<script lang="ts">
  import { untrack } from 'svelte';
  import { db } from './db';
  import {
    TIMER_FORMATS,
    TIMER_FORMAT_LABELS,
    DEFAULT_TABATA_PARAMS,
    DEFAULT_EMOM_PARAMS,
    DEFAULT_AMRAP_PARAMS,
    circuitSummary,
    type Circuit,
    type TimerFormat,
    type TabataParams,
    type EmomParams,
    type AmrapParams,
    type TimerPreset,
  } from './circuitTypes';
  import type { Exercise, VoiceProfile } from './types';
  import type { AnnounceSettings } from './timerEngine';
  import { buildTimeline } from './timerEngine';
  import type { VoiceSelection } from './timerAudio';
  import TimerRunner from './TimerRunner.svelte';
  import VoiceProfiles from './VoiceProfiles.svelte';

  let { circuit = null, embedded = false, onClose = () => {} }: { circuit?: Circuit | null; embedded?: boolean; onClose?: () => void } =
    $props();

  const LAST_CONFIG_KEY = 'agenda-gruppi:lastTimerConfig';
  const ANNOUNCE_KEY = 'agenda-gruppi:announceSettings';
  const VOICE_KEY = 'agenda-gruppi:voiceSelection';

  function loadLastConfig(): { timerFormat: TimerFormat; tabata: TabataParams; emom: EmomParams; amrap: AmrapParams } | null {
    try {
      const raw = localStorage.getItem(LAST_CONFIG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function loadAnnounce(): AnnounceSettings {
    try {
      const raw = localStorage.getItem(ANNOUNCE_KEY);
      return raw ? JSON.parse(raw) : { frasi: true, esercizio: true };
    } catch {
      return { frasi: true, esercizio: true };
    }
  }

  function loadVoiceSelection(): VoiceSelection {
    try {
      const raw = localStorage.getItem(VOICE_KEY);
      return raw ? JSON.parse(raw) : { mode: 'computer', computerVoiceURI: '' };
    } catch {
      return { mode: 'computer', computerVoiceURI: '' };
    }
  }

  const lastConfig = circuit ? null : loadLastConfig();

  let mode = $state<'setup' | 'run'>('setup');
  let timerFormat = $state<TimerFormat>(circuit?.timerFormat ?? lastConfig?.timerFormat ?? 'tabata');
  let tabata = $state<TabataParams>({ ...DEFAULT_TABATA_PARAMS, ...(circuit?.tabata ?? lastConfig?.tabata) });
  let emom = $state<EmomParams>({ ...DEFAULT_EMOM_PARAMS, ...(circuit?.emom ?? lastConfig?.emom) });
  let amrap = $state<AmrapParams>({ ...DEFAULT_AMRAP_PARAMS, ...(circuit?.amrap ?? lastConfig?.amrap) });
  let announce = $state<AnnounceSettings>(loadAnnounce());
  let voiceSelection = $state<VoiceSelection>(loadVoiceSelection());

  let presets = $state<TimerPreset[]>([]);
  let newPresetName = $state('');
  let showSavePreset = $state(false);

  let voiceProfiles = $state<VoiceProfile[]>([]);
  let voiceProfilesOpen = $state(false);
  let availableVoices = $state<SpeechSynthesisVoice[]>([]);

  if (!circuit) {
    db.timerPresets.orderBy('name').toArray().then((list) => (presets = list));
  }

  function loadVoiceProfiles() {
    db.voiceProfiles.orderBy('name').toArray().then((list) => (voiceProfiles = list));
  }
  loadVoiceProfiles();

  function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    availableVoices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('it'));
  }
  loadVoices();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = loadVoices;
  }

  function selectComputerMode() {
    voiceSelection = { mode: 'computer', computerVoiceURI: voiceSelection.computerVoiceURI };
  }

  function selectProfileMode(id: number | undefined) {
    if (!id) return;
    voiceSelection = { mode: 'profile', profileId: id, computerVoiceURI: voiceSelection.computerVoiceURI };
  }

  function closeVoiceProfiles() {
    voiceProfilesOpen = false;
    loadVoiceProfiles();
  }

  let exercises = $state<Exercise[]>([]);
  if (circuit && circuit.exerciseIds.length > 0) {
    db.exercises.bulkGet(circuit.exerciseIds).then((list) => {
      exercises = list.filter((e): e is Exercise => !!e);
    });
  }

  const exercisesById = $derived.by(() => {
    const map = new Map<number, Exercise>();
    for (const ex of exercises) if (ex.id) map.set(ex.id, ex);
    return map;
  });

  const circuitExerciseList = $derived.by(() =>
    (circuit?.exerciseIds ?? []).map((id) => exercisesById.get(id)?.name ?? '—'),
  );

  function mmss(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  type IntervalRow = {
    key: string;
    color: string;
    title: string;
    subtitle: string;
    kind: 'time' | 'count';
    get: () => number;
    set: (v: number) => void;
  };

  const tabataRows = $derived.by<IntervalRow[]>(() => [
    {
      key: 'prepara',
      color: '#F2C94C',
      title: 'Prepara',
      subtitle: 'Conto alla rovescia prima di iniziare',
      kind: 'time',
      get: () => tabata.prepareSeconds,
      set: (v) => (tabata.prepareSeconds = v),
    },
    {
      key: 'lavora',
      color: '#4CAF7D',
      title: 'Lavora',
      subtitle: 'Fai esercizi per questo tempo',
      kind: 'time',
      get: () => tabata.workSeconds,
      set: (v) => (tabata.workSeconds = v),
    },
    {
      key: 'riposa',
      color: '#F26D6D',
      title: 'Riposa',
      subtitle: 'Riposa per questo tempo',
      kind: 'time',
      get: () => tabata.restSeconds,
      set: (v) => (tabata.restSeconds = v),
    },
    {
      key: 'cicli',
      color: '#F2C94C',
      title: 'Cicli',
      subtitle: 'Quante volte ripetere il circuito',
      kind: 'count',
      get: () => tabata.cycles,
      set: (v) => (tabata.cycles = v),
    },
    {
      key: 'restBc',
      color: '#F2C94C',
      title: 'Riposa tra i cicli',
      subtitle: 'Intervallo di recupero',
      kind: 'time',
      get: () => tabata.restBetweenCyclesSeconds,
      set: (v) => (tabata.restBetweenCyclesSeconds = v),
    },
  ]);

  const emomRows = $derived.by<IntervalRow[]>(() => [
    {
      key: 'prepara',
      color: '#F2C94C',
      title: 'Prepara',
      subtitle: 'Conto alla rovescia prima di iniziare',
      kind: 'time',
      get: () => emom.prepareSeconds,
      set: (v) => (emom.prepareSeconds = v),
    },
    {
      key: 'intervallo',
      color: '#5FB8C9',
      title: 'Intervallo',
      subtitle: 'Durata di ogni round',
      kind: 'time',
      get: () => emom.intervalSeconds,
      set: (v) => (emom.intervalSeconds = v),
    },
    {
      key: 'round',
      color: '#5FB8C9',
      title: 'Round',
      subtitle: 'Quanti round totali',
      kind: 'count',
      get: () => emom.rounds,
      set: (v) => (emom.rounds = v),
    },
  ]);

  const amrapRows = $derived.by<IntervalRow[]>(() => [
    {
      key: 'prepara',
      color: '#F2C94C',
      title: 'Prepara',
      subtitle: 'Conto alla rovescia prima di iniziare',
      kind: 'time',
      get: () => amrap.prepareSeconds,
      set: (v) => (amrap.prepareSeconds = v),
    },
    {
      key: 'tempoLimite',
      color: '#9B7EDE',
      title: 'Tempo limite',
      subtitle: 'Durata totale dell’AMRAP',
      kind: 'time',
      get: () => amrap.timeLimitSeconds,
      set: (v) => (amrap.timeLimitSeconds = v),
    },
  ]);

  const activeRows = $derived(
    timerFormat === 'tabata' ? tabataRows : timerFormat === 'emom' ? emomRows : amrapRows,
  );

  let editingRow = $state<IntervalRow | null>(null);
  let editingMinutes = $state(0);
  let editingSeconds = $state(0);
  let editingCount = $state(0);
  let minWheelEl = $state<HTMLDivElement | null>(null);
  let secWheelEl = $state<HTMLDivElement | null>(null);

  const WHEEL_ITEM_HEIGHT = 44;
  const wheelNumbers = Array.from({ length: 60 }, (_, i) => i);

  function openEdit(row: IntervalRow) {
    editingRow = row;
    if (row.kind === 'time') {
      const total = Math.max(0, Math.round(row.get()));
      editingMinutes = Math.min(59, Math.floor(total / 60));
      editingSeconds = total % 60;
    } else {
      editingCount = row.get();
    }
  }

  function confirmEdit() {
    if (!editingRow) return;
    if (editingRow.kind === 'time') {
      editingRow.set(editingMinutes * 60 + editingSeconds);
    } else {
      editingRow.set(Math.max(0, Math.round(editingCount)));
    }
    editingRow = null;
  }

  function handleMinWheelScroll(e: Event) {
    const el = e.currentTarget as HTMLDivElement;
    editingMinutes = Math.max(0, Math.min(59, Math.round(el.scrollTop / WHEEL_ITEM_HEIGHT)));
  }

  function handleSecWheelScroll(e: Event) {
    const el = e.currentTarget as HTMLDivElement;
    editingSeconds = Math.max(0, Math.min(59, Math.round(el.scrollTop / WHEEL_ITEM_HEIGHT)));
  }

  $effect(() => {
    if (!editingRow || editingRow.kind !== 'time') return;
    const min = minWheelEl;
    const sec = secWheelEl;
    if (!min || !sec) return;
    untrack(() => {
      min.scrollTop = editingMinutes * WHEEL_ITEM_HEIGHT;
      sec.scrollTop = editingSeconds * WHEEL_ITEM_HEIGHT;
    });
  });

  function presetStats(p: TimerPreset): { left: { label: string; value: string }[]; right: { label: string; value: string }[] } {
    if (p.timerFormat === 'tabata') {
      return {
        left: [
          { label: 'Prepara', value: mmss(p.tabata.prepareSeconds ?? 3) },
          { label: 'Lavora', value: mmss(p.tabata.workSeconds) },
          { label: 'Riposa', value: mmss(p.tabata.restSeconds) },
        ],
        right: [
          { label: 'Cicli', value: String(p.tabata.cycles) },
          { label: 'Rest BC', value: mmss(p.tabata.restBetweenCyclesSeconds) },
        ],
      };
    }
    if (p.timerFormat === 'emom') {
      return {
        left: [
          { label: 'Prepara', value: mmss(p.emom.prepareSeconds ?? 3) },
          { label: 'Intervallo', value: mmss(p.emom.intervalSeconds) },
        ],
        right: [{ label: 'Round', value: String(p.emom.rounds) }],
      };
    }
    return {
      left: [{ label: 'Prepara', value: mmss(p.amrap.prepareSeconds ?? 3) }],
      right: [{ label: 'Tempo limite', value: mmss(p.amrap.timeLimitSeconds) }],
    };
  }

  function presetMatches(p: TimerPreset): boolean {
    return (
      p.timerFormat === timerFormat &&
      JSON.stringify(p.tabata) === JSON.stringify(tabata) &&
      JSON.stringify(p.emom) === JSON.stringify(emom) &&
      JSON.stringify(p.amrap) === JSON.stringify(amrap)
    );
  }

  function applyPreset(p: TimerPreset) {
    timerFormat = p.timerFormat;
    tabata = { ...DEFAULT_TABATA_PARAMS, ...p.tabata };
    emom = { ...DEFAULT_EMOM_PARAMS, ...p.emom };
    amrap = { ...DEFAULT_AMRAP_PARAMS, ...p.amrap };
  }

  function runPreset(p: TimerPreset) {
    applyPreset(p);
    start();
  }

  async function savePreset() {
    const trimmed = newPresetName.trim();
    if (!trimmed) return;
    await db.timerPresets.add({
      name: trimmed,
      timerFormat,
      tabata: { ...tabata },
      emom: { ...emom },
      amrap: { ...amrap },
    });
    newPresetName = '';
    showSavePreset = false;
    presets = await db.timerPresets.orderBy('name').toArray();
  }

  async function deletePreset(p: TimerPreset) {
    if (!p.id) return;
    if (!confirm(`Eliminare il workout "${p.name}"?`)) return;
    await db.timerPresets.delete(p.id);
    presets = await db.timerPresets.orderBy('name').toArray();
  }

  function start() {
    localStorage.setItem(ANNOUNCE_KEY, JSON.stringify(announce));
    localStorage.setItem(VOICE_KEY, JSON.stringify(voiceSelection));
    if (!circuit) {
      localStorage.setItem(
        LAST_CONFIG_KEY,
        JSON.stringify({ timerFormat, tabata, emom, amrap }),
      );
    }
    mode = 'run';
  }

  const timelineConfig = $derived({
    timerFormat,
    tabata,
    emom,
    amrap,
    exerciseIds: circuit?.exerciseIds ?? [],
  });

  function handleExit() {
    mode = 'setup';
    onClose();
  }
</script>

{#if mode === 'setup'}
  <div class="screen" class:embedded>
    <div class="topbar">
      {#if !embedded}
        <button class="icon-btn" onclick={onClose} aria-label="Chiudi">✕</button>
      {/if}
      <h1>{circuit ? circuit.name : 'Timer'}</h1>
      {#if !embedded}<span class="spacer"></span>{/if}
    </div>

    <div class="content" class:embedded>
      {#if circuit}
        <div class="field">
          <span>Formato</span>
          <div class="readonly-pill">{TIMER_FORMAT_LABELS[circuit.timerFormat]}</div>
        </div>
        <div class="field">
          <span>Parametri</span>
          <div class="readonly-pill">{circuitSummary(circuit)}</div>
        </div>
        {#if circuitExerciseList.length > 0}
          <div class="field">
            <span>Esercizi</span>
            <div class="ex-preview">
              {#each circuitExerciseList as name, i}
                <div class="ex-preview-row">{i + 1}. {name}</div>
              {/each}
            </div>
          </div>
        {/if}
      {:else}
        <div class="field">
          <span>Formato timer</span>
          <div class="format-row">
            <button class="format-tabata" class:active={timerFormat === 'tabata'} onclick={() => (timerFormat = 'tabata')}>
              Tabata
            </button>
            {#each TIMER_FORMATS.filter((f) => f !== 'tabata') as f}
              <button class="format-minor" class:active={timerFormat === f} onclick={() => (timerFormat = f)}>
                {TIMER_FORMAT_LABELS[f]}
              </button>
            {/each}
          </div>
        </div>

        <div class="section-label">Intervalli</div>
        <div class="interval-list">
          {#each activeRows as row (row.key)}
            <button class="interval-row" onclick={() => openEdit(row)}>
              <span class="row-dot" style="background:{row.color}"></span>
              <span class="row-text">
                <span class="row-title">{row.title}</span>
                <span class="row-subtitle">{row.subtitle}</span>
              </span>
              <span class="row-value">{row.kind === 'time' ? mmss(row.get()) : row.get()}</span>
              <span class="row-chevron">›</span>
            </button>
          {/each}
        </div>

        {#if showSavePreset}
          <div class="save-preset-row">
            <input type="text" bind:value={newPresetName} placeholder="Nome workout" />
            <button class="btn-save-mini" onclick={savePreset}>Salva</button>
          </div>
        {:else}
          <button class="add-timer-btn" onclick={() => (showSavePreset = true)}>⏱ Aggiungi nuovo timer</button>
        {/if}

        <div class="section-label">
          I miei workout
          <span class="section-icon">📝</span>
        </div>
        {#if presets.length > 0}
          <div class="workout-list">
            {#each presets as p (p.id)}
              <div class="workout-card">
                <div class="workout-name">{p.name}</div>
                <div class="workout-grid">
                  <div class="workout-col">
                    {#each presetStats(p).left as stat}
                      <div class="stat-row">
                        <span class="stat-label">{stat.label}</span>
                        <span class="stat-value">{stat.value}</span>
                      </div>
                    {/each}
                  </div>
                  <div class="workout-col">
                    {#each presetStats(p).right as stat}
                      <div class="stat-row">
                        <span class="stat-label">{stat.label}</span>
                        <span class="stat-value">{stat.value}</span>
                      </div>
                    {/each}
                  </div>
                  <button
                    class="workout-check"
                    class:checked={presetMatches(p)}
                    onclick={() => applyPreset(p)}
                    aria-label="Seleziona workout"
                  >
                    {#if presetMatches(p)}✓{/if}
                  </button>
                </div>
                <div class="workout-actions">
                  <button class="workout-delete" onclick={() => deletePreset(p)}>Elimina</button>
                  <button class="workout-play" onclick={() => runPreset(p)}>▶ Avvia</button>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="hint">Nessun workout salvato.</p>
        {/if}
      {/if}

      <div class="field">
        <div class="voice-label-row">
          <span>Voce</span>
          <button class="gear-btn" onclick={() => (voiceProfilesOpen = true)} aria-label="Gestisci profili voce">⚙</button>
        </div>
        <div class="radio-group">
          <label class="radio-option">
            <input type="radio" name="voiceMode" checked={voiceSelection.mode === 'computer'} onchange={selectComputerMode} />
            Voce computer
          </label>
          {#each voiceProfiles as p (p.id)}
            <label class="radio-option">
              <input
                type="radio"
                name="voiceMode"
                checked={voiceSelection.mode === 'profile' && voiceSelection.profileId === p.id}
                onchange={() => selectProfileMode(p.id)}
              />
              {p.name}
            </label>
          {/each}
        </div>
        {#if voiceSelection.mode === 'computer' && availableVoices.length > 0}
          <select bind:value={voiceSelection.computerVoiceURI}>
            <option value="">Predefinita di sistema</option>
            {#each availableVoices as v (v.voiceURI)}
              <option value={v.voiceURI}>{v.name}</option>
            {/each}
          </select>
        {/if}
      </div>

      <div class="field">
        <span>Cosa annunciare</span>
        <label class="toggle-row">
          <input type="checkbox" bind:checked={announce.frasi} />
          Frasi di fase (prepara / riposa / lavora / completato)
        </label>
        <label class="toggle-row">
          <input type="checkbox" bind:checked={announce.esercizio} />
          Nome esercizio a ogni round
        </label>
        {#if !announce.frasi && !announce.esercizio}
          <p class="hint">Solo bip, nessuna voce.</p>
        {/if}
      </div>
    </div>

    <div class="footer">
      <button class="btn-start" onclick={start}>▶ Avvia</button>
    </div>
  </div>

  {#if editingRow}
    <div
      class="overlay"
      role="button"
      tabindex="-1"
      onclick={() => (editingRow = null)}
      onkeydown={(e) => e.key === 'Escape' && (editingRow = null)}
    >
      <div
        class="sheet"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <div class="handle-bar"></div>
        <h2>{editingRow.title}</h2>
        <p class="sheet-subtitle">{editingRow.subtitle}</p>
        {#if editingRow.kind === 'time'}
          <div class="wheel-frame">
            <div class="wheel-highlight"></div>
            <div class="wheel-group">
              <div class="wheel" bind:this={minWheelEl} onscroll={handleMinWheelScroll}>
                <div class="wheel-pad"></div>
                {#each wheelNumbers as n}
                  <div class="wheel-item" class:selected={n === editingMinutes}>{String(n).padStart(2, '0')}</div>
                {/each}
                <div class="wheel-pad"></div>
              </div>
              <span class="wheel-unit">MIN</span>
            </div>
            <div class="wheel-group">
              <div class="wheel" bind:this={secWheelEl} onscroll={handleSecWheelScroll}>
                <div class="wheel-pad"></div>
                {#each wheelNumbers as n}
                  <div class="wheel-item" class:selected={n === editingSeconds}>{String(n).padStart(2, '0')}</div>
                {/each}
                <div class="wheel-pad"></div>
              </div>
              <span class="wheel-unit">SEC</span>
            </div>
          </div>
        {:else}
          <input type="number" min="0" bind:value={editingCount} />
        {/if}
        <button class="btn-confirm" onclick={confirmEdit}>Fatto</button>
      </div>
    </div>
  {/if}

  {#if voiceProfilesOpen}
    <VoiceProfiles onClose={closeVoiceProfiles} />
  {/if}
{:else}
  <TimerRunner config={timelineConfig} {announce} {voiceSelection} exerciseNames={circuitExerciseList} onExit={handleExit} />
{/if}

<style>
  .screen {
    min-height: 100svh;
    background: var(--bg);
    position: fixed;
    inset: 0;
    z-index: 90;
    display: flex;
    flex-direction: column;
  }

  .screen.embedded {
    position: static;
    inset: auto;
    z-index: auto;
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .topbar h1 {
    font-size: 16px;
    font-weight: 800;
    text-align: center;
    flex: 1;
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 18px;
    padding: 8px 12px;
  }

  .spacer {
    width: 34px;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .content.embedded {
    padding-bottom: 110px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .readonly-pill {
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    color: var(--text);
    font-size: 15px;
    font-weight: 600;
  }

  .ex-preview {
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
    padding: 6px 14px;
  }

  .ex-preview-row {
    padding: 8px 0;
    font-size: 14px;
    font-weight: 500;
    color: var(--text);
    border-bottom: 1px solid var(--border);
  }

  .ex-preview-row:last-child {
    border-bottom: none;
  }

  input[type='text'],
  input[type='number'],
  select {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    font-size: 16px;
    font-weight: 500;
    color: var(--text);
    width: 100%;
  }

  .format-row {
    display: flex;
    gap: 8px;
  }

  .format-tabata {
    flex: 2;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 14px;
    font-size: 16px;
    font-weight: 800;
    color: var(--text-muted);
  }

  .format-tabata.active {
    background: #c4ff4d;
    border-color: #c4ff4d;
    color: #111;
  }

  .format-minor {
    flex: 1;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 10px 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-faint);
  }

  .format-minor.active {
    background: var(--bg-navbar);
    border-color: var(--text-faint);
    color: var(--text);
  }

  .section-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .interval-list {
    display: flex;
    flex-direction: column;
    background: var(--bg-elevated);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .interval-row {
    display: flex;
    align-items: center;
    gap: 12px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: 14px 16px;
    text-align: left;
  }

  .interval-row:last-child {
    border-bottom: none;
  }

  .row-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .row-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .row-title {
    font-size: 15px;
    font-weight: 800;
    color: var(--text);
    text-transform: uppercase;
  }

  .row-subtitle {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-faint);
  }

  .row-value {
    font-size: 22px;
    font-weight: 800;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  .row-chevron {
    color: var(--text-faint);
    font-size: 20px;
    flex-shrink: 0;
  }

  .add-timer-btn {
    background: var(--bg-elevated);
    border: none;
    border-radius: var(--radius-lg);
    padding: 16px;
    color: var(--text);
    font-weight: 700;
    font-size: 14px;
    text-align: center;
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .radio-option {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text);
  }

  .voice-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .gear-btn {
    background: var(--bg-elevated);
    border: none;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    color: var(--text-muted);
    font-size: 13px;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text);
  }

  .hint {
    font-size: 12px;
    color: var(--text-faint);
    font-weight: 400;
  }

  .save-preset-row {
    display: flex;
    gap: 8px;
  }

  .btn-save-mini {
    background: var(--accent);
    border: none;
    border-radius: var(--radius-sm);
    padding: 0 16px;
    color: #fff;
    font-weight: 700;
    font-size: 14px;
  }

  .workout-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .workout-card {
    background: var(--bg-elevated);
    border-radius: var(--radius-lg);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .workout-name {
    font-size: 15px;
    font-weight: 800;
    color: var(--text);
    text-transform: uppercase;
  }

  .workout-grid {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .workout-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
  }

  .stat-label {
    color: var(--text-faint);
    font-weight: 600;
    text-transform: uppercase;
  }

  .stat-value {
    color: var(--text);
    font-weight: 700;
  }

  .workout-check {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--bg-navbar);
    border: 1px solid var(--border);
    color: transparent;
    font-size: 15px;
    font-weight: 800;
    flex-shrink: 0;
  }

  .workout-check.checked {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }

  .workout-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .workout-delete {
    background: transparent;
    border: none;
    color: #f26d6d;
    font-size: 12px;
    font-weight: 700;
    padding: 2px 0;
  }

  .workout-play {
    background: var(--accent);
    border: none;
    border-radius: var(--radius-sm);
    padding: 8px 16px;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
  }

  .footer {
    padding: 14px 20px 24px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .btn-start {
    width: 100%;
    background: var(--accent);
    border: none;
    border-radius: var(--radius-md);
    padding: 16px;
    color: #fff;
    font-size: 17px;
    font-weight: 700;
  }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: flex-end;
    z-index: 110;
  }

  .sheet {
    width: 100%;
    background: var(--bg-elevated);
    border-radius: 20px 20px 0 0;
    padding: 12px 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .handle-bar {
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: var(--border);
    margin: 0 auto 4px;
  }

  .sheet h2 {
    font-size: 17px;
    font-weight: 800;
    color: var(--text);
  }

  .sheet-subtitle {
    font-size: 13px;
    color: var(--text-muted);
    margin-top: -6px;
  }

  .btn-confirm {
    background: var(--accent);
    border: none;
    border-radius: var(--radius-sm);
    padding: 14px;
    color: #fff;
    font-weight: 700;
    font-size: 15px;
    margin-top: 6px;
  }

  .wheel-frame {
    position: relative;
    display: flex;
    justify-content: center;
    gap: 28px;
    height: 220px;
  }

  .wheel-highlight {
    position: absolute;
    left: 0;
    right: 0;
    top: 88px;
    height: 44px;
    background: var(--bg-navbar);
    border-radius: var(--radius-sm);
    pointer-events: none;
  }

  .wheel-group {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .wheel {
    height: 220px;
    width: 64px;
    overflow-y: scroll;
    scroll-snap-type: y mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .wheel::-webkit-scrollbar {
    display: none;
  }

  .wheel-pad {
    height: 88px;
  }

  .wheel-item {
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    scroll-snap-align: center;
    font-size: 19px;
    font-weight: 600;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }

  .wheel-item.selected {
    font-size: 28px;
    font-weight: 800;
    color: var(--text);
  }

  .wheel-unit {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
  }
</style>
