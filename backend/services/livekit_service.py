"""
LiveKit Voice Calling Service — Replaces VAPI.

Dispatches outbound calls via LiveKit Cloud and Vobiz SIP Trunking,
with Groq Llama 3.1 LLM, Deepgram STT, and Cartesia/Sarvam TTS.
"""

import os
import certifi
os.environ['SSL_CERT_FILE'] = certifi.where()

import json
import random
import logging
import asyncio
from typing import Optional, Tuple, Dict, Any
from livekit import api
from openai import AsyncOpenAI
from config import settings

logger = logging.getLogger(__name__)


def _get_livekit_api() -> api.LiveKitAPI:
    """Initializes the LiveKit Server API client."""
    return api.LiveKitAPI(
        url=settings.LIVEKIT_URL,
        api_key=settings.LIVEKIT_API_KEY,
        api_secret=settings.LIVEKIT_API_SECRET,
    )


def normalize_phone_number(phone: str) -> str:
    """Ensures phone number has a leading '+' and country code (defaults to India +91)."""
    phone = phone.strip()
    if phone.startswith("+"):
        return phone
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) == 10:
        return f"+91{digits}"
    return f"+{digits}"


async def refine_voice_prompt(
    raw_prompt: str,
    product_name: str = "",
    target_customer: str = "",
    call_to_action: str = "",
) -> str:
    """
    Refines a rough user prompt into a high-converting voice agent script
    using OpenAI or Groq with automatic fallback.
    """
    groq_key = settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY")
    openai_key = settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY")
    pref_provider = (os.getenv("LLM_PROVIDER") or "openai").lower()

    clients_to_try = []

    # Prioritize OpenAI if LLM_PROVIDER is openai or as default
    if pref_provider == "openai" and openai_key:
        clients_to_try.append((AsyncOpenAI(api_key=openai_key), "gpt-4o-mini"))
    if groq_key:
        groq_model = "openai/gpt-oss-120b" if settings.GROQ_MODEL in ("llama-3.1-8b-instant", "") else (settings.GROQ_MODEL or "openai/gpt-oss-120b")
        clients_to_try.append((AsyncOpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1"), groq_model))
    if pref_provider != "openai" and openai_key:
        clients_to_try.append((AsyncOpenAI(api_key=openai_key), "gpt-4o-mini"))

    if not clients_to_try:
        logger.warning("No LLM key configured for prompt refinement. Returning raw prompt.")
        return raw_prompt

    system_prompt = """You are an expert AI voice agent prompt engineer.
Convert the user's rough description into a concise, professional system prompt for an outbound phone AI.
Include: role, conversation goals, natural pauses, polite objection handling, and call-to-action.
Keep the prompt under 500 words. Output ONLY the polished prompt text."""

    user_msg = f"""User input: {raw_prompt}
Product: {product_name or 'N/A'}
Target Audience: {target_customer or 'N/A'}
CTA: {call_to_action or 'Book a consultation/demo'}"""

    for client, model in clients_to_try:
        try:
            completion = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.4,
                max_tokens=1024,
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"Refinement with model {model} failed ({e}), trying next fallback...")

    logger.error("All LLM providers failed for voice prompt refinement. Returning raw prompt.")
    return raw_prompt


async def dispatch_livekit_call(
    phone: str,
    lead_name: str,
    system_prompt: str,
    first_message: str = "",
    user_id: str = "",
    campaign_id: str = "",
    language: str = "auto",
    accent: str = "auto",
    tts_provider: str = "",
    tts_voice: str = "",
    telephony_provider: str = "auto",
) -> Tuple[Optional[str], str]:
    """
    Dispatches a LiveKit agent to a newly generated room and dials out
    to the lead via the user's configured telephony provider (Vobiz for India, Twilio/SIP for International).
    Dynamically routes to Sarvam AI for Hindi/Indian accents and Cartesia for US accents.
    Returns (room_name, "queued" | "failed").
    """
    from database import db
    normalized_phone = normalize_phone_number(phone)
    room_name = f"call-{normalized_phone.replace('+', '')}-{random.randint(1000, 9999)}"

    # Auto-detect language and accent if set to "auto" or empty
    combined_text = f"{system_prompt} {first_message}"
    has_devanagari = any("\u0900" <= c <= "\u097F" for c in combined_text)
    has_hindi_keywords = any(w in combined_text.lower() for w in [
        "namaste", "namaskar", "aapka", "kripya", "kaise", "dhanyawad", "shukriya",
        "haan", "nahi", "baat", "bhai", "dost", "hindi", "kya haal"
    ])
    is_indian_number = normalized_phone.startswith("+91") or normalized_phone.startswith("91")

    resolved_lang = (language or "auto").lower()
    resolved_accent = (accent or "auto").lower()

    if resolved_lang == "auto":
        resolved_lang = "hi" if (has_devanagari or has_hindi_keywords) else ("hi" if is_indian_number else "en")

    if resolved_accent == "auto":
        resolved_accent = "in" if (resolved_lang == "hi" or is_indian_number) else "us"

    # Select TTS provider, voice, and speed based on config.py defaults
    chosen_provider = (tts_provider or os.getenv("TTS_PROVIDER", "cartesia")).lower()
    chosen_voice = tts_voice

    if resolved_lang == "hi" or resolved_accent in ["in", "indian"]:
        chosen_voice = chosen_voice or "39d518b7-fd0b-4676-9b8b-29d64ff31e12"
        chosen_speed = 0.85
    else:
        chosen_voice = chosen_voice or "248be419-c632-4f23-add1-07c49495163f"
        chosen_speed = 1.0

    greeting = first_message
    if not greeting:
        if resolved_lang == "hi":
            greeting = f"नमस्ते {lead_name}! बात करने के लिए धन्यवाद।"
        else:
            greeting = f"Hello {lead_name}! Thanks for taking my call."

    # Look up user's telephony integrations (Vobiz for India, Twilio for International)
    user_doc = None
    if db is not None and user_id:
        try:
            user_doc = await db.users.find_one({"user_id": user_id})
        except Exception as ex:
            logger.warning(f"Could not load user {user_id} integrations: {ex}")

    integrations = (user_doc or {}).get("integrations", {})
    vobiz_creds = integrations.get("vobiz", {})
    twilio_creds = integrations.get("twilio", {})
    sip_creds = integrations.get("sip", {})

    selected_provider = (telephony_provider or "auto").lower()
    if selected_provider == "auto":
        if is_indian_number:
            selected_provider = "vobiz" if vobiz_creds else ("sip" if sip_creds else ("twilio" if twilio_creds else "vobiz"))
        else:
            selected_provider = "sip" if sip_creds else ("twilio" if twilio_creds else ("vobiz" if vobiz_creds else "twilio"))

    sip_trunk_id = None
    caller_id = None

    if selected_provider == "vobiz":
        sip_trunk_id = vobiz_creds.get("sip_trunk_id") or os.getenv("VOBIZ_SIP_TRUNK_ID") or os.getenv("OUTBOUND_TRUNK_ID") or "ST_z4V2wYPm5ar3"
        caller_id = vobiz_creds.get("outbound_number") or os.getenv("VOBIZ_OUTBOUND_NUMBER") or "+917965853227"
    elif selected_provider == "sip":
        sip_trunk_id = sip_creds.get("sip_trunk_id") or os.getenv("CUSTOM_SIP_TRUNK_ID") or os.getenv("OUTBOUND_TRUNK_ID") or "ST_z4V2wYPm5ar3"
        caller_id = sip_creds.get("outbound_number") or os.getenv("CUSTOM_SIP_CALLER_ID") or os.getenv("TWILIO_FROM_NUMBER") or "+1234567890"
    else:
        sip_trunk_id = twilio_creds.get("sip_trunk_id") or os.getenv("TWILIO_SIP_TRUNK_ID") or os.getenv("OUTBOUND_TRUNK_ID") or os.getenv("VOBIZ_SIP_TRUNK_ID") or "ST_z4V2wYPm5ar3"
        caller_id = twilio_creds.get("from_number") or os.getenv("TWILIO_FROM_NUMBER") or os.getenv("VOBIZ_OUTBOUND_NUMBER")

    # If Custom SIP is connected by user but trunk was not yet provisioned in LiveKit, provision on the fly
    if selected_provider == "sip" and sip_creds and not sip_creds.get("sip_trunk_id") and sip_creds.get("sip_domain") and settings.LIVEKIT_URL:
        try:
            from livekit.protocol.sip import CreateSIPOutboundTrunkRequest, SIPOutboundTrunkInfo
            lk_temp = _get_livekit_api()
            trunk_info = SIPOutboundTrunkInfo(
                name=f"BYOC-SIP-{user_id}",
                address=sip_creds["sip_domain"],
                auth_username=sip_creds.get("username", ""),
                auth_password=sip_creds.get("password", ""),
                numbers=[sip_creds["outbound_number"]] if sip_creds.get("outbound_number") else [],
            )
            created_trunk = await lk_temp.sip.create_outbound_trunk(CreateSIPOutboundTrunkRequest(trunk=trunk_info))
            sip_trunk_id = created_trunk.sip_trunk_id
            if db is not None:
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$set": {"integrations.sip.sip_trunk_id": sip_trunk_id}}
                )
            await lk_temp.aclose()
            logger.info(f"On-demand provisioned Custom SIP trunk {sip_trunk_id} for user {user_id}")
        except Exception as p_err:
            logger.warning(f"On-demand custom SIP trunk provision notice: {p_err}")

    # If Vobiz is connected by user but trunk was not yet provisioned in LiveKit, provision on the fly
    if selected_provider == "vobiz" and vobiz_creds and not vobiz_creds.get("sip_trunk_id") and vobiz_creds.get("sip_domain") and settings.LIVEKIT_URL:
        try:
            from livekit.protocol.sip import CreateSIPOutboundTrunkRequest, SIPOutboundTrunkInfo
            lk_temp = _get_livekit_api()
            trunk_info = SIPOutboundTrunkInfo(
                name=f"Vobiz-{user_id}",
                address=vobiz_creds["sip_domain"],
                auth_username=vobiz_creds.get("username", ""),
                auth_password=vobiz_creds.get("password", ""),
                numbers=[vobiz_creds["outbound_number"]] if vobiz_creds.get("outbound_number") else [],
            )
            created_trunk = await lk_temp.sip.create_outbound_trunk(CreateSIPOutboundTrunkRequest(trunk=trunk_info))
            sip_trunk_id = created_trunk.sip_trunk_id
            if db is not None:
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$set": {"integrations.vobiz.sip_trunk_id": sip_trunk_id}}
                )
            await lk_temp.aclose()
            logger.info(f"On-demand provisioned LiveKit SIP trunk {sip_trunk_id} for user {user_id}")
        except Exception as p_err:
            logger.warning(f"On-demand trunk provision notice: {p_err}")

    metadata = {
        "user_id": user_id,
        "campaign_id": campaign_id,
        "phone_number": normalized_phone,
        "lead_name": lead_name,
        "system_prompt": system_prompt,
        "first_message": greeting,
        "language": resolved_lang,
        "accent": resolved_accent,
        "tts_provider": chosen_provider,
        "voice_id": chosen_voice,
        "speed": chosen_speed,
        "sip_trunk_id": sip_trunk_id,
        "caller_id": caller_id,
        "provider": selected_provider,
        "sip_dispatched": True,
    }

    lk_api = _get_livekit_api()

    try:
        # 1. Create agent dispatch
        dispatch_req = api.CreateAgentDispatchRequest(
            agent_name="outbound-caller",
            room=room_name,
            metadata=json.dumps(metadata),
        )
        dispatch = await lk_api.agent_dispatch.create_dispatch(dispatch_req)
        logger.info(f"Dispatched LiveKit Agent {dispatch.id} to room {room_name} (Provider: {selected_provider}, CallerID: {caller_id}, Trunk: {sip_trunk_id})")

        # 2. Initiate outbound phone call via selected SIP Trunk
        try:
            sip_kwargs = {
                "room_name": room_name,
                "sip_trunk_id": sip_trunk_id,
                "sip_call_to": normalized_phone,
                "participant_identity": f"sip_{normalized_phone}",
            }
            if caller_id:
                sip_kwargs["sip_number"] = caller_id

            sip_req = api.CreateSIPParticipantRequest(**sip_kwargs)
            await lk_api.sip.create_sip_participant(sip_req)
            logger.info(f"Initiated {selected_provider.upper()} SIP dial to {normalized_phone} with caller ID {caller_id} (Trunk: {sip_trunk_id})")
        except Exception as sip_err:
            logger.warning(f"Backend SIP participant creation notice (agent fallback will dial on join): {sip_err}")

        return room_name, "queued"

    except Exception as e:
        logger.error(f"LiveKit call dispatch failed: {e}", exc_info=True)
        return None, str(e)
    finally:
        await lk_api.aclose()


async def process_call_transcript(transcript: str) -> Dict[str, Any]:
    """
    Analyzes call transcript using Groq to produce summary, checklist, SMS, sentiment.
    """
    if not transcript:
        return {
            "summary": "No transcript captured.",
            "checklist": ["1. Attempt follow-up call", "2. Check lead number", "3. Note CRM"],
            "sms_message": "",
            "sentiment": "Neutral",
        }

    groq_key = settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY")
    openai_key = settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY")
    pref_provider = (os.getenv("LLM_PROVIDER") or "openai").lower()

    clients_to_try = []
    if pref_provider == "openai" and openai_key:
        clients_to_try.append((AsyncOpenAI(api_key=openai_key), "gpt-4o-mini"))
    if groq_key:
        groq_model = "openai/gpt-oss-120b" if settings.GROQ_MODEL in ("llama-3.1-8b-instant", "") else (settings.GROQ_MODEL or "openai/gpt-oss-120b")
        clients_to_try.append((AsyncOpenAI(api_key=groq_key, base_url="https://api.groq.com/openai/v1"), groq_model))
    if pref_provider != "openai" and openai_key:
        clients_to_try.append((AsyncOpenAI(api_key=openai_key), "gpt-4o-mini"))

    if not clients_to_try:
        return {
            "summary": transcript[:200],
            "checklist": ["Review manual notes", "Follow up as needed", "Update CRM"],
            "sms_message": "Thank you for speaking with us today!",
            "sentiment": "Neutral",
        }

    prompt = f"""Analyze the sales call transcript and return valid JSON with:
1. summary (concise paragraph)
2. checklist (array of 3 strings: immediate next step, short-term, long-term)
3. sms_message (short friendly SMS under 160 chars)
4. sentiment ("Positive", "Negative", or "Neutral")

Transcript:
{transcript[:3500]}
"""

    for client, model in clients_to_try:
        try:
            resp = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a sales CRM analyst. Output JSON only."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
            )
            data = json.loads(resp.choices[0].message.content)
            return {
                "summary": data.get("summary", ""),
                "checklist": data.get("checklist", [])[:3],
                "sms_message": data.get("sms_message", ""),
                "sentiment": data.get("sentiment", "Neutral"),
            }
        except Exception as e:
            logger.warning(f"Transcript analysis with {model} failed ({e}), trying fallback...")

    logger.error("All LLM providers failed for transcript analysis.")
    return {
        "summary": "Transcript recorded successfully.",
        "checklist": ["1. Check lead notes", "2. Plan next outreach", "3. Update status"],
        "sms_message": "Thank you for your time on the call today!",
        "sentiment": "Neutral",
    }
