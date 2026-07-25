<script lang="ts">
  import { db } from './db';
  import { GROUPS, WEEKLY_SCHEDULE, type GroupId } from './groups';
  import type { StandardVariant } from './standardTypes';
  import StandardVariantEditor from './StandardVariantEditor.svelte';

  const WEEKDAY_NAMES: Record<number, string> = { 1: 'lunedì', 2: 'martedì', 3: 'mercoledì', 4: 'giovedì' };

  function daysForGroup(groupId: GroupId): string {
    const days = WEEKLY_SCHEDULE.filter((s) => s.groupId === groupId).map((s) => WEEKDAY_NAMES[s.weekday]);
    return [...new Set(days)].join(', ');
  }

  let view = $state<'groups' | 'variants'>('groups');
  let selectedGroupId = $state<GroupId | null>(null);

  let variants = $state<StandardVariant[]>([]);
  let openVariant = $state<StandardVariant | null>(null);

  let variantCreatorOpen = $state(false);
  let newVariantName = $state('');

  async function openGroup(groupId: GroupId) {
    selectedGroupId = groupId;
    variants = await db.standardVariants.where('groupId').equals(groupId).toArray();
    view = 'variants';
  }

  function backToGroups() {
    view = 'groups';
    selectedGroupId = null;
  }

  function openNewVariant() {
    newVariantName = '';
    variantCreatorOpen = true;
  }

  async function createVariant() {
    const trimmed = newVariantName.trim();
    if (!trimmed || !selectedGroupId) return;
    const id = await db.standardVariants.add({ groupId: selectedGroupId, name: trimmed, notes: '' });
    variantCreatorOpen = false;
    variants = await db.standardVariants.where('groupId').equals(selectedGroupId).toArray();
    openVariant = variants.find((v) => v.id === id) ?? null;
  }

  function openExistingVariant(v: StandardVariant) {
    openVariant = v;
  }

  async function handleVariantEditorClose() {
    openVariant = null;
    if (selectedGroupId) variants = await db.standardVariants.where('groupId').equals(selectedGroupId).toArray();
  }

  async function handleVariantDeleted() {
    openVariant = null;
    if (selectedGroupId) variants = await db.standardVariants.where('groupId').equals(selectedGroupId).toArray();
  }
</script>

<div class="screen">
  {#if view === 'groups'}
    <div class="topbar">
      <h1>Allenamenti</h1>
    </div>
    <div class="content">
      {#each Object.values(GROUPS) as g}
        <button class="card" onclick={() => openGroup(g.id)}>
          <div class="group-info">
            <span class="group-pill" style="background:{g.color}">{g.name}</span>
            <span class="days">{daysForGroup(g.id)}</span>
          </div>
        </button>
      {/each}
    </div>
  {:else if view === 'variants'}
    <div class="topbar">
      <button class="icon-btn" onclick={backToGroups} aria-label="Indietro">‹</button>
      <h1>{selectedGroupId ? GROUPS[selectedGroupId].name : ''}</h1>
      <span class="spacer"></span>
    </div>
    <div class="content">
      {#if variants.length === 0}
        <p class="empty">Nessun allenamento. Creane uno per iniziare.</p>
      {/if}
      {#each variants as v (v.id)}
        <button class="card" onclick={() => openExistingVariant(v)}>
          <div class="name">{v.name}</div>
        </button>
      {/each}
    </div>
    <button class="fab" onclick={openNewVariant} aria-label="Nuovo allenamento">+</button>
  {/if}
</div>

{#if variantCreatorOpen}
  <div class="overlay" role="button" tabindex="-1" onclick={() => (variantCreatorOpen = false)} onkeydown={(e) => e.key === 'Escape' && (variantCreatorOpen = false)}>
    <div class="sheet" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <div class="handle-bar"></div>
      <h2>Nuovo allenamento</h2>
      <label class="field">
        <span>Nome</span>
        <input type="text" bind:value={newVariantName} placeholder="Es. Allenamento A" />
      </label>
      <button class="btn-save" onclick={createVariant}>Crea</button>
    </div>
  </div>
{/if}

{#if openVariant && selectedGroupId}
  <StandardVariantEditor variant={openVariant} groupId={selectedGroupId} onClose={handleVariantEditorClose} onDeleted={handleVariantDeleted} />
{/if}

<style>
  .screen {
    display: flex;
    flex-direction: column;
    min-height: 100svh;
    position: relative;
  }

  .topbar {
    padding: 22px 20px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .topbar h1 {
    font-size: 20px;
    font-weight: 800;
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 24px;
    padding: 4px 10px;
  }

  .spacer {
    width: 34px;
  }

  .content {
    flex: 1;
    padding-bottom: 100px;
  }

  .empty {
    padding: 40px 20px;
    text-align: center;
    color: var(--text-muted);
    font-size: 15px;
  }

  .card {
    width: calc(100% - 40px);
    margin: 0 20px 10px;
    background: var(--bg-elevated);
    border: none;
    border-radius: var(--radius-lg);
    padding: 16px 18px;
    display: flex;
    align-items: center;
    text-align: left;
  }

  .group-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .days {
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 600;
  }

  .name {
    font-size: 16px;
    font-weight: 700;
  }

  .group-pill {
    padding: 6px 14px;
    border-radius: var(--radius-pill);
    font-size: 14px;
    font-weight: 800;
    color: #fff;
  }

  .fab {
    position: fixed;
    right: 20px;
    bottom: 96px;
    z-index: 65;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    font-size: 28px;
    font-weight: 600;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 20px rgba(232, 98, 44, 0.4);
    line-height: 1;
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

  input {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    font-size: 16px;
    font-weight: 500;
    color: var(--text);
  }

  .btn-save {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: var(--radius-sm);
    padding: 13px;
    font-size: 15px;
    font-weight: 700;
  }
</style>
