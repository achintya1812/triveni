# /// script
# requires-python = ">=3.11,<3.13"
# dependencies = [
#   "parler-tts @ git+https://github.com/huggingface/parler-tts.git@d108732cd57788ec86bc857d99a6cabd66663d68",
#   "torch==2.5.1",
#   "torchaudio==2.5.1",
#   "soundfile",
# ]
# [[tool.uv.index]]
# name = "pytorch-cpu"
# url = "https://download.pytorch.org/whl/cpu"
# explicit = true
# [tool.uv.sources]
# torch = { index = "pytorch-cpu" }
# torchaudio = { index = "pytorch-cpu" }
# ///
"""Speaks Bhili (Devanagari) with ai4bharat/bhili-tts.

POST /speak with {"text": "..."} returns a WAV. Only apps/api calls this; it caches the results.
Run: uv run services/bhili/tts_server.py  (port 8790, or TTS_PORT)
"""

import io
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

import soundfile as sf
import torch
from parler_tts import ParlerTTSForConditionalGeneration
from transformers import AutoTokenizer

MODEL = "ai4bharat/bhili-tts"
# Every clip uses the same voice. apps/api caches clips by text, so clear its cache if this changes.
VOICE = "A female speaker with a clear, slow-paced voice. The recording is clean with no background noise."

device = "cuda:0" if torch.cuda.is_available() else "cpu"
model = ParlerTTSForConditionalGeneration.from_pretrained(MODEL).to(device)
tokenizer = AutoTokenizer.from_pretrained(MODEL)
voice_ids = AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path)(
    VOICE, return_tensors="pt"
).input_ids.to(device)


def speak(text: str) -> bytes:
    prompt_ids = tokenizer(text, return_tensors="pt").input_ids.to(device)
    # Generation samples, and on a very short text it sometimes stops at once; try again then.
    for _ in range(3):
        with torch.no_grad():
            audio = model.generate(input_ids=voice_ids, prompt_input_ids=prompt_ids).cpu().numpy().reshape(-1)
        if audio.size >= model.config.sampling_rate // 4:
            break
    else:
        raise RuntimeError(f"No speech made for {text!r}")
    out = io.BytesIO()
    sf.write(out, audio, model.config.sampling_rate, format="WAV", subtype="PCM_16")
    return out.getvalue()


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/speak":
            return self.send_error(404)
        text = json.loads(self.rfile.read(int(self.headers["Content-Length"]))).get("text", "").strip()
        if not text:
            return self.send_error(400, "text is required")
        wav = speak(text)
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(wav)))
        self.end_headers()
        self.wfile.write(wav)


port = int(os.environ.get("TTS_PORT", 8790))
print(f"Bhili TTS on http://localhost:{port} ({device})", flush=True)
HTTPServer(("localhost", port), Handler).serve_forever()
