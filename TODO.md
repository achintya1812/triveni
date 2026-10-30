# Triveni: full build

The MVP (Stages 0–8) is done and frozen on the `mvp` branch (tag `mvp-demo-v1`). Its stage notes are in `TODO.md` on that branch. This file covers the full build, Stages 9–23, on `main`.

Three people build it in about two days, each working with a Claude Code instance. Each stage lists what to build, what it depends on and how to check it's done.

## Lanes

Each lane owns one set of folders, so parallel PRs rarely touch the same files.

| Lane | Owns | Stages, in order |
| --- | --- | --- |
| **A: Rules** | `packages/core`, `apps/web/src/seed.ts` | 9 → 10 → 11 → 12 |
| **B: Web app** | `apps/web` (screens, components, Dexie, locales) | 13 → 14 → 15 → 16 → 17 |
| **C: Server + AI** | `apps/api`, `services/bhili`, `packages/content` | 18 → 19 → 20 → 21 → 22 |
| **All** | | 23 |

**Timeline**
- **Day 1:** A builds Stage 9 first and gets it merged within about 3 hours, because most later stages build on it. Then A does 10 and starts 11. B does 13, then 14. C does 18, 19 and the server part of 20.
- **Day 2:** A finishes 11, then 12. B does 15, 16, then 17 if time allows. C finishes 20, then 21 and 22. Features freeze mid-afternoon; then everyone does 23.

**Cut line.** If you're behind at midday on Day 2, drop from the top of this list down:
1. Stage 17, offline and outbox.
2. The simulation report in 12. Keep the seed.
3. Stage 22, Telegram. Keep a "Share voice note" button that uses the Web Share API.
4. Stage 21, voice notes. Keep the concept dropdown.
5. The listening check in 16. The language profile then comes from checks and the teacher's note alone.

The diagnosis story must survive: Stages 9–11, 14–16 and 20.

## Workflow

**Once per teammate**
1. Clone the repo, install pnpm 10 and run `pnpm install`.
2. Run `pnpm typecheck && pnpm test` to confirm everything passes before you change anything.
3. Create your own `apps/api/.env` and `apps/web/.env` (see `README.md`). Point them at the **full-build Supabase project**, never the MVP's. Get keys from a teammate privately and never commit them.

**For each stage**
1. Pull the latest `main` and branch from it: `git checkout -b stage-9-contracts` (your stage's number and name).
2. **Claim the stage.** Run `gh pr list`; if a PR for that stage is already open, someone has it, so pick the next stage in your lane. Otherwise make an empty commit, push, and open a **draft PR** titled "Stage N: <name>" straight away, so others can see it's taken.
3. Start a fresh Claude Code session with this prompt: "Read CLAUDE.md and TODO.md, then build Stage N. Ask me before doing anything outside that stage."
   - Claude should first check that the stages listed under **Depends on** are ticked here and merged into `main`.
   - If one isn't, build only the parts that don't need it, as the stage notes describe, and say what's left.
   - The stage tells you which keys it needs ("You need"). If one is missing, ask the person who owns it rather than working around it.
4. Build until every box in the stage's Verify list passes, along with `pnpm typecheck` and `pnpm test`.
5. In the same branch, mark the stage `[done]` in `CLAUDE.md` and tick it here.
6. Push and mark the PR ready for review. CI runs typecheck and tests. Someone from another lane reviews it, checking that it stays inside its stage and that rules changes match IDEA.md's tables. Merge as soon as it's approved: with two days, a PR shouldn't sit for hours.
7. Pull `main` before starting your next stage. **Everyone pulls right after Stage 9 merges.**

Parallel PRs all edit `CLAUDE.md` and `TODO.md`, so expect small merge conflicts there. Resolve them by keeping both sets of ticks.

## What already exists (from the MVP)

| Path | What it holds |
| --- | --- |
| `packages/core/src/content.ts` | Zod schemas for content: `Language`, `AudioClip`, `Concept`, `Keyword`, `Question`, `PracticeStory` |
| `packages/core/src/records.ts` | Zod schemas for stored records: `ClassRecord`, `Child`, `Attendance`, `Lesson`, `Check`, `Answer` |
| `packages/core/src/rules.ts` | `markAnswer`, `patternGroup` (5 groups), `wasTaught`, `placeChild`, with tests in `rules.test.ts` |
| `packages/core/src/brief.ts` | `buildBrief`: the template brief for one check |
| `packages/core/src/slates.ts` | `SlateReading`: what Claude returns for one photo |
| `packages/content/data/*.json` | 3 concepts, one A/B/C question each, 6 key words, 9 practice stories, 3 Bulbul B clips |
| `apps/api/src/app.ts` | CRUD routes, `POST /speak` (Bhili, cached by a hash of the text), `POST /brief/reword`, `POST /slates/read` |
| `apps/api/scripts` | `seed:audio`, `make:standins` (Bulbul B clips), `warm:speech`, `slate:accuracy` |
| `apps/web/src` | Dexie store (`db.ts`), screens `Setup`, `DailyLog`, `CheckRunner`, `Results`; `check.ts` (`markGrid`, `applySlates`, `rollFlags`); `results.ts`; `seed.ts` |
| `services/bhili` | `tts_server.py` (bhili-tts, `POST /speak`) and `translate.py` (fills in missing `bhili` fields) |

## Conventions

- Workspace packages export TypeScript source directly (`"exports": { ".": "./src/index.ts" }`), with no build step. Import them as `@triveni/core` and `@triveni/content`.
- Rules code uses camelCase. The database uses snake_case. Convert at the API boundary with the existing `snake`/`camel` helpers.
- Dates are `YYYY-MM-DD` strings; timestamps are ISO strings.
- Tests use Vitest, as `*.test.ts` next to the code.
- Secrets go in `apps/api/.env`. Never put keys in `apps/web`.
- **API routes:** after Stage 9, each area has its own file in `apps/api/src/routes/` and is mounted with one line in `app.ts`. Add new routes to your area's file, or a new file, rather than to `app.ts`.
- **Migrations:** only add new timestamped files to `supabase/migrations/`, and never edit one that has been applied. They apply to the full-build Supabase project. The MVP's project is never migrated from `main`.
- **UI text:** after Stage 13, every string goes through `t()`, with keys in `apps/web/src/locales/{en,hi}/<screen>.json`, one file per screen. Hindi is the default.
- **Rules:** Stages 10 and 11 change what the rules decide, on purpose, following the tables in IDEA.md. Outside those stages, don't change what `rules.ts` decides without asking. These MVP rules stay:
  - A child with no attendance row counts as present.
  - "Never taught" means absent on every day the concept was taught.
  - A concept with no logged lesson counts as taught.
  - A blank answer is no data.
- **Branches:** feature work stays off `mvp`. Fixes are cherry-picked there only when asked.

---

## [x] Stage 9: Contracts

**Lane:** A. **Depends on:** nothing. **Blocks:** most later stages, so keep it small and merge it fast.

**Goal:** every shared type, table and Dexie store for the full build exists, so the three lanes can build against them in parallel.

**You need:** the full-build Supabase project's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `apps/api/.env`, and `pnpm supabase link --project-ref <full-build ref>`.

**Build:**

1. **Record schemas** in `packages/core/src/records.ts`:

   | Schema | Change |
   | --- | --- |
   | `Child` | Add `parentChatId` (the parent's Telegram chat id as a string, nullable), `parentOptInAt` (ISO datetime, nullable) and `hindiUnderstanding` (`well`, `some` or `none`, nullable: the teacher's own view, which seeds the language profile). |
   | `Lesson` | Add `source` (`dropdown` or `voice`), `transcript` (nullable) and `page` (int, nullable). |
   | `Check` | Replace `conceptId` with `questionIds` (1–2 ids; row *n* on the slate asks `questionIds[n-1]`, and the concept comes from the question). Add `kind` (`weekly` or `recheck`), `versionOrder` (a permutation of `A`, `B`, `C`) and `childIds` (null for the whole class, or the children in a re-check). |
   | `Answer` | Add `row` (1 or 2) and `cause` (the id of the matched wrong answer, nullable). Tap-marked answers (re-check, Grade 1 oral check) have `value: null` and a status of `right` or `wrong`. |
   | `ProbeResult` (new) | `id`, `classId`, `childId`, `conceptId` (the concept the child failed), `date`, `passedAtOnce`, `restartConceptId` (nullable), `form` (`concrete`, `pictorial` or `abstract`, nullable) |
   | `ListeningResult` (new) | `classId`, `childId`, `date`, `itemId`, `language`, `value` (nullable), `status` |
   | `ParentMessage` (new) | `id`, `classId`, `childId`, `kind` (`catch_up` or `activity`), `conceptId`, `file` (audio bucket path), `status` (`queued`, `sent` or `failed`; Telegram has no delivery or read receipts for bots), `telegramMessageId` (nullable), `sentAt` (nullable) |

2. **Content schemas** in `packages/core/src/content.ts`. Existing content must still parse, so new fields stay optional until Stage 19 fills them, then become required in 19.

   | Schema | Change |
   | --- | --- |
   | `Concept` | Add `nameHi`, `pages` (textbook page numbers), `catchUp: { english, hindi, bhili }` (the parent's catch-up lesson with a household activity) and `probe: ProbeStep[]` |
   | `ProbeStep` (new) | `form` (`concrete`, `pictorial` or `abstract`), `english`, `hindi`, `answer` (int). The probe is oral in the teacher's language, so there is no Bhili. |
   | `Question` | Add `use` (`weekly` or `recheck`) and `wrongAnswers: { A, B, C }`, each a list of `WrongAnswer` |
   | `WrongAnswer` (new) | `value`, `cause` (a short id such as `added`, `borrowing` or `counting`), `meaning` (shown to the teacher), `pointsTo` (`keyword`, `concept` or `no_data`) and `conceptId` (when it points to a concept) |
   | `Kit` (new) | `id`, `conceptId`, `steps: [{ teacherDoes: { english, hindi }, says: { english, hindi, bhili } }]`, `keywordIds` (8–10) and `parentActivity: { english, hindi, bhili }` |
   | `ListeningItem` (new) | `id`, `pictures` (4 entries, each `{ number, emoji, english }`), and a prompt for each language, `hindi: { text, answer }` and `bhili: { text, english, answer }`. The two prompts ask for different pictures, so a child can't copy from the first. |

   Export `kits` and `listeningItems` from `@triveni/content` (empty arrays until Stage 19).

   **As built:**
   - New records carry `classId` (like `Attendance`), so the API can list them by class.
   - The new `Child` and `Lesson` fields have defaults (`null`, or `source: "dropdown"`), so the old shapes still parse.
   - Content uses defaults where an empty value is natural (`pages`, `probe`, `use: "weekly"`, empty `wrongAnswers`) and makes `nameHi` and `catchUp` optional. Stage 19 tightens these.
   - Shared enums `Version` and `Status`, and `ProbeForm`, are exported from core.
   - Routes for the new records:
     - `POST`/`GET /classes/:id/probes`
     - `/classes/:id/listening` (bulk)
     - `/classes/:id/parent-messages`
     - `GET /classes/:id/checks`
   - Shared route helpers are in `apps/api/src/http.ts`.
   - The `Draft` type for Stage 14 is in `db.ts`.

3. **Migration** `supabase/migrations/<timestamp>_full_build.sql`:
   - Add the new columns for `children`, `lessons`, `checks` and `answers`. On `checks`, drop `concept_id`. On `answers`, the primary key becomes `(check_id, child_id, row, version)`.
   - Add the new tables `probe_results`, `listening_results` (primary key `(child_id, item_id, language)`) and `parent_messages`. RLS on, with no policies, as before.
   - Create the storage buckets: `audio` (public) and `voice-notes` (private). Insert them into `storage.buckets` in the migration, so a fresh project gets them.
   - There is no `child_records` table: the record is derived on the phone (Stage 11).
   - Run `pnpm supabase db push` against the full-build project. It applies the MVP migrations too.

4. **Dexie** in `apps/web/src/db.ts`:
   - Open a new database, `triveni-full`, because Dexie can't change a primary key in an upgrade, and the full build has no data to keep.
   - Its tables are `classes`, `children`, `attendance`, `lessons`, `checks`, `answers` (key `[checkId+childId+row+version]`), `probeResults`, `listeningResults` (key `[childId+itemId+language]`), `parentMessages`, and `drafts` (key `classId`, for Stage 14).
   - Fix the existing screens so they compile against the new types. Use one row and `kind: "weekly"`; the real changes come in Stage 14.

5. **API:**
   - Split `apps/api/src/app.ts` into `routes/classes.ts` (classes, children, attendance, lessons), `routes/checks.ts` (checks, answers, probe results, listening results), `routes/parents.ts` (parent messages), `routes/speak.ts`, `routes/brief.ts` and `routes/slates.ts`. `app.ts` keeps the middleware, `onError` and one `.route()` line per file.
   - Add a POST (upsert) and a GET for each new record.

**Verify:**
- [x] `pnpm supabase db push` applies cleanly to the full-build project, and both buckets exist.
- [x] `app.test.ts` round-trips every entity, the new ones included, then deletes the test class.
- [x] Existing content still parses, and the existing screens still work with one row.
- [x] `pnpm typecheck` and `pnpm test` pass.

---

## [ ] Stage 10: Rules: marking and all eight patterns

**Lane:** A. **Depends on:** 9.

**Goal:** the rules engine reads wrong answers, knows all eight patterns, and only places a child once a pattern is confirmed.

**Build** in `packages/core/src/rules.ts` (split into more files if it grows past about 300 lines):
- **`markAnswer(value, question, version)`** returns `{ status, cause }`:
  - A blank is `no_data`.
  - A number that appears in that version's own question (`A.prompt`, `B.english` or `C.english`) and isn't the answer means the child copied it. It's `no_data` with the cause `copied`.
  - A value in `wrongAnswers[version]` is `wrong`, with that entry's `cause`. If its `pointsTo` is `no_data`, the status is `no_data`.
  - Any other wrong value is `wrong`, with `cause: null`. Stage 15 lists these.
- **`patternGroup`**: all eight patterns from IDEA.md's table:

  | A | B | C | Pattern |
  | --- | --- | --- | --- |
  | right | right | right | `ready` |
  | wrong | wrong | wrong | `concept_gap` |
  | right | wrong | right | `language_gap` |
  | right | wrong | wrong | `word_problem_gap` |
  | wrong | right | right | `symbol_gap` |
  | right | right | wrong | `clip_failed` |
  | wrong | wrong | right | `language_symbol_gap` |
  | wrong | right | wrong | `inconsistent` |
  | any `no_data` | | | `unclear` |

  For Hindi-home children (no C): `rr` is ready, `rw` is a word-problem gap, `wr` is a symbol gap and `ww` is a concept gap.
- **`placeChild`** works per row (concept) and returns the pattern, with `concept_gap` split into `never_taught` and `taught_not_learned` by `wasTaught`. A child absent on the check date (attendance row with `present: false`) is never marked wrong: they're `never_taught` if they also missed the lesson, otherwise `not_checked`.
- **Confirmation** ("the same pattern twice"). `confirmed(childId, conceptId, history)` is true when:
  - the child's two latest results on that concept (weekly or re-check) give the same placement, or
  - for `language_gap`, the child has a language gap on a check in another ISO week, on any concept (language evidence belongs to the child), or
  - for `taught_not_learned`, a probe result after the check has `passedAtOnce: false`.

  A probe with `passedAtOnce: true` clears the label: the child goes back to the class.

  `ready` and `never_taught` need no confirmation. `inconsistent`, `unclear` and `not_checked` are never groups: the next check decides.

  **The re-check list** is every child with an unconfirmed placement other than these and `taught_not_learned` (which goes to the probe).
- **`versionOrder(date)`:** `ABC`, `BCA`, `CAB`, chosen by ISO week number mod 3.
- **`pickConcepts(lessons, checks, concepts)`:** takes the concepts with a lesson since the last weekly check, at most 2. Those with the most concepts depending on them (directly or not) in the concept map come first; a tie goes to the one taught most recently.

**Verify:**
- [ ] Vitest covers all 8 patterns with C and all 4 without it, `unclear`, copied numbers, a listed cause, an unlisted wrong answer, and absent-on-check-day (both cases).
- [ ] Confirmation tests cover each of the three ways to confirm and the probe that clears.
- [ ] Tests cover `versionOrder` across three weeks and `pickConcepts` with 3 taught concepts.
- [ ] Old MVP tests that no longer apply (such as a copied number counting as wrong) are updated, and the PR says which.

---

## [ ] Stage 11: Running record + daily brief

**Lane:** A. **Depends on:** 10.

**Goal:** everything IDEA.md's "What Triveni remembers about each child" table lists, worked out from stored records, plus the morning brief built from it.

**Build** in `packages/core`:
- **`childRecord(child, data)`** takes everything Dexie holds for the class (checks, answers, lessons, attendance, probe results, listening results) plus content. It returns:
  - **`concepts`**: for each concept, the status (`not_taught`, `taught_not_learned`, `learned` or `not_checked`), the latest placement with its `confirmed` flag, and the causes seen.
  - **`root(conceptId)`**: where a concept gap started.
    1. A wrong-answer cause that points to a concept wins (Arjun wrote 11 for 14 − 5 → borrowing).
    2. Otherwise, walk the concept's prerequisites, nearest first. Take the first one the child was never taught, or else the first one with status `taught_not_learned`.
    3. Otherwise, the concept itself.
  - **`words`**: for each key word, `{ met, stumbled }`. A word is met whenever a B question tagged with it is answered. It's stumbled on when B is wrong while A and C are right; a B cause with `pointsTo: "keyword"` counts double.
  - **`language`**: `{ hindi, bhili, reteachIn }`, scores from 0 to 1.
    - The Hindi score averages the listening check's Hindi items with the B results on checks where A was right.
    - The Bhili score does the same with the Bhili items and C results.
    - The teacher's `hindiUnderstanding` counts as one result: well = 1, some = 0.5, none = 0.
    - `reteachIn` is `school` if the Hindi score is at least 0.7; `home` if Bhili is at least 0.3 above Hindi; `mixed` otherwise.
    - Hindi-home children are always `school`. With no evidence, a Bhili-home child is `home`.
- **`buddies(records)`:** children ready on the latest check whose two language scores are both at least 0.7.
- **`buildDailyBrief(today, data)`** replaces `buildBrief`. It's a template in the order of IDEA.md's example:
  1. Who is back: absent on the day before the latest logged day, present on it. Also what they missed.
  2. How many children missed a concept that other concepts depend on: recap it in group time, and send catch-up notes to their parents.
  3. Each confirmed group, with its action and names. The language group lists the class's top blocking words.
  4. The probe group, with each child's root.
  5. The re-check list.

  It takes an `en`/`hi` language and has a template in each. `POST /brief/reword` gains a `language` field, so Claude rewords it in plain Hindi.
- **Defaults:** the thresholds above are defaults the team agreed to. Keep them as named constants in one place, so changing them is a single edit.

**Verify:**
- [ ] Meena (absent both borrowing days) fails two-digit subtraction → her root is borrowing.
- [ ] Arjun's 11 → root borrowing, even though he was present.
- [ ] Ravi's language gaps in two different weeks are confirmed without a re-check.
- [ ] Word evidence over Ravi's checks ranks `de-diye` and `bache` at the top.
- [ ] The daily brief for a fixture class has all five sections, in both languages.

---

## [ ] Stage 12: Demo seed v2 + simulation

**Lane:** A. **Depends on:** 11 (and uses 19's content when it lands).

**Goal:** a demo class that shows every part of the product, plus a simulation that measures how well the rules find the true cause.

**Build:**
- **Seed** in `apps/web/src/seed.ts` ("Load demo class"):
  - 20 children: mostly Bhili-home, 3 Hindi-home, with a few `hindiUnderstanding` values.
  - 3 school weeks of attendance.
  - Lessons for all 4 concepts, with page numbers; one of them has `source: "voice"` and a transcript.
  - Last week's weekly check, with answers that leave:
    - Ravi: a language gap on subtraction within 20 (he'll be confirmed by this week's live check).
    - Meena: absent both days borrowing was taught.
    - Arjun: present, but wrote 11 on borrowing's A.
    - Sita: a word-problem gap seen once, to confirm with a live re-check.
    - A spread of the other patterns.
  - Listening results for the whole class.
  - No parent phones: the teacher adds the demo parent live.
- **Simulation** in `packages/core/src/simulate.ts`, run with `pnpm --filter @triveni/core simulate` (add `tsx` as a dev dependency):
  - It generates classes of made-up children, each with a planted cause: a language gap, a concept gap with a known root, absences on given days, or none. Each has a careless-mistake rate.
  - It runs their answers through the rules over 4 weekly checks, with re-checks and probes.
  - It prints a table: for each planted cause, how often the true cause was found, and after how many checks.

**Verify:**
- [ ] The seed loads, and Ravi, Meena, Arjun and Sita are placed as planted.
- [ ] The simulation prints the table and runs in under 10 seconds, with no API calls.

---

## [ ] Stage 13: Hindi interface

**Lane:** B. **Depends on:** nothing. Start at once.

**Goal:** the teacher's app is in Hindi, with English one tap away.

**Build:**
- Add `i18next` and `react-i18next`, set up in `apps/web/src/i18n.ts`.
- Use one namespace per screen: `apps/web/src/locales/{en,hi}/<screen>.json`, plus `common.json`.
- Wrap every existing string in `t()`. Claude writes the Hindi, and the Hindi reviewer checks it on Day 2.
- Add a हिंदी / English toggle in the header, remembered in `localStorage` (wrapped in try/catch). Hindi is the default.
- Concept names use `nameHi` in Hindi, once Stage 9 has added it.

**Verify:**
- [ ] Every current screen renders fully in Hindi and fully in English, with no leftover English in Hindi mode.
- [ ] The choice survives a reload.

---

## [ ] Stage 14: Check runner v2

**Lane:** B. **Depends on:** 9; uses 10's `versionOrder` and `pickConcepts` once they land (until then, use fixed `ABC` and a manual pick).

**Goal:** a real check day: one or two concepts, rotated order, many photos at once, and nothing lost when the teacher switches screens.

**Build:**
- **Draft in Dexie:**
  - The check in progress (questions, grid values, slate reads, check id) lives in `drafts`, keyed by class.
  - It survives switching to Daily log and back, and a reload.
  - "Discard" clears it, and so does saving.
- **Concepts:**
  - `pickConcepts` suggests up to two, using each concept's question with `use: "weekly"`.
  - The teacher can change them.
  - Two concepts means two rows on the slate and in the grid.
- **Order:**
  - The versions run in `versionOrder(today)`.
  - The app shows A for the board and plays B (Bulbul file) and C (Bhili, `/speak`) for each row.
  - It tells the class which box to fill next, by symbol: "Now fill the △ box".
- **Grid:**
  - There's one row group per concept.
  - Hindi-home children have no C cell.
  - Children absent today are greyed out. An "Absent today" toggle writes their attendance for the check date, and they get no answers.
- **Photos:** replace the single `capture` input with:
  - **Choose from gallery:** `<input type="file" accept="image/*" multiple>` with no `capture`, so Android allows several photos.
  - **Take photos:** an in-app camera (`getUserMedia` with the rear camera, a shutter button, a thumbnail strip and Done), for several shots in a row.
  - Every photo is resized to 1500 px on the long side, and uploads run in parallel, 3 at a time, each showing its own progress and retry.
- **`applySlates`** fills each row from its question. Stage 20 changes how rolls are matched; keep that code in `check.ts`.

**Verify:**
- [ ] A 2-concept check runs end to end on a phone, in this week's rotated order.
- [ ] Switching to Daily log and back, or reloading, keeps the draft.
- [ ] Choosing 5 photos from the gallery on Android reads all 5, in parallel.
- [ ] Taking 3 photos with the in-app camera reads all 3.

---

## [ ] Stage 15: Results, brief and quick re-check

**Lane:** B. **Depends on:** 10, 11.

**Goal:** the teacher sees each child's group and why, reads tomorrow's brief, and confirms patterns with a quick re-check.

**Build:**
- **Results screen**, for each check and concept:
  - Show every placement, with a "seen once" badge on unconfirmed ones.
  - Under each wrong answer that has a cause, show the meaning: "wrote 21: added instead of subtracted".
  - Each group shows what to do:

    | Group | What to show |
    | --- | --- |
    | Language gap | The key-word card (the question's key words: Hindi, romanised, meaning; Hindi audio and Bhili audio) |
    | Word-problem gap | The concept's practice stories |
    | Symbol gap | "Solve a story, then write the sum that matches it", with the stories |
    | Language + symbol gap | The key-word card, then the stories |
    | Clip failed | "Hindi worked, Bhili didn't." If 30% or more of the Bhili-home children land here, warn that the clip may be unclear. |
    | Never taught | Recap the lesson; "Send catch-up to parents" (Stage 22) |
    | Taught but not learned | "Run the probe" (Stage 16) |
    | Inconsistent, unclear, not checked | "The next check decides" |
    | Ready | Move on |

- **Brief screen** (the first screen when a class exists):
  - Show `buildDailyBrief` straight away.
  - Then ask `POST /brief/reword` for the teacher's language, keeping the template if that fails.
  - "Read aloud" plays the Hindi brief through `/speak` with `language: "hindi"` (Stage 18).
- **Quick re-check:**
  - Start it from the brief's re-check list.
  - It uses each concept's `use: "recheck"` question, so the A/B/C numbers are fresh, and plays the same way as a weekly check.
  - The teacher taps ✓ or ✗ for each box for each child (`value: null`, status `right` or `wrong`).
  - It saves as a check with `kind: "recheck"` and `childIds` set.
  - The same tap grid can run a whole-class oral check for early Grade 1.
- **Stretch:** list wrong answers that have no cause, and add a `POST /answers/explain` route in `routes/checks.ts` where Claude suggests a likely cause, shown as a suggestion only.

**Verify:**
- [ ] On the demo seed, after this week's live check, Ravi is in a confirmed language gap and Meena is in Never taught.
- [ ] A re-check that repeats Sita's pattern confirms her; one that doesn't clears her.
- [ ] With the API stopped, the template brief still shows.

---

## [ ] Stage 16: Group time: probe, reteaching kit, listening check

**Lane:** B. **Depends on:** 11; 19 for the probe, kit and listening content.

**Goal:** the small-group work behind the brief: confirm a concept gap and find where to restart, reteach in the right language, and measure each child's language once.

**Build:**
- **Probe runner** (the probe group from the brief):
  1. Step 1 is the failed concept in numbers (`abstract`). A child who passes `passedAtOnce` goes back to the class.
  2. For the rest, start at the child's root (`childRecord(...).root`) and go abstract → pictorial → concrete. If all three fail, move to the root's own prerequisite.
  3. The teacher taps ✓ or ✗ for each child at each step. A child stops at their first ✓.
  4. Save a `ProbeResult` for each child, and show the restart point: "start with take-away using real objects, then move to drawings".
- **Reteaching kit** (from the probe result, or Taught but not learned): it shows the `Kit` for the concept.
  - **Steps:** each step shows what the teacher does (in the interface language), with a play button for what the audio says. Use Bhili if the group's most common `reteachIn` is `home`, and Hindi otherwise. The teacher can switch.
  - **Key-word card:** the kit's 8–10 words, with Hindi and Bhili audio.
  - **Buddy:** the suggested buddy (`buddies`).
  - **Parents:** "Send activity to parents" (Stage 22).
- **Listening check** (once, from the class screen):
  - For each `ListeningItem`, show the 4 numbered emoji pictures large, for the teacher to copy to the board.
  - Play the Hindi prompt, then the Bhili prompt.
  - Children write two numbers. The teacher enters them in a tap grid (two cells per child), saved as `ListeningResult`s.
  - On the class setup screen, the teacher can set each child's `hindiUnderstanding`.

**Verify:**
- [ ] The probe finds Arjun's restart point at borrowing, and a child who passes the first step is cleared.
- [ ] The kit plays Bhili lines for a group whose profile says `home`, and Hindi for `school`.
- [ ] Entering listening results changes the children's language profile and their kit language.

---

## [ ] Stage 17: Offline: PWA + outbox

**Lane:** B. **Depends on:** 14–16. **First to cut.**

**Goal:** the teacher can work with no signal, and everything syncs when it returns.

**Build:**
- **vite-plugin-pwa:**
  - It caches the app shell and the audio for the drafted check (the B files and the cached Bhili `/speak` files).
  - The app installs to the home screen.
- **Outbox:**
  - Add a Dexie `outbox` table (`db.version(2)`). Every API write in `db.ts` goes through it.
  - Rows are sent in order and retried when the browser comes back online and on app start.
  - A small badge shows how many are waiting.
- **Photos and voice notes** wait in the outbox as blobs, and are read or transcribed when the signal returns. The review screen appears then.

**Verify:**
- [ ] In airplane mode: log a day, run a check from the cache, and photograph slates.
- [ ] When the phone reconnects, the rows reach Supabase, the photos are read, and the review screen appears.

---

## [ ] Stage 18: Speech everywhere

**Lane:** C. **Depends on:** nothing. Start at once.

**Goal:** Hindi speech through the same `/speak` route as Bhili, and a reliable way to make sure every Bhili clip is cached before anyone needs it.

**How Bhili works (as in the MVP):**
- Every Bhili sentence the app speaks is written in advance in `packages/content`, so nothing new in Bhili is made while the app runs.
- `warm:speech` speaks every Bhili text once, using `tts_server.py` on a laptop CPU (about a minute per sentence), and caches it in the `audio` bucket.
- The deployed API has no speech service and serves only cached clips.
- **Later, optionally:** a cloud GPU host (Modal, a Hugging Face endpoint, RunPod) runs the same `tts_server.py`, and the API points `TTS_URL` at it, with no code changes. We skipped it because it needs a card.

**You need:** `SARVAM_API_KEY`.

**Build:**
- **`POST /speak` takes `{ text, language }`:**
  - `bhili` goes to the Bhili service at `TTS_URL`, as now.
  - `hindi` goes to Sarvam Bulbul (reuse the call in `make-standins.ts`, `bulbul:v3`). Hindi is made on request even when deployed (the brief read aloud is new text every day), then cached.
  - The cache key hashes the language and the text together.
- **A clip that isn't cached:** when a Bhili text isn't cached and the speech service can't be reached, `/speak` answers 503 straight away with "this Bhili clip hasn't been made yet", and `SpeakButton` shows that message instead of hanging.
- Update `SpeakButton` and `warm:speech` to pass the language.
- **`warm:speech --check`:** it asks the API (`API_URL`, so it also works against the deployed one) for each text without making anything, and lists every one that isn't cached. Stages 19 and 23 use it.
- **Faster warming (optional, free):** run `tts_server.py` in a Google Colab or Kaggle notebook on its free GPU, expose it with `cloudflared tunnel --url http://localhost:8790`, and set `TTS_URL` to the tunnel's address while warming. Add a short how-to in `services/bhili/README.md`. Use it only for warming, never as part of the demo.

**Verify:**
- [ ] Hindi text speaks through Bulbul, and a second request is served from the cache.
- [ ] With the speech service stopped, an uncached Bhili text gets the 503 message in the app, and a cached one still plays.
- [ ] `warm:speech --check` lists exactly the uncached texts.

---

## [ ] Stage 19: Full content

**Lane:** C. **Depends on:** 9.

**Goal:** all the content the full build needs, reviewed by people and with every clip cached.

**You need:** a Hindi reviewer (and a Bhili reviewer, if possible) for about an hour. The textbook pages and the Hindi the books use are in `resources/TEXTBOOKS.md`: model the questions and key words on them. `concepts.json` already has the Class 2 `pages`; add `[61, 62, 63, 67, 68]` for two-digit subtraction.

**Build** in `packages/content/data/`:
- **Concepts:**
  - Add `two-digit-subtraction`, which depends on `borrowing`.
  - Every concept gets `nameHi`, `pages`, `catchUp` and `probe` steps (all three forms).
- **Questions:**
  - At least 2 for each concept: one `use: "weekly"` and one `use: "recheck"`.
  - Each A/B/C has its own numbers, of the same difficulty.
  - Each has key words, and `wrongAnswers` for every version.
  - Add a B clip for each new question with `make:standins`.
- **Key words:** at least 8–10 for borrowing, the concept the kit covers.
- **Kit** (`kits.json`): one kit, for Taught but not learned on borrowing. It has paired steps like IDEA.md's stones example, its key words, and a parent activity.
- **Listening items** (`listening.json`): 4 items, each with 4 emoji pictures and two prompts asking for different pictures.
- **How to write it:**
  - Claude drafts the wrong-answer lists, probe steps, catch-up scripts and kit with the Message Batches API. Add `apps/api/scripts/draft-content.ts`, which writes a review file.
  - A person reviews the draft before it's committed.
  - Keep the numbers in every `english` field matching the `hindi` and `bhili` text.
- **Bhili:**
  - Extend `translate.py` to the new `bhili` fields (catch-up, kit, listening).
  - Extend `warm:speech` to every Bhili and Hindi text, then run both. Warming is a local API plus a local `tts_server.py`, pointed at the full-build Supabase project, so the shared bucket gets the clips. Colab or Kaggle make it faster (Stage 18).
- Once everything is filled, make the new content fields required in `content.ts`.

**Verify:**
- [ ] All content parses with the fields required, and every audio ref resolves.
- [ ] `translate.py` reports no changed numbers.
- [ ] `warm:speech --check` lists no uncached texts.
- [ ] A person has reviewed the Hindi, and the PR says who.

---

## [ ] Stage 20: Slate reading v2

**Lane:** C. **Depends on:** nothing for the server part; 14 for the web part (it changes the grid and photo code).

**Goal:** rolls, including Devanagari ones, are read reliably, and a slate is never silently given to the wrong child.

**You need:** the notebook test set (photos plus `answers.csv`). Add a `name` column to the CSV where children wrote names.

**Build:**
- **Request:** `POST /slates/read` also takes the class roster (`[{ roll, name }]`) and the number of rows.
- **Prompt** (in `apps/api/src/slates.ts`):
  - Give the valid rolls and names.
  - Add a table of Devanagari digits that look like Latin ones (१ looks like 9, ४ like 8, ७ like 6 or 9).
  - Each slate uses one script for all its numbers.
  - Copy the roll exactly as written, then convert it.
  - Read a name if one is written (Devanagari or Latin).
- **Reading:** `SlateReading` gains `rollAsWritten`, `rollConfidence` and `name` (nullable) for each slate.
- **Matching** (`check.ts`):
  - A roll that's in the roster, read with confidence of at least 0.8, places the slate.
  - Otherwise a name that matches the roster places it.
  - If the roll and the name disagree, or neither matches, the slate is **unplaced**.
- **Unplaced slates:** they show in a list on the check screen ("Photo 2, slate 3: roll written '९?', name 'मीना'"), each with a picker of the children who have no slate yet.
- **`slate:accuracy`:**
  - Print every misread roll (true value against what was read and the written form), and roll accuracy separately from answer accuracy.
  - Take `--effort low|medium`.
  - Run both levels on the test set and keep the better one. Put the numbers in the PR.

**Verify:**
- [ ] On the notebook test set, roll accuracy beats `mvp-demo-v1` (run the old prompt for the baseline).
- [ ] Every misread roll shows as unplaced; none is given to the wrong child.
- [ ] A slate with only a name is placed by name.

---

## [ ] Stage 21: Voice notes

**Lane:** C. **Depends on:** 9.

**Goal:** the teacher logs what she taught with a ten-second voice note instead of the dropdown.

**You need:** `SARVAM_API_KEY` with Saaras speech-to-text, and about 10 recorded test notes (some with a page number, some without).

**Build:**
- **Daily log:**
  - A hold-to-record button (`MediaRecorder`, webm/Opus).
  - The note uploads to `POST /voice-notes`, in `routes/voice.ts`.
- **Server:**
  1. Store the audio in `voice-notes`.
  2. Send it to Sarvam's speech-to-text with `model: "saaras:v3"`, in code-mixed mode (teachers mix Hindi and English: "borrowing, page 65"), with the concept names and "page", "पेज", "पृष्ठ" as key terms if the API takes them. A request takes audio under 30 seconds.
  3. Look for a page number in the transcript and match it to a concept's `pages`.
  4. With no page number, ask Claude (`claude-opus-5-5`, low effort, structured output limited to the concept ids, or none).
  5. Return `{ transcript, page, conceptId, via: "page" | "claude" }`.
- **Web:** the dropdown is prefilled with the concept. The teacher confirms or changes it. The lesson saves with `source: "voice"`, the transcript and the page.
- **Accuracy script:** `apps/api/scripts/voice-accuracy.ts` runs the test notes and prints the matched concept against the true one.

**Verify:**
- [ ] "Borrowing, page 65" maps by page, and a note with no page maps through Claude, both to the right concept.
- [ ] The voice-accuracy script runs on the test notes, and the PR gives the result.

---

## [ ] Stage 22: Telegram parent notes

**Lane:** C. **Depends on:** 9, 18, 19 (and 21 for transcribing Hindi replies).

**Goal:** parents get home-language voice notes on Telegram (catch-up lessons and home activities), and their replies come back.

**Why Telegram:**
- **WhatsApp was ruled out.** A new Meta business account was locked (error 131031), and Twilio trial accounts can only send Twilio's own templates.
- **Telegram's Bot API is easy:** it's free, set up in minutes, and needs no business verification, 24-hour window or message templates.
- **Known limit, to say in the demo:** fewer rural parents use Telegram than WhatsApp.

**You need:**
- **A bot made with @BotFather**, and in `apps/api/.env`:
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_WEBHOOK_SECRET` (any random string, for example from `openssl rand -hex 16`)
  - `PUBLIC_API_URL` (the address Telegram calls: a tunnel while developing, the Render URL once deployed)
- **In `apps/web/.env`:** `VITE_TELEGRAM_BOT` (the bot's username, without the @).
- **Demo phones** with Telegram installed and signed in.

**Build** in `apps/api/src/routes/telegram.ts`, using `fetch` against `https://api.telegram.org/bot<token>/<method>` (no SDK):
- **Opt-in:**
  - In the app, each child has a QR code for `https://t.me/<VITE_TELEGRAM_BOT>?start=<code>`, where the code is the first 8 characters of the child's id.
  - The parent scans it and taps **Start**, and the bot receives `/start <code>`.
  - The webhook then sets `children.parent_chat_id` and `parent_opt_in_at`, and replies with a welcome in Hindi.
  - One parent can scan the codes of several children (siblings). They share one chat id.
- **Voice notes:**
  - Make the audio with `/speak`'s cache, in the child's home language.
  - Telegram shows audio as a voice message only if it's OGG/Opus, MP3 or M4A, and bhili-tts makes WAV. So convert each clip once to `.ogg` Opus with `ffmpeg-static`, and store it in the public `audio` bucket (`tg/<hash>.ogg`).
  - Send it with `sendVoice`:
    - `voice`: the public URL
    - `caption`: the activity steps, at most 1024 characters
    - one inline button, "हो गया 👍" (`callback_data`: `done:<parent message id>`)
- **Sending:** `POST /parents/send` with `{ kind, conceptId, childIds }`, called from:
  - "Send catch-up to N parents" (never-taught children)
  - "Send activity to parents" (the kit)

  Each send is a `parent_messages` row (`sent`, with Telegram's `message_id`, or `failed`). Children without an opt-in are listed in the app, not sent.
- **Webhook:**
  - `POST /telegram/webhook` first checks that the `X-Telegram-Bot-Api-Secret-Token` header equals `TELEGRAM_WEBHOOK_SECRET`, and rejects anything else. It answers 200 at once, then handles:
    - `/start <code>`
    - a button tap (`callback_query`): store it and call `answerCallbackQuery`
    - a text reply
    - a voice reply: fetch it with `getFile` and download it from `https://api.telegram.org/file/bot<token>/<file_path>`. Store it in a private `parent-media` bucket, transcribed with Saaras if the child is Hindi-home (stored as is for Bhili).
  - Replies go in a new `parent_replies` table (`id`, `child_id`, `received_at`, `type`, `text`, `file`, `transcript`), added with the bucket in this stage's migration.
- **Registering the webhook:** a script, `pnpm --filter @triveni/api telegram:webhook`, calls `setWebhook` with:
  - `url`: `<PUBLIC_API_URL>/telegram/webhook`
  - `secret_token`
  - `allowed_updates`: `["message", "callback_query"]`

  Run it again whenever `PUBLIC_API_URL` changes. While developing, use a tunnel (`cloudflared tunnel --url http://localhost:8787`).
- **Optional:** the teacher can start the bot too, and receive the morning brief the same way.

**Verify:**
- [ ] A demo phone scans a child's QR code and taps Start, and the parent is opted in.
- [ ] It receives a Bhili catch-up that plays as a voice message, with the activity as its caption.
- [ ] Tapping "हो गया 👍" is stored, and so is a Hindi voice reply, with its transcript.
- [ ] A webhook call without the right secret header is rejected.
- [ ] A child whose parent hasn't opted in is listed, not sent.

---

## [ ] Stage 23: Deploy full build + demo

**Lane:** all. **Depends on:** everything that made the cut.

**Goal:** the full build runs on a phone against a deployed stack, and the team can give the demo.

**Build:**
- **Hosting** (the MVP's Render service and Vercel project stay on `mvp`, untouched):
  - **API:** a second Render service from `main`, on the Starter plan (it doesn't sleep, so webhooks always land). Set the full-build Supabase keys, `ANTHROPIC_API_KEY`, `SARVAM_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `PUBLIC_API_URL` (the Render URL) and `WEB_ORIGIN`.
  - **Web app:** a second Vercel project from `main`, with `VITE_API_URL`, `VITE_AUDIO_BASE_URL` and `VITE_TELEGRAM_BOT`.
  - **Webhook:** run `telegram:webhook` with `PUBLIC_API_URL` set to the Render URL.
  - **Bhili speech:** no speech service is deployed, so leave `TTS_URL` unset on Render, as in the MVP. After the last content change, run `warm:speech` locally (Stage 19), then `API_URL=<render url> warm:speech --check` must list nothing.
  - **README:** add a "Deploy (full build)" section.
- **Designs:** two static mock screens or slides for what IDEA.md says is shown only as designs:
  - the teacher's language learning (tomorrow's words, spaced review)
  - the community audio library (the recorder bot)
- **Demo script** (about 5 minutes), written into README:
  1. Load the demo class. Log today with a voice note ("borrowing, page 65", Jyoti's garland story in the Class 2 book).
  2. Run a two-concept check in this week's rotated order. Show A, play B, then C in Bhili.
  3. Choose the slate photos from the gallery; fix one flagged box and assign one unplaced slate.
  4. On the results, Ravi is in a confirmed language gap with his key words; Meena is in Never taught; Arjun's 11 points to borrowing.
  5. Show the Hindi morning brief, and read it aloud.
  6. Run a quick re-check that confirms Sita.
  7. Run the probe for Arjun, then open the reteaching kit in Bhili.
  8. Send the catch-up to Meena's parent: the demo phone receives the Bhili voice note on Telegram, live.
  9. Close with the design slides and the simulation table.

**Verify:**
- [ ] The demo runs on a phone against the deployed full build, twice in a row, in under 6 minutes.

---

## Open items for people, not code

- [ ] A new Supabase project for the full build (URL and service-role key, shared privately).
- [ ] A Sarvam key with Saaras speech-to-text (Stages 21, 22). Confirm the Bulbul version.
- [ ] A Telegram bot made with @BotFather: its token and username (Stage 22).
- [x] The textbook and page numbers for the 4 concepts (Stages 19, 21): NCERT Class 2, in `resources/TEXTBOOKS.md`.
- [ ] The notebook slate test set with `answers.csv` (Stage 20).
- [ ] About 10 recorded voice-note test files (Stage 21).
- [ ] A Hindi speaker reviews the new questions, wrong-answer lists, kit and interface text on Day 2.
- [ ] A Bhili speaker from the target area reviews every `bhili` field and how bhili-tts says it, especially numbers and single words.
- [ ] Demo phones: an Android phone for the teacher, and a phone with Telegram for the parent.
