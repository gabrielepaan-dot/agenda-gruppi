<script lang="ts">
  import { tick } from 'svelte';
  import { dndzone } from 'svelte-dnd-action';

  let {
    value = $bindable(''),
    onCommit,
  }: { value?: string; onCommit?: () => void } = $props();

  type Line = { id: string; text: string };

  function linesFromValue(v: string): Line[] {
    if (!v.length) return Array.from({ length: 8 }, () => ({ id: crypto.randomUUID(), text: '' }));
    return v.split('\n').map((text) => ({ id: crypto.randomUUID(), text }));
  }

  let lines = $state<Line[]>(linesFromValue(value));
  let inputEls: (HTMLInputElement | null)[] = [];

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

  function handleDndConsider(e: CustomEvent<{ items: Line[] }>) {
    lines = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<{ items: Line[] }>) {
    lines = e.detail.items;
    commit();
  }
</script>

<div class="notes-list">
  <div class="header-row">
    <span class="label">Esercizi</span>
  </div>

  <div
    class="lines-zone"
    use:dndzone={{ items: lines, flipDurationMs: 150 }}
    onconsider={handleDndConsider}
    onfinalize={handleDndFinalize}
  >
    {#each lines as line, i (line.id)}
      <div class="line-row">
        <span class="handle">≡</span>
        <span class="badge">{i + 1}</span>
        <input
          type="text"
          bind:value={line.text}
          bind:this={inputEls[i]}
          onblur={commit}
          placeholder="Esercizio"
        />
        <button type="button" class="remove-btn" onclick={() => removeLine(i)} aria-label="Elimina riga">✕</button>
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
    align-items: center;
    gap: 6px;
  }

  .handle {
    flex-shrink: 0;
    color: var(--text-faint);
    font-size: 18px;
    cursor: grab;
  }

  .badge {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
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
    background: var(--bg-elevated);
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
