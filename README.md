# Triveni

A phone-based tool that tells a Grade 1–3 teacher whether a child got a maths question wrong because of the concept or because of the language. See `resources/IDEA.md` and `resources/TECH.md`, and `TODO.md` for the build stages.

## Setup

```
pnpm install
pnpm typecheck && pnpm test
pnpm --filter @triveni/api dev   # API on http://localhost:8787
pnpm --filter @triveni/web dev   # web app on http://localhost:5173
```

## Environment variables

Both `.env` files are gitignored. Get the keys from a teammate privately and never commit them.

`apps/api/.env`:

| Variable | Needed for |
| --- | --- |
| `SUPABASE_URL` | The API, `seed:audio`, `make:standins` and the API round-trip test |
| `SUPABASE_SERVICE_ROLE_KEY` | Same. Server-side only: never put it in `apps/web`. |
| `SARVAM_API_KEY` | `make:standins` only |

`apps/web/.env`:

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | `http://localhost:8787` locally |
| `VITE_AUDIO_BASE_URL` | `https://<project-ref>.supabase.co/storage/v1/object/public/audio/` (public bucket URL, with the trailing slash) |
| `VITE_DEV_ALLOW_STANDINS` | `true` lets Bulbul stand-in clips play in the check. Leave it unset or `false` in any build used with children or in the demo. |

Vite reads `apps/web/.env` only at startup, so restart the dev server after changing it.
