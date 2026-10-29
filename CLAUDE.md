# Project Overview 

Refer to resources/IDEA.md and resources/TECH.md for the core app idea and tech stack. 

## Current Scope
Build only what IDEA.md "Bare minimum MVP" lists. Everything under "Left out of the MVP" (probe, language profile, offline outbox, multi-language classes, voice notes...) is out of scope unless I ask. If a task seems to need it, stop and ask.

MVP decisions:
- Data: Supabase + Dexie. Writes go to Dexie, then straight to the API (no outbox yet).
- Answers: tap-to-enter grid first; Claude slate-photo reading comes later (Stage 7).
- UI in English. No i18next, PWA/offline, voice notes or WhatsApp. Stretch goals only when I ask.
- Audio is generated, not recorded: B from Bulbul files, C spoken live in Bhili by `services/bhili` (AI4Bharat bhili-tts) through `POST /speak`. No human-only rule.

## Build Stages
We build one stage at a time. A stage is done only when its verify check passes.
Detailed instructions for every remaining stage, plus repo conventions, are in TODO.md. Read it before starting a stage, and when a stage is done, mark it `[done]` here and tick it in TODO.md.

0. [done] Scaffold: pnpm workspace (`apps/web`, `apps/api`, `packages/core`, `packages/content`). Verify: typecheck + tests pass, web shows a page, `GET /health` is ok.
1. [done] Content + types: Zod schemas in core; concept map, A/B/C questions, key words, practice stories, audio manifest in content. Verify: all content parses; every audio ref resolves.
2. [done] Rules engine (core): mark answers, pattern → 5 groups, never taught vs taught-not-learned from attendance, template brief. Verify: Vitest covers all 8 patterns, blanks, absent/present split, brief.
3. [done] Database + API: Supabase migrations for the MVP tables; Hono CRUD routes validated with core types. Verify: migrations apply; each entity round-trips.
4. [done] Class setup + daily log (web): Dexie store, setup screen, tap-absent + concept dropdown, demo seed (20 children, 2 weeks, Ravi and Meena). Verify: rows reach Supabase; seed shows Meena's absences.
5. [done] Check runner + answer grid (web): show A, play B then C (C now spoken live in Bhili), tap grid, Hindi-home children skip C. Verify: full check in browser; saved answers marked right, blanks `no_data`.
6. Results + brief: five groups with what to do; template brief, reworded by Claude with template fallback. Verify: Ravi → Language gap, Meena → Never taught; works with API off.
7. Slate photo reading: camera, resize, Claude structured read into the grid, flag low-confidence/missing/duplicate rolls, accuracy script. Verify: sample photos fill the grid with flags.
8. Deploy + demo: Railway/Fly + Vercel/Cloudflare, Bhili speech service on a GPU host (or every C clip cached beforehand). Verify: 3-minute demo runs on a phone.

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