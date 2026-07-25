<script lang="ts">
  import { db } from './db';
  import { GROUPS, type GroupId } from './groups';
  import type { StandardCategory, StandardVariant } from './standardTypes';
  import StandardVariantEditor from './StandardVariantEditor.svelte';

  let view = $state<'groups' | 'categories' | 'variants'>('groups');
  let selectedGroupId = $state<GroupId | null>(null);
  let selectedCategory = $state<StandardCategory | null>(null);

  let categories = $state<StandardCategory[]>([]);
  let variants = $state<StandardVariant[]>([]);
  let openVariant = $state<StandardVariant | null>(null);

  let categoryFormOpen = $state(false);
  let editingCategory = $state<StandardCategory | null>(null);
  let categoryNameInput = $state('');

  let variantCreatorOpen = $state(false);
  let newVariantName = $state('');

  async function openGroup(groupId: GroupId) {
    selectedGroupId = groupId;
    categories = await db.standardCategories.where('groupId').equals(groupId).toArray();
    view = 'categories';
  }

  async function openCategory(cat: StandardCategory) {
    selectedCategory = cat;
    variants = await db.standardVariants.where('categoryId').equals(cat.id!).toArray();
    view = 'variants';
  }

  function backToGroups() {
    view = 'groups';
    selectedGroupId = null;
  }

  async function backToCategories() {
    if (!selectedGroupId) return;
    view = 'categories';
    categories = await db.standardCategories.where('groupId').equals(selectedGroupId).toArray();
    selectedCategory = null;
  }

  function openNewCategory() {
    editingCategory = null;
    categoryNameInput = '';
    categoryFormOpen = true;
  }

  function openEditCategory(cat: StandardCategory) {
    editingCategory = cat;
    categoryNameInput = cat.name;
    categoryFormOpen = true;
  }

  async function saveCategory() {
    const trimmed = categoryNameInput.trim();
    if (!trimmed || !selectedGroupId) return;
    if (editingCategory?.id) {
      await db.standardCategories.update(editingCategory.id, { name: trimmed });
    } else {
      await db.standardCategories.add({ groupId: selectedGroupId, name: trimmed });
    }
    categoryFormOpen = false;
    categories = await db.standardCategories.where('groupId').equals(selectedGroupId).toArray();
  }

  async function deleteCategory(cat: StandardCategory) {
    if (!confirm(`Eliminare la categoria "${cat.name}" e tutte le sue varianti?`)) return;
    const catVariants = await db.standardVariants.where('categoryId').equals(cat.id!).toArray();
    for (const v of catVariants) {
      await db.circuits.where('[ownerType+ownerId]').equals(['variant', v.id!]).delete();
      await db.standardVariants.delete(v.id!);
    }
    await db.standardCategories.delete(cat.id!);
    categoryFormOpen = false;
    if (selectedGroupId) categories = await db.standardCategories.where('groupId').equals(selectedGroupId).toArray();
  }

  function openNewVariant() {
    newVariantName = '';
    variantCreatorOpen = true;
  }

  async function createVariant() {
    const trimmed = newVariantName.trim();
    if (!trimmed || !selectedCategory) return;
    const id = await db.standardVariants.add({ categoryId: selectedCategory.id!, name: trimmed, warmup: '', notes: '' });
    variantCreatorOpen = false;
    variants = await db.standardVariants.where('categoryId').equals(selectedCategory.id!).toArray();
    openVariant = variants.find((v) => v.id === id) ?? null;
  }

  function openExistingVariant(v: StandardVariant) {
    openVariant = v;
  }

  async function handleVariantEditorClose() {
    openVariant = null;
    if (selectedCategory) variants = await db.standardVariants.where('categoryId').equals(selectedCategory.id!).toArray();
  }

  async function handleVariantDeleted() {
    openVariant = null;
    if (selectedCategory) variants = await db.standardVariants.where('categoryId').equals(selectedCategory.id!).toArray();
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
          <span class="group-pill" style="background:{g.color}">{g.name}</span>
        </button>
      {/each}
    </div>
  {:else if view === 'categories'}
    <div class="topbar">
      <button class="icon-btn" onclick={backToGroups} aria-label="Indietro">‹</button>
      <h1>{selectedGroupId ? GROUPS[selectedGroupId].name : ''}</h1>
      <span class="spacer"></span>
    </div>
    <div class="content">
      {#if categories.length === 0}
        <p class="empty">Nessuna categoria. Creane una per iniziare.</p>
      {/if}
      {#each categories as cat (cat.id)}
        <div class="card row">
          <button class="card-main" onclick={() => openCategory(cat)}>
            <div class="name">{cat.name}</div>
          </button>
          <button class="edit-btn" onclick={() => openEditCategory(cat)} aria-label="Modifica categoria">✎</button>
        </div>
      {/each}
    </div>
    <button class="fab" onclick={openNewCategory} aria-label="Nuova categoria">+</button>
  {:else if view === 'variants'}
    <div class="topbar">
      <button class="icon-btn" onclick={backToCategories} aria-label="Indietro">‹</button>
      <h1>{selectedCategory?.name ?? ''}</h1>
      <span class="spacer"></span>
    </div>
    <div class="content">
      {#if variants.length === 0}
        <p class="empty">Nessuna variante. Creane una per iniziare.</p>
      {/if}
      {#each variants as v (v.id)}
        <button class="card" onclick={() => openExistingVariant(v)}>
          <div class="name">{v.name}</div>
        </button>
      {/each}
    </div>
    <button class="fab" onclick={openNewVariant} aria-label="Nuova variante">+</button>
  {/if}
</div>

{#if categoryFormOpen}
  <div class="overlay" role="button" tabindex="-1" onclick={() => (categoryFormOpen = false)} onkeydown={(e) => e.key === 'Escape' && (categoryFormOpen = false)}>
    <div class="sheet" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <div class="handle-bar"></div>
      <h2>{editingCategory ? 'Modifica categoria' : 'Nuova categoria'}</h2>
      <label class="field">
        <span>Nome</span>
        <input type="text" bind:value={categoryNameInput} placeholder="Es. Forza" />
      </label>
      <div class="actions">
        {#if editingCategory}
          <button class="btn-delete" onclick={() => deleteCategory(editingCategory!)}>Elimina</button>
        {/if}
        <button class="btn-cancel" onclick={() => (categoryFormOpen = false)}>Annulla</button>
        <button class="btn-save" onclick={saveCategory}>Salva</button>
      </div>
    </div>
  </div>
{/if}

{#if variantCreatorOpen}
  <div class="overlay" role="button" tabindex="-1" onclick={() => (variantCreatorOpen = false)} onkeydown={(e) => e.key === 'Escape' && (variantCreatorOpen = false)}>
    <div class="sheet" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <div class="handle-bar"></div>
      <h2>Nuova variante</h2>
      <label class="field">
        <span>Nome</span>
        <input type="text" bind:value={newVariantName} placeholder="Es. Variante A" />
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

  .card.row {
    padding: 0;
    gap: 8px;
  }

  .card-main {
    flex: 1;
    background: transparent;
    border: none;
    padding: 16px 18px;
    text-align: left;
  }

  .edit-btn {
    flex-shrink: 0;
    background: transparent;
    border: none;
    color: var(--text-faint);
    font-size: 15px;
    padding: 12px 16px;
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

  .actions {
    display: flex;
    gap: 10px;
  }

  .actions button {
    flex: 1;
    border: none;
    border-radius: var(--radius-sm);
    padding: 13px;
    font-size: 15px;
    font-weight: 700;
  }

  .btn-save {
    background: var(--accent);
    color: #fff;
  }

  .btn-cancel {
    background: var(--bg);
    color: var(--text-muted);
    border: 1px solid var(--border) !important;
  }

  .btn-delete {
    flex: 0 0 auto;
    background: transparent;
    color: #f26d6d;
    padding: 13px 16px;
  }
</style>
