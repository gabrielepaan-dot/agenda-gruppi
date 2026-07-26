<script lang="ts">
  import { dndzone } from 'svelte-dnd-action';
  import { db } from './db';
  import { GROUPS, candidateDatesForGroup, formatShortDate, type GroupId } from './groups';
  import { getCircuitsFor, deleteCircuitsFor } from './circuitService';
  import {
    TIPOLOGIE,
    TIPOLOGIA_LABELS,
    TIPOLOGIA_COLORS,
    TIMER_FORMAT_LABELS,
    TIMER_FORMAT_COLORS,
    circuitSummary,
    type Circuit,
    type Tipologia,
  } from './circuitTypes';
  import { DEFAULT_SECTION_ORDER, type Allenamento, type AllenamentoSection } from './standardTypes';
  import CircuitForm from './CircuitForm.svelte';
  import Timer from './Timer.svelte';
  import NotesList from './NotesList.svelte';

  let {
    allenamento,
    groupId,
    onClose,
    onDeleted,
  }: { allenamento: Allenamento; groupId: GroupId; onClose: () => void; onDeleted: () => void } = $props();

  const group = GROUPS[groupId];

  const dateCandidates = (() => {
    const base = candidateDatesForGroup(groupId);
    return base.includes(allenamento.date) ? base : [...base, allenamento.date].sort();
  })();

  let date = $state(allenamento.date);
  let dateEditorOpen = $state(false);
  let pickedDate = $state(allenamento.date);

  function openDateEditor() {
    pickedDate = date;
    dateEditorOpen = true;
  }

  async function saveDate() {
    date = pickedDate;
    await db.allenamenti.update(allenamento.id!, { date });
    dateEditorOpen = false;
  }

  let esercizi = $state(allenamento.esercizi ?? '');
  let notes = $state(allenamento.notes ?? '');
  let tipologie = $state<Tipologia[]>([...(allenamento.tipologie ?? [])]);
  let circuits = $state<Circuit[]>([]);
  let circuitFormOpen = $state(false);
  let editingCircuit = $state<Circuit | null>(null);
  let timerCircuit = $state<Circuit | null>(null);
  let savedFlash = $state(false);

  type SectionItem = { id: AllenamentoSection };
  let sections = $state<SectionItem[]>(
    (allenamento.sectionOrder?.length ? allenamento.sectionOrder : DEFAULT_SECTION_ORDER).map((id) => ({ id })),
  );

  function sectionLabel(id: AllenamentoSection): string {
    if (id === 'note') return 'Note';
    if (id === 'esercizi') return 'Esercizi';
    return `Circuiti (${circuits.length})`;
  }

  async function loadCircuits() {
    circuits = await getCircuitsFor('allenamento', allenamento.id!);
  }

  loadCircuits();

  async function saveEsercizi() {
    await db.allenamenti.update(allenamento.id!, { esercizi });
    savedFlash = true;
    setTimeout(() => (savedFlash = false), 1200);
  }

  async function saveNotes() {
    await db.allenamenti.update(allenamento.id!, { notes });
  }

  function toggleTipologia(t: Tipologia) {
    tipologie = tipologie.includes(t) ? tipologie.filter((x) => x !== t) : [...tipologie, t];
    db.allenamenti.update(allenamento.id!, { tipologie: [...tipologie] });
  }

  function handleSectionDndConsider(e: CustomEvent<{ items: SectionItem[] }>) {
    sections = e.detail.items;
  }

  function handleSectionDndFinalize(e: CustomEvent<{ items: SectionItem[] }>) {
    sections = e.detail.items;
    db.allenamenti.update(allenamento.id!, { sectionOrder: sections.map((s) => s.id) });
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

  async function deleteAllenamento() {
    if (!confirm(`Eliminare l'allenamento del ${formatShortDate(date)}?`)) return;
    await deleteCircuitsFor('allenamento', allenamento.id!);
    await db.allenamenti.delete(allenamento.id!);
    onDeleted();
  }
</script>

<div class="screen">
  <div class="topbar">
    <button class="icon-btn" onclick={onClose} aria-label="Chiudi">✕</button>
    <div class="title-block">
      <span class="group-pill" style="background:{group.color}">{group.name}</span>
      <button class="date" onclick={openDateEditor}>{formatShortDate(date)}</button>
    </div>
    <span class="spacer"></span>
  </div>

  <div class="content">
    <div class="tipologia-section">
      <span class="tipologia-label">Tipologia</span>
      <div class="tipologia-toggle-row">
        {#each TIPOLOGIE as t}
          <button
            type="button"
            class="tipologia-toggle"
            class:active={tipologie.includes(t)}
            style={tipologie.includes(t) ? `background:${TIPOLOGIA_COLORS[t].bg}; border-color:${TIPOLOGIA_COLORS[t].bg}; color:${TIPOLOGIA_COLORS[t].text}` : ''}
            onclick={() => toggleTipologia(t)}
          >
            {TIPOLOGIA_LABELS[t]}
          </button>
        {/each}
      </div>
    </div>

    <div
      class="sections-zone"
      use:dndzone={{ items: sections, flipDurationMs: 150 }}
      onconsider={handleSectionDndConsider}
      onfinalize={handleSectionDndFinalize}
    >
      {#each sections as section (section.id)}
        <div class="section-card">
          <div class="section-header">
            <span class="section-handle">≡</span>
            <span class="section-label">{sectionLabel(section.id)}</span>
          </div>

          {#if section.id === 'note'}
            <textarea bind:value={notes} onblur={saveNotes} placeholder="Note libere sull'allenamento" rows="3"></textarea>
          {:else if section.id === 'esercizi'}
            <NotesList bind:value={esercizi} onCommit={saveEsercizi} showHeader={false} />
            {#if savedFlash}
              <p class="flash">Salvato</p>
            {/if}
          {:else if section.id === 'circuiti'}
            {#each circuits as c, i (c.id)}
              <div class="circuit-card">
                <div class="move-col">
                  <button class="move-btn" onclick={() => moveCircuit(i, -1)} disabled={i === 0} aria-label="Sposta su">▲</button>
                  <button class="move-btn" onclick={() => moveCircuit(i, 1)} disabled={i === circuits.length - 1} aria-label="Sposta giù">▼</button>
                </div>
                <button class="card-main" onclick={() => openEditCircuit(c)}>
                  <div class="card-top">
                    <span class="fmt-pill" style="background:{TIMER_FORMAT_COLORS[c.timerFormat]}">{TIMER_FORMAT_LABELS[c.timerFormat]}</span>
                  </div>
                  <div class="name">{c.name || circuitSummary(c)}</div>
                  {#if c.name}
                    <div class="sub">{circuitSummary(c)}</div>
                  {/if}
                </button>
                <button class="play-btn" onclick={() => openTimer(c)} aria-label="Avvia timer">▶</button>
              </div>
            {/each}
            <button class="add-circuit-btn" onclick={openNewCircuit}>+ Aggiungi circuito</button>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <button class="btn-delete" onclick={deleteAllenamento}>Elimina allenamento</button>
</div>

{#if circuitFormOpen}
  <CircuitForm
    circuit={editingCircuit}
    ownerType="allenamento"
    ownerId={allenamento.id!}
    order={circuits.length}
    onClose={closeCircuitForm}
    onSaved={handleCircuitSaved}
  />
{/if}

{#if timerCircuit}
  <Timer circuit={timerCircuit} onClose={closeTimer} />
{/if}

{#if dateEditorOpen}
  <div class="overlay" role="button" tabindex="-1" onclick={() => (dateEditorOpen = false)} onkeydown={(e) => e.key === 'Escape' && (dateEditorOpen = false)}>
    <div class="sheet" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <div class="handle-bar"></div>
      <h2>Cambia data</h2>
      <label class="field">
        <span>Data</span>
        <select bind:value={pickedDate}>
          {#each dateCandidates as d}
            <option value={d}>{formatShortDate(d)}</option>
          {/each}
        </select>
      </label>
      <button class="btn-save-date" onclick={saveDate}>Salva</button>
    </div>
  </div>
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
    background: transparent;
    border: none;
    font-size: 13px;
    color: var(--text);
    font-weight: 700;
    padding: 2px 4px;
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
    padding: 20px 20px 40px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .tipologia-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .tipologia-toggle-row {
    display: flex;
    gap: 8px;
  }

  .tipologia-toggle {
    flex: 1;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 8px 6px;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted);
  }

  .sections-zone {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .section-card {
    background: var(--bg-elevated);
    border-radius: 20px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: grab;
  }

  .section-handle {
    flex-shrink: 0;
    color: var(--text-faint);
    font-size: 20px;
    line-height: 1;
  }

  .section-label {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  textarea {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    font-size: 15px;
    font-weight: 500;
    font-family: inherit;
    color: var(--text);
    resize: vertical;
  }

  textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }

  .flash {
    color: var(--success);
    font-size: 12px;
    font-weight: 700;
  }

  .circuit-card {
    background: var(--bg);
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    gap: 4px;
    padding-right: 12px;
    margin-bottom: 10px;
  }

  .circuit-card:last-of-type {
    margin-bottom: 0;
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

  .circuit-card .name {
    font-size: 16px;
    font-weight: 700;
  }

  .circuit-card .sub {
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

  .btn-delete {
    flex-shrink: 0;
    background: transparent;
    border: none;
    border-top: 1px solid var(--border);
    border-radius: 0;
    padding: 16px 20px;
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

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
  }

  select {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    font-size: 16px;
    font-weight: 500;
    color: var(--text);
  }

  .btn-save-date {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: var(--radius-sm);
    padding: 13px;
    font-size: 15px;
    font-weight: 700;
  }
</style>
