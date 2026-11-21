#!/bin/bash
set -e

echo "=== Starting Genquantaa GTM OS Production Container ==="

# Start the LiveKit Voice Agent worker in the background
echo "[Voice Agent] Starting LiveKit outbound caller daemon..."
python voice_agent/agent.py dev &

# Start the FastAPI HTTP backend in the foreground
echo "[FastAPI] Starting HTTP server on port ${PORT:-8080}..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
