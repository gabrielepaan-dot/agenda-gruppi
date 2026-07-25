<script lang="ts">
  import { db } from './db';
  import { GROUPS, toIsoDate, type GroupId } from './groups';
  import { ensureSessionForDate } from './sessionService';
  import { applyVariantToSession } from './standardService';
  import { getCircuitsFor, deleteCircuitsFor } from './circuitService';
  import {
    TIPOLOGIA_LABELS,
    TIPOLOGIA_COLORS,
    TIMER_FORMAT_LABELS,
    TIMER_FORMAT_COLORS,
    circuitSummary,
    type Circuit,
  } from './circuitTypes';
  import type { StandardVariant } from './standardTypes';
  import CircuitForm from './CircuitForm.svelte';
  import Timer from './Timer.svelte';

  let {
    variant,
    groupId,
    onClose,
    onDeleted,
  }: { variant: StandardVariant; groupId: GroupId; onClose: () => void; onDeleted: () => void } = $props();

  const group = GROUPS[groupId];

  let warmup = $state(variant.warmup);
  let notes = $state(variant.notes);
  let circuits = $state<Circuit[]>([]);
  let circuitFormOpen = $state(false);
  let editingCircuit = $state<Circuit | null>(null);
  let timerCircuit = $state<Circuit | null>(null);
  let savedFlash = $state(false);
  let applied = $state(false);

  async function loadCircuits() {
    circuits = await getCircuitsFor('variant', variant.id!);
  }

  loadCircuits();

  async function saveText() {
    await db.standardVariants.update(variant.id!, { warmup, notes });
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

  async function applyToToday() {
    await saveText();
    const todaySession = await ensureSessionForDate(toIsoDate(new Date()), groupId);
    await applyVariantToSession({ ...variant, warmup, notes }, todaySession);
    applied = true;
    setTimeout(() => (applied = false), 1800);
  }

  async function deleteVariant() {
    if (!confirm(`Eliminare la variante "${variant.name}"?`)) return;
    await deleteCircuitsFor('variant', variant.id!);
    await db.standardVariants.delete(variant.id!);
    onDeleted();
  }
</script>

<div class="screen">
  <div class="topbar">
    <button class="icon-btn" onclick={onClose} aria-label="Chiudi">✕</button>
    <div class="title-block">
      <span class="group-pill" style="background:{group.color}">{group.name}</span>
      <span class="date">{variant.name}</span>
    </div>
    <span class="spacer"></span>
  </div>

  <div class="content">
    <label class="field">
      <span>Riscaldamento</span>
      <textarea bind:value={warmup} onblur={saveText} rows="3" placeholder="Es. mobilità spalle + salita facile"></textarea>
    </label>

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

    <label class="field">
      <span>Note</span>
      <textarea bind:value={notes} onblur={saveText} rows="3" placeholder="Note libere sulla variante"></textarea>
    </label>

    {#if savedFlash}
      <p class="flash">Salvato</p>
    {/if}

    <button class="btn-apply" onclick={applyToToday}>
      {applied ? 'Applicata a oggi ✓' : '▶ Applica a Oggi'}
    </button>

    <button class="btn-delete" onclick={deleteVariant}>Elimina variante</button>
  </div>
</div>

{#if circuitFormOpen}
  <CircuitForm
    circuit={editingCircuit}
    ownerType="variant"
    ownerId={variant.id!}
    order={circuits.length}
    onClose={closeCircuitForm}
    onSaved={handleCircuitSaved}
  />
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
    font-size: 13px;
    color: var(--text);
    font-weight: 700;
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

  .btn-apply {
    background: var(--accent);
    border: none;
    border-radius: var(--radius-md);
    padding: 15px;
    color: #fff;
    font-weight: 700;
    font-size: 15px;
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
</style>
