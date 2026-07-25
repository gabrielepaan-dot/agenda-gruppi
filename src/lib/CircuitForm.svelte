<script lang="ts">
  import { dndzone } from 'svelte-dnd-action';
  import { db } from './db';
  import { PATTERN_CATEGORIES, PATTERN_CATEGORY_LABELS, type Exercise } from './types';
  import {
    TIPOLOGIE,
    TIPOLOGIA_LABELS,
    TIMER_FORMATS,
    TIMER_FORMAT_LABELS,
    REST_TYPE_LABELS,
    DEFAULT_TABATA_PARAMS,
    DEFAULT_EMOM_PARAMS,
    DEFAULT_AMRAP_PARAMS,
    type Circuit,
    type CircuitOwnerType,
    type Tipologia,
    type TimerFormat,
    type RestType,
    type TabataParams,
    type EmomParams,
    type AmrapParams,
  } from './circuitTypes';

  let {
    circuit = null,
    ownerType,
    ownerId,
    order = 0,
    onClose,
    onSaved,
  }: {
    circuit?: Circuit | null;
    ownerType: CircuitOwnerType;
    ownerId: number;
    order?: number;
    onClose: () => void;
    onSaved: () => void;
  } = $props();

  let name = $state(circuit?.name ?? '');
  let tipologia = $state<Tipologia>(circuit?.tipologia ?? 'forza');
  let timerFormat = $state<TimerFormat>(circuit?.timerFormat ?? 'tabata');
  let tabata = $state<TabataParams>({ ...(circuit?.tabata ?? DEFAULT_TABATA_PARAMS) });
  let emom = $state<EmomParams>({ ...(circuit?.emom ?? DEFAULT_EMOM_PARAMS) });
  let amrap = $state<AmrapParams>({ ...(circuit?.amrap ?? DEFAULT_AMRAP_PARAMS) });
  let error = $state('');
  let pickerOpen = $state(false);

  type SelectedItem = { id: string; exerciseId: number };
  let selectedItems = $state<SelectedItem[]>(
    (circuit?.exerciseIds ?? []).map((exerciseId) => ({ id: crypto.randomUUID(), exerciseId })),
  );

  let allExercises = $state<Exercise[]>([]);
  db.exercises.orderBy('name').toArray().then((list) => (allExercises = list));

  const exercisesById = $derived.by(() => {
    const map = new Map<number, Exercise>();
    for (const ex of allExercises) if (ex.id) map.set(ex.id, ex);
    return map;
  });

  const groupedForPicker = $derived.by(() => {
    const map = new Map<string, Exercise[]>();
    for (const cat of PATTERN_CATEGORIES) map.set(cat, []);
    for (const ex of allExercises) map.get(ex.category)?.push(ex);
    return map;
  });

  function addExercise(ex: Exercise) {
    if (!ex.id) return;
    selectedItems = [...selectedItems, { id: crypto.randomUUID(), exerciseId: ex.id }];
  }

  function removeItem(id: string) {
    selectedItems = selectedItems.filter((item) => item.id !== id);
  }

  function handleDnd(e: CustomEvent<{ items: SelectedItem[] }>) {
    selectedItems = e.detail.items;
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      error = 'Inserisci un nome per il circuito.';
      return;
    }
    if (selectedItems.length === 0) {
      error = 'Aggiungi almeno un esercizio.';
      return;
    }
    if (timerFormat === 'tabata') {
      if (tabata.workSeconds <= 0 || tabata.restSeconds < 0 || tabata.cycles <= 0) {
        error = 'Controlla i parametri Tabata.';
        return;
      }
    } else if (timerFormat === 'emom') {
      if (emom.intervalSeconds <= 0 || emom.rounds <= 0) {
        error = 'Controlla i parametri EMOM.';
        return;
      }
    } else if (amrap.timeLimitSeconds <= 0) {
      error = 'Controlla il tempo limite AMRAP.';
      return;
    }

    const payload: Circuit = {
      ownerType,
      ownerId,
      order: circuit?.order ?? order,
      name: trimmed,
      tipologia,
      exerciseIds: selectedItems.map((item) => item.exerciseId),
      timerFormat,
      tabata: { ...tabata },
      emom: { ...emom },
      amrap: { ...amrap },
    };
    if (circuit?.id) {
      await db.circuits.put({ ...payload, id: circuit.id });
    } else {
      await db.circuits.add(payload);
    }
    onSaved();
  }

  async function remove() {
    if (!circuit?.id) return;
    if (!confirm(`Eliminare il circuito "${circuit.name}"?`)) return;
    await db.circuits.delete(circuit.id);
    onSaved();
  }
</script>

<div class="screen">
  <div class="topbar">
    <button class="icon-btn" onclick={onClose} aria-label="Chiudi">✕</button>
    <h1>{circuit ? 'Modifica circuito' : 'Nuovo circuito'}</h1>
    <button class="icon-btn save" onclick={save} aria-label="Salva">Salva</button>
  </div>

  <div class="content">
    <label class="field">
      <span>Nome</span>
      <input type="text" bind:value={name} placeholder="Es. Circuito Trazioni" />
    </label>

    <div class="field">
      <span>Tipologia</span>
      <div class="segmented">
        {#each TIPOLOGIE as t}
          <button class:active={tipologia === t} onclick={() => (tipologia = t)}>
            {TIPOLOGIA_LABELS[t]}
          </button>
        {/each}
      </div>
    </div>

    <div class="field">
      <span>Esercizi ({selectedItems.length})</span>
      {#if selectedItems.length > 0}
        <div
          class="exercise-list"
          use:dndzone={{ items: selectedItems, flipDurationMs: 150 }}
          onconsider={handleDnd}
          onfinalize={handleDnd}
        >
          {#each selectedItems as item (item.id)}
            {@const ex = exercisesById.get(item.exerciseId)}
            <div class="exercise-row">
              <span class="handle">≡</span>
              <span class="ex-name">{ex?.name ?? '—'}</span>
              <button class="remove-btn" onclick={() => removeItem(item.id)} aria-label="Rimuovi">✕</button>
            </div>
          {/each}
        </div>
      {/if}
      <button class="add-exercise-btn" onclick={() => (pickerOpen = true)}>+ Aggiungi esercizio</button>
    </div>

    <div class="field">
      <span>Formato timer</span>
      <div class="format-row">
        <button
          class="format-tabata"
          class:active={timerFormat === 'tabata'}
          onclick={() => (timerFormat = 'tabata')}
        >
          Tabata
        </button>
        <button
          class="format-minor"
          class:active={timerFormat === 'emom'}
          onclick={() => (timerFormat = 'emom')}
        >
          Emom
        </button>
        <button
          class="format-minor"
          class:active={timerFormat === 'amrap'}
          onclick={() => (timerFormat = 'amrap')}
        >
          Amrap
        </button>
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

    {#if error}
      <p class="error">{error}</p>
    {/if}

    {#if circuit}
      <button class="btn-delete" onclick={remove}>Elimina circuito</button>
    {/if}
  </div>
</div>

{#if pickerOpen}
  <div class="overlay" role="button" tabindex="-1" onclick={() => (pickerOpen = false)} onkeydown={(e) => e.key === 'Escape' && (pickerOpen = false)}>
    <div
      class="sheet"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <div class="handle-bar"></div>
      <h2>Aggiungi esercizio</h2>
      <div class="picker-list">
        {#each PATTERN_CATEGORIES as cat}
          {@const list = groupedForPicker.get(cat) ?? []}
          {#if list.length > 0}
            <div class="picker-section-label">{PATTERN_CATEGORY_LABELS[cat]}</div>
            {#each list as ex (ex.id)}
              <button class="picker-row" onclick={() => addExercise(ex)}>{ex.name}</button>
            {/each}
          {/if}
        {/each}
        {#if allExercises.length === 0}
          <p class="empty">Nessun esercizio nell'eserciziario. Aggiungine prima uno.</p>
        {/if}
      </div>
      <button class="btn-cancel" onclick={() => (pickerOpen = false)}>Chiudi</button>
    </div>
  </div>
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
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 18px;
    padding: 8px 12px;
  }

  .icon-btn.save {
    color: var(--accent);
    font-weight: 700;
    font-size: 15px;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px 40px;
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

  input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }

  .segmented {
    display: flex;
    gap: 8px;
  }

  .segmented button {
    flex: 1;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 11px;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-muted);
  }

  .segmented button.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }

  .exercise-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .exercise-row {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
  }

  .handle {
    color: var(--text-faint);
    font-size: 18px;
    cursor: grab;
    flex-shrink: 0;
  }

  .ex-name {
    flex: 1;
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
  }

  .remove-btn {
    background: transparent;
    border: none;
    color: var(--text-faint);
    font-size: 14px;
    padding: 4px 6px;
    flex-shrink: 0;
  }

  .add-exercise-btn {
    background: transparent;
    border: 1px dashed var(--border);
    border-radius: var(--radius-sm);
    padding: 12px;
    color: var(--accent);
    font-weight: 700;
    font-size: 14px;
  }

  .format-row {
    display: flex;
    gap: 8px;
    align-items: stretch;
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

  .error {
    color: #f26d6d;
    font-size: 13px;
    font-weight: 600;
  }

  .btn-delete {
    background: transparent;
    border: 1px solid #f26d6d;
    border-radius: var(--radius-sm);
    color: #f26d6d;
    padding: 12px;
    font-weight: 700;
    font-size: 14px;
    margin-top: 8px;
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
    max-height: 85vh;
    overflow-y: auto;
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
  }

  .picker-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .picker-section-label {
    padding: 12px 4px 4px;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .picker-row {
    text-align: left;
    background: transparent;
    border: none;
    padding: 10px 4px;
    font-size: 15px;
    font-weight: 500;
    color: var(--text);
    border-bottom: 1px solid var(--border);
  }

  .empty {
    padding: 20px 4px;
    color: var(--text-muted);
    font-size: 14px;
  }

  .btn-cancel {
    margin-top: 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 13px;
    color: var(--text-muted);
    font-weight: 700;
  }
</style>
