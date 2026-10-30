# Triveni

A phone-based tool that tells a Grade 1–3 teacher whether a child got a maths question wrong because of the concept or because of the language. See `resources/IDEA.md` and `resources/TECH.md`, and `TODO.md` for the build stages.

## Setup

```
pnpm install
pnpm typecheck && pnpm test
pnpm --filter @triveni/api dev   # API on http://localhost:8787
pnpm --filter @triveni/web dev   # web app on http://localhost:5173
uv run services/bhili/tts_server.py   # Bhili speech on http://localhost:8790
```

The Bhili speech service needs [uv](https://docs.astral.sh/uv/). The first run installs PyTorch (CPU) and downloads the 3.6 GB model. On a CPU, each new sentence takes up to a minute to speak; the API caches it after that. After the first run, start it with `HF_HUB_OFFLINE=1` in front: otherwise it checks Hugging Face for model updates at startup, which can hang on a poor connection.

`uv run services/bhili/translate.py` fills in any missing Bhili text in `packages/content/data` (C questions, key words, reteaching scripts). It never overwrites existing Bhili, so to redo one, delete its `bhili` value first. Run it with the speech service stopped, since it needs about 10 GB of free RAM. Then `pnpm --filter @triveni/api warm:speech` (with the API and speech service running) makes and caches every Bhili clip.

`pnpm --filter @triveni/api slate:accuracy <folder>` measures how well Claude reads slate photos. The folder holds the photos and an `answers.csv` with the true answers (`photo,roll,A,B,C`, one row per slate). `apps/api/scripts/slate-samples` has three synthetic photos of the demo class made with a handwriting font; real slate photos give the number that counts. Each photo is one paid Claude call.

## Environment variables

Both `.env` files are gitignored. Get the keys from a teammate privately and never commit them.

`apps/api/.env`:

| Variable | Needed for |
| --- | --- |
| `SUPABASE_URL` | The API, `seed:audio`, `make:standins` and the API round-trip test |
| `SUPABASE_SERVICE_ROLE_KEY` | Same. Server-side only: never put it in `apps/web`. |
| `SARVAM_API_KEY` | `make:standins` only |
| `ANTHROPIC_API_KEY` | Rewording the morning brief (`POST /brief/reword`). Use the `triveni-app` workspace key. Without it the app shows the template brief. |
| `TTS_URL` | Optional. The Bhili speech service, `http://localhost:8790` by default. |
| `WEB_ORIGIN` | Deployed only: the web app's address, which the API accepts requests from. `http://localhost:5173` by default. |

`apps/web/.env`:

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | `http://localhost:8787` locally |
| `VITE_AUDIO_BASE_URL` | `https://<project-ref>.supabase.co/storage/v1/object/public/audio/` (public bucket URL, with the trailing slash) |

Vite reads `apps/web/.env` only at startup, so restart the dev server after changing it.

## Deploy (the MVP backup)

The MVP deploys from the `mvp` branch, so work on `main` never changes it. Both hosts redeploy on every push to `mvp`.

**API on Render:** New → Web Service → this repo.
- Branch `mvp`, root directory left empty, runtime Node.
- Build command `corepack enable && pnpm install --frozen-lockfile`; start command `pnpm start` (the root `start` script runs the API). Node 22 comes from `engines` in `package.json`.
- Environment: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, and `WEB_ORIGIN` (the Vercel address, set once it exists). Render sets `PORT` itself.
- Check `https://<name>.onrender.com/health` returns `{"ok":true}`. On the free plan the API sleeps after 15 minutes idle and takes up to a minute to wake, so open `/health` shortly before demoing (the Starter plan doesn't sleep).

**Web app on Vercel:** Add New → Project → this repo.
- Root Directory `apps/web`. Vercel detects Vite and pnpm.
- Environment variables: `VITE_API_URL` (the Render address, no trailing slash) and `VITE_AUDIO_BASE_URL` (as above).
- After the first deploy: Settings → Git → Production Branch `mvp`, then redeploy.

**Bhili speech:** the deployed API has no speech service, so every Bhili clip must already be cached. Run `warm:speech` locally (see Setup) after any content change, before pushing to `mvp`.
