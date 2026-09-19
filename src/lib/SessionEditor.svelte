<script lang="ts">
  import { db } from './db';
  import { GROUPS, candidateDatesForGroup, formatShortDate } from './groups';
  import { deleteCircuitsFor } from './circuitService';
  import { saveSessionAsAllenamento } from './standardService';
  import type { Session } from './sessionTypes';

  let { session, onClose, onDeleted }: { session: Session; onClose: () => void; onDeleted: () => void } = $props();

  const group = GROUPS[session.groupId];

  let notes = $state(session.notes ?? '');

  let saveAllenamentoOpen = $state(false);
  let allenamentoDate = $state(session.date);
  let allenamentoSaved = $state(false);
  const allenamentoDateCandidates = (() => {
    const base = candidateDatesForGroup(session.groupId);
    return base.includes(session.date) ? base : [...base, session.date].sort();
  })();

  async function saveNotes() {
    await db.sessions.update(session.id!, { notes });
  }

  async function deleteSession() {
    if (!confirm('Eliminare questa sessione?')) return;
    await deleteCircuitsFor('session', session.id!);
    await db.sessions.delete(session.id!);
    onDeleted();
  }

  async function openSaveAllenamento() {
    await saveNotes();
    allenamentoDate = session.date;
    saveAllenamentoOpen = true;
  }

  async function confirmSaveAllenamento() {
    await saveSessionAsAllenamento(session, '', notes, allenamentoDate);
    saveAllenamentoOpen = false;
    allenamentoSaved = true;
    setTimeout(() => (allenamentoSaved = false), 1800);
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
    <label class="field">
      <span>Allenamento</span>
      <textarea bind:value={notes} onblur={saveNotes} placeholder="Note libere sulla sessione" rows="16"></textarea>
    </label>
  </div>

  <div class="action-footer">
    <button class="btn-save-standard" onclick={openSaveAllenamento}>
      {allenamentoSaved ? 'Salvato come allenamento ✓' : '★ Salva come allenamento standard'}
    </button>
    <button class="btn-delete" onclick={deleteSession}>Elimina sessione</button>
  </div>
</div>

{#if saveAllenamentoOpen}
  <div class="overlay" role="button" tabindex="-1" onclick={() => (saveAllenamentoOpen = false)} onkeydown={(e) => e.key === 'Escape' && (saveAllenamentoOpen = false)}>
    <div class="sheet" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <div class="handle-bar"></div>
      <h2>Salva come allenamento standard</h2>
      <label class="field">
        <span>Data</span>
        <select bind:value={allenamentoDate}>
          {#each allenamentoDateCandidates as d}
            <option value={d}>{formatShortDate(d)}</option>
          {/each}
        </select>
      </label>
      <button class="btn-save-allenamento" onclick={confirmSaveAllenamento}>Salva</button>
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

  .action-footer {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 20px calc(14px + env(safe-area-inset-bottom, 0px));
    border-top: 1px solid var(--border);
  }

  .btn-save-standard {
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

  select {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    font-size: 16px;
    font-weight: 500;
    color: var(--text);
  }

  .btn-save-allenamento {
    background: var(--accent);
    border: none;
    border-radius: var(--radius-sm);
    padding: 13px;
    color: #fff;
    font-weight: 700;
    font-size: 15px;
  }
</style>
