<script lang="ts">
  import VoiceRecorder from './VoiceRecorder.svelte';
  import { PHRASE_TEXT } from './timerAudio';

  const phrases: Array<{ key: 'lavora' | 'riposa' | 'completato'; label: string }> = [
    { key: 'lavora', label: PHRASE_TEXT.lavora },
    { key: 'riposa', label: PHRASE_TEXT.riposa },
    { key: 'completato', label: PHRASE_TEXT.completato },
  ];
</script>

<div class="screen">
  <div class="topbar">
    <h1>Frasi vocali</h1>
    <p class="subtitle">Registra la tua voce per le frasi fisse del timer. Senza registrazione viene usata la voce di sistema.</p>
  </div>

  <div class="content">
    {#each phrases as p (p.key)}
      <div class="card">
        <div class="name">{p.label}</div>
        <VoiceRecorder target={{ type: 'phrase', phraseKey: p.key }} />
      </div>
    {/each}
  </div>
</div>

<style>
  .screen {
    display: flex;
    flex-direction: column;
    min-height: 100svh;
  }

  .topbar {
    padding: 22px 20px 12px;
  }

  .topbar h1 {
    font-size: 22px;
    font-weight: 800;
  }

  .subtitle {
    font-size: 13px;
    color: var(--text-muted);
    margin-top: 6px;
  }

  .content {
    flex: 1;
    padding: 0 20px 100px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .card {
    background: var(--bg-elevated);
    border-radius: var(--radius-lg);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .name {
    font-size: 16px;
    font-weight: 700;
  }
</style>
