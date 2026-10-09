<script lang="ts">
  import Oggi from './lib/Oggi.svelte';
  import AllenamentiStandard from './lib/AllenamentiStandard.svelte';
  import BottomNav, { type NavTab } from './lib/BottomNav.svelte';

  let tab = $state<NavTab>('oggi');
</script>

<main>
  {#if tab === 'oggi'}
    {#key tab}
      <Oggi />
    {/key}
  {:else if tab === 'standard'}
    <AllenamentiStandard />
  {/if}
</main>

<BottomNav active={tab} onSelect={(t) => (tab = t)} />

<style>
  main {
    min-height: 100svh;
  }
</style>
