<script lang="ts">
  import { db } from './db';
  import {
    TIMER_FORMATS,
    TIMER_FORMAT_LABELS,
    REST_TYPE_LABELS,
    DEFAULT_TABATA_PARAMS,
    DEFAULT_EMOM_PARAMS,
    DEFAULT_AMRAP_PARAMS,
    circuitSummary,
    type Circuit,
    type TimerFormat,
    type RestType,
    type TabataParams,
    type EmomParams,
    type AmrapParams,
    type TimerPreset,
  } from './circuitTypes';
  import type { Exercise } from './types';
  import type { AnnounceSettings } from './timerEngine';
  import { buildTimeline } from './timerEngine';
  import TimerRunner from './TimerRunner.svelte';

  let { circuit = null, onClose }: { circuit?: Circuit | null; onClose: () => void } = $props();

  const LAST_CONFIG_KEY = 'agenda-gruppi:lastTimerConfig';
  const ANNOUNCE_KEY = 'agenda-gruppi:announceSettings';

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

  const lastConfig = circuit ? null : loadLastConfig();

  let mode = $state<'setup' | 'run'>('setup');
  let timerFormat = $state<TimerFormat>(circuit?.timerFormat ?? lastConfig?.timerFormat ?? 'tabata');
  let tabata = $state<TabataParams>({ ...(circuit?.tabata ?? lastConfig?.tabata ?? DEFAULT_TABATA_PARAMS) });
  let emom = $state<EmomParams>({ ...(circuit?.emom ?? lastConfig?.emom ?? DEFAULT_EMOM_PARAMS) });
  let amrap = $state<AmrapParams>({ ...(circuit?.amrap ?? lastConfig?.amrap ?? DEFAULT_AMRAP_PARAMS) });
  let announce = $state<AnnounceSettings>(loadAnnounce());

  let presets = $state<TimerPreset[]>([]);
  let newPresetName = $state('');
  let showSavePreset = $state(false);

  if (!circuit) {
    db.timerPresets.orderBy('name').toArray().then((list) => (presets = list));
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

  function applyPreset(p: TimerPreset) {
    timerFormat = p.timerFormat;
    tabata = { ...p.tabata };
    emom = { ...p.emom };
    amrap = { ...p.amrap };
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
    if (!confirm(`Eliminare il preset "${p.name}"?`)) return;
    await db.timerPresets.delete(p.id);
    presets = await db.timerPresets.orderBy('name').toArray();
  }

  function start() {
    localStorage.setItem(ANNOUNCE_KEY, JSON.stringify(announce));
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
</script>

{#if mode === 'setup'}
  <div class="screen">
    <div class="topbar">
      <button class="icon-btn" onclick={onClose} aria-label="Chiudi">✕</button>
      <h1>{circuit ? circuit.name : 'Timer standalone'}</h1>
      <span class="spacer"></span>
    </div>

    <div class="content">
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

        {#if timerFormat === 'tabata'}
          <div class="params-grid">
            <label class="field small">
              <span>Lavoro (sec)</span>
              <input type="number" min="1" bind:value={tabata.workSeconds} />
            </label>
            <label class="field small">
              <span>Riposo (sec)</span>
              <input type="number" min="0" bind:value={tabata.restSeconds} />
            </label>
          </div>
          <label class="field">
            <span>Tipo di riposo</span>
            <div class="radio-group">
              {#each Object.entries(REST_TYPE_LABELS) as [value, label]}
                <label class="radio-option">
                  <input
                    type="radio"
                    name="restType"
                    value={value}
                    checked={tabata.restType === value}
                    onchange={() => (tabata.restType = value as RestType)}
                  />
                  {label}
                </label>
              {/each}
            </div>
          </label>
          <div class="params-grid">
            <label class="field small">
              <span>Cicli</span>
              <input type="number" min="1" bind:value={tabata.cycles} />
            </label>
            <label class="field small">
              <span>Riposo tra cicli (sec)</span>
              <input type="number" min="0" bind:value={tabata.restBetweenCyclesSeconds} />
            </label>
          </div>
        {:else if timerFormat === 'emom'}
          <div class="params-grid">
            <label class="field small">
              <span>Intervallo (sec)</span>
              <input type="number" min="1" bind:value={emom.intervalSeconds} />
            </label>
            <label class="field small">
              <span>Round</span>
              <input type="number" min="1" bind:value={emom.rounds} />
            </label>
          </div>
        {:else}
          <label class="field">
            <span>Tempo limite (sec)</span>
            <input type="number" min="1" bind:value={amrap.timeLimitSeconds} />
          </label>
        {/if}

        <div class="field">
          <span>Preset</span>
          {#if presets.length > 0}
            <div class="preset-list">
              {#each presets as p (p.id)}
                <div class="preset-chip">
                  <button class="preset-load" onclick={() => applyPreset(p)}>{p.name}</button>
                  <button class="preset-del" onclick={() => deletePreset(p)} aria-label="Elimina preset">✕</button>
                </div>
              {/each}
            </div>
          {/if}
          {#if showSavePreset}
            <div class="save-preset-row">
              <input type="text" bind:value={newPresetName} placeholder="Nome preset" />
              <button class="btn-save-mini" onclick={savePreset}>Salva</button>
            </div>
          {:else}
            <button class="add-preset-btn" onclick={() => (showSavePreset = true)}>+ Salva come preset</button>
          {/if}
        </div>
      {/if}

      <div class="field">
        <span>Cosa annunciare</span>
        <label class="toggle-row">
          <input type="checkbox" bind:checked={announce.frasi} />
          Frasi di fase (riposa / lavora / completato)
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
{:else}
  <TimerRunner config={timelineConfig} {announce} exerciseNames={circuitExerciseList} onExit={onClose} />
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

  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .field.small {
    gap: 6px;
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
  input[type='number'] {
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

  .params-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
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

  .preset-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .preset-chip {
    display: flex;
    align-items: center;
    background: var(--bg-elevated);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }

  .preset-load {
    background: transparent;
    border: none;
    padding: 8px 12px;
    color: var(--text);
    font-size: 13px;
    font-weight: 600;
  }

  .preset-del {
    background: transparent;
    border: none;
    padding: 8px 10px;
    color: var(--text-faint);
    font-size: 11px;
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

  .add-preset-btn {
    background: transparent;
    border: 1px dashed var(--border);
    border-radius: var(--radius-sm);
    padding: 10px;
    color: var(--accent);
    font-weight: 700;
    font-size: 13px;
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
</style>
