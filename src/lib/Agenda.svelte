<script lang="ts">
  import { db } from './db';
  import { GROUPS, toIsoDate } from './groups';
  import type { Session } from './sessionTypes';
  import SessionEditor from './SessionEditor.svelte';

  const todayIso = toIsoDate(new Date());

  let sessions = $state<Session[]>([]);
  let openSession = $state<Session | null>(null);

  async function load() {
    sessions = (await db.sessions.toArray()).sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  load();

  function openEntry(s: Session) {
    openSession = s;
  }

  async function handleClose() {
    openSession = null;
    await load();
  }

  async function handleDeleted() {
    openSession = null;
    await load();
  }
</script>

<div class="screen">
  <div class="topbar">
    <h1>Agenda</h1>
  </div>

  <div class="content">
    {#if sessions.length === 0}
      <p class="empty">Nessuna sessione ancora.</p>
    {/if}
    {#each sessions as s (s.id)}
      <button class="row" class:today={s.date === todayIso} onclick={() => openEntry(s)}>
        <span class="pill" style="background:{GROUPS[s.groupId].color}">{GROUPS[s.groupId].name}</span>
        <span class="date">{s.date}</span>
        {#if s.date === todayIso}
          <span class="today-badge">oggi</span>
        {/if}
      </button>
    {/each}
  </div>
</div>

{#if openSession}
  <SessionEditor session={openSession} onClose={handleClose} onDeleted={handleDeleted} />
{/if}

<style>
  .screen {
    display: flex;
    flex-direction: column;
    min-height: 100svh;
    padding-bottom: 100px;
  }

  .topbar {
    padding: 22px 20px 12px;
  }

  .topbar h1 {
    font-size: 22px;
    font-weight: 800;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 20px;
  }

  .empty {
    padding: 40px 0;
    text-align: center;
    color: var(--text-muted);
    font-size: 15px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-elevated);
    border: none;
    border-radius: var(--radius-sm);
    padding: 12px 14px;
  }

  .row.today {
    border: 1px solid var(--accent);
  }

  .pill {
    padding: 6px 12px;
    border-radius: var(--radius-pill);
    font-size: 12px;
    font-weight: 800;
    color: #fff;
  }

  .date {
    flex: 1;
    text-align: left;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .today-badge {
    font-size: 11px;
    font-weight: 800;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
</style>
