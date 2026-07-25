<script lang="ts">
  import { db } from './db';
  import { GROUPS, nextWeekIsoDate } from './groups';
  import { duplicateSessionTo } from './sessionService';
  import { getCircuitsFor, deleteCircuitsFor } from './circuitService';
  import { saveSessionAsVariant } from './standardService';
  import {
    TIPOLOGIA_LABELS,
    TIPOLOGIA_COLORS,
    TIMER_FORMAT_LABELS,
    TIMER_FORMAT_COLORS,
    circuitSummary,
    type Circuit,
  } from './circuitTypes';
  import type { Session } from './sessionTypes';
  import CircuitForm from './CircuitForm.svelte';
  import Timer from './Timer.svelte';

  let { session, onClose, onDeleted }: { session: Session; onClose: () => void; onDeleted: () => void } = $props();

  const group = GROUPS[session.groupId];

  let notes = $state(session.notes);
  let circuits = $state<Circuit[]>([]);
  let circuitFormOpen = $state(false);
  let editingCircuit = $state<Circuit | null>(null);
  let timerCircuit = $state<Circuit | null>(null);
  let savedFlash = $state(false);
  let duplicated = $state(false);

  let saveVariantOpen = $state(false);
  let variantName = $state('');
  let variantSaved = $state(false);

  async function loadCircuits() {
    circuits = await getCircuitsFor('session', session.id!);
  }

  loadCircuits();

  async function saveText() {
    await db.sessions.update(session.id!, { notes });
    savedFlash = true;
    setTimeout(() => (savedFlash = false), 1200);
  }

  function openNewCircuit() {
    editingCircuit = null;
    circuitFormOpen = true;
  }

  function openEditCircuit(c: Circuit) {
    editingCircuit = c;
    circuitFormOpen = true;
  }

  function closeCircuitForm() {
    circuitFormOpen = false;
  }

  async function handleCircuitSaved() {
    circuitFormOpen = false;
    await loadCircuits();
  }

  async function moveCircuit(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= circuits.length) return;
    const a = circuits[index];
    const b = circuits[target];
    await db.circuits.update(a.id!, { order: b.order });
    await db.circuits.update(b.id!, { order: a.order });
    await loadCircuits();
  }

  function openTimer(c: Circuit) {
    timerCircuit = c;
  }

  function closeTimer() {
    timerCircuit = null;
  }

  async function duplicateForNextWeek() {
    await saveText();
    const newDate = nextWeekIsoDate(session.date);
    await duplicateSessionTo({ ...session, notes }, newDate);
    duplicated = true;
    setTimeout(() => (duplicated = false), 1800);
  }

  async function deleteSession() {
    if (!confirm('Eliminare questa sessione e tutti i suoi circuiti?')) return;
    await deleteCircuitsFor('session', session.id!);
    await db.sessions.delete(session.id!);
    onDeleted();
  }

  async function openSaveVariant() {
    await saveText();
    variantName = '';
    saveVariantOpen = true;
  }

  async function confirmSaveVariant() {
    const trimmedName = variantName.trim();
    if (!trimmedName) return;
    await saveSessionAsVariant(session, trimmedName, notes);
    saveVariantOpen = false;
    variantSaved = true;
    setTimeout(() => (variantSaved = false), 1800);
  }
</script>

<div class="screen">
  <div class="topbar">
    <button class="icon-btn" onclick={onClose} aria-label="Chiudi">✕</button>
    <div class="title-block">
      <span class="group-pill" style="background:{group.color}">{group.name}</span>
      <span class="date">{session.date}</span>
    </div>
    <span class="spacer"></span>
  </div>

  <div class="content">
    <div class="field">
      <span>Circuiti ({circuits.length})</span>
      {#each circuits as c, i (c.id)}
        <div class="card">
          <div class="move-col">
            <button class="move-btn" onclick={() => moveCircuit(i, -1)} disabled={i === 0} aria-label="Sposta su">▲</button>
            <button class="move-btn" onclick={() => moveCircuit(i, 1)} disabled={i === circuits.length - 1} aria-label="Sposta giù">▼</button>
          </div>
          <button class="card-main" onclick={() => openEditCircuit(c)}>
            <div class="card-top">
              <span class="fmt-pill" style="background:{TIMER_FORMAT_COLORS[c.timerFormat]}">{TIMER_FORMAT_LABELS[c.timerFormat]}</span>
              <span class="tipologia-pill" style="background:{TIPOLOGIA_COLORS[c.tipologia].bg}; color:{TIPOLOGIA_COLORS[c.tipologia].text}">
                {TIPOLOGIA_LABELS[c.tipologia]}
              </span>
            </div>
            <div class="name">{c.name}</div>
            <div class="sub">{circuitSummary(c)}</div>
          </button>
          <button class="play-btn" onclick={() => openTimer(c)} aria-label="Avvia timer">▶</button>
        </div>
      {/each}
      <button class="add-circuit-btn" onclick={openNewCircuit}>+ Aggiungi circuito</button>
    </div>

    <div class="field">
      <span>Note</span>
      <textarea bind:value={notes} onblur={saveText} rows="3" placeholder="Note libere sulla sessione"></textarea>
    </div>

    {#if savedFlash}
      <p class="flash">Salvato</p>
    {/if}

    <button class="btn-duplicate" onclick={duplicateForNextWeek}>
      {duplicated ? 'Duplicata ✓' : `↻ Duplica per ${nextWeekIsoDate(session.date)}`}
    </button>

    <button class="btn-duplicate" onclick={openSaveVariant}>
      {variantSaved ? 'Salvato come allenamento ✓' : '★ Salva come allenamento standard'}
    </button>

    <button class="btn-delete" onclick={deleteSession}>Elimina sessione</button>
  </div>
</div>

{#if circuitFormOpen}
  <CircuitForm
    circuit={editingCircuit}
    ownerType="session"
    ownerId={session.id!}
    order={circuits.length}
    onClose={closeCircuitForm}
    onSaved={handleCircuitSaved}
  />
{/if}

{#if saveVariantOpen}
  <div class="overlay" role="button" tabindex="-1" onclick={() => (saveVariantOpen = false)} onkeydown={(e) => e.key === 'Escape' && (saveVariantOpen = false)}>
    <div class="sheet" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <div class="handle-bar"></div>
      <h2>Salva come allenamento standard</h2>
      <label class="field">
        <span>Nome allenamento</span>
        <input type="text" bind:value={variantName} placeholder="Es. Allenamento A" />
      </label>
      <button class="btn-save-variant" onclick={confirmSaveVariant}>Salva</button>
    </div>
  </div>
{/if}

{#if timerCircuit}
  <Timer circuit={timerCircuit} onClose={closeTimer} />
{/if}

<style>
  .screen {
    min-height: 100svh;
    background: var(--bg);
    position: fixed;
    inset: 0;
    z-index: 80;
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

  .title-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .group-pill {
    padding: 5px 12px;
    border-radius: var(--radius-pill);
    font-size: 12px;
    font-weight: 800;
    color: #fff;
  }

  .date {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 600;
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

  textarea {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    font-size: 15px;
    font-weight: 500;
    color: var(--text);
    font-family: inherit;
    resize: vertical;
  }

  .flash {
    color: var(--success);
    font-size: 12px;
    font-weight: 700;
  }

  .card {
    background: var(--bg-elevated);
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    gap: 4px;
    padding-right: 12px;
    margin-bottom: 10px;
  }

  .move-col {
    display: flex;
    flex-direction: column;
    padding-left: 6px;
  }

  .move-btn {
    background: transparent;
    border: none;
    color: var(--text-faint);
    font-size: 10px;
    padding: 4px 6px;
  }

  .move-btn:disabled {
    opacity: 0.25;
  }

  .card-main {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    padding: 14px 12px;
    display: block;
    text-align: left;
  }

  .play-btn {
    flex-shrink: 0;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    border: none;
    font-size: 15px;
  }

  .card-top {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .fmt-pill {
    padding: 4px 10px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: #111;
  }

  .tipologia-pill {
    padding: 4px 10px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .card .name {
    font-size: 16px;
    font-weight: 700;
  }

  .card .sub {
    font-size: 13px;
    color: var(--text-muted);
    margin-top: 3px;
  }

  .add-circuit-btn {
    background: transparent;
    border: 1px dashed var(--border);
    border-radius: var(--radius-sm);
    padding: 12px;
    color: var(--accent);
    font-weight: 700;
    font-size: 14px;
  }

  .btn-duplicate {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 14px;
    color: var(--text);
    font-weight: 700;
    font-size: 14px;
  }

  .btn-delete {
    background: transparent;
    border: 1px solid #f26d6d;
    border-radius: var(--radius-md);
    padding: 12px;
    color: #f26d6d;
    font-weight: 700;
    font-size: 14px;
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
    gap: 14px;
  }

  .handle-bar {
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: var(--border);
    margin: 0 auto 4px;
  }

  .sheet h2 {
    font-size: 18px;
    font-weight: 800;
  }

  .btn-save-variant {
    background: var(--accent);
    border: none;
    border-radius: var(--radius-sm);
    padding: 13px;
    color: #fff;
    font-weight: 700;
    font-size: 15px;
  }
</style>
