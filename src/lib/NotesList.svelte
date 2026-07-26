<script lang="ts">
  import { tick } from 'svelte';

  let {
    value = $bindable(''),
    onCommit,
  }: { value?: string; onCommit?: () => void } = $props();

  let lines = $state<string[]>(value.length ? value.split('\n') : []);
  let inputEls: (HTMLInputElement | null)[] = [];

  const QUICK_COUNTS = [6, 8, 10];

  function commit() {
    value = lines.join('\n');
    onCommit?.();
  }

  async function addLine() {
    lines.push('');
    commit();
    await tick();
    inputEls[lines.length - 1]?.focus();
  }

  function removeLine(i: number) {
    lines.splice(i, 1);
    commit();
  }

  function moveLine(i: number, delta: number) {
    const target = i + delta;
    if (target < 0 || target >= lines.length) return;
    [lines[i], lines[target]] = [lines[target], lines[i]];
    commit();
  }

  function padTo(n: number) {
    if (lines.length >= n) return;
    for (let i = lines.length; i < n; i++) lines.push('');
    commit();
  }
</script>

<div class="notes-list">
  <div class="header-row">
    <span class="label">Note</span>
    <div class="quick-row">
      {#each QUICK_COUNTS as n}
        <button type="button" class="quick-btn" onclick={() => padTo(n)}>{n}</button>
      {/each}
    </div>
  </div>

  {#each lines as line, i (i)}
    <div class="line-row">
      <span class="badge">{i + 1}</span>
      <input
        type="text"
        bind:value={lines[i]}
        bind:this={inputEls[i]}
        onblur={commit}
        placeholder="Riga nota"
      />
      <button type="button" class="arrow-btn" onclick={() => moveLine(i, -1)} disabled={i === 0} aria-label="Sposta su">▲</button>
      <button type="button" class="arrow-btn" onclick={() => moveLine(i, 1)} disabled={i === lines.length - 1} aria-label="Sposta giù">▼</button>
      <button type="button" class="remove-btn" onclick={() => removeLine(i)} aria-label="Elimina riga">✕</button>
    </div>
  {/each}

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

  .quick-row {
    display: flex;
    gap: 6px;
  }

  .quick-btn {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 700;
    padding: 5px 10px;
  }

  .line-row {
    display: flex;
    align-items: center;
    gap: 6px;
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

  .arrow-btn {
    flex-shrink: 0;
    background: transparent;
    border: none;
    color: var(--text-faint);
    font-size: 10px;
    padding: 4px 5px;
  }

  .arrow-btn:disabled {
    opacity: 0.25;
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
