<script lang="ts">
  import { dndzone } from 'svelte-dnd-action';
  import { db } from './db';
  import { PATTERN_CATEGORIES, PATTERN_CATEGORY_LABELS, type Exercise } from './types';
  import {
    TIMER_FORMATS,
    TIMER_FORMAT_LABELS,
    DEFAULT_TABATA_PARAMS,
    DEFAULT_EMOM_PARAMS,
    DEFAULT_AMRAP_PARAMS,
    type Circuit,
    type CircuitOwnerType,
    type TimerFormat,
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
  let timerFormat = $state<TimerFormat>(circuit?.timerFormat ?? 'tabata');
  let tabata = $state<TabataParams>({ ...DEFAULT_TABATA_PARAMS, ...circuit?.tabata });
  let emom = $state<EmomParams>({ ...DEFAULT_EMOM_PARAMS, ...circuit?.emom });
  let amrap = $state<AmrapParams>({ ...DEFAULT_AMRAP_PARAMS, ...circuit?.amrap });
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

    <div class="timer-footer">
      <div class="format-pills">
        <button
          class="pill"
          class:active={timerFormat === 'tabata'}
          onclick={() => (timerFormat = 'tabata')}
        >
          Tabata
        </button>
        <button
          class="pill"
          class:active={timerFormat === 'emom'}
          onclick={() => (timerFormat = 'emom')}
        >
          Emom
        </button>
        <button
          class="pill"
          class:active={timerFormat === 'amrap'}
          onclick={() => (timerFormat = 'amrap')}
        >
          Amrap
        </button>
      </div>

      {#if timerFormat === 'tabata'}
        <div class="params-inline">
          <label class="param">
            <span>Prepara</span>
            <input type="number" min="0" bind:value={tabata.prepareSeconds} />
          </label>
          <label class="param">
            <span>Lavoro</span>
            <input type="number" min="1" bind:value={tabata.workSeconds} />
          </label>
          <label class="param">
            <span>Riposo</span>
            <input type="number" min="0" bind:value={tabata.restSeconds} />
          </label>
          <label class="param">
            <span>Cicli</span>
            <input type="number" min="1" bind:value={tabata.cycles} />
          </label>
          <label class="param">
            <span>Rip. cicli</span>
            <input type="number" min="0" bind:value={tabata.restBetweenCyclesSeconds} />
          </label>
        </div>
      {:else if timerFormat === 'emom'}
        <div class="params-inline">
          <label class="param">
            <span>Prepara</span>
            <input type="number" min="0" bind:value={emom.prepareSeconds} />
          </label>
          <label class="param">
            <span>Intervallo</span>
            <input type="number" min="1" bind:value={emom.intervalSeconds} />
          </label>
          <label class="param">
            <span>Round</span>
            <input type="number" min="1" bind:value={emom.rounds} />
          </label>
        </div>
      {:else}
        <div class="params-inline">
          <label class="param">
            <span>Prepara</span>
            <input type="number" min="0" bind:value={amrap.prepareSeconds} />
          </label>
          <label class="param">
            <span>Tempo limite</span>
            <input type="number" min="1" bind:value={amrap.timeLimitSeconds} />
          </label>
        </div>
      {/if}
    </div>

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

  .timer-footer {
    margin: auto -20px 0;
    padding: 16px 20px;
    background: var(--bg-navbar);
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .format-pills {
    display: flex;
    gap: 8px;
  }

  .pill {
    flex: 1;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    padding: 8px 10px;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-muted);
  }

  .pill.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }

  .params-inline {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .param {
    flex: 1;
    min-width: 72px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .param input[type='number'] {
    padding: 8px 10px;
    font-size: 14px;
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
