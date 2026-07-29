<script lang="ts">
  import { dragHandleZone, dragHandle } from 'svelte-dnd-action';
  import { db } from './db';
  import {
    PATTERN_CATEGORIES,
    PATTERN_CATEGORY_LABELS,
    PATTERN_CATEGORY_COLORS,
    type Exercise,
  } from './types';
  import {
    DEFAULT_TABATA_PARAMS,
    DEFAULT_EMOM_PARAMS,
    DEFAULT_AMRAP_PARAMS,
    type Circuit,
    type CircuitOwnerType,
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
  let tabata = $state<TabataParams>({ ...DEFAULT_TABATA_PARAMS, ...circuit?.tabata });
  let emom = $state<EmomParams>({ ...DEFAULT_EMOM_PARAMS, ...circuit?.emom });
  let amrap = $state<AmrapParams>({ ...DEFAULT_AMRAP_PARAMS, ...circuit?.amrap });
  let error = $state('');
  let pickerOpen = $state(false);
  let freeTextInput = $state('');

  type SelectedItem = { id: string; exerciseId: number; freeText?: string };
  let selectedItems = $state<SelectedItem[]>(
    (circuit?.exerciseIds ?? []).map((exerciseId, i) => {
      const freeText = circuit?.freeText?.[i];
      return freeText ? { id: crypto.randomUUID(), exerciseId, freeText } : { id: crypto.randomUUID(), exerciseId };
    }),
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

  function addFreeText() {
    const trimmed = freeTextInput.trim();
    if (!trimmed) return;
    selectedItems = [...selectedItems, { id: crypto.randomUUID(), exerciseId: 0, freeText: trimmed }];
    freeTextInput = '';
    pickerOpen = false;
  }

  function removeItem(id: string) {
    selectedItems = selectedItems.filter((item) => item.id !== id);
  }

  // Snapshotted the moment a real drag begins (first `consider` event, tagged
  // DRAG_STARTED by the library) so a drag that never reaches `finalize` — an
  // interrupted touch gesture, see below — still has something authoritative
  // to restore from.
  let preDragSnapshot: SelectedItem[] | null = null;
  let recoveryTimer: ReturnType<typeof setTimeout> | null = null;

  function clearRecoveryTimer() {
    if (recoveryTimer) {
      clearTimeout(recoveryTimer);
      recoveryTimer = null;
    }
  }

  function handleConsider(e: CustomEvent<{ items: SelectedItem[] }>) {
    if (preDragSnapshot === null) {
      preDragSnapshot = selectedItems.map((item) => ({ ...item }));
    }
    selectedItems = e.detail.items;
  }

  function handleFinalize(e: CustomEvent<{ items: SelectedItem[] }>) {
    const finalized = e.detail.items;
    // Guard against svelte-dnd-action ever dropping a row (e.g. a release outside a
    // valid drop target on flaky touch input): reordering must never delete anything —
    // the ✕ button is the only path that's allowed to remove a row.
    const before = preDragSnapshot ?? selectedItems;
    const finalizedIds = new Set(finalized.map((item) => item.id));
    const lost = before.filter((item) => !finalizedIds.has(item.id));
    selectedItems = lost.length > 0 ? [...finalized, ...lost] : finalized;
    preDragSnapshot = null;
    clearRecoveryTimer();
  }

  // Safety net for gestures that end without ever firing `finalize` at all —
  // svelte-dnd-action only listens for mouseup/touchend, not touchcancel, so an
  // Android-cancelled gesture (incoming call, edge-swipe nav, notification
  // shade, app backgrounded mid-drag) can leave a drag permanently unfinished.
  // Force it closed two ways: (1) replay the events the library itself listens
  // for, so its own finalize runs normally; (2) if that still doesn't land
  // within one frame's worth of slack, fall back to restoring the pre-drag
  // order directly from our own snapshot, guaranteeing no row is ever lost.
  function forceEndStuckDrag() {
    window.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
    window.dispatchEvent(new Event('mouseup', { bubbles: true, cancelable: true }));
    clearRecoveryTimer();
    recoveryTimer = setTimeout(() => {
      if (preDragSnapshot) {
        selectedItems = preDragSnapshot;
        preDragSnapshot = null;
      }
      recoveryTimer = null;
    }, 300);
  }

  function handleVisibilityChange() {
    if (document.hidden) forceEndStuckDrag();
  }

  $effect(() => {
    window.addEventListener('touchcancel', forceEndStuckDrag, { capture: true });
    window.addEventListener('pointercancel', forceEndStuckDrag, { capture: true });
    window.addEventListener('blur', forceEndStuckDrag);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('touchcancel', forceEndStuckDrag, { capture: true });
      window.removeEventListener('pointercancel', forceEndStuckDrag, { capture: true });
      window.removeEventListener('blur', forceEndStuckDrag);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearRecoveryTimer();
    };
  });

  async function save() {
    const trimmed = name.trim();
    if (selectedItems.length === 0) {
      error = 'Aggiungi almeno un esercizio.';
      return;
    }
    if (tabata.workSeconds <= 0 || tabata.restSeconds < 0 || tabata.cycles <= 0) {
      error = 'Controlla i parametri Tabata.';
      return;
    }

    const payload: Circuit = {
      ownerType,
      ownerId,
      order: circuit?.order ?? order,
      name: trimmed,
      exerciseIds: selectedItems.map((item) => item.exerciseId),
      freeText: selectedItems.map((item) => item.freeText ?? ''),
      timerFormat: 'tabata',
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
          use:dragHandleZone={{ items: selectedItems, flipDurationMs: 150, type: 'circuit-exercises' }}
          onconsider={handleConsider}
          onfinalize={handleFinalize}
        >
          {#each selectedItems as item (item.id)}
            {@const ex = item.freeText ? null : exercisesById.get(item.exerciseId)}
            <div
              class="exercise-row"
              style="border-left-color:{ex ? PATTERN_CATEGORY_COLORS[ex.category].bg : item.freeText ? 'var(--accent)' : 'transparent'}"
            >
              <div class="row-body">
                <span class="ex-name">{item.freeText || ex?.name || '—'}</span>
                <button class="remove-btn" onclick={() => removeItem(item.id)} aria-label="Rimuovi">✕</button>
              </div>
              <span class="drag-handle" use:dragHandle aria-label="Trascina per riordinare">⚓</span>
            </div>
          {/each}
        </div>
      {/if}
      <button class="add-exercise-btn" onclick={() => (pickerOpen = true)}>+ Aggiungi esercizio</button>
    </div>

    <div class="timer-footer">
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
      <div class="picker-scroll">
        <div class="free-text-row">
          <input type="text" bind:value={freeTextInput} placeholder="Testo libero (es. Stretching 5')" />
          <button class="btn-add-freetext" onclick={addFreeText} disabled={!freeTextInput.trim()}>Aggiungi</button>
        </div>
        <div class="picker-list">
          {#each PATTERN_CATEGORIES as cat}
            {@const list = groupedForPicker.get(cat) ?? []}
            {#if list.length > 0}
              <div class="picker-section-label">
                <span class="dot" style="background:{PATTERN_CATEGORY_COLORS[cat].bg}"></span>
                {PATTERN_CATEGORY_LABELS[cat]}
              </div>
              {#each list as ex (ex.id)}
                <button
                  class="picker-row"
                  style="border-left-color:{PATTERN_CATEGORY_COLORS[cat].bg}"
                  onclick={() => addExercise(ex)}
                >
                  {ex.name}
                </button>
              {/each}
            {/if}
          {/each}
          {#if allExercises.length === 0}
            <p class="empty">Nessun esercizio nell'eserciziario. Aggiungine prima uno.</p>
          {/if}
        </div>
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
    align-items: stretch;
    background: var(--bg-elevated);
    border: 2px solid transparent;
    border-left: 4px solid transparent;
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: box-shadow 0.15s, border-color 0.15s;
  }

  .row-body {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 14px 16px;
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
    cursor: pointer;
    touch-action: auto;
  }

  .drag-handle {
    flex-shrink: 0;
    width: 52px;
    align-self: stretch;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    border-left: 1px solid var(--border);
    color: var(--text-faint);
    font-size: 20px;
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  /* The floating clone svelte-dnd-action follows the pointer while a drag is active.
     !important: svelte-dnd-action snapshots the original element's computed border into
     this clone's own inline style, which otherwise beats any stylesheet rule. */
  :global(#dnd-action-dragged-el.exercise-row) {
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35) !important;
    border-color: var(--accent) !important;
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
    background: var(--bg-elevated);
    border-radius: 20px 20px 0 0;
    padding: 12px 20px 0;
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
    flex-shrink: 0;
  }

  .sheet h2 {
    font-size: 17px;
    font-weight: 800;
    flex-shrink: 0;
  }

  .picker-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-bottom: 16px;
  }

  .free-text-row {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .free-text-row input {
    flex: 1;
  }

  .btn-add-freetext {
    background: var(--accent);
    border: none;
    border-radius: var(--radius-sm);
    padding: 0 16px;
    color: #fff;
    font-weight: 700;
    font-size: 14px;
  }

  .btn-add-freetext:disabled {
    opacity: 0.4;
  }

  .picker-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .picker-section-label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 4px 4px;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .picker-row {
    text-align: left;
    background: transparent;
    border: none;
    border-left: 4px solid transparent;
    padding: 10px 4px 10px 8px;
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
    flex-shrink: 0;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 13px;
    color: var(--text-muted);
    font-weight: 700;
    margin: 0 -20px;
    border-radius: 0;
    border-width: 1px 0 0;
    padding: 13px 20px calc(13px + env(safe-area-inset-bottom, 0px));
  }
</style>
