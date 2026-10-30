# Project Overview 

Refer to resources/IDEA.md and resources/TECH.md for the core app idea and tech stack. 

## Current Scope
The MVP is done and frozen on the `mvp` branch (tag `mvp-demo-v1`). `main` is the full hackathon build: IDEA.md "Full hackathon build", plus the language profile with its listening check, word evidence, a Hindi interface and rotating version order. Three teammates build it in parallel lanes (see TODO.md). Build only your stage. If a task seems to need another stage's work, or anything IDEA.md shows only as a design (the teacher's language learning, the community recorder bot), stop and ask.

Full-build decisions:
- One language pair (Hindi and Bhili) and one concept chain: numbers to 20, subtraction within 20, borrowing, two-digit subtraction.
- No login: one teacher and one demo class.
- Data: a separate full-build Supabase project, plus Dexie (database `triveni-full`). Writes go to Dexie, then the API; Stage 17 adds the outbox.
- Audio is generated, not recorded:
  - Hindi from Sarvam Bulbul: the B files, and `/speak` with `language: "hindi"`.
  - Bhili from bhili-tts, through `/speak`. Every Bhili text is fixed content, cached in advance with `warm:speech` (as in the MVP), so no GPU host is deployed. One can be added later by setting `TTS_URL`.
  - No human-only rule.
- Interface in Hindi by default, with an English toggle (i18next).
- Parents are reached through a Telegram bot (Bot API). WhatsApp was dropped: a new Meta business account was locked, and Twilio trial accounts only send Twilio's templates.
- Feature work never goes to `mvp`. Fixes are cherry-picked there only when I ask.

## Build Stages
We build one stage at a time per person. A stage is done only when its verify check passes.
Detailed instructions for every stage, the lanes, the cut line and repo conventions are in TODO.md. Read it before starting a stage, and when a stage is done, mark it `[done]` here and tick it in TODO.md.

MVP (done, on `mvp`):

0. [done] Scaffold: pnpm workspace (`apps/web`, `apps/api`, `packages/core`, `packages/content`). Verify: typecheck + tests pass, web shows a page, `GET /health` is ok.
1. [done] Content + types: Zod schemas in core; concept map, A/B/C questions, key words, practice stories, audio manifest in content. Verify: all content parses; every audio ref resolves.
2. [done] Rules engine (core): mark answers, pattern → 5 groups, never taught vs taught-not-learned from attendance, template brief. Verify: Vitest covers all 8 patterns, blanks, absent/present split, brief.
3. [done] Database + API: Supabase migrations for the MVP tables; Hono CRUD routes validated with core types. Verify: migrations apply; each entity round-trips.
4. [done] Class setup + daily log (web): Dexie store, setup screen, tap-absent + concept dropdown, demo seed (20 children, 2 weeks, Ravi and Meena). Verify: rows reach Supabase; seed shows Meena's absences.
5. [done] Check runner + answer grid (web): show A, play B then C (C now spoken live in Bhili), tap grid, Hindi-home children skip C. Verify: full check in browser; saved answers marked right, blanks `no_data`.
6. [done] Results + brief: five groups with what to do; template brief, reworded by Claude with template fallback. Verify: Ravi → Language gap, Meena → Never taught; works with API off.
7. [done] Slate photo reading: camera, resize, Claude structured read into the grid, flag low-confidence/missing/duplicate rolls, accuracy script. Verify: sample photos fill the grid with flags.
8. [done] Deploy + demo: Render (API) + Vercel (web) from the `mvp` branch, every Bhili clip cached beforehand. Verify: 3-minute demo runs on a phone.

Full build (on `main`; lane in brackets):
9. [done] Contracts [A]: full-build record and content schemas, migration, Dexie `triveni-full`, API routes split into `routes/`. Verify: migrations apply to the full-build project; every entity round-trips.
10. [done] Rules: marking and 8 patterns [A]: wrong-answer causes, copied numbers as no data, all 8 patterns, absent on check day, "same pattern twice", version rotation, concept picking. Verify: Vitest covers each.
11. [done] Running record + daily brief [A]: concept status, root of a concept gap, word evidence, language profile, buddies, daily brief (en/hi). Verify: Meena and Arjun → root borrowing; Ravi confirmed across two weeks; brief has all sections.
12. Demo seed v2 + simulation [A]: 20 children, 3 weeks, last week's check, planted causes; `simulate` script. Verify: planted children land correctly; the simulation prints an accuracy table.
13. Hindi interface [B]: i18next, a namespace per screen, Hindi default with an English toggle. Verify: every screen fully in both languages.
14. Check runner v2 [B]: draft kept in Dexie, 1–2 concepts, rotated order, gallery multi-pick, in-app multi-shot camera, parallel uploads. Verify: a 2-concept check on a phone; the draft survives a screen switch; 5 gallery photos all read.
15. Results, brief and quick re-check [B]: all groups with causes and actions, a daily brief screen with read-aloud, tap re-check. Verify: Ravi confirmed, Meena never taught; a re-check confirms Sita; the brief works with the API off.
16. Group time [B]: probe runner, reteaching kit in the profile's language, listening check. Verify: Arjun's restart point; the kit's language follows the profile.
17. Offline [B, first to cut]: PWA cache and Dexie outbox for writes, photos and voice notes. Verify: an airplane-mode check syncs on reconnect.
18. Speech everywhere [C]: `/speak` with `language` (Bulbul for Hindi, made on request), a clear 503 for uncached Bhili, `warm:speech --check`, an optional Colab/Kaggle warming how-to. Verify: Hindi is cached; uncached Bhili shows the message; the check lists exactly the uncached texts.
19. Full content [C]: two-digit subtraction, pages, weekly and re-check questions, wrong-answer lists, probes, kit, listening items, catch-up scripts; translated and warmed. Verify: parses; numbers survive translation; reviewed by a person.
20. Slate reading v2 [C]: roster in each request, Devanagari rules, roll confidence, name matching, unplaced slates, per-roll accuracy. Verify: roll accuracy beats `mvp-demo-v1`; no slate goes to the wrong child.
21. Voice notes [C]: record, Saaras, page → concept, Claude fallback. Verify: page and no-page notes both map correctly.
22. Telegram parent notes [C]: bot, QR deep-link opt-in, `.ogg` voice messages with the activity as caption, a webhook with a secret token for replies. Verify: a demo phone receives a Bhili catch-up voice message; replies are stored.
23. Deploy + demo [all]: a second Render service and Vercel project from `main`, every Bhili clip cached beforehand, design slides, the 5-minute demo. Verify: the demo runs twice in a row on a phone.

Follow these rules when you are building: 

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.