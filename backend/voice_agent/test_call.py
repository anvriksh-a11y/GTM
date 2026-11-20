"""
Test script to make a single outbound voice call via LiveKit & Vobiz SIP Trunk.
Usage:
    python backend/voice_agent/test_call.py --to +91XXXXXXXXXX
"""

import os
import certifi
os.environ['SSL_CERT_FILE'] = certifi.where()

import sys
import argparse
import asyncio
import logging

# Ensure backend directory is in sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env")))

from services.livekit_service import dispatch_livekit_call

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_call")


async def main():
    parser = argparse.ArgumentParser(description="Test outbound call using LiveKit & Vobiz SIP Trunk")
    parser.add_argument("--to", required=True, help="Destination phone number in E.164 format (e.g. +91XXXXXXXXXX)")
    parser.add_argument("--name", default="Valued Prospect", help="Prospect's name")
    parser.add_argument("--prompt", default="", help="Custom prompt or leave blank for default")
    args = parser.parse_args()

    phone = args.to.strip()
    logger.info(f"Initiating test outbound call to {phone} for {args.name}...")

    room_name, status = await dispatch_livekit_call(
        phone=phone,
        lead_name=args.name,
        system_prompt=args.prompt,
        first_message=f"Hello {args.name}! Thanks for taking my call.",
    )

    if room_name:
        print("\n" + "="*50)
        print("CALL DISPATCHED SUCCESSFULLY!")
        print(f"Session Room: {room_name}")
        print(f"Status: {status}")
        print("The LiveKit agent worker will join the room and dial via Vobiz.")
        print("="*50 + "\n")
    else:
        print(f"\nFailed to dispatch call: {status}\n")


if __name__ == "__main__":
    asyncio.run(main())
