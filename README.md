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
| `SUPABASE_URL` | The API, the scripts and the API round-trip test. On `main`, use the **full-build** Supabase project, never the MVP's. |
| `SUPABASE_SERVICE_ROLE_KEY` | Same. Server-side only: never put it in `apps/web`. |
| `SARVAM_API_KEY` | `make:standins`; Hindi speech through `/speak` (Stage 18); Saaras voice notes and parent replies (Stages 21, 22) |
| `ANTHROPIC_API_KEY` | Slate reading, rewording the brief, and the other Claude calls. Use the `triveni-app` workspace key. Without it the app shows the template brief. |
| `TTS_URL` | Optional. The Bhili speech service: `http://localhost:8790` by default, or a Colab/Kaggle tunnel for faster warming (Stage 18). Not set on Render. |
| `TELEGRAM_BOT_TOKEN` | The parents' Telegram bot, from @BotFather (Stage 22) |
| `TELEGRAM_WEBHOOK_SECRET` | Any random string. Telegram sends it with every webhook call, and the API checks it (Stage 22). |
| `PUBLIC_API_URL` | The API's public address, which Telegram calls: a tunnel while developing, the Render URL once deployed (Stage 22) |
| `WEB_ORIGIN` | Deployed only: the web app's address, which the API accepts requests from. `http://localhost:5173` by default. |

`apps/web/.env`:

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | `http://localhost:8787` locally |
| `VITE_AUDIO_BASE_URL` | `https://<project-ref>.supabase.co/storage/v1/object/public/audio/` (public bucket URL, with the trailing slash) |
| `VITE_TELEGRAM_BOT` | The bot's username without the @, for the parent opt-in QR codes (Stage 22) |

Vite reads `apps/web/.env` only at startup, so restart the dev server after changing it.

## Deploy (full build)

The full build deploys from `main`, to its own Render service and Vercel project. The MVP's service and project stay on `mvp`, untouched.

**Before deploying** (on a laptop, against the full-build Supabase project), make every clip the deployed API needs, since it has no Bhili speech service and no `ffmpeg`:

```
pnpm --filter @triveni/api warm:speech            # every Bhili and Hindi clip (with the API and services/bhili running)
pnpm --filter @triveni/api telegram:warm          # every parent voice note as OGG/Opus (needs ffmpeg)
pnpm --filter @triveni/api telegram:warm --check  # lists anything missing
```

Run them again after any content change.

**API on Render:** New → Web Service → this repo.
- Branch `main`, root directory left empty, runtime Node. Build command `corepack enable && pnpm install --frozen-lockfile`; start command `pnpm start`.
- Plan: **Starter**, which doesn't sleep. On the free plan the first Telegram update after 15 idle minutes waits up to a minute for the API to wake.
- Environment: the full-build `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `SARVAM_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `PUBLIC_API_URL` (this service's `https://<name>.onrender.com`), and `WEB_ORIGIN` (the Vercel address, once it exists). Leave `TTS_URL` unset.
- Check that `https://<name>.onrender.com/health` returns `{"ok":true}`.

**Web app on Vercel:** Add New → Project → this repo, as a **new** project.
- Root Directory `apps/web`; Production Branch `main`.
- Environment variables: `VITE_API_URL` (the Render address, no trailing slash), `VITE_AUDIO_BASE_URL` (the full-build bucket, as above) and `VITE_TELEGRAM_BOT`.
- Then set `WEB_ORIGIN` on Render to this address.

**Telegram:** with `PUBLIC_API_URL` in `apps/api/.env` set to the Render address, run `pnpm --filter @triveni/api telegram:webhook`. Telegram then sends updates to the deployed API. Run it again whenever that address changes.

**Check before a demo:**

```
API_URL=https://<name>.onrender.com pnpm --filter @triveni/api warm:speech --check   # must list nothing
```

On the phone, open the Vercel address in Chrome and choose "Add to Home screen": the app then opens and runs a check with no signal (Stage 17). To try the offline build locally, use `pnpm --filter @triveni/web build && pnpm --filter @triveni/web exec vite preview --port 5173`: the dev server has no service worker.

## Demo (full build, about 5 minutes)

On the demo phone: the installed app, in Hindi. On a second phone: Telegram, signed in and opted in as Meena's parent (scan her QR code from the Class tab, tap Start). Open the API's `/health` first.

1. **Load the demo class** (setup screen). In **रजिस्टर** (the daily log), hold the mic and say "आज borrowing पढ़ाया, page 65". The concept fills in from the page; save.
2. **Run a two-concept check** (**जाँच**): the suggested concepts, in this week's rotated order. Show A on the board, play B in Hindi, then C in Bhili.
3. **Choose the slate photos from the gallery.** When they're read, fix one highlighted box and give one slate from "यह स्लेट किसकी है?" to its child. Save.
4. **Results** (**नतीजे**): Ravi is in a confirmed language gap with his key words; Meena is in Never taught; Arjun's 11 points to borrowing.
5. **The morning brief** (**आज**) in Hindi: read it aloud.
6. **A quick re-check** that confirms Sita's word-problem gap.
7. **The probe for Arjun** (✗ in numbers, ✓ with drawings), then open the reteaching kit: it plays in Bhili. Switch the app to English for a moment to show the toggle.
8. **Send the catch-up to Meena's parent** (Catch-up for parents on **आज**): the second phone receives the Bhili voice note on Telegram, live. Tap "हो गया 👍".
9. **Close** with the design slides and the simulation table: `<web address>/designs/`.

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
