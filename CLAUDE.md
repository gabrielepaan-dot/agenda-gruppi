# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It documents the **current state** of the app so a fresh session doesn't need to re-explore the codebase from scratch. See section 9 for the rule on keeping it that way.

## Project

Agenda Gruppi — a local-only PWA (also packaged as a native Android app via Capacitor) for a climbing coach to plan and run group training sessions, with an integrated gym timer (Tabata/EMOM/AMRAP) featuring hybrid voice/beep audio. Single user, Android phone only, Italian UI, no backend/account/cloud — all data lives in IndexedDB on-device. The full functional spec is `spec-agenda-gruppi.md` in the repo root — it is the source of truth for scope, but a few implementation details have since diverged from it (flagged in section 7).

## 1. Stack tecnico

- **Svelte 5** in runes mode (`$state`, `$derived`, `$props`, `$derived.by` — no legacy `export let`/stores) + **TypeScript** + **Vite 8**.
- **Dexie** (`src/lib/db.ts`) wraps IndexedDB; schema is versioned via `db.version(n).stores(...)`, with `.upgrade()` migrations at v6, v7, and v8.
- **svelte-dnd-action** for drag-to-reorder exercises within a circuit (`CircuitForm.svelte`).
- **Capacitor** (`@capacitor/core`, `@capacitor/android`) wraps the built web app into a native Android shell; native project lives in `android/`.
- **@fontsource/inter** bundled locally (not Google Fonts CDN) — the app must work with zero connectivity in the gym.
- No component-framework routing — `src/App.svelte` just switches between top-level screens by tab state (`$state<NavTab>`).
- No automated test suite. Verification is done by driving the Vite dev server (or the deployed preview) in a browser and inspecting IndexedDB/console directly.

### Commands

```bash
npm run dev         # Vite dev server
npm run build        # production build to dist/
npm run preview      # serve the production build locally
npm run check        # svelte-check + tsc --noEmit (no test suite exists)
npm run cap:sync     # build + copy dist/ into the Capacitor Android project
npm run cap:open     # open the Android project in Android Studio
```

The Android native project does **not** read from the source tree live — `npm run cap:sync` must be run (copies `dist/` into `android/app/src/main/assets/public`) before rebuilding in Android Studio.

### Deploy (Cloudflare Pages)

The repo is pushed to GitHub (`github.com/gabrielepaan-dot/agenda-gruppi`) and connected to **Cloudflare Pages** for automatic deploys: every push to `master` triggers a build (`npm run build`, output dir `dist`, `NODE_VERSION=22`) and publishes to `agenda-gruppi.pages.dev`. This is the fast iteration loop for bugfixing from the phone — open the URL in Chrome, "Add to Home Screen" for a PWA-like icon, reload after each deploy. No Capacitor rebuild needed for this loop; the APK is only for final/offline-verified installs. **Caveat**: data entered via the `.pages.dev` PWA lives in that browser's IndexedDB — it does **not** sync with the native APK's storage, they're separate origins/storage buckets.

## 2. Architettura generale

```
src/
  App.svelte              — tab switcher (5 tabs), renders BottomNav
  app.css                  — global CSS variables (dark theme), reset
  main.ts                  — Svelte app mount
  lib/
    db.ts                  — Dexie instance + schema versions
    groups.ts              — hardcoded groups + weekly schedule
    types.ts                — Exercise + VoiceRecording/VoiceProfile types
    circuitTypes.ts         — Circuit, TimerFormat params, Tipologia
    sessionTypes.ts         — Session type
    standardTypes.ts        — StandardVariant type
    circuitService.ts       — owner-agnostic circuit CRUD helpers
    sessionService.ts       — session duplication / auto-provisioning
    standardService.ts      — apply variant ↔ session conversions
    timerEngine.ts          — TimerPhase timeline builder + TimerEngine class
    timerAudio.ts           — TimerAudio class (beep/TTS/recording playback)
    wakeLock.ts              — WakeLockManager (keep screen on during timer)
    BottomNav.svelte         — 5-tab nav bar
    Oggi.svelte              — screen: today's session
    Agenda.svelte            — screen: flat chronological session list
    AllenamentiStandard.svelte — screen: standard workout library (2-level drill-down)
    Eserciziario.svelte      — screen: exercise list
    Timer.svelte             — screen/component: standalone timer setup + per-circuit launcher
    SessionEditor.svelte     — full-screen editor for one Session
    StandardVariantEditor.svelte — full-screen editor for one StandardVariant
    CircuitForm.svelte       — full-screen editor for one Circuit (shared by both owners)
    ExerciseForm.svelte      — bottom-sheet editor for one Exercise
    TimerRunner.svelte       — full-screen running timer (the actual countdown UI)
    VoiceRecorder.svelte     — generic record/play/delete widget (MediaRecorder)
    VoiceProfiles.svelte     — manage named voice profiles + their phrase recordings
    NotesList.svelte         — reusable numbered-list editor for the Note field (Session/StandardVariant)
android/                   — Capacitor native Android project (build artifacts gitignored)
spec-agenda-gruppi.md       — product spec, source of truth for scope
home-diario-style.html      — visual reference mockup (antracite/rounded/pill style)
```

## 3. Navigazione

Bottom nav has **5 tabs** (`BottomNav.svelte`): Oggi, Agenda, Allenamenti, Esercizi, Timer. (`spec-agenda-gruppi.md` still says "4 voci" — that line is stale, see section 7. Also note: the tab and screen were formerly labeled "Standard" — renamed to "Allenamenti" for the user-facing label/header only, the `AllenamentiStandard.svelte` filename and internal `Standard*` type/identifier names are unchanged. Same pattern for "variante": user-facing strings now say "allenamento" everywhere, but the `StandardVariant` type/table/component names are unchanged.)

- **Oggi** (`Oggi.svelte`) — auto-detects today's group(s) via `slotsForDate`; on "double days" (Wed/Thu) shows a pill switcher between the day's two groups, never both at once. Auto-provisions today's `Session` via `ensureSessionForDate` (duplicates the most recent past session for that group if one exists, else creates an empty one). Shows the "last time" card and circuit list; tapping anything opens `SessionEditor`. Read-mostly — all editing is delegated. **Limitation**: only ever operates on *today's* date, no date picker.
- **Agenda** (`Agenda.svelte`) — flat, reverse-chronological list of **all** sessions across all groups, today's entry highlighted. Tapping opens `SessionEditor`. **Limitation**: no way to create a session for an arbitrary future date from here — sessions only come into being via Oggi's auto-provisioning or via "duplicate to next week" from inside an existing session.
- **Allenamenti** (`AllenamentiStandard.svelte`) — 2-level drill-down: group → allenamento (flat list, no intermediate category level — collapsed 2026-07-25, see section 7). The group list also shows each group's day(s) of the week, derived from `WEEKLY_SCHEDULE`, joined with a comma when a group meets more than once. CRUD-complete on `StandardVariant` ("allenamento" in the UI): create via the single FAB (picking a `date` from a `<select>` constrained to the group's scheduled weekdays, see below), or via "save current session as allenamento standard" from `SessionEditor`; edit via `StandardVariantEditor`; delete cascades its circuits. Each variant card shows its `date` (formatted via `formatShortDate`) plus its `tipologie` pills. Inside `StandardVariantEditor`, two chips — "▶ Oggi" and "▶ Prossima lezione (‹data›)" — copy the allenamento's content into the session for today or for the group's next scheduled occurrence respectively (`groups.ts`'s `nextScheduledDate` helper), each showing its own "Applicata ✓" feedback independently; both go through the same `ensureSessionForDate`/`applyVariantToSession` pair, only the target date differs. **Limitation**: allenamenti can't be manually reordered (only circuits inside one can).
- **Esercizi** (`Eserciziario.svelte`) — flat list grouped by pattern category, FAB to add, tap to edit via `ExerciseForm` (name, category, Core subcategory if applicable, optional quality, voice recording). CRUD-complete. Deleting an exercise removes its voice recording but leaves the dangling id in any circuit's `exerciseIds` — shown as `—` wherever the name is looked up (matches the spec's "disappears from history silently" intent). **Note**: the old settings-gear entry point to a phrase/voice library is gone from this screen — voice profile management moved to the Timer screen (see section 7).
- **Timer** (`Timer.svelte`, embedded mode) — standalone timer: pick format (Tabata/EMOM/AMRAP), edit intervals via tap-to-open bottom sheets (time-kind rows use a scrollable MIN/SEC wheel picker, iOS-style; count-kind rows like Cicli/Round still use a plain number input), save/apply/delete reusable `TimerPreset`s ("I miei workout"), pick voice (system TTS voice or a `VoiceProfile`) and announce toggles, then "Avvia" → `TimerRunner`. Each saved preset card also has its own "▶ Avvia" button that applies the preset and starts it immediately (separate from the "✓" circle, which only applies the preset into the current setup form without starting). The same component is reused **non-embedded** as a per-circuit launcher (opened from the ▶ button in `SessionEditor`/`StandardVariantEditor`) — in that mode format/params are read-only (they come from the `Circuit`), only voice/announce settings remain editable. CRUD-complete for `TimerPreset`s only in standalone mode.

## 4. Schema dati (Dexie / `src/lib/db.ts`)

| Table | Key fields | Notes |
|---|---|---|
| `exercises` | `name`, `category` (PatternCategory), `coreSubcategory?`, `quality?` (forza/potenza) | indexed on `name`, `category`. `PatternCategory` values (`src/lib/types.ts`): `spinta_verticale`, `spinta_orizzontale`, `tirata_verticale`, `tirata_orizzontale`, `spinta_gambe`, `tirata_gambe`, `core`, `accessori`, `mobilita` (label "Mobilità"), `multiarticolare` (label "Multiarticolare Total body"). Reworked 2026-07-25 from the previous flat `spinta`/`trazione`/`verticale`/`orizzontale` set — old exercises tagged with those retired values show with no category label until manually re-edited (no migration was run). |
| `voiceRecordings` | `targetType` ('exercise'\|'phrase'), `exerciseId?`, `phraseKey?`, `profileId?`, `audioBlob`, `createdAt` | exercise recordings are **global** (one per exercise); phrase recordings are scoped per `(phraseKey, profileId)` pair |
| `voiceProfiles` | `name`, `createdAt` | a named "voice" (e.g. a person) owning a set of the 4 fixed-phrase recordings |
| `circuits` | `ownerType` ('session'\|'variant'), `ownerId`, `order`, `name` (optional, see section 7), `exerciseIds[]`, `timerFormat`, `tabata`, `emom`, `amrap` | compound index `[ownerType+ownerId]`; `ownerId` is a loose reference (no Dexie FK) into `sessions.id` or `standardVariants.id`. No longer carries `tipologia` — moved up to `Session`/`StandardVariant` as `tipologie` (2026-07-26, see section 7) |
| `timerPresets` | `name`, `timerFormat`, `tabata`, `emom`, `amrap` | standalone saved workout configs, unrelated to any circuit/session |
| `sessions` | `date` (YYYY-MM-DD), `groupId`, `notes`, `tipologie` (`Tipologia[]`) | indexed `date`, `groupId`. `notes` is still a single `\n`-joined string (see `NotesList.svelte` in section 5) |
| `standardVariants` | `groupId`, `date` (YYYY-MM-DD, default label for the reusable template), `notes`, `tipologie` (`Tipologia[]`) | indexed `groupId` only (the `name` index was dropped in v8, see below) |

**Relations**: `Session`/`StandardVariant` → (`ownerType`+`ownerId`) → `Circuit`; `Circuit` → (`exerciseIds[]`, loose many-to-many) → `Exercise`; `VoiceRecording` → (`exerciseId` or `phraseKey`+`profileId`) → `Exercise`/`VoiceProfile`.

**Migration history**: v1 exercises+voiceRecordings → v2 circuits → v3 timerPresets → v4 circuits gain sessionId/order, sessions table added (pre-dates the ownerType generalization) → v5 circuits generalized to `[ownerType+ownerId]`, standardCategories/standardVariants added → v6 voiceProfiles added, voiceRecordings gains `profileId`, with an `.upgrade()` that migrates any pre-existing orphaned phrase recording into a new default profile called "Voce salvata" (this is the PhraseLibrary → VoiceProfiles migration, see section 7) → v7 drops the `standardCategories` table and the `warmup` field (from both `sessions` and `standardVariants`); `standardVariants` gains `groupId` directly, with an `.upgrade()` that copies each variant's old `categoryId → standardCategories.groupId` into the new field before the category table is deleted (see section 7) → v8 renames `StandardVariant.name` to `date` and drops the now-unused `name` index (`standardVariants: '++id, groupId'`), with an `.upgrade()` that back-fills `date` = today's date on any row still missing it (pre-existing `name` values are left in place, unread, same "harmless leftover field" pattern as `warmup` in v7 — see section 7).

## 5. Moduli chiave

- **Timer engine** (`src/lib/timerEngine.ts`) — timestamp-driven, not tick-counted: `buildTabataTimeline`/`buildEmomTimeline`/`buildAmrapTimeline` build a flat `TimerPhase[]` upfront; `TimerEngine` steps through it on a 200ms `setInterval`, computing remaining time from an absolute `phaseEndTime` each tick to avoid drift. `buildTabataTimeline` tags `rest`/`rest_cycle` phases with the same `round`/`cycle` as the `work` phase they follow (not just `work` phases), so the UI can read remaining-round/cycle counts off any phase without peeking ahead. The final 3-2-1 countdown in the last `min(3, duration)` seconds of `rest`/`rest_cycle`/`interval`/`amrap` phases (and of `prepare`) is **always** beeped via `TimerAudio.playCountdownBeep` (short-short-long, never spoken) — this is unconditional and independent of voice settings. Separately, `maybeCue`/`speakUpcoming`/`announceCompletion` still speak the phrase/exercise-name preview ("lavora"/"riposa"/exercise name/"completato") once per cue window when voice announcements are enabled; the two are no longer mutually exclusive (beep always plays, voice preview plays on top when active) — previously voice replaced the beep entirely. Tabata always ends on a `work` phase with no trailing cue window (unlike EMOM/AMRAP), handled via the `isCompletionWindow` check — easy to break when touching phase transitions. `pause()`/`resume()` freeze/restore the countdown by snapshotting the remaining seconds and recomputing `phaseEndTime` on resume (same drift-avoidance trick as the initial start); `TimerRunner.svelte` exposes this as a Pausa/Riprendi button next to Stop. `buildTabataTimeline`'s round count per cycle is `exerciseIds.length` when a circuit has linked exercises, but falls back to `TabataParams.genericRounds` (default 8) when `exerciseIds` is empty — this is what makes the standalone Timer tab's Tabata format actually loop instead of collapsing to `[prepare, done]` (with `totalRounds`/`totalCycles` in `TimerRunner.svelte` mirroring the same fallback). `Timer.svelte`'s `tabataRows` only shows the extra "Round" wheel-picker input when `(circuit?.exerciseIds.length ?? 0) === 0` — a circuit-linked Tabata still derives its round count silently from the exercise list, unchanged.
- **Audio** (`src/lib/timerAudio.ts`) — `TimerAudio` class: synthesized beep via Web Audio (`AudioContext` oscillator, `beep(long?)` — `long` makes the final countdown tick a longer tone), TTS via Web Speech API (`it-IT`, optional system voice by `voiceURI`), and a hybrid lookup for phrases/exercise names that prefers a personal `VoiceRecording` (looked up by profile for phrases, globally for exercises) and falls back to TTS. `playCountdownBeep(remaining)` is the dedicated 3-2-1 countdown method (never speaks numbers).
- **TimerRunner UI** (`src/lib/TimerRunner.svelte`) — running-timer screen, rebuilt to: a header row (format name + total workout time remaining, color-matched to the current phase: green while working, red while resting/preparing); a full-width colored `phase-banner` (phase name + big countdown, green for work/interval/amrap, red for rest/rest_cycle/prepare); a smaller `next-banner` previewing the upcoming phase's name+duration (hidden once there's no next phase before `done`); the exercise list (unchanged); and a 3-column `stats-row` — **Round rimasti** (blue, left, tabata/emom only) / pause-resume circular button (center) / **Cicli rimasti** (yellow, right, tabata only) — followed by the Stop button. "Round rimasti"/"Cicli rimasti" are `totalRounds/totalCycles - phase.round/cycle + 1`, so they only decrement when a new round/cycle's `work` phase starts (holding steady through the following rest). AMRAP shows neither side stat, just the centered pause button.
- **Voice recording** (`VoiceRecorder.svelte`) — generic MediaRecorder-based record/play/delete widget parameterized by a `target` discriminated union (`{type:'exercise', exerciseId}` or `{type:'phrase', phraseKey, profileId}`); used inside both `ExerciseForm.svelte` and `VoiceProfiles.svelte`.
- **Voice profiles** (`VoiceProfiles.svelte` + `voiceProfiles` table) — lets you create multiple named profiles (e.g. different people), each owning its own recording for the 4 fixed phrases (prepara/lavora/riposa/completato). Reached via a gear icon next to "Voce" inside the Timer setup screen.
- **Timer presets** ("I miei workout", `TimerPreset` table, UI inside `Timer.svelte`) — reusable named timer configs (format+params), usable only from the standalone Timer tab; **not** wired into `CircuitForm` (see TODO).
- **Wake lock** (`wakeLock.ts`) — `WakeLockManager` wraps the Screen Wake Lock API and re-acquires it on `visibilitychange`, since Android releases the lock when the tab backgrounds/foregrounds.
- **Notes editor** (`NotesList.svelte`) — replaces the old free-text `<textarea>` for `Session.notes`/`StandardVariant.notes` (2026-07-26). Renders a numbered list: each row is a plain `<input>` with a badge showing `index + 1` (never persisted — purely positional), plus ▲/▼/✕ controls and a "+ Aggiungi riga" button that appends a row and focuses it. Three quick-add buttons (6/8/10) pad the list up to N empty rows without touching already-filled ones. Storage is unchanged: the component is `bind:value`-driven (a single `\n`-joined string) with an `onCommit` callback fired after every structural change (add/remove/reorder) and on row blur (not on every keystroke) — the parent still does its own Dexie write in `onCommit`, same as the old `onblur={saveText}` pattern. Splitting/joining on `\n` is lossless for the common case but means a literal newline typed mid-row would (if it were possible via a plain `<input>`, which it isn't) be indistinguishable from a row break — not a real-world concern given `<input>` can't contain newlines.
- **Date pickers for `StandardVariant`** (`groups.ts`'s `formatShortDate`/`candidateDatesForGroup`) — `candidateDatesForGroup(groupId, weeksBack=8, weeksForward=26)` generates the list of ISO dates, restricted to that group's scheduled weekday(s) (same `WEEKLY_SCHEDULE` source of truth as `nextScheduledDate`), used to populate the `<select>` in AllenamentiStandard's "Nuovo allenamento" sheet, `StandardVariantEditor`'s date-change sheet, and `SessionEditor`'s "save as allenamento standard" sheet. Callers that show an *existing* record's date manually union it into the candidate list first (`base.includes(variant.date) ? base : [...base, variant.date].sort()`) so a date outside the generated window (e.g. a migrated/legacy value) still appears as a selectable, non-blank option instead of silently falling off the list.

## 6. Convenzioni

- Svelte 5 runes only; no `export let`/stores anywhere.
- Discriminated unions for variant types (`VoiceRecordingTarget`, `VoiceMode`/`VoiceSelection`, `TimerPhase['kind']`).
- Italian for all user-facing strings/labels; English for code identifiers, file names, comments.
- Recurring pattern for any taxonomy: define the union type + a `*_LABELS: Record<T, string>` + (where relevant) a `*_COLORS: Record<T, {bg,text}|string>` together in the same `*Types.ts` file (see `circuitTypes.ts`, `types.ts`).
- Full-screen editors (`SessionEditor`, `StandardVariantEditor`, `CircuitForm`, non-embedded `Timer`) share a `position:fixed; inset:0` "screen" shell with a topbar (✕ close + centered `<h1>`). Smaller create/edit flows (`ExerciseForm`, category/variant creation) instead use a dimmed `.overlay` + rounded-top `.sheet` bottom-sheet pattern with a handle-bar.
- Every editor communicates via `onSaved`/`onClose`/`onDeleted` callback props — no event dispatching, no global store; the parent screen re-fetches from Dexie after the callback instead of the child mutating shared state.
- **Known gotcha**: `$state` objects/arrays are reactive Proxies. Passing one directly into `db.table.add()`/`.put()` throws `DataCloneError`. Always spread into plain objects/arrays (`{ ...tabata }`, `[...exerciseIds]`) immediately before any Dexie write — see `circuitService.copyCircuits` and `CircuitForm.save` for the pattern.
- **Known gotcha**: `BottomNav` is `position:fixed; bottom:0; height:80px; z-index:60` with an opaque background, and stacks above same-context siblings with `z-index:auto` regardless of DOM order (positive z-index always wins). Any screen-level FAB must sit at `bottom: 96px` or more with its own `z-index` (e.g. 65) to clear it — `bottom: 24px` places the FAB entirely underneath the navbar, making it invisible and unclickable (this was the bug behind the Esercizi/Allenamenti FABs, fixed in `Eserciziario.svelte`/`AllenamentiStandard.svelte`).
- Fixed dark theme only (CSS variables in `src/app.css`, no light mode / OS-preference switching).

## 7. Decisioni di design prese

- **Circuit has no standalone library/list screen.** It always belongs to an owner (`ownerType: 'session'|'variant'` + `ownerId`) and is created/edited inline from whatever owns it, because `Session` and `StandardVariant` are structurally identical containers (ordered circuits + notes). `circuitService.ts` exists purely to keep the owner-type filtering consistent across both callers.
- **`Allenamenti` collapsed from 3 levels to 2, and `warmup` was dropped entirely (2026-07-25).** The category level (`standardCategories` table, group → category → allenamento) was removed — `StandardVariant` now carries `groupId` directly, so the screen is just group → flat allenamento list; the `v7` migration back-fills `groupId` from each variant's old category before dropping the table (see section 4). The `Riscaldamento` textarea/field was removed from both `Session` and `StandardVariant` (and from `Oggi`'s "last time" preview) — a coach-driven simplification, not something the spec called for. Historical `warmup` string values in existing rows are left untouched in IndexedDB (harmless, just unread) rather than being explicitly stripped.
- **Groups and weekly schedule are hardcoded** (`groups.ts`) — intentionally out of scope for an editor per the spec. The `Pro` group was split (2026-07-25) into two separate `GroupId`s, `pro_mer` and `pro_gio` (both `name: 'Pro'`, distinguished only by color and by which weekday slot in `WEEKLY_SCHEDULE` references them), so Wednesday and Thursday Pro sessions/allenamenti no longer share the same `groupId` — no migration was needed since no data existed under the old `pro` id yet.
- **Timer engine is timestamp-driven**, not tick-counted, specifically to avoid drift over long AMRAP/EMOM durations.
- **Voice library was redesigned mid-project**: it used to be a single fixed `PhraseLibrary.svelte` (one recording per phrase, reached from a settings gear in `Eserciziario`'s topbar). It's now `VoiceProfiles.svelte` — N named profiles × 4 phrases each — reached from the Timer setup screen instead. The `db.version(6)` upgrade migrates any pre-existing recording into a default "Voce salvata" profile so nothing is lost. Rationale (inferred from the shape of the change): support different people's voices being selectable per timer run, not just the coach's own.
- **Bottom nav grew from 4 to 5 tabs.** Timer is now a first-class tab (standalone timer + preset library) rather than a button living inside Oggi. `spec-agenda-gruppi.md`'s "Bottom nav a 4 voci" line is stale on this point — don't treat it as current truth.
- **Per-circuit configurable rest structure was simplified in implementation.** The spec calls for the rest type (only-between-rounds vs. also-between-exercises) to be configurable per circuit; `buildTabataTimeline` currently always inserts a `rest` phase between every exercise and a separate `rest_cycle` between cycles, with no toggle to suppress the inter-exercise rest.
- **Exercise voice recordings are global, phrase recordings are per-profile** — an intentional asymmetry: exercise pronunciation doesn't need to vary "by coach voice" the way the four fixed cue phrases do (those exist specifically to let different people's voices run a session).
- **`Circuit.name` is now optional (2026-07-26).** `CircuitForm.save()` no longer blocks on an empty name (`Circuit.name` itself is still typed `string`, just allowed to be `''`). Wherever a circuit's name is displayed (`SessionEditor`/`StandardVariantEditor` cards), an empty name falls back to `circuitSummary(c)` as the title, with the subtitle line suppressed in that case (to avoid showing the same string twice).
- **`Tipologia` moved from `Circuit` to `Session`/`StandardVariant`, and became multi-select (2026-07-26).** Previously a single required field on `Circuit` (3 exclusive buttons in `CircuitForm`), it's now `tipologie: Tipologia[]` on the session/variant as a whole, edited via 3 independent toggle buttons (not a segmented control — any combination of 0–3 can be active) in `SessionEditor`/`StandardVariantEditor`, using `TIPOLOGIA_COLORS` for each button's own active state. The per-circuit tipologia pill is gone from circuit cards. Rationale (coach-driven): tipologia describes the session/allenamento as a whole, not each circuit inside it. No Dexie migration was needed (neither the old nor the new field was ever indexed) — pre-existing circuits simply lose their `tipologia` value silently (extra field, unread), and pre-existing sessions/variants read `tipologie` as `undefined` until first touched (all read sites guard with `?? []`, all write sites default to `[]`).
- **`StandardVariant.name` renamed to `date` (2026-07-26).** A `StandardVariant` is still a freely reusable template — the `date` is only the *default label* shown in the allenamenti list/topbar and pre-filled in the "Nuovo allenamento"/date-change pickers, **not** a constraint on which sessions it can be applied to (applying still works via the existing "▶ Oggi"/"▶ Prossima lezione" chips regardless of the variant's own `date`). The `date` field is chosen via a `<select>` restricted to the owning group's scheduled weekdays (`candidateDatesForGroup`, section 5), defaulting to today if today is a valid weekday for that group, else to `nextScheduledDate(groupId)`. This required a real Dexie migration (`db.version(8)`, section 4) since `name` was indexed and is gone; the `standardService.saveSessionAsVariant` signature changed from `(session, name, notes)` to `(session, notes, date = today)` accordingly — check current call sites before assuming the old parameter order.

## 8. Cosa manca / TODO noti

- Timer presets aren't surfaced or auto-suggested from `CircuitForm` when picking a circuit's timer format/params, even though the spec wants "choosing a recurring block type suggests its associated timer preset automatically." `TimerPreset` currently only lives inside the standalone Timer tab, disconnected from circuit creation.
- No per-circuit toggle for rest structure (only-between-rounds vs. also-between-exercises) — see section 7.
- Exercise photo/video attachments — explicitly deferred in the spec ("in futuro, non ora"), not started.
- No manual date picker to plan a session for an arbitrary future date — sessions only come into existence via `ensureSessionForDate` (today, automatic) or `duplicateSessionTo` (always the next occurrence of the same weekday).
- No automated test suite (verification is manual, via browser + IndexedDB inspection).

## 9. Manutenzione di questo file

Ad ogni successiva modifica di codice, di struttura dati, o di qualsiasi altro aspetto importante del progetto, aggiorna questo file CLAUDE.md di conseguenza, prima di concludere la sessione.
