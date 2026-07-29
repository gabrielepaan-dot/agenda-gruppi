<script lang="ts">
  import { tick } from 'svelte';
  import { dragHandleZone, dragHandle } from 'svelte-dnd-action';

  let {
    value = $bindable(''),
    onCommit,
    showHeader = true,
  }: { value?: string; onCommit?: () => void; showHeader?: boolean } = $props();

  type Line = { id: string; text: string };

  function linesFromValue(v: string): Line[] {
    if (!v.length) return [{ id: crypto.randomUUID(), text: '' }];
    return v.split('\n').map((text) => ({ id: crypto.randomUUID(), text }));
  }

  let lines = $state<Line[]>(linesFromValue(value));
  let inputEls: (HTMLInputElement | null)[] = [];

  // Unique per mounted instance so this zone is never mistaken for a compatible drop
  // target by another dndzone elsewhere on screen (svelte-dnd-action treats all zones
  // sharing a `type` — the default is a single shared value for every zone in the app —
  // as valid cross-drop targets for each other).
  const zoneType = `notes-lines-${crypto.randomUUID()}`;

  function commit() {
    value = lines.map((l) => l.text).join('\n');
    onCommit?.();
  }

  async function addLine() {
    lines.push({ id: crypto.randomUUID(), text: '' });
    commit();
    await tick();
    inputEls[lines.length - 1]?.focus();
  }

  function removeLine(i: number) {
    lines.splice(i, 1);
    commit();
  }

  async function insertLineAfter(i: number) {
    lines.splice(i + 1, 0, { id: crypto.randomUUID(), text: '' });
    commit();
    await tick();
    inputEls[i + 1]?.focus();
  }

  function handleKeydown(e: KeyboardEvent, i: number) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    insertLineAfter(i);
  }

  function handleDndConsider(e: CustomEvent<{ items: Line[] }>) {
    lines = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<{ items: Line[] }>) {
    lines = e.detail.items;
    commit();
  }
</script>

<div class="notes-list">
  {#if showHeader}
    <div class="header-row">
      <span class="label">Esercizi</span>
    </div>
  {/if}

  <div
    class="lines-zone"
    use:dragHandleZone={{ items: lines, flipDurationMs: 150, type: zoneType }}
    onconsider={handleDndConsider}
    onfinalize={handleDndFinalize}
  >
    {#each lines as line, i (line.id)}
      <div class="line-row">
        <div class="row-body">
          <span class="badge">{i + 1}</span>
          <input
            type="text"
            bind:value={line.text}
            bind:this={inputEls[i]}
            onblur={commit}
            onkeydown={(e) => handleKeydown(e, i)}
            placeholder="Esercizio"
          />
          <button type="button" class="remove-btn" onclick={() => removeLine(i)} aria-label="Elimina riga">✕</button>
        </div>
        <span class="drag-handle" use:dragHandle aria-label="Trascina per riordinare">⚓</span>
      </div>
    {/each}
  </div>

  <button type="button" class="add-line-btn" onclick={addLine}>+ Aggiungi riga</button>
</div>

<style>
  .notes-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .lines-zone {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .line-row {
    display: flex;
    align-items: stretch;
    background: var(--bg-elevated);
    border: 2px solid transparent;
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: box-shadow 0.15s, border-color 0.15s;
  }

  .row-body {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px 8px 12px;
  }

  .badge {
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: rgba(232, 98, 44, 0.15);
    color: var(--accent);
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  input[type='text'] {
    flex: 1;
    min-width: 0;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    font-size: 15px;
    font-weight: 500;
    color: var(--text);
  }

  input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
  }

  .remove-btn {
    flex-shrink: 0;
    background: transparent;
    border: none;
    color: var(--text-faint);
    font-size: 14px;
    padding: 4px 5px;
  }

  .drag-handle {
    flex-shrink: 0;
    width: 52px;
    align-self: stretch;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    border-left: 1px solid var(--border);
    color: var(--text-faint);
    font-size: 20px;
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  /* !important: svelte-dnd-action snapshots the original element's computed border
     into this clone's own inline style, which otherwise beats any stylesheet rule. */
  :global(#dnd-action-dragged-el.line-row) {
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35) !important;
    border-color: var(--accent) !important;
  }

  .add-line-btn {
    background: transparent;
    border: 1px dashed var(--border);
    border-radius: var(--radius-sm);
    padding: 10px;
    color: var(--accent);
    font-weight: 700;
    font-size: 13px;
  }
</style>
