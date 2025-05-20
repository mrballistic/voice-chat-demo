"""
realtime_voice_with_memory.py
-----------------------------
A push-to-talk demo that keeps conversational state with the latest
Responses API *inside* every Realtime WebSocket turn.

requirements
------------
pip install openai==1.* websockets pyaudio asyncio
# macOS users:  brew install portaudio
# Linux users:  sudo apt-get install portaudio19-dev

export OPENAI_API_KEY="sk-..."
python realtime_voice_with_memory.py
"""

import asyncio, base64, json, os
from datetime import datetime

import pyaudio           # microphone I/O
import websockets        # WebSocket transport
import openai            # official 1.x SDK

# ----------------------------- constants ---------------------------------
RATE      = 16_000       # 16-kHz mono PCM16
WIDTH     = 2            # 16-bit samples
CHANNELS  = 1
CHUNK     = 1024         # frames per read

REALTIME_WS = (
    "wss://api.openai.com/v1/realtime"
    "?model=gpt-4o-realtime-preview-2025-02-01"
)

HEADERS = {
    "Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}",
    "OpenAI-Beta": "realtime=v1"
}

SYSTEM_PROMPT = "You are an assistant that answers briefly and politely."

# ----------------------------- helpers -----------------------------------
def record_until_enter() -> bytes:
    """Block on mic until the user presses ENTER; return raw PCM16 bytes."""
    pa     = pyaudio.PyAudio()
    stream = pa.open(format=pa.get_format_from_width(WIDTH),
                     channels=CHANNELS, rate=RATE, input=True,
                     frames_per_buffer=CHUNK)
    print("🎙  Speak… (press ENTER to send)")
    frames = []
    try:
        while True:
            if os.name == "nt":            # Windows: msvcrt for keypress
                import msvcrt
                if msvcrt.kbhit() and msvcrt.getch() in {b"\r", b"\n"}:
                    break
            else:                          # POSIX: stdin
                if input("") == "":
                    break
            data = stream.read(CHUNK, exception_on_overflow=False)
            frames.append(data)
    finally:
        stream.stop_stream(); stream.close(); pa.terminate()
    return b"".join(frames)

def play_pcm16(raw: bytes):
    pa     = pyaudio.PyAudio()
    stream = pa.open(format=pa.get_format_from_width(WIDTH),
                     channels=CHANNELS, rate=RATE, output=True)
    stream.write(raw); stream.stop_stream(); stream.close(); pa.terminate()

# ----------------------------- main turn ---------------------------------
previous_response_id: str | None = None   # updated each round

async def one_voice_turn():
    global previous_response_id

    # 1) capture mic input
    pcm = record_until_enter()
    audio_b64 = base64.b64encode(pcm).decode()

    # 2) stream it to Realtime
    async with websockets.connect(REALTIME_WS, extra_headers=HEADERS) as ws:
        # conversation.item.create  (user audio message)
        await ws.send(json.dumps({
            "type": "conversation.item.create",
            "item": {
                "type": "message",
                "role": "user",
                "content": [{
                    "type":  "input_audio",
                    "audio": audio_b64
                }]
            }
        }))

        # response.create  (ask model to reply)
        await ws.send(json.dumps({
            "type": "response.create",
            "response": {
                "modalities": ["audio", "text"],
                "instructions": SYSTEM_PROMPT,
                "previous_response_id": previous_response_id    # <-- memory
            }
        }))

        # 3) handle the server stream
        text_chunks = []
        async for raw in ws:
            msg = json.loads(raw)
            t   = msg["type"]

            if t == "response.text.delta":
                text_chunks.append(msg["delta"])

            elif t == "response.audio.delta":
                play_pcm16(base64.b64decode(msg["delta"]))

            elif t == "response.done":
                # grab the new id for the next turn’s previous_response_id
                previous_response_id = msg["response"]["id"]
                break   # leave the async-for → will close socket

    print(f"\n🤖 {''.join(text_chunks).strip()}\n")

# ----------------------------- driver loop -------------------------------
async def main():
    print("Press Ctrl-C to quit.")
    try:
        while True:
            await one_voice_turn()
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    openai.api_key = os.environ["OPENAI_API_KEY"]
    asyncio.run(main())
 