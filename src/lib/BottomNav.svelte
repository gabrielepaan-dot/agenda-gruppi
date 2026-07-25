<script lang="ts">
  export type NavTab = 'oggi' | 'agenda' | 'timer' | 'standard' | 'eserciziario';

  let { active, onSelect }: { active: NavTab; onSelect: (tab: NavTab) => void } = $props();

  const items: { id: NavTab; label: string }[] = [
    { id: 'oggi', label: 'Oggi' },
    { id: 'agenda', label: 'Agenda' },
    { id: 'standard', label: 'Allenamenti' },
    { id: 'eserciziario', label: 'Esercizi' },
    { id: 'timer', label: 'Timer' },
  ];
</script>

<nav class="navbar">
  {#each items as item}
    <button class="nav-item" class:active={active === item.id} onclick={() => onSelect(item.id)}>
      <span class="nav-icon">
        {#if item.id === 'oggi'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
          </svg>
        {:else if item.id === 'agenda'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 9.5h18M8 3v4M16 3v4" />
          </svg>
        {:else if item.id === 'timer'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l3 2M10 2h4M18.5 5.5l1.5-1.5" />
          </svg>
        {:else if item.id === 'standard'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4.5 8v8M2 10.5v3M20 10.5v3M19.5 8v8M8 8v8M16 8v8M8 12h8" />
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        {/if}
      </span>
      {item.label}
    </button>
  {/each}
</nav>

<style>
  .navbar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 80px;
    background: var(--bg-navbar);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding-bottom: 12px;
    z-index: 60;
  }

  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    color: var(--text-faint);
    font-size: 11px;
    font-weight: 600;
    background: transparent;
    border: none;
    flex: 1;
    height: 100%;
    justify-content: center;
  }

  .nav-item.active {
    color: var(--accent);
  }

  .nav-icon {
    width: 22px;
    height: 22px;
    display: block;
  }

  .nav-icon svg {
    width: 100%;
    height: 100%;
  }
</style>
