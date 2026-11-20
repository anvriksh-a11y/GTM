import asyncio
import os
import certifi
os.environ['SSL_CERT_FILE'] = certifi.where()
import logging
from dotenv import load_dotenv
from livekit.plugins import cartesia
import json

load_dotenv()
logging.basicConfig(level=logging.DEBUG)

async def main():
    try:
        tts = cartesia.TTS(model="sonic-3", language="hi", voice="39d518b7-fd0b-4676-9b8b-29d64ff31e12", api_key=os.environ.get("CARTESIA_API_KEY"))
        print("Starting synthesis...")
        stream = tts.synthesize("नमस्ते, आप कैसे हैं?")
        async for audio in stream:
            print("Received audio frame", len(audio.data))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
