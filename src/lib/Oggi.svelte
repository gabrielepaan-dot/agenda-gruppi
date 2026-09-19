<script lang="ts">
  import { GROUPS, slotsForDate, toIsoDate, type GroupId } from './groups';
  import { ensureSessionForDate, lastPastSession } from './sessionService';
  import type { Session } from './sessionTypes';
  import SessionEditor from './SessionEditor.svelte';

  const today = new Date();
  const todayIso = toIsoDate(today);
  const todaySlots = slotsForDate(today);

  let selectedGroupId = $state<GroupId | null>(todaySlots[0]?.groupId ?? null);
  let todaySession = $state<Session | null>(null);
  let lastSession = $state<Session | null>(null);
  let openSession = $state<Session | null>(null);
  let loading = $state(true);

  async function loadForGroup(groupId: GroupId) {
    loading = true;
    todaySession = await ensureSessionForDate(todayIso, groupId);
    lastSession = await lastPastSession(groupId, todayIso);
    loading = false;
  }

  if (selectedGroupId) {
    loadForGroup(selectedGroupId);
  } else {
    loading = false;
  }

  function selectGroup(groupId: GroupId) {
    selectedGroupId = groupId;
    loadForGroup(groupId);
  }

  function sessionSummaryLine(session: Session | null): string {
    if (!session) return '';
    const text = (session.notes ?? '').trim();
    return text ? text.split('\n')[0] : 'Nessun contenuto registrato';
  }

  function openToday() {
    if (todaySession) openSession = todaySession;
  }

  function openLastSession() {
    if (lastSession) openSession = lastSession;
  }

  async function handleEditorClose() {
    openSession = null;
    if (selectedGroupId) await loadForGroup(selectedGroupId);
  }

  async function handleEditorDeleted() {
    openSession = null;
    if (selectedGroupId) await loadForGroup(selectedGroupId);
  }
</script>

<div class="screen">
  <div class="topbar">
    <h1>Oggi</h1>
  </div>

  {#if !selectedGroupId}
    <p class="empty-today">Nessun gruppo in programma oggi.</p>
  {:else}
    <button class="cta" onclick={openToday}>▶ Avvia sessione di oggi</button>

    <div class="content-top">
      {#if todaySlots.length > 1}
        <div class="pill-row">
          {#each todaySlots as slot}
            <button
              class="group-select-pill"
              class:active={slot.groupId === selectedGroupId}
              style={slot.groupId === selectedGroupId ? `background:${GROUPS[slot.groupId].color}` : ''}
              onclick={() => selectGroup(slot.groupId)}
            >
              {GROUPS[slot.groupId].name}
            </button>
          {/each}
        </div>
      {:else}
        <div class="pill-row">
          <span class="pill" style="background:{GROUPS[selectedGroupId].color}">{GROUPS[selectedGroupId].name}</span>
        </div>
      {/if}

      {#if !loading}
        {#if lastSession}
          <button class="card" onclick={openLastSession}>
            <div class="left">
              <div class="name">Ultima volta · {lastSession.date}</div>
              <div class="sub">{sessionSummaryLine(lastSession)}</div>
            </div>
          </button>
        {/if}
      {/if}
    </div>
  {/if}
</div>

{#if openSession}
  <SessionEditor session={openSession} onClose={handleEditorClose} onDeleted={handleEditorDeleted} />
{/if}

<style>
  .screen {
    display: flex;
    flex-direction: column;
    min-height: 100svh;
    padding-bottom: 100px;
  }

  .topbar {
    padding: 14px 20px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .topbar h1 {
    font-size: 22px;
    font-weight: 800;
  }

  .cta {
    margin: 0 20px 22px;
    background: var(--accent);
    color: #fff;
    font-weight: 700;
    font-size: 16px;
    text-align: center;
    padding: 15px;
    border-radius: var(--radius-md);
    border: none;
  }

  .empty-today {
    padding: 30px 20px;
    color: var(--text-muted);
    font-size: 15px;
    text-align: center;
  }

  .content-top {
    display: flex;
    flex-direction: column;
  }

  .pill-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 20px;
    margin-bottom: 12px;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: var(--radius-pill);
    font-size: 13px;
    font-weight: 700;
    color: #fff;
  }

  .group-select-pill {
    padding: 7px 14px;
    border-radius: var(--radius-pill);
    font-size: 13px;
    font-weight: 700;
    color: var(--text-muted);
    background: var(--bg-elevated);
    border: none;
  }

  .group-select-pill.active {
    color: #fff;
  }

  .card {
    margin: 0 20px 14px;
    background: var(--bg-elevated);
    border-radius: var(--radius-lg);
    padding: 16px 18px;
    display: block;
    text-align: left;
    border: none;
    width: calc(100% - 40px);
  }

  .card .name {
    font-size: 17px;
    font-weight: 700;
  }

  .card .sub {
    font-size: 14px;
    color: var(--text-muted);
    margin-top: 3px;
  }
</style>
