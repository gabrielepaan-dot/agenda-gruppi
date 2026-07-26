<script lang="ts">
  import { dragHandleZone, dragHandle } from 'svelte-dnd-action';
  import { db } from './db';
  import {
    PATTERN_CATEGORIES,
    PATTERN_CATEGORY_LABELS,
    PATTERN_CATEGORY_COLORS,
    CORE_SUBCATEGORY_LABELS,
    QUALITIES,
    QUALITY_LABELS,
    type Exercise,
    type PatternCategory,
    type Quality,
  } from './types';
  import ExerciseForm from './ExerciseForm.svelte';

  let exercises = $state<Exercise[]>([]);
  let formOpen = $state(false);
  let editingExercise = $state<Exercise | null>(null);
  let qualityFilter = $state<Quality | null>(null);

  function emptyLists(): Record<PatternCategory, Exercise[]> {
    const obj = {} as Record<PatternCategory, Exercise[]>;
    for (const cat of PATTERN_CATEGORIES) obj[cat] = [];
    return obj;
  }

  let listsByCategory = $state<Record<PatternCategory, Exercise[]>>(emptyLists());

  async function load() {
    exercises = await db.exercises.toArray();
  }

  load();

  $effect(() => {
    const obj = emptyLists();
    for (const ex of exercises) {
      if (qualityFilter && ex.quality !== qualityFilter) continue;
      obj[ex.category].push(ex);
    }
    for (const cat of PATTERN_CATEGORIES) obj[cat].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    listsByCategory = obj;
  });

  function openNew() {
    editingExercise = null;
    formOpen = true;
  }

  function openEdit(ex: Exercise) {
    editingExercise = ex;
    formOpen = true;
  }

  function closeForm() {
    formOpen = false;
  }

  async function handleSaved() {
    formOpen = false;
    await load();
  }

  function handleConsider(cat: PatternCategory, e: CustomEvent<{ items: Exercise[] }>) {
    listsByCategory[cat] = e.detail.items;
  }

  async function handleFinalize(cat: PatternCategory, e: CustomEvent<{ items: Exercise[] }>) {
    const items = e.detail.items;
    listsByCategory[cat] = items;
    await Promise.all(
      items.map((ex, i) => {
        ex.order = i;
        return ex.id != null ? db.exercises.update(ex.id, { order: i }) : Promise.resolve();
      }),
    );
  }
</script>

<div class="screen">
  <div class="topbar">
    <h1>Eserciziario</h1>
  </div>

  <div class="filter-row">
    <button class="chip" class:active={qualityFilter === null} onclick={() => (qualityFilter = null)}>Tutti</button>
    {#each QUALITIES as q}
      <button class="chip" class:active={qualityFilter === q} onclick={() => (qualityFilter = q)}>
        {QUALITY_LABELS[q]}
      </button>
    {/each}
  </div>

  <div class="content">
    {#if exercises.length === 0}
      <p class="empty">Nessun esercizio. Aggiungine uno per iniziare.</p>
    {/if}

    {#each PATTERN_CATEGORIES as cat}
      {@const list = listsByCategory[cat]}
      {#if list.length > 0}
        <div class="section-label">
          <span class="dot" style="background:{PATTERN_CATEGORY_COLORS[cat].bg}"></span>
          {PATTERN_CATEGORY_LABELS[cat]}
        </div>
        <div
          class="category-zone"
          use:dragHandleZone={{ items: list, flipDurationMs: 150 }}
          onconsider={(e) => handleConsider(cat, e)}
          onfinalize={(e) => handleFinalize(cat, e)}
        >
          {#each list as ex (ex.id)}
            <div class="card" style="border-left-color:{PATTERN_CATEGORY_COLORS[cat].bg}">
              <span class="drag-handle" use:dragHandle>≡</span>
              <button class="card-body" onclick={() => openEdit(ex)}>
                <div class="left">
                  <div class="name">{ex.name}</div>
                  {#if ex.category === 'core' && ex.coreSubcategory}
                    <div class="sub">{CORE_SUBCATEGORY_LABELS[ex.coreSubcategory]}</div>
                  {/if}
                </div>
                {#if ex.quality}
                  <span class="quality-pill">{QUALITY_LABELS[ex.quality]}</span>
                {/if}
              </button>
            </div>
          {/each}
        </div>
      {/if}
    {/each}
  </div>

  <button class="fab" onclick={openNew} aria-label="Aggiungi esercizio">+</button>
</div>

{#if formOpen}
  <ExerciseForm exercise={editingExercise} onClose={closeForm} onSaved={handleSaved} />
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
    font-size: 22px;
    font-weight: 800;
  }

  .filter-row {
    display: flex;
    gap: 8px;
    padding: 0 20px 12px;
    flex-shrink: 0;
  }

  .chip {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-muted);
  }

  .chip.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
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

  .section-label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 18px 20px 8px;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .category-zone {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0 20px;
  }

  .card {
    display: flex;
    align-items: stretch;
    background: var(--bg-elevated);
    border-left: 4px solid transparent;
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .drag-handle {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding: 0 4px 0 10px;
    color: var(--text-faint);
    font-size: 20px;
    cursor: grab;
  }

  .card-body {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    padding: 14px 16px 14px 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-align: left;
  }

  .card-body .name {
    font-size: 16px;
    font-weight: 700;
  }

  .card-body .sub {
    font-size: 13px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .quality-pill {
    flex-shrink: 0;
    padding: 5px 10px;
    border-radius: var(--radius-pill);
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
    border: 1px solid var(--border);
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
</style>
