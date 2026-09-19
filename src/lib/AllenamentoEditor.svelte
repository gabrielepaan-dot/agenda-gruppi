<script lang="ts">
  import { db } from './db';
  import { GROUPS, candidateDatesForGroup, formatShortDate, type GroupId } from './groups';
  import { deleteCircuitsFor } from './circuitService';
  import type { Allenamento } from './standardTypes';

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

  let notes = $state(allenamento.notes ?? '');

  async function saveNotes() {
    await db.allenamenti.update(allenamento.id!, { notes });
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
    <label class="field">
      <span>Allenamento</span>
      <textarea bind:value={notes} onblur={saveNotes} placeholder="Note libere sull'allenamento" rows="16"></textarea>
    </label>
  </div>

  <button class="btn-delete" onclick={deleteAllenamento}>Elimina allenamento</button>
</div>

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
    padding: 14px 16px;
    font-size: 15px;
    font-weight: 500;
    font-family: inherit;
    line-height: 1.5;
    color: var(--text);
    resize: vertical;
    min-height: 320px;
  }

  textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
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
