# Triveni: Tech Stack

This is the technical companion to [IDEA.md](IDEA.md). It covers what we build Triveni with, how the pieces connect, and how we spend our $500 of Claude API credits.

## Principles

- **One language everywhere.** TypeScript on the phone, the server and the shared rules. The one exception is the Bhili speech service (`services/bhili`), which is Python because the model is.
- **Rules decide; AI reads and writes.** Grouping, concept-map tracing and scheduling are plain code that runs on the phone. AI is used only to read things (slates, speech), write things (briefs, content) and speak (Bulbul for Hindi, AI4Bharat's bhili-tts for Bhili).
- **Speech is generated, not recorded.** Check questions and Bhili audio come from text-to-speech, so there are no recordings to collect. Bhili text is machine-translated, so a Bhili speaker should review it.
- **API keys never reach the phone.** Every AI call goes through our server.

## Overview

```
Teacher's phone (offline web app)          Server                              Outside services
┌─────────────────────────────┐   sync    ┌──────────────────────────┐       ┌──────────────────────────┐
│ React app, works offline    │ ───────▶  │ Hono API (Node, TS)      │ ────▶ │ Claude API               │
│ IndexedDB (Dexie): records  │ ◀───────  │  · slate reading         │       │   slates, briefs, content│
│ Rules engine (shared code)  │           │  · brief wording         │ ────▶ │ Sarvam Saaras v4         │
│ Cached audio clips          │           │  · voice note → text     │       │   speech to text         │
└─────────────────────────────┘           │  · WhatsApp webhook      │ ────▶ │ Sarvam Bulbul            │
                                          └──────────┬───────────────┘       │   Hindi text to speech   │
                                                     │                ◀────▶ │ WhatsApp Cloud API       │
                                          Supabase: Postgres + Storage       └──────────────────────────┘
```

## Repository layout

A pnpm workspace with four packages:

| Path | Contents |
| --- | --- |
| `apps/web` | The teacher's web app (PWA) |
| `apps/api` | The Hono server |
| `packages/core` | The rules engine: answer patterns, grouping, concept-map tracing, the brief template, and the shared types (Zod). The phone and the server run the same code. |
| `packages/content` | The concept map, question bank, wrong-answer lists, key-word tags and the audio manifest, as JSON in git. Changes are reviewed in pull requests and loaded into the database. |
| `services/bhili` | Not part of the pnpm workspace: Python scripts, run with `uv`, for Bhili speech and translation (see Bhili text to speech below) |

## Teacher's app (phone)

| Need | Choice | Notes |
| --- | --- | --- |
| Framework | React + Vite + TypeScript | |
| Offline and installable | vite-plugin-pwa (Workbox) | Caches the app shell and the audio for upcoming checks |
| Local data | Dexie.js (IndexedDB) | Class list, attendance, answers, child records, and an outbox of changes waiting to sync |
| Camera | A gallery picker (`<input type="file" accept="image/*" multiple>`, no `capture`) and an in-app camera (`getUserMedia`) for several shots in a row | `capture` makes Android take one shot and ignore `multiple`. Photos are resized to about 1500 px on the long side and uploaded in parallel. |
| Voice notes | Browser `MediaRecorder` (Opus audio) | Saved locally and uploaded when there is a signal |
| Audio playback | HTML5 `Audio` from the cache | |
| UI | Tailwind + shadcn/ui | Large tap targets |
| Interface language | i18next | Hindi interface |

## Server

| Need | Choice | Notes |
| --- | --- | --- |
| API | Hono on Node + TypeScript | Holds every external API key |
| Database and files | Supabase (Postgres, Storage, Auth), free tier | Photos, audio clips, records |
| Hosting | API on Render, web app on Vercel. The MVP deploys from `mvp` (Render free plan); the full build has its own Render service (Starter, $7/month) and Vercel project from `main`, on its own Supabase project. Railway was the first choice, but its sign-ups were paused. | The free plan sleeps after 15 minutes idle; Starter doesn't, so WhatsApp webhooks always land |

## AI services

### Claude (Anthropic)

SDK: `@anthropic-ai/sdk`, server-side only. Model: `claude-opus-5-5`.

| Job | When | How |
| --- | --- | --- |
| Reading slates | After check day, once there is a signal | One photo per request, `effort: "low"`, structured outputs returning one entry per slate: `{roll, answers: [{row, version, value, confidence}]}`. Each concept in the check has its own row of three boxes, and each box symbol always maps to the same version (circle is A). Low-confidence reads go to the review screen. The fixed instructions and example images are cached. |
| Wording the brief | Nightly, when there is a signal | `effort: "low"`. The rules engine has already chosen the groups; Claude only rewrites the template in plain Hindi. Without a signal, the template is shown as is. |
| Mapping voice-note text to a concept | Only when the note has no page number | A short call on the Saaras transcript |
| Writing content | Before the demo | Message Batches API (half price): matched questions, wrong-answer lists, key-word cards and scripts. All output is reviewed before it goes into `packages/content`. |
| Explaining unknown wrong answers | Rare | A short call |

Requests use the server-side fallback option (`fallbacks: "default"`), so a declined request is retried on another model automatically.

### Sarvam Saaras v4 (speech to text)

| Job | How |
| --- | --- |
| The teacher's daily voice note ("borrowing in subtraction, page 34") | The voice note is uploaded and sent to the Saaras REST API with keyterms (concept names, "page"). A page number in the text is matched to a concept in code; if there is none, Claude maps the text. |
| Probe results logged by voice | Same flow; Claude turns the transcript into results for each child |
| Parents' WhatsApp replies | Hindi only. Replies in Bhili are stored, not transcribed. |

### Sarvam Bulbul (text to speech, Hindi only)

Bulbul speaks all the Hindi audio: the B questions, reading the morning brief aloud, step-by-step prompts, the Hindi side of key-word cards, Hindi reteaching audio and voice notes to parents whose home language is Hindi. It does not speak Bhili; see the next section.

The B clips are generated once by `pnpm --filter @triveni/api make:standins`, stored in Supabase Storage and listed in the audio manifest. Only the morning brief's audio is generated daily on the server.

Check in the Sarvam console whether `bulbul:v4` is available on the standalone text-to-speech API. As of October 2026, the changelog lists it only for Voice Agents, with `bulbul:v3` remaining on the text-to-speech API. Use v3 if v4 is not available.

### Bhili text to speech (AI4Bharat bhili-tts)

Bhili audio is generated live from Devanagari text with [ai4bharat/bhili-tts](https://huggingface.co/ai4bharat/bhili-tts) (Parler-TTS, about 0.9B parameters, MIT licence, Dehvali dialect, trained mostly on farming speech).

| Piece | How |
| --- | --- |
| `services/bhili/tts_server.py` | A small Python server that loads the model once and answers `POST /speak` with a WAV. Every clip uses the same voice description. Run with `uv run services/bhili/tts_server.py`. |
| `POST /speak` in `apps/api` | Takes the text, returns its path in the `audio` bucket. The first request for a text calls the Python server (up to a minute on a CPU) and caches the WAV by a hash of the text, so later requests are instant. |
| `services/bhili/translate.py` | Run after adding or changing content. There is no Hindi → Bhili model, so it feeds English text to AI4Bharat's `bhili-translate-mar-bhb` adapter on `sarvamai/sarvam-translate`, and fills in every missing `bhili` field: C questions, key words and reteaching scripts. Going through Marathi first was tried and was less reliable. It never overwrites existing Bhili, so a speaker's corrections are kept, and it stops if any number changes in translation. |

The app asks for each Bhili clip (C questions, key words, reteaching scripts) as soon as it shows. After the content changes, `pnpm --filter @triveni/api warm:speech` makes and caches every clip in one go, so none waits on the model. The full build runs the server on a Modal GPU (`services/bhili/modal_app.py`, scales to zero, kept warm on demo days) and sets `TTS_URL`; the MVP has no speech service and relies on the cache.

Known limits: B (Bulbul) and C (bhili-tts) are different voices, so a difference in answers could partly come from the voice. The translations and the dialect have not yet been reviewed by a Bhili speaker from the target area.

## WhatsApp

- **Meta WhatsApp Cloud API**, called with `fetch` from `apps/api/src/routes/whatsapp.ts`. The free test number can message up to five verified numbers, which is enough for the demo. Incoming messages and delivery statuses arrive at the Hono server as webhooks, checked with `X-Hub-Signature-256`.
- **Opt-in:** the app shows a QR code per child (`wa.me/<number>?text=JOIN <code>`). The parent's JOIN message records their number and consent, and opens WhatsApp's 24-hour window.
- **24-hour window:** inside it we send voice notes freely; outside it we first send one approved utility template ("Reply OK to hear it"), and the reply reopens the window.
- Voice notes are `.ogg` (Opus), converted once with `ffmpeg-static` from the cached Bulbul or bhili-tts audio. This is WhatsApp's native voice-note format.
- Parents' voice replies are stored in the private `wa-media` bucket; Hindi ones are transcribed with Saaras.
- **Who owns the app:** the Meta app belongs to a teammate's established Facebook account. A brand-new account's business portfolio was locked (error 131031).
- **Twilio was ruled out:** trial accounts can only send Twilio's ready-made templates.
- **Fallback, if Meta stays blocked:** a **Telegram bot** (Bot API: a `t.me/<bot>?start=<code>` opt-in, `sendVoice` with the same `.ogg` Opus file, and a webhook with a secret token). It's free and instant to set up, but fewer rural parents use Telegram.

## Data model

| Table | Key fields |
| --- | --- |
| `classes` | id, school, grade, textbook |
| `children` | id, class_id, roll_no, name, home_language, hindi_understanding (the teacher's view), parent_phone, parent_opt_in_at (WhatsApp requires an opt-in before we message a parent), parent_last_message_at (the 24-hour window) |
| `attendance` | class_id, date, child_id, present. Stored by date, so absences are recorded even on days with no logged concept. |
| `lessons` | id, class_id, date, concept_id, source (`dropdown`, `voice`), transcript, page |
| `checks` | id, class_id, date, kind (`weekly`, `recheck`), question_ids (row order), version_order, child_ids (re-checks only) |
| `answers` | check_id, child_id, question_id, row, version (`A`, `B`, `C`), value, status (`right`, `wrong`, `no_data`), cause, confidence, reviewed |
| `listening_results` | child_id, date, item_id, language, value, status |
| `probe_results` | id, child_id, concept_id, date, passed_at_once, restart_concept_id, form (`concrete`, `pictorial`, `abstract`) |
| `audio_clips` | id, kind, language, source (`human`, `bulbul`), url, approved |
| `parent_messages`, `parent_replies` | WhatsApp messages sent to and received from parents, with delivery status |

Each child's running record (language profile, word evidence, concept status) is derived on the phone by the rules engine, not stored.

Questions, the concept map and wrong-answer lists live in `packages/content` and are loaded into the database.

## Offline and sync

- Everything the teacher does is written to Dexie first, then queued in the outbox.
- When a signal returns, the outbox uploads attendance, answers, photos and voice notes. The server reads the slates and transcribes the notes, then sends the results back.
- The rules engine runs on the phone, so groups and the template brief are always available. Only slate reading, transcription and the brief's wording wait for a signal.

## Testing

- **Vitest** for the rules engine, which is where correctness matters most and which costs nothing to run.
- **Simulation script:** a seeded class of made-up children with planted causes, run through the rules engine. It measures how often Triveni finds the true cause, with no API cost.
- **Slate-reading test:** about 50 real slate photos with the correct answers written down, run through Claude to measure accuracy. **Do this first.** If accuracy is poor, switch to a tap-to-enter grid early.
- **Voice-note test:** about 20 recorded voice notes run through Saaras with keyterms, to check that the concept is matched correctly.

## Budget

### Claude credits ($500)

Estimates use Opus 5.5 pricing ($4 per million input tokens, $20 per million output tokens).

| Use | Cost per item | Hackathon total |
| --- | --- | --- |
| Reading one slate photo (about 2k tokens in, 0.7k out) | about $0.025 | about $10 for 400 photos |
| Wording one brief | about $0.02 | about $4 for 200 runs |
| Content generation (batch, about three rounds) | | about $20 |
| Slate-reading test runs | | about $5 |
| Concept mapping and wrong-answer explanations | | under $2 |
| **Product total** | | **about $40; set aside $75** |
| **AI coding assistance** | | **about $425** |

- Use two Console workspaces with separate keys and spending limits: `triveni-app` capped at $75, and `coding` for the rest.
- Claude Code is the fastest way to spend credits. A heavy day on Opus can cost $10 to $40 per developer. Check `/cost`, start a fresh session for each task, and keep CLAUDE.md short.
- A teammate with a Claude Pro or Max subscription can run Claude Code on that instead, which leaves the credits for the product.
- If money runs short, Sonnet 5.5 ($2 / $10) and Haiku 5.5 ($0.10 / $0.50) are cheaper options to test for the brief and for routine coding. Compare quality before switching.

### Sarvam (billed separately, in rupees)

Voice notes are about ten seconds each, and Bulbul clips are generated once, so the hackathon cost should be small. Confirm current rates in the Sarvam console, because the official speech-to-text prices could not be verified when this was written.

### Hosting

About $5 for the API host. Supabase, Vercel or Cloudflare Pages, and the WhatsApp test number are free.

## MVP versus full build

| | Bare minimum MVP | Full hackathon build |
| --- | --- | --- |
| App | Web app (offline optional) | PWA with offline caching and a sync outbox |
| Claude | Slate reading, brief wording | Plus content batches, concept mapping, wrong-answer explanations |
| Saaras v4 | Not used (concept dropdown) | Voice notes and spoken probe logs |
| Bulbul | B questions | Plus Hindi key-word audio, reteaching audio, brief read aloud, Hindi parent notes |
| bhili-tts | C questions, spoken live | All Bhili audio |
| WhatsApp | Optional: one parent voice note | Parents, catch-up lessons, recorder bot |
| Data | Supabase + Dexie | Same |

## Open checks before building

1. Slate-reading accuracy on real children's handwriting (the slate-reading test above).
2. Whether `bulbul:v4` is on Sarvam's text-to-speech API, or only `bulbul:v3`.
3. Sarvam's current speech-to-text and text-to-speech prices.
4. Meta WhatsApp Cloud API: set up on a teammate's established Facebook account. If it stays blocked, fall back to a Telegram bot.
5. A Bhili speaker from the target area to review the machine-translated Bhili text and how bhili-tts says it.
