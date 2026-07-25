# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Agenda Gruppi — a local-only PWA (packaged as a native Android app via Capacitor) for a climbing coach to plan and run group training sessions, with an integrated gym timer (Tabata/EMOM/AMRAP) featuring hybrid voice/beep audio. Single user, Android phone only, Italian UI, no backend/account/cloud — all data lives in IndexedDB on-device. The full functional spec is in `spec-agenda-gruppi.md` — read it before making product decisions; it is the source of truth for scope.

## Commands

```bash
npm run dev        # Vite dev server
npm run build       # production build to dist/
npm run preview     # serve the production build locally
npm run check       # svelte-check + tsc --noEmit (no test suite exists in this project)
npm run cap:sync    # build + copy dist/ into the Capacitor Android project
npm run cap:open    # open the Android project in Android Studio
```

There is no automated test suite — verification during development has been done by driving the Vite dev server in a browser and inspecting IndexedDB state directly.

The Android native project lives in `android/`. After any change to the web app, `npm run cap:sync` must be run before rebuilding in Android Studio — Capacitor copies a static snapshot of `dist/` into `android/app/src/main/assets/public`, it does not read from the source tree live.

## Architecture

Svelte 5 (runes mode: `$state`, `$derived`, `$props`, no legacy stores/`export let`) + TypeScript + Vite. Dexie wraps IndexedDB (`src/lib/db.ts`, schema versioned via `db.version(n).stores(...)`). No component framework routing — `src/App.svelte` just switches between four top-level screens by tab state.

### Ownership model: Circuit is not a standalone entity

The single most important structural fact about this codebase: **`Circuit` (src/lib/circuitTypes.ts) has no independent list/library screen.** A circuit always belongs to an owner — `ownerType: 'session' | 'variant'` + `ownerId` — and is created/edited inline from within whatever owns it (`SessionEditor.svelte` or `StandardVariantEditor.svelte`, both embedding `CircuitForm.svelte`). This is because `Session` (a planned day for a group) and `StandardVariant` (a reusable template in the Allenamenti Standard library) are structurally identical containers — warmup text + ordered circuits + notes — so circuits are shared plumbing between the two, not a feature of either one specifically.

This is why `src/lib/circuitService.ts` exists as a small owner-agnostic layer (`getCircuitsFor`, `deleteCircuitsFor`, `copyCircuits`) used by both `sessionService.ts` (duplicating a session to next week, auto-provisioning "today") and `standardService.ts` (applying a variant to today's session, saving a session as a new variant). When adding a new feature that touches circuits, go through `circuitService.ts` rather than querying `db.circuits` directly, to keep the owner-type filtering consistent (the Dexie index is a compound `[ownerType+ownerId]`).

### Groups and schedule are hardcoded

`src/lib/groups.ts` hardcodes the 4 groups (id, display name, color) and the weekly schedule (`WEEKLY_SCHEDULE`: weekday → ordered list of group slots — Wed/Thu each have two groups back-to-back). There is intentionally no editor for this; it's out of scope per the spec. `slotsForDate`/`slotsForWeekday` are the lookup used by `Oggi.svelte` to know which group(s) are active on a given day, including the "double day" case where the coach switches between two sessions without seeing them simultaneously.

### Timer engine is timestamp-driven, not tick-counted

`src/lib/timerEngine.ts` builds a flat `TimerPhase[]` timeline upfront per format (`buildTabataTimeline`/`buildEmomTimeline`/`buildAmrapTimeline`), then `TimerEngine` steps through it on a `setInterval`, computing remaining time from an absolute `phaseEndTime` timestamp each tick (not decrementing a counter) to avoid drift. Audio cueing logic (triple-beep vs. spoken phrase/exercise name, replacing rather than overlapping) lives in the same class — see the code comments around `maybeCue`/`speakUpcoming`/`announceCompletion` before changing phase transitions, the completion-announcement fallback (Tabata always ends on a `work` phase with no trailing cue window, unlike EMOM/AMRAP) is easy to accidentally break. `src/lib/timerAudio.ts` handles the actual audio: synthesized beep via Web Audio, TTS via Web Speech API, with a hybrid lookup (personal `VoiceRecording` in IndexedDB first, else TTS) for phrases and exercise names.

### Screens vs. reusable editors

The four bottom-nav screens (`Oggi.svelte`, `Agenda.svelte`, `AllenamentiStandard.svelte`, `Eserciziario.svelte`, wired in `App.svelte` via `BottomNav.svelte`) are thin — they list/navigate and delegate actual editing to shared full-screen editor components: `SessionEditor.svelte`, `StandardVariantEditor.svelte`, `CircuitForm.svelte`, `ExerciseForm.svelte`, `Timer.svelte`/`TimerRunner.svelte`. `Oggi` and `Agenda` are a deliberate split of what was originally one screen: Oggi is the single-session focused view (today only, CTA-driven), Agenda is the flat scrollable chronological list of all sessions with today's entry marked — they share the same underlying `Session` data and both open `SessionEditor`.

### Known Svelte 5 + Dexie gotcha

`$state` objects/arrays are reactive Proxies. Passing one directly into `db.table.add()`/`.put()` throws `DataCloneError` (IndexedDB's structured clone can't serialize a Proxy) — this has bitten multiple features already (circuit save, session duplication). Always spread into plain objects/arrays (`{ ...tabata }`, `[...exerciseIds]`) immediately before any Dexie write.

### Voice recording

`VoiceRecorder.svelte` is a generic record/play/delete component (MediaRecorder + getUserMedia) used both inside `ExerciseForm.svelte` (per-exercise pronunciation) and `PhraseLibrary.svelte` (the three fixed timer phrases: lavora/riposa/completato). `PhraseLibrary` is reached via a settings-gear icon in `Eserciziario.svelte`'s topbar rather than its own nav tab, since the bottom nav is fixed at 4 items per spec.

### Styling

Fixed dark theme only (no light mode, no OS-preference switching) — CSS variables in `src/app.css`. Font is `@fontsource/inter`, bundled locally (not loaded from Google Fonts CDN) because the app must work with zero network connectivity in the gym. Visual reference is `home-diario-style.html` in the repo root (antracite background, rounded cards, colored pills, orange accent for primary actions).
