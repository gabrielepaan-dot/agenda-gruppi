<script lang="ts">
  import Oggi from './lib/Oggi.svelte';
  import Agenda from './lib/Agenda.svelte';
  import Timer from './lib/Timer.svelte';
  import AllenamentiStandard from './lib/AllenamentiStandard.svelte';
  import Eserciziario from './lib/Eserciziario.svelte';
  import BottomNav, { type NavTab } from './lib/BottomNav.svelte';

  let tab = $state<NavTab>('oggi');
</script>

<main>
  {#if tab === 'oggi'}
    {#key tab}
      <Oggi />
    {/key}
  {:else if tab === 'agenda'}
    {#key tab}
      <Agenda />
    {/key}
  {:else if tab === 'timer'}
    {#key tab}
      <Timer embedded />
    {/key}
  {:else if tab === 'standard'}
    <AllenamentiStandard />
  {:else}
    <Eserciziario />
  {/if}
</main>

<BottomNav active={tab} onSelect={(t) => (tab = t)} />

<style>
  main {
    min-height: 100svh;
  }
</style>
