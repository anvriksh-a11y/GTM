import os
import certifi

# Fix for macOS SSL Certificate errors - MUST be before other imports
os.environ['SSL_CERT_FILE'] = certifi.where()

import logging
import json
import inspect
import aiohttp
from dotenv import load_dotenv

# Compatibility patch for aiohttp versions (< 3.11) where ClientSession.__init__ does not accept 'proxy'
try:
    if "proxy" not in inspect.signature(aiohttp.ClientSession.__init__).parameters:
        _orig_client_session_init = aiohttp.ClientSession.__init__
        def _patched_client_session_init(self, *args, **kwargs):
            kwargs.pop("proxy", None)
            return _orig_client_session_init(self, *args, **kwargs)
        aiohttp.ClientSession.__init__ = _patched_client_session_init
except Exception:
    pass

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


AARAV_VOICE_ID = "39d518b7-fd0b-4676-9b8b-29d64ff31e12"

def _build_tts(
    config_provider: str = None,
    config_voice: str = None,
    language: str = "hi",
    accent: str = "auto",
    speed: float = None,
    emotion: list = None,
):
    """
    Configures Text-to-Speech:
    Enforces Cartesia Sonic-3 with Aarav Voice ID (39d518b7-fd0b-4676-9b8b-29d64ff31e12).
    Pitch, prosody, and emotional intonation are driven dynamically by the text transcript.
    """
    model = os.getenv("CARTESIA_TTS_MODEL", getattr(config, "CARTESIA_MODEL", "sonic-3"))
    
    # Strictly enforce Cartesia Aarav voice ID
    voice = AARAV_VOICE_ID
    if config_voice and len(config_voice.strip()) >= 32 and "-" in config_voice:
        voice = config_voice.strip()

    tts_speed = speed if speed is not None else float(getattr(config, "CARTESIA_SPEED", 0.88))
    tts_lang = "hi" if (not language or language.lower().startswith("hi") or (accent and accent.lower() in ["in", "indian", "auto"])) else "en"

    logger.info("=" * 65)
    logger.info(f"🔊 [VOICE AGENT TTS] Engine: Cartesia {model}")
    logger.info(f"🎙️ [VOICE AGENT TTS] Voice: Aarav ({voice})")
    logger.info(f"⚡ [VOICE AGENT TTS] Language: {tts_lang} | Speed: {tts_speed}x | Dynamic Prosody: Active")
    logger.info("=" * 65)

    tts_kwargs = {
        "model": model,
        "voice": voice,
        "language": tts_lang,
        "speed": float(tts_speed),
    }
    # Dynamic emotion: only applied if explicitly requested, otherwise driven naturally by the user's transcript
    if emotion:
        tts_kwargs["emotion"] = emotion

    return cartesia.TTS(**tts_kwargs)



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

    @llm.function_tool(description="Immediately end and hang up the phone call after concluding the conversation, saying goodbye, or if the user asks to hang up.")
    async def end_call(self):
        """
        Immediately hang up and terminate the phone call.
        """
        logger.info("🛑 [VOICE AGENT TOOL] 'end_call' invoked. Hanging up call...")
        asyncio.create_task(_trigger_call_hangup(self.ctx, delay=2.5))
        return "Call is disconnecting now. Goodbye."


_hangup_triggered = False

def resolve_template_placeholders(text: str, name: str = None) -> str:
    """
    Replaces all template placeholders like {Patient Name}, {Lead Name}, {Name}, etc.
    with the actual person's name or a natural address.
    Also strips out any prompt engineering instructions/notes that shouldn't be spoken out loud.
    """
    if not text:
        return ""
    import re
    resolved_name = (name or "").strip()
    if resolved_name in ["Test Preview User", "Test Prospect", "Test User", ""]:
        resolved_name = "Raj"
    name_patterns = [
        r"\{[Pp]atient[_\s]?[Nn]ame\}",
        r"\{[Ll]ead[_\s]?[Nn]ame\}",
        r"\{[Cc]ustomer[_\s]?[Nn]ame\}",
        r"\{[Cc]ontact[_\s]?[Nn]ame\}",
        r"\{[Uu]ser[_\s]?[Nn]ame\}",
        r"\{[Ff]irst[_\s]?[Nn]ame\}",
        r"\{[Nn]ame\}",
        r"\{[Pp]atient\}",
        r"\{[Ll]ead\}",
    ]
    result = text
    for pat in name_patterns:
        result = re.sub(pat, resolved_name, result)
    # Strip any meta instructions like 'Notice that {Patient Name} was spoken literally...'
    result = re.sub(r"(?i)notice that.*?before starting the conversation\.?", "", result)
    # Strip any remaining unreplaced {variable} patterns so raw brackets are never spoken literally
    result = re.sub(r"\{[A-Za-z0-9_\s]+\}", resolved_name, result)
    return result.strip()


def _is_farewell_message(text: str) -> bool:
    """Detects whether a speech turn is a farewell, goodbye, thank you, or call conclusion."""
    if not text:
        return False
    import re
    lower = text.lower()
    eng_patterns = (
        r"\b(goodbye|good bye|bye bye|bye-bye|bye|have a (great|good|nice|wonderful) day|"
        r"take care|talk soon|have a good one|thank you|thanks|thanks for (your|the) time|"
        r"thank you for (your|the) time|that's all|that is all|nothing else|hang up|disconnect|cut the call)\b"
    )
    if re.search(eng_patterns, lower):
        return True
    hindi_keywords = [
        "अलविदा", "बाय", "बाय-बाय", "बाय बाय", "फिर मिलेंगे", "अच्छा बाय", "ओके बाय", "चल बाय",
        "धन्यवाद", "शुक्रिया", "थैंक यू", "थैंक्स", "कॉल कट", "फोन रख", "रखता हूँ", "रखती हूँ"
    ]
    return any(k in lower for k in hindi_keywords)


async def _trigger_call_hangup(ctx: agents.JobContext, delay: float = 2.0, before_hangup_fn = None):
    """
    Terminates the LiveKit SIP call cleanly after allowing the final farewell speech audio to complete.
    Sends SIP BYE directly to the telephone carrier trunk and deletes the room.
    """
    global _hangup_triggered
    if _hangup_triggered:
        return
    _hangup_triggered = True

    logger.info("=" * 65)
    logger.info(f"🛑 [VOICE AGENT HANGUP] Farewell concluded. Ending call in {delay}s...")
    logger.info("=" * 65)

    await asyncio.sleep(delay)

    # Save final call logs to MongoDB before deleting the room
    if before_hangup_fn:
        try:
            if asyncio.iscoroutinefunction(before_hangup_fn):
                await before_hangup_fn()
            else:
                before_hangup_fn()
        except Exception as e:
            logger.warning(f"before_hangup_fn error: {e}")

    logger.info(f"📞 [VOICE AGENT] Cutting call now for room {ctx.room.name}!")

    # 1. Remove all remote participants (sends SIP BYE to phone carrier immediately)
    for p in list(ctx.room.remote_participants.values()):
        try:
            logger.info(f"📞 Sending SIP BYE to disconnect participant: {p.identity}")
            await ctx.api.room.remove_participant(
                api.RoomParticipantIdentity(room=ctx.room.name, identity=p.identity)
            )
        except Exception as err:
            logger.warning(f"Error removing participant {p.identity}: {err}")

    # 2. Delete the room completely from LiveKit
    try:
        await ctx.api.room.delete_room(
            api.DeleteRoomRequest(room=ctx.room.name)
        )
        logger.info(f"✅ Room {ctx.room.name} deleted successfully.")
    except Exception as err:
        logger.warning(f"Error deleting room {ctx.room.name}: {err}")

    # 3. Disconnect local agent and shutdown job
    try:
        await ctx.room.disconnect()
    except Exception:
        pass
    ctx.shutdown()


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
    call_connected = False
    import time
    call_start_time = time.time()

    # Clean and resolve any {Patient Name}, {Lead Name}, {Name} template placeholders before starting
    resolved_contact_name = lead_name or config_dict.get("patient_name") or config_dict.get("lead_name")
    raw_prompt = config_dict.get("system_prompt") or config_dict.get("prompt") or config.SYSTEM_PROMPT
    system_prompt = resolve_template_placeholders(raw_prompt, resolved_contact_name)
    if lead_name:
        system_prompt = f"The person you are calling is {lead_name}.\n\n" + system_prompt

    raw_greeting = config_dict.get("first_message") or config.INITIAL_GREETING
    initial_greeting = resolve_template_placeholders(raw_greeting, resolved_contact_name)
    fallback_greeting = initial_greeting

    global _hangup_triggered
    _hangup_triggered = False

    # Dynamic human speech prosody & pitch inflection guidelines:
    # Adapts automatically to ANY user prompt/persona (sales, support, casual, formal) without fixed emotions
    speech_prosody_directive = """
# SPEECH PROSODY & CRITICAL CALL INSTRUCTIONS (MANDATORY):
1. LIVE SPOKEN DIALOGUE ONLY: You are on a real telephone call with a real human being. NEVER read prompt engineering instructions, template notes, code, bracketed text, or meta guidance out loud to the caller. ONLY speak natural conversational dialogue directly to the person.
2. DYNAMIC PITCH & INTONATION: Never speak in a flat, monotone, or robotic manner. Modulate your pitch dynamically to fit your specific role:
   - High Pitch / Energy: Use '!' on enthusiastic greetings, key highlights, or warm affirmations.
   - Rising Question Pitch: Always end questions with '?' so your pitch lifts naturally at the end of clauses.
   - Low Pitch & Thoughtful Pauses: Use '...' or commas (',') for natural breath pauses and calm transitions.
3. CONTEXTUAL WARMTH & LAUGHTER:
   - If the user's scenario or flow is casual, humorous, or friendly: weave in subtle natural chuckles ("हाहा", "haha") and conversational warmth where it feels authentic.
   - If the user's scenario is formal, medical, business, or serious: maintain a confident, polite, and warmly modulated human tone without forced laughter.
4. HANGING UP IMMEDIATELY AFTER FAREWELL (CRITICAL):
   - When the caller says "thank you", "thanks", "bye", "goodbye", "that's all", or when the conversation concludes:
     Say a brief, polite farewell (e.g. "Thank you so much! Have a wonderful day, goodbye!" or "चल ठीक है भाई, अपना ध्यान रखना! बाय!") and call the 'end_call' function immediately to hang up the phone.
"""
    system_prompt = system_prompt + "\n\n" + speech_prosody_directive

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
            emotion=config_dict.get("emotion"),
        ),
    )

    # Register real-time dialogue and speech telemetry listeners
    @session.on("user_state_changed")
    def _on_user_state(ev):
        logger.info(f"🎤 [VOICE AGENT] Caller is now: {getattr(ev, 'new_state', ev)}")

    @session.on("agent_state_changed")
    def _on_agent_state(ev):
        logger.info(f"🤖 [VOICE AGENT] AI Agent is now: {getattr(ev, 'new_state', ev)}")

    @session.on("user_input_transcribed")
    def _on_transcribed(ev):
        transcript = getattr(ev, "transcript", "")
        if transcript:
            logger.info(f"🗣️ [CALLER SAID]: '{transcript}'")

    _user_said_bye = False
    live_transcript_lines = []
    saved_once = False

    @session.on("conversation_item_added")
    def _on_item_added(ev):
        nonlocal _user_said_bye
        item = getattr(ev, "item", None)
        if item:
            role = getattr(item, "role", "")
            content = getattr(item, "text", "") or getattr(item, "content", "")
            logger.info(f"💬 [CONVERSATION] {role.upper()}: {content}")

            if content:
                speaker_tag = (lead_name or "Prospect") if role in ("user", "prospect") else "Agent"
                live_transcript_lines.append(f"{speaker_tag}: {content.strip()}")

            # If the user says goodbye or thank you, record it so the assistant's response triggers hangup
            if role == "user" and content and _is_farewell_message(content):
                logger.info(f"🛑 [VOICE AGENT] User initiated farewell: '{content}'")
                _user_said_bye = True

            # Auto-hangup when assistant speaks a farewell / goodbye / thank you closing, or replies to user's bye
            if role == "assistant" and content:
                if _user_said_bye or _is_farewell_message(content):
                    logger.info(f"🛑 [VOICE AGENT] Farewell detected in speech ('{content}'). Cutting call on the spot...")
                    asyncio.create_task(_trigger_call_hangup(ctx, delay=2.5, before_hangup_fn=save_call_completion))

    @session.on("error")
    def _on_session_error(ev):
        logger.error(f"❌ [VOICE AGENT ERROR]: {ev}")

    # Start the session
    await session.start(
        room=ctx.room,
        agent=OutboundAssistant(tools=list(fnc_ctx.function_tools.values()), instructions=system_prompt),
    )

    # Transcript & Analysis Collector on Call Hangup / Disconnect
    async def save_call_completion():
        nonlocal saved_once
        if saved_once:
            return
        saved_once = True
        try:
            import datetime
            import time
            import sys
            backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
            if backend_path not in sys.path:
                sys.path.insert(0, backend_path)

            # 1. Primary: Use real-time live transcript turns collected during the call
            transcript_lines = list(live_transcript_lines)

            # 2. Fallback: inspect session history or chat context if live list was empty
            if not transcript_lines:
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
                            speaker = (lead_name or "Prospect") if role_str in ("user", "prospect") else "Agent"
                            transcript_lines.append(f"{speaker}: {content_str}")

            transcript_str = "\n".join(transcript_lines)
            duration = int(time.time() - call_start_time) if call_start_time else 0
            
            # Accurate status: answered/completed if dialogue occurred or confirmed answered connection >= 3s
            if transcript_lines or (call_connected and duration >= 3):
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

            # Update call log in MongoDB database
            try:
                from database import update_call_log, connect_to_mongo
                connect_to_mongo()

                update_dict = {
                    "status": final_status,
                    "duration": duration,
                    "transcript": transcript_str,
                    "summary": analysis.get("summary", "Test call completed successfully."),
                    "checklist": analysis.get("checklist", []),
                    "sentiment": analysis.get("sentiment", "Positive"),
                    "updated_at": datetime.datetime.utcnow(),
                }
                res = await update_call_log(ctx.room.name, update_dict)
                logger.info(f"✅ Successfully updated MongoDB call log for {ctx.room.name}: status={final_status}, duration={duration}s, turns={len(transcript_lines)}, result={res}")
            except Exception as db_err:
                logger.error(f"Could not update MongoDB call log: {db_err}")
        except Exception as e:
            logger.error(f"Error in save_call_completion: {e}")

    ctx.add_shutdown_callback(save_call_completion)

    @ctx.room.on("participant_disconnected")
    def _on_participant_disconnected(p):
        logger.info(f"📞 Remote participant {p.identity} disconnected from room. Saving completion...")
        asyncio.create_task(save_call_completion())



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
            call_start_time = time.time()
            try:
                from database import update_call_log, connect_to_mongo
                connect_to_mongo()
                await update_call_log(ctx.room.name, {"status": "in-progress", "updated_at": datetime.datetime.utcnow()})
            except Exception as ex:
                logger.warning(f"Could not update in-progress status: {ex}")
            
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
                call_start_time = time.time()
                try:
                    from database import update_call_log, connect_to_mongo
                    connect_to_mongo()
                    await update_call_log(ctx.room.name, {"status": "in-progress", "updated_at": datetime.datetime.utcnow()})
                except Exception as ex:
                    logger.warning(f"Could not update in-progress status: {ex}")
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
        logger.info(f"⏳ [VOICE AGENT] Room {ctx.room.name}: Waiting for lead ({phone_number}) to answer phone...")
        try:
            participant = await asyncio.wait_for(ctx.wait_for_participant(), timeout=60.0)
            call_connected = True
            call_start_time = time.time()
            try:
                from database import update_call_log, connect_to_mongo
                connect_to_mongo()
                await update_call_log(ctx.room.name, {"status": "in-progress", "updated_at": datetime.datetime.utcnow()})
            except Exception as ex:
                logger.warning(f"Could not update in-progress status: {ex}")
            logger.info("=" * 65)
            logger.info(f"🎉 [VOICE AGENT] PHONE ANSWERED! Connected to {participant.identity}")
            logger.info(f"🔊 [VOICE AGENT] Speaking Opening Greeting: '{initial_greeting}'")
            logger.info("=" * 65)
            try:
                await session.say(initial_greeting)
                logger.info("✅ [VOICE AGENT] Opening greeting audio delivered successfully.")
            except Exception as say_err:
                logger.warning(f"session.say notice ({say_err}), fallback to generate_reply...")
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
