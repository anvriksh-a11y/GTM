import os
import certifi

# Fix for macOS SSL Certificate errors - MUST be before other imports
os.environ['SSL_CERT_FILE'] = certifi.where()

import logging
import json
from dotenv import load_dotenv

from livekit import agents, api
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import (
    openai,
    cartesia,
    deepgram,
    noise_cancellation,
    silero,
)
try:
    from livekit.plugins import sarvam
except ImportError:
    sarvam = None

from livekit.agents import llm
from typing import Annotated, Optional

# Load environment variables (supports running from root or backend or voice_agent directory)
load_dotenv(".env")
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("outbound-agent")

try:
    import config
except ImportError:
    from voice_agent import config


# TRUNK ID - Now loaded from config.py
# You can find this by running 'python setup_trunk.py --list' or checking LiveKit Dashboard 


# Curated Voice Presets: Cartesia Sonic-3 with user's configured Hindi voice and speed
VOICE_PRESETS = {
    "hi": {
        "provider": "cartesia",
        "voice": getattr(config, "CARTESIA_VOICE", "39d518b7-fd0b-4676-9b8b-29d64ff31e12"),
        "speed": getattr(config, "CARTESIA_SPEED", 0.85),
        "stt_lang": "hi",
    },
    "en": {
        "provider": "cartesia",
        "voice": "248be419-c632-4f23-add1-07c49495163f", # US English Natural
        "speed": 1.0,
        "stt_lang": "en",
    },
    "en-US": {
        "provider": "cartesia",
        "voice": "248be419-c632-4f23-add1-07c49495163f",
        "speed": 1.0,
        "stt_lang": "en",
    }
}


def _build_tts(config_provider: str = None, config_voice: str = None, language: str = "hi", accent: str = "auto", speed: float = None):
    """
    Configures Text-to-Speech per config.py:
    - Hindi: Uses Cartesia Sonic-3 with Voice ID 39d518b7-fd0b-4676-9b8b-29d64ff31e12 and Speed 0.85
    - US Accent: Uses Cartesia Sonic-3 with Voice ID 248be419-c632-4f23-add1-07c49495163f and Speed 1.0
    """
    lang = (language or "hi").lower().split("-")[0]
    acc = (accent or "").lower()

    provider = (config_provider or os.getenv("TTS_PROVIDER", config.DEFAULT_TTS_PROVIDER)).lower()

    if provider == "cartesia":
        model = os.getenv("CARTESIA_TTS_MODEL", config.CARTESIA_MODEL)
        if lang == "hi" or acc in ["in", "indian"]:
            voice = config_voice or getattr(config, "CARTESIA_VOICE", "39d518b7-fd0b-4676-9b8b-29d64ff31e12")
            tts_speed = speed if speed is not None else float(getattr(config, "CARTESIA_SPEED", 0.85))
            tts_lang = "hi"
        else:
            voice = config_voice or "248be419-c632-4f23-add1-07c49495163f"
            tts_speed = speed if speed is not None else 1.0
            tts_lang = "en"

        logger.info(f"Using Cartesia TTS (Model: {model}, Lang: {tts_lang}, Voice: {voice}, Speed: {tts_speed})")
        return cartesia.TTS(model=model, voice=voice, language=tts_lang, speed=float(tts_speed))

    if provider == "sarvam" and sarvam is not None:
        voice = config_voice or "karun"
        logger.info(f"Using Sarvam TTS for Indian Voice: {voice}")
        model = os.getenv("SARVAM_TTS_MODEL", config.SARVAM_MODEL)
        return sarvam.TTS(model=model, speaker=voice, target_language_code="hi-IN")

    if provider == "deepgram":
        logger.info(f"Using Deepgram TTS (US English Aura)")
        model = config_voice or os.getenv("DEEPGRAM_TTS_MODEL", "aura-asteria-en")
        return deepgram.TTS(model=model)

    # Fallback to OpenAI
    model = os.getenv("OPENAI_TTS_MODEL", "tts-1")
    voice = config_voice or "alloy"
    if voice not in ["nova", "shimmer", "echo", "onyx", "fable", "alloy", "ash", "sage", "coral"]:
        voice = "alloy"
    logger.info(f"Using OpenAI TTS (Voice: {voice})")
    return openai.TTS(model=model, voice=voice)



def _build_llm(config_provider: str = None):
    """Configure the LLM provider based on config or env vars."""
    provider = (config_provider or os.getenv("LLM_PROVIDER", config.DEFAULT_LLM_PROVIDER)).lower()

    if provider == "groq":
        logger.info("Using Groq LLM")
        return openai.LLM(
            base_url="https://api.groq.com/openai/v1",
            api_key=os.getenv("GROQ_API_KEY"),
            model=os.getenv("GROQ_MODEL", config.GROQ_MODEL),
            temperature=float(os.getenv("GROQ_TEMPERATURE", str(config.GROQ_TEMPERATURE))),
        )
    
    # Default to OpenAI
    logger.info("Using OpenAI LLM")
    return openai.LLM(model=config.DEFAULT_LLM_MODEL)



class TransferFunctions(llm.ToolContext):
    def __init__(self, ctx: agents.JobContext, phone_number: str = None):
        super().__init__(tools=[])
        self.ctx = ctx
        self.phone_number = phone_number

    @llm.function_tool(description="Look up user details by phone number.")
    async def lookup_user(self, phone: str):
        """
        Mock function to look up user details.

        Args:
            phone: The phone number to look up
        """
        logger.info(f"Looking up user: {phone}")
        return f"User found: Shreyas Raj. Status: Premium. Last order: Coffee setup (Delivered)."

    @llm.function_tool(description="Transfer the call to a human support agent or another phone number.")
    async def transfer_call(self, destination: Optional[str] = None):
        """
        Transfer the call.
        """
        if destination is None:
            destination = config.DEFAULT_TRANSFER_NUMBER
            if not destination:
                 return "Error: No default transfer number configured."
        if "@" not in destination:
            # If no domain is provided, append the SIP domain
            if config.SIP_DOMAIN:
                # Ensure clean number (strip tel: or sip: prefix if present but no domain)
                clean_dest = destination.replace("tel:", "").replace("sip:", "")
                destination = f"sip:{clean_dest}@{config.SIP_DOMAIN}"
            else:
                # Fallback to tel URI if no domain configured
                if not destination.startswith("tel:") and not destination.startswith("sip:"):
                     destination = f"tel:{destination}"
        elif not destination.startswith("sip:"):
             destination = f"sip:{destination}"
        
        logger.info(f"Transferring call to {destination}")
        
        # Determine the participant identity
        # For outbound calls initiated by this agent, the participant identity is typically "sip_<phone_number>"
        # For inbound, we might need to find the remote participant.
        participant_identity = None
        
        # If we stored the phone number from metadata, we can construct the identity
        if self.phone_number:
            participant_identity = f"sip_{self.phone_number}"
        else:
            # Try to find a participant that is NOT the agent
            for p in self.ctx.room.remote_participants.values():
                participant_identity = p.identity
                break
        
        if not participant_identity:
            logger.error("Could not determine participant identity for transfer")
            return "Failed to transfer: could not identify the caller."

        try:
            logger.info(f"Transferring participant {participant_identity} to {destination}")
            await self.ctx.api.sip.transfer_sip_participant(
                api.TransferSIPParticipantRequest(
                    room_name=self.ctx.room.name,
                    participant_identity=participant_identity,
                    transfer_to=destination,
                    play_dialtone=False
                )
            )
            return "Transfer initiated successfully."
        except Exception as e:
            logger.error(f"Transfer failed: {e}")
            return f"Error executing transfer: {e}"


class OutboundAssistant(Agent):
    """
    An AI agent tailored for outbound calls.
    Attempts to be helpful and concise.
    """
    def __init__(self, tools: list, instructions: str = None) -> None:
        super().__init__(
            instructions=instructions or config.SYSTEM_PROMPT,
            tools=tools,
        )




async def entrypoint(ctx: agents.JobContext):
    """
    Main entrypoint for the agent.
    
    For outbound calls:
    1. Checks for 'phone_number' in the job metadata.
    2. Connects to the room.
    3. Initiates the SIP call to the phone number.
    4. Waits for answer before speaking.
    """
    logger.info(f"Connecting to room: {ctx.room.name}")
    
    # parse the phone number AND config from the metadata
    phone_number = None
    config_dict = {}
    
    # Check Job Metadata (Legacy/Dispatch)
    try:
        if ctx.job.metadata:
            data = json.loads(ctx.job.metadata)
            phone_number = data.get("phone_number")
            config_dict = data
    except Exception:
        pass
        
    # Check Room Metadata (Dashboard/Route.ts) - Overrides Job Metadata if present
    try:
        if ctx.room.metadata:
            data = json.loads(ctx.room.metadata)
            if data.get("phone_number"):
                phone_number = data.get("phone_number")
            config_dict.update(data) # Merge configs
    except Exception:
        logger.warning("No valid JSON metadata found in Room.")

    # Extract dynamic campaign instructions or fallback to config defaults
    lead_name = config_dict.get("lead_name", "")
    call_start_time = None
    call_connected = False
    import datetime
    call_start_time = datetime.datetime.utcnow()

    system_prompt = config_dict.get("system_prompt") or config_dict.get("prompt") or config.SYSTEM_PROMPT
    if lead_name:
        system_prompt = f"The person you are calling is {lead_name}.\n\n" + system_prompt
    initial_greeting = config_dict.get("first_message") or config.INITIAL_GREETING
    fallback_greeting = config_dict.get("first_message") or getattr(config, "fallback_greeting", config.INITIAL_GREETING)

    # Initialize function context
    fnc_ctx = TransferFunctions(ctx, phone_number)

    # Detect language & accent: explicit campaign metadata or content analysis
    call_language = config_dict.get("language")
    call_accent = config_dict.get("accent")

    if not call_language or call_language == "auto":
        is_hindi = (
            any("\u0900" <= c <= "\u097F" for c in system_prompt)
            or any(w in system_prompt.lower() for w in ["namaste", "namaskar", "aapka", "kripya", "kaise", "dhanyawad", "hindi", "bhai", "haan", "dost"])
            or (phone_number and (str(phone_number).startswith("+91") or str(phone_number).startswith("91")))
        )
        call_language = "hi" if is_hindi else "en"

    if not call_accent or call_accent == "auto":
        call_accent = "in" if (call_language == "hi" or (phone_number and (str(phone_number).startswith("+91") or str(phone_number).startswith("91")))) else "us"

    stt_language = "hi" if call_language.startswith("hi") else ("en-IN" if call_accent in ["in", "indian"] else "en")

    # Initialize the Agent Session with plugins
    vad_model = getattr(getattr(ctx, "proc", None), "userdata", {}).get("vad") if hasattr(ctx, "proc") else None
    if vad_model is None:
        vad_model = silero.VAD.load()

    session = AgentSession(
        vad=vad_model,
        stt=deepgram.STT(model=config.STT_MODEL, language=stt_language), 
        llm=_build_llm(config_dict.get("model_provider")),
        tts=_build_tts(
            config_provider=config_dict.get("tts_provider") or config_dict.get("model_provider"),
            config_voice=config_dict.get("voice_id"),
            language=call_language,
            accent=call_accent,
            speed=config_dict.get("speed"),
        ),
    )


    # Start the session
    await session.start(
        room=ctx.room,
        agent=OutboundAssistant(tools=list(fnc_ctx.function_tools.values()), instructions=system_prompt),
    )

    # Transcript & Analysis Collector on Call Hangup / Disconnect
    async def save_call_completion():
        try:
            import datetime
            import sys
            backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
            if backend_path not in sys.path:
                sys.path.insert(0, backend_path)

            transcript_lines = []

            # 1. Primary: read session history (ChatContext or messages list)
            raw_history = None
            if hasattr(session, "history"):
                try:
                    raw_history = session.history() if callable(session.history) else session.history
                except Exception as h_call_err:
                    logger.debug(f"session.history access error: {h_call_err}")

            messages = []
            if raw_history is not None:
                if hasattr(raw_history, "messages"):
                    msg_attr = getattr(raw_history, "messages")
                    messages = msg_attr() if callable(msg_attr) else msg_attr
                elif isinstance(raw_history, list):
                    messages = raw_history

            # Check alternative session context containers if empty
            if not messages:
                ctx_obj = getattr(session, "chat_ctx", None) or getattr(session, "_chat_ctx", None)
                if ctx_obj and hasattr(ctx_obj, "messages"):
                    msg_attr = getattr(ctx_obj, "messages")
                    messages = msg_attr() if callable(msg_attr) else msg_attr

            if messages:
                for msg in messages:
                    role = getattr(msg, "role", "user")
                    role_str = str(role).lower()
                    if role_str in ("system", "developer"):
                        continue
                    content = getattr(msg, "content", "") or getattr(msg, "text", "")
                    if isinstance(content, list):
                        parts = []
                        for p in content:
                            if isinstance(p, str):
                                parts.append(p)
                            elif hasattr(p, "text"):
                                parts.append(str(p.text))
                        content = " ".join(parts)
                    content_str = str(content or "").strip()
                    if content_str:
                        speaker = lead_name if (role_str in ("user", "prospect") and lead_name) else ("Prospect" if role_str in ("user", "prospect") else "Agent (नरेश)")
                        transcript_lines.append(f"{speaker}: {content_str}")

            # 2. Fallback: conversation item_list
            if not transcript_lines and hasattr(session, "conversation") and hasattr(session.conversation, "item_list"):
                try:
                    conv_items = session.conversation.item_list() if callable(session.conversation.item_list) else session.conversation.item_list
                    for item in (conv_items or []):
                        role = getattr(item, "role", "user")
                        role_str = str(role).lower()
                        if role_str in ("system", "developer"):
                            continue
                        text = getattr(item, "text", "") or getattr(item, "content", "")
                        if text:
                            speaker = lead_name if (role_str in ("user", "prospect") and lead_name) else ("Prospect" if role_str in ("user", "prospect") else "Agent (नरेश)")
                            transcript_lines.append(f"{speaker}: {str(text).strip()}")
                except Exception as c_err:
                    logger.debug(f"conversation item_list access error: {c_err}")

            transcript_str = "\n".join(transcript_lines)
            duration = int((datetime.datetime.utcnow() - call_start_time).total_seconds()) if call_start_time else 0
            
            # Accurate status: answered/completed if dialogue occurred or confirmed answered connection >= 4s
            if transcript_lines or (call_connected and duration >= 4):
                final_status = "completed"
            else:
                final_status = "failed"

            logger.info(f"Room {ctx.room.name} ended ({final_status}, duration: {duration}s). Captured {len(transcript_lines)} turns.")

            analysis = {}
            if transcript_str:
                try:
                    from services.livekit_service import process_call_transcript
                    analysis = await process_call_transcript(transcript_str)
                except Exception as ex:
                    logger.warning(f"Could not process transcript with LLM: {ex}")

            # Update call log in database
            try:
                from database import update_call_log

                update_dict = {
                    "status": final_status,
                    "duration": duration,
                    "transcript": transcript_str,
                    "summary": analysis.get("summary", ""),
                    "checklist": analysis.get("checklist", []),
                    "sentiment": analysis.get("sentiment", "Neutral"),
                    "updated_at": datetime.datetime.utcnow(),
                }
                await update_call_log(ctx.room.name, update_dict)
                logger.info(f"Successfully updated MongoDB call log with transcript, status ({final_status}) and summary for {ctx.room.name}")
            except Exception as db_err:
                logger.warning(f"Could not update MongoDB: {db_err}")
        except Exception as e:
            logger.error(f"Error in save_call_completion: {e}")

    ctx.add_shutdown_callback(save_call_completion)



    # Logic to dial out:
    # 1. If 'phone_number' is present, we MIGHT need to dial.
    # 2. Check if a SIP participant is already in the room or already dispatched by backend.
    sip_dispatched_by_backend = bool(config_dict.get("sip_dispatched"))
    should_dial = False
    
    if phone_number and not sip_dispatched_by_backend:
        user_already_here = False
        for p in ctx.room.remote_participants.values():
            if f"sip_{phone_number}" in p.identity or "sip_" in p.identity:
                user_already_here = True
                break
        
        if not user_already_here:
            should_dial = True
            logger.info("User not in room and not pre-dispatched. Agent will initiate dial-out.")
        else:
            logger.info("User already in room. Outputting greeting.")
    else:
        logger.info(f"SIP dial already dispatched by backend (sip_dispatched={sip_dispatched_by_backend}). Waiting for participant to answer...")

    if should_dial:
        logger.info(f"Initiating outbound SIP call to {phone_number}...")
        try:
            # Create a SIP participant to dial out
            # Uses user's configured trunk and caller ID from metadata (Vobiz or Twilio)
            target_trunk_id = config_dict.get("sip_trunk_id") or config.SIP_TRUNK_ID
            caller_id = config_dict.get("caller_id") or getattr(config, "VOBIZ_OUTBOUND_NUMBER", None)

            sip_kwargs = {
                "room_name": ctx.room.name,
                "sip_trunk_id": target_trunk_id,
                "sip_call_to": phone_number,
                "participant_identity": f"sip_{phone_number}",
                "wait_until_answered": True,
            }
            if caller_id:
                sip_kwargs["sip_number"] = caller_id

            await ctx.api.sip.create_sip_participant(
                api.CreateSIPParticipantRequest(**sip_kwargs)
            )
            logger.info(f"Call answered via trunk {target_trunk_id} (Caller ID: {caller_id})! Agent is now listening.")
            call_connected = True
            import datetime
            call_start_time = datetime.datetime.now(datetime.UTC)
            
            # Speak greeting immediately using TTS
            logger.info(f"Delivering initial greeting via TTS: {initial_greeting}")
            try:
                await session.say(initial_greeting)
            except Exception as say_err:
                logger.warning(f"session.say error ({say_err}), falling back to generate_reply...")
                await session.generate_reply(instructions=initial_greeting)
            
        except Exception as e:
            logger.warning(f"Outbound dial attempt notice ({e}). Checking if participant answers...")
            try:
                participant = await asyncio.wait_for(ctx.wait_for_participant(), timeout=45.0)
                call_connected = True
                call_start_time = datetime.datetime.now(datetime.UTC)
                logger.info(f"Participant joined/answered: {participant.identity}. Delivering greeting...")
                try:
                    await session.say(initial_greeting)
                except Exception as say_err:
                    await session.generate_reply(instructions=initial_greeting)
            except Exception as wait_err:
                logger.error(f"Failed to place outbound call and participant did not answer: {wait_err}")
                call_connected = False
                ctx.shutdown()
    else:
        # User is already joining/joined via SIP trunk dispatched by backend
        logger.info("SIP participant dispatched by backend. Waiting for participant to answer...")
        try:
            participant = await asyncio.wait_for(ctx.wait_for_participant(), timeout=60.0)
            call_connected = True
            import datetime
            call_start_time = datetime.datetime.now(datetime.UTC)
            logger.info(f"Participant joined/answered: {participant.identity}. Delivering initial greeting via TTS...")
            try:
                await session.say(initial_greeting)
            except Exception as say_err:
                logger.warning(f"session.say error ({say_err}), fallback to generate_reply...")
                await session.generate_reply(instructions=initial_greeting)
        except Exception as e:
            logger.warning(f"wait_for_participant notice ({e}). Delivering fallback greeting...")
            try:
                await session.say(fallback_greeting)
            except Exception as say_err:
                await session.generate_reply(instructions=fallback_greeting)



def prewarm(proc: agents.JobProcess):
    """Pre-load VAD model at worker boot to eliminate cold-start speech delay."""
    proc.userdata["vad"] = silero.VAD.load()


if __name__ == "__main__":
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            agent_name="outbound-caller",
            num_idle_processes=0,
            initialize_process_timeout=30.0,
        )
    )
