<script lang="ts">
  import { db } from './db';
  import {
    PATTERN_CATEGORIES,
    PATTERN_CATEGORY_LABELS,
    CORE_SUBCATEGORIES,
    CORE_SUBCATEGORY_LABELS,
    QUALITIES,
    QUALITY_LABELS,
    type Exercise,
    type PatternCategory,
    type CoreSubcategory,
    type Quality,
  } from './types';
  import VoiceRecorder from './VoiceRecorder.svelte';

  let {
    exercise = null,
    onClose,
    onSaved,
  }: { exercise?: Exercise | null; onClose: () => void; onSaved: () => void } = $props();

  let name = $state(exercise?.name ?? '');
  let category = $state<PatternCategory>(exercise?.category ?? 'spinta_verticale');
  let coreSubcategory = $state<CoreSubcategory | ''>(exercise?.coreSubcategory ?? '');
  let quality = $state<Quality | ''>(exercise?.quality ?? '');
  let error = $state('');

  const isCore = $derived(category === 'core');

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      error = 'Inserisci un nome.';
      return;
    }
    if (isCore && !coreSubcategory) {
      error = 'Seleziona una sottocategoria Core.';
      return;
    }
    const payload: Exercise = {
      name: trimmed,
      category,
      coreSubcategory: isCore ? (coreSubcategory as CoreSubcategory) : undefined,
      quality: quality ? (quality as Quality) : undefined,
    };
    if (exercise?.id) {
      if (category !== exercise.category) {
        payload.order = await db.exercises.where('category').equals(category).count();
      }
      await db.exercises.update(exercise.id, payload);
    } else {
      payload.order = await db.exercises.where('category').equals(category).count();
      await db.exercises.add(payload);
    }
    onSaved();
  }

  async function remove() {
    if (!exercise?.id) return;
    if (!confirm(`Eliminare "${exercise.name}"? Sparirà anche dallo storico.`)) return;
    await db.exercises.delete(exercise.id);
    await db.voiceRecordings.where({ targetType: 'exercise', exerciseId: exercise.id }).delete();
    onSaved();
  }
</script>

<div
  class="overlay"
  role="button"
  tabindex="-1"
  onclick={onClose}
  onkeydown={(e) => e.key === 'Escape' && onClose()}
>
  <div
    class="sheet"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <div class="handle"></div>
    <h2>{exercise ? 'Modifica esercizio' : 'Nuovo esercizio'}</h2>

    <label class="field">
      <span>Nome</span>
      <input type="text" bind:value={name} placeholder="Es. Trazioni presa larga" />
    </label>

    <label class="field">
      <span>Categoria (pattern di movimento)</span>
      <select bind:value={category}>
        {#each PATTERN_CATEGORIES as cat}
          <option value={cat}>{PATTERN_CATEGORY_LABELS[cat]}</option>
        {/each}
      </select>
    </label>

    {#if isCore}
      <label class="field">
        <span>Sottocategoria Core</span>
        <select bind:value={coreSubcategory}>
          <option value="" disabled>Seleziona...</option>
          {#each CORE_SUBCATEGORIES as sub}
            <option value={sub}>{CORE_SUBCATEGORY_LABELS[sub]}</option>
          {/each}
        </select>
      </label>
    {/if}

    <label class="field">
      <span>Qualità (opzionale)</span>
      <select bind:value={quality}>
        <option value="">Nessuna</option>
        {#each QUALITIES as q}
          <option value={q}>{QUALITY_LABELS[q]}</option>
        {/each}
      </select>
    </label>

    <div class="field">
      <span>Pronuncia registrata</span>
      {#if exercise?.id}
        <VoiceRecorder target={{ type: 'exercise', exerciseId: exercise.id }} />
      {:else}
        <div class="recording-stub">Salva l'esercizio per poter registrare la pronuncia</div>
      {/if}
    </div>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <div class="actions">
      {#if exercise}
        <button class="btn-delete" onclick={remove}>Elimina</button>
      {/if}
      <button class="btn-cancel" onclick={onClose}>Annulla</button>
      <button class="btn-save" onclick={save}>Salva</button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: flex-end;
    z-index: 100;
  }

  .sheet {
    width: 100%;
    max-height: 88vh;
    overflow-y: auto;
    background: var(--bg-elevated);
    border-radius: 20px 20px 0 0;
    padding: 12px 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .handle {
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: var(--border);
    margin: 0 auto 4px;
  }

  h2 {
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

  input,
  select {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    font-size: 16px;
    font-weight: 500;
    color: var(--text);
  }

  input:focus,
  select:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }

  .recording-stub {
    background: var(--bg);
    border: 1px dashed var(--border);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-faint);
  }

  .error {
    color: #f26d6d;
    font-size: 13px;
    font-weight: 600;
  }

  .actions {
    display: flex;
    gap: 10px;
    margin-top: 6px;
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
