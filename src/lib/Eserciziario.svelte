<script lang="ts">
  import { db } from './db';
  import {
    PATTERN_CATEGORIES,
    PATTERN_CATEGORY_LABELS,
    PATTERN_CATEGORY_COLORS,
    CORE_SUBCATEGORY_LABELS,
    QUALITY_LABELS,
    type Exercise,
    type PatternCategory,
  } from './types';
  import ExerciseForm from './ExerciseForm.svelte';

  let exercises = $state<Exercise[]>([]);
  let formOpen = $state(false);
  let editingExercise = $state<Exercise | null>(null);

  async function load() {
    exercises = await db.exercises.orderBy('name').toArray();
  }

  load();

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

  const grouped = $derived.by(() => {
    const map = new Map<PatternCategory, Exercise[]>();
    for (const cat of PATTERN_CATEGORIES) map.set(cat, []);
    for (const ex of exercises) {
      map.get(ex.category)?.push(ex);
    }
    return map;
  });
</script>

<div class="screen">
  <div class="topbar">
    <h1>Eserciziario</h1>
  </div>

  <div class="content">
    {#if exercises.length === 0}
      <p class="empty">Nessun esercizio. Aggiungine uno per iniziare.</p>
    {/if}

    {#each PATTERN_CATEGORIES as cat}
      {@const list = grouped.get(cat) ?? []}
      {#if list.length > 0}
        <div class="section-label">
          <span class="dot" style="background:{PATTERN_CATEGORY_COLORS[cat].bg}"></span>
          {PATTERN_CATEGORY_LABELS[cat]}
        </div>
        {#each list as ex (ex.id)}
          <button class="card" onclick={() => openEdit(ex)}>
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
        {/each}
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

  .card {
    width: calc(100% - 40px);
    margin: 0 20px 10px;
    background: var(--bg-elevated);
    border: none;
    border-radius: var(--radius-lg);
    padding: 14px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-align: left;
  }

  .card .name {
    font-size: 16px;
    font-weight: 700;
  }

  .card .sub {
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
    bottom: 24px;
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
