# Triveni: remaining work

Stages 0–2 are done. This file is for whoever picks up a stage next, working with a Claude Code instance. Each stage below lists what to build, the files it touches, and how to check it is done.

## Workflow

**Once per teammate**
1. Clone the repo, install pnpm 10, and run `pnpm install`.
2. Run `pnpm typecheck && pnpm test` to confirm everything passes before you change anything.
3. Create your own `apps/api/.env` with the keys your stage needs. It is gitignored, so get keys from a teammate privately and never commit them.

**For each stage**
1. Pull the latest `main` and branch from it: `git checkout -b stage-3-db-api` (use your stage's number and name).
2. Read `CLAUDE.md`, then the "Bare minimum MVP" section of `resources/IDEA.md` and `resources/TECH.md`.
3. Start a fresh Claude Code session with this prompt: "Read CLAUDE.md and TODO.md, then build Stage N. Ask me before doing anything outside that stage."
4. Build until every box in the stage's verify checklist below passes, along with `pnpm typecheck` and `pnpm test`.
5. In the same branch, mark the stage `[done]` in `CLAUDE.md` and tick it below.
6. Push and open a PR. CI runs typecheck and tests on every PR. A teammate reviews it, checking that it stays within MVP scope and doesn't change the rules in `rules.ts`, then merges it into `main`.
7. Everyone pulls `main` before starting their next stage.

**Working in parallel**
- Stage 3 and the Stage 4 screens and Dexie store can run at the same time. Only Stage 4's sync to the API waits for Stage 3.
- After Stage 5, Stages 6 and 7 can run in parallel.
- Parallel PRs both edit `CLAUDE.md` and `TODO.md`, so expect small merge conflicts there. Resolve them by keeping both sets of ticks.

## What already exists

| Path | What it holds |
| --- | --- |
| `packages/core/src/content.ts` | Zod schemas: `Language`, `AudioClip`, `Concept`, `Keyword`, `Question`, `PracticeStory` |
| `packages/core/src/rules.ts` | `markAnswer`, `patternGroup`, `wasTaught`, `placeChild`. These are the grouping rules, covered by tests in `rules.test.ts`. |
| `packages/core/src/brief.ts` | `buildBrief`: the template morning brief |
| `packages/content/data/*.json` | 3 concepts, one A/B/C question per concept, 6 key words, 9 practice stories, 15 audio clips (none recorded yet) |
| `packages/content/src/index.ts` | Parses the JSON with the core schemas and exports `concepts`, `questions`, `keywords`, `stories`, `audioClips` |
| `apps/api/src/index.ts` | Hono server with `GET /health` only (port 8787, or `PORT`) |
| `apps/web` | Vite + React + Tailwind + shadcn/ui (Base UI style). A placeholder page only. |

### Conventions

- Workspace packages export TypeScript source directly (`"exports": { ".": "./src/index.ts" }`), with no build step. Import them as `@triveni/core` and `@triveni/content`.
- Rules code uses camelCase (`childId`, `conceptId`). The database uses snake_case. Convert at the API boundary.
- Dates are `YYYY-MM-DD` strings.
- Tests use Vitest, as `*.test.ts` next to the code. Add a `"test": "vitest run"` script to any package that gets tests.
- Secrets go in `apps/api/.env`, which is gitignored. Never put keys in `apps/web`.
- Don't change what the rules in `rules.ts` decide without asking. The tests document the agreed behaviour:
  - a child with no attendance row counts as present
  - "never taught" means absent on every day the concept was taught
  - a concept with no logged lesson counts as taught
  - any blank answer means "unclear".

---

## [x] Stage 3: Database + API

**Goal:** Supabase holds the MVP data, and the Hono API can create and read every entity.

**You need:** a hosted Supabase project (free tier). Local Supabase needs Docker, so use the hosted one. Put these in `apps/api/.env`:
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

**Build:**

1. **Record schemas** in `packages/core/src/records.ts`, exported from `packages/core/src/index.ts`. Use Zod and camelCase fields:

   | Schema | Fields |
   | --- | --- |
   | `ClassRecord` | `id`, `school`, `grade` |
   | `Child` | `id`, `classId`, `rollNo`, `name`, `homeLanguage` (use the existing `Language`) |
   | `Attendance` | `classId`, `date`, `childId`, `present` |
   | `Lesson` | `id`, `classId`, `date`, `conceptId` |
   | `Check` | `id`, `classId`, `date`, `conceptId` (the MVP checks one concept) |
   | `Answer` | `checkId`, `childId`, `questionId`, `version` (`A`, `B` or `C`), `value` (int or null), `status` (`right`, `wrong` or `no_data`) |

   `Attendance` and `Lesson` must stay compatible with `AttendanceLog` and `LessonLog` in `rules.ts`.

2. **Migrations** in `supabase/migrations/` at the repo root:
   - Add the Supabase CLI as a root dev dependency: `pnpm add -Dw supabase`.
   - Run `pnpm supabase init`, `pnpm supabase link --project-ref <ref>`, and `pnpm supabase db push`.
   - Create the tables `classes`, `children`, `attendance`, `lessons`, `checks`, `answers` and `audio_clips`, with snake_case columns matching the schemas above.
   - Add these keys and constraints:
     - `attendance` has the primary key `(child_id, date)`.
     - `children` has `unique (class_id, roll_no)`.
     - `answers` has `unique (check_id, child_id, version)`.
   - `audio_clips` has the columns `id`, `kind`, `language`, `source` and `url` (nullable).
   - Leave out the columns TECH.md lists for out-of-scope features: `parent_phone`, `transcript`, `version_order`, `probe_results`, `child_records`, `cause`.
   - Stage 7 adds `confidence` and `reviewed` to `answers` later; don't add them now.

3. **API** in `apps/api`:
   - Add `@supabase/supabase-js` and use the service-role key, server-side only.
   - Split `src/index.ts` into `src/app.ts`, which builds and exports the Hono `app`, and `src/index.ts`, which only calls `serve`. This lets tests call `app.request()`.
   - Enable `hono/cors` for the Vite dev origin (`http://localhost:5173`).
   - Validate request bodies with the core schemas, and return 400 on bad input.
   - Suggested routes:
     - `POST /classes`, `GET /classes/:id`
     - `POST /classes/:id/children` (bulk), `GET /classes/:id/children`
     - `PUT /classes/:id/attendance/:date`, with the body `{ absentChildIds: string[] }`. Write a row for every child in the class: present unless listed.
     - `GET /classes/:id/attendance`
     - `POST /classes/:id/lessons`, `GET /classes/:id/lessons`
     - `POST /classes/:id/checks`, `POST /checks/:id/answers` (bulk), `GET /checks/:id/answers`
   - A script `pnpm --filter @triveni/api seed:audio` upserts `packages/content/data/audio.json` into `audio_clips`.
   - There is no auth in the MVP: it has one teacher and one demo class. Note this in the PR.

**Verify:**
- [x] `pnpm supabase db push` applies cleanly to the hosted project.
- [x] `apps/api/src/app.test.ts` uses `app.request()` to create a class, children, attendance, a lesson, a check and its answers. It reads each one back, compares the result, then deletes the test class.
- [x] Bad input (for example `homeLanguage: "french"`) returns 400.
- [x] `pnpm typecheck` and `pnpm test` pass.

---

## [x] Stage 4: Class setup + daily log (web)

**Depends on:** Stage 3 for syncing. The Dexie and UI parts can start before it lands.

**Build:**
- **Dexie store** (`dexie`, `dexie-react-hooks`) in `apps/web/src/db.ts`, with tables mirroring Stage 3: classes, children, attendance, lessons, checks, answers.
  - Every write goes to Dexie first, then to the API with a plain `fetch`.
  - There is no outbox or retry queue (out of scope). On API failure, show a small error.
  - The API URL comes from `VITE_API_URL`.
- **Class setup screen:** school, grade, and a list of children (roll number, name, home language: Hindi or Bhili).
- **Daily log screen:**
  - Pick a date (default today). Everyone is present by default; tap a child to mark them absent.
  - Pick the day's concept from a dropdown built from `concepts` in `@triveni/content`, and save.
- **Demo seed** (a "Load demo class" button):
  - 20 children (mostly Bhili, 2–3 Hindi) and two school weeks of attendance and lessons.
  - Ravi (Bhili) is present every day.
  - Meena is absent on both days borrowing was taught.
  - Keep the seed data in one file (`apps/web/src/seed.ts`), so Stage 6 can rely on it.
- Use shadcn components (`pnpm dlx shadcn@latest add …` from `apps/web`) with large tap targets. The app is used on a phone, so build for a narrow screen.

**Verify:**
- [x] Setting up a class and logging a day in the browser creates the matching rows in Supabase.
- [x] The demo seed loads, and the daily log history shows Meena absent on the borrowing days.
- [x] `pnpm typecheck` passes.

---

## [x] Stage 5: Check runner + answer grid (web)

**Depends on:** Stage 4.

**Build:**
- **Audio files:**
  - No real recordings exist yet. For now, make stand-in clips: Hindi from Sarvam Bulbul (key in `apps/api/.env`, generated once by a script), or team voice recordings.
  - Upload them to a public Supabase Storage bucket `audio`, and set `file` (the bucket path) on each entry in `packages/content/data/audio.json`.
  - Stand-ins must have `source: "bulbul"`. Only real human recordings get `source: "human"`.
- **Check screen:**
  1. The teacher picks a concept.
  2. Show A large, for copying onto the board.
  3. Play B (Hindi), then C (Bhili).
  4. The player refuses to play any clip whose `source` isn't `"human"` unless `VITE_DEV_ALLOW_STANDINS=true`. Show a clear message when it refuses.
  5. Fixed order for the MVP: A, B, C. Rotation is out of scope.
- **Answer grid:**
  - One row per child (by roll number), with A, B and C number inputs. A blank stays `null`.
  - Children whose home language is Hindi have no C cell.
  - On save, mark each answer with `markAnswer` from `@triveni/core` and store it via Dexie and the API.
- This grid is also where Stage 7's photo reading will fill in answers, so keep it a separate component.

**Verify:**
- [x] With `VITE_DEV_ALLOW_STANDINS=true`, a full check runs end to end in the browser.
- [x] With the flag off, stand-in clips are blocked.
- [x] Saved answers have the right status, and blanks are `no_data`.

---

## [ ] Stage 6: Results + brief

**Depends on:** Stage 5.

**Build:**
- **Results screen for a check:**
  - Call `placeChild` for each child, using the lessons and attendance for the class.
  - Show the six placements: Ready, Language gap, Word-problem gap, Never taught, Taught but not learned, Unclear.
- **What to do, for each group:**

  | Group | What to show |
  | --- | --- |
  | Language gap | A key-word card: the question's `keywordIds` → Hindi, romanised and meaning, plus a play button for the Bhili audio |
  | Word-problem gap | The three `stories` for the concept |
  | Never taught | "Recap the lesson" |
  | Taught but not learned | The concept's `reteachAudio` clip and "use real objects" |

- **Brief:**
  - Show `buildBrief(...)` straight away.
  - Then call `POST /brief/reword` in `apps/api`:
    - It uses `@anthropic-ai/sdk` with model `claude-opus-5-5` and low effort, and returns the reworded text in plain English.
    - Put `ANTHROPIC_API_KEY` in `apps/api/.env`, using the `triveni-app` workspace key (capped at $75).
    - Ask Claude to load the `claude-api` skill before writing this call.
  - If the call fails or times out, keep showing the template.

**Verify:**
- [ ] On the demo class, Ravi lands in Language gap with the word card, and Meena lands in Never taught. To get these results, enter answers that produce those patterns.
- [ ] The reworded brief appears.
- [ ] With the API stopped, the template brief still shows.

---

## [ ] Stage 7: Slate photo reading

**Depends on:** Stage 5. This stage can run in parallel with Stage 6.

**Build:**
- **Camera input:** `<input type="file" accept="image/*" capture="environment">`. Resize each photo in the browser so the long side is about 1500 px before upload.
- **`POST /slates/read`** in `apps/api`:
  - Sends one photo to Claude (`claude-opus-5-5`, low effort) and asks for a structured output: `[{ roll, answers: [{ row, version, value, confidence }] }]`.
  - The box symbols always map to the same version: circle = A, triangle = B, square = C.
  - Cache the fixed instructions.
- **Filling the grid:** results go into the Stage 5 grid.
  - Flag low-confidence reads, and roll numbers that are missing or appear twice.
  - The teacher fixes flagged cells with a tap.
- **Migration:** add `confidence` and `reviewed` to `answers`.
- **Accuracy script:** `apps/api/scripts/slate-accuracy.ts` reads a folder of photos plus a CSV of the true answers, and prints the accuracy.

**Verify:**
- [ ] Sample photos (make your own: numbers written in boxes) fill the grid, and the flags appear.
- [ ] The accuracy script runs on a sample folder.

---

## [ ] Stage 8: Deploy + demo

**Build:**
- **Hosting:** the API on Railway or Fly.io (a host that doesn't sleep), and the web app on Vercel or Cloudflare Pages.
- **Settings:** set `VITE_API_URL`, and set the CORS origin to the deployed web URL.
- **Audio:** swap in the real human recordings with `source: "human"`, and leave `VITE_DEV_ALLOW_STANDINS` off.
- **Rehearsal:** practise the 3-minute demo in IDEA.md (Bare minimum MVP → Demo).

**Verify:**
- [ ] The full demo runs on a phone against the deployed build.

---

## Open items for people, not code

- [ ] A Hindi speaker reviews all the Hindi in `packages/content/data/questions.json` and `stories.json`. Claude wrote it.
- [ ] Find a bilingual Hindi–Bhili speaker to record:
  - the 3 B and 3 C questions (C: translate `scriptHi` into Bhili, keeping the numbers)
  - the 6 key words
  - the 3 reteaching clips.
- [ ] Get keys: Supabase (Stage 3), Sarvam (Stage 5 stand-ins), Anthropic `triveni-app` (Stage 6).
