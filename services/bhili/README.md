# Bhili speech and translation

- `tts_server.py`: speaks Bhili (Devanagari) with ai4bharat/bhili-tts. `POST /speak` with `{"text": "..."}` returns a WAV. Only `apps/api` calls it, and the API caches every clip in the `audio` bucket.
- `translate.py`: fills in missing `bhili` fields in `packages/content/data` (see the repo README).

The deployed API has no Bhili speech service. Every Bhili text is fixed content, so every clip is made in advance with `warm:speech`. The steps are below.

## Make every Bhili clip (on your laptop)

On a CPU, each new sentence takes up to a minute.

```
uv run services/bhili/tts_server.py            # first run downloads the model (3.6 GB); later: HF_HUB_OFFLINE=1 uv run …
pnpm --filter @triveni/api dev                 # the API, with apps/api/.env pointing at the full-build Supabase
pnpm --filter @triveni/api warm:speech         # makes and caches every clip
pnpm --filter @triveni/api warm:speech --check # lists anything still missing
```

Before a demo, check the deployed API too:

```
API_URL=https://<api>.onrender.com pnpm --filter @triveni/api warm:speech --check
```

## Faster: on a free GPU (Google Colab or Kaggle)

Use this only for warming the cache, never during a demo: free notebooks disconnect without warning. Kaggle needs a verified phone number before it allows the internet and a GPU.

1. **Notebook:** open a new notebook with a GPU (Colab: Runtime → Change runtime type → T4 GPU; Kaggle: Settings → Accelerator → GPU, and Internet on).
2. **Install the dependencies** without `uv`, so the notebook keeps its own CUDA build of PyTorch:
   ```
   !pip install -q "parler-tts @ git+https://github.com/huggingface/parler-tts.git@d108732cd57788ec86bc857d99a6cabd66663d68" soundfile
   ```
3. **Upload and start the server:** upload `tts_server.py` (the file browser on the left), then start it in the background:
   ```
   !nohup python tts_server.py > tts.log 2>&1 &
   ```
   If the log asks for a Hugging Face login, run `!huggingface-cli login` with a read token, and start it again.
4. **Wait for the model:** `!tail tts.log` shows when the model has loaded.
5. **Open a public tunnel to it:**
   ```
   !wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O cloudflared && chmod +x cloudflared
   !nohup ./cloudflared tunnel --url http://localhost:8790 > tunnel.log 2>&1 &
   !sleep 8 && grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' tunnel.log
   ```
6. **Warm the cache from your laptop:** point the local API at the tunnel and warm:
   ```
   TTS_URL=https://<printed>.trycloudflare.com pnpm --filter @triveni/api dev
   pnpm --filter @triveni/api warm:speech
   ```
   The clips are cached in the full-build Supabase, which the deployed API reads from.

## Later: a hosted GPU

To speak new Bhili sentences live (for example, children's names in parent notes), run the same `tts_server.py` on a GPU host such as Modal, a Hugging Face endpoint or RunPod, and set `TTS_URL` on the deployed API. No code changes are needed. Put an authentication layer in front of a public endpoint.
