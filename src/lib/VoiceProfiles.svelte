<script lang="ts">
  import { db } from './db';
  import type { VoiceProfile } from './types';
  import { PHRASE_TEXT, type PhraseKey } from './timerAudio';
  import VoiceRecorder from './VoiceRecorder.svelte';

  let { onClose }: { onClose: () => void } = $props();

  const PHRASES: PhraseKey[] = ['prepara', 'lavora', 'riposa', 'completato'];

  let profiles = $state<VoiceProfile[]>([]);
  let newName = $state('');
  let expandedId = $state<number | null>(null);

  async function load() {
    profiles = await db.voiceProfiles.orderBy('name').toArray();
  }
  load();

  async function addProfile() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const id = await db.voiceProfiles.add({ name: trimmed, createdAt: Date.now() });
    newName = '';
    await load();
    expandedId = id as number;
  }

  async function deleteProfile(p: VoiceProfile) {
    if (!p.id) return;
    if (!confirm(`Eliminare il profilo "${p.name}" e le sue registrazioni?`)) return;
    await db.voiceRecordings.where({ targetType: 'phrase', profileId: p.id }).delete();
    await db.voiceProfiles.delete(p.id);
    if (expandedId === p.id) expandedId = null;
    await load();
  }

  function toggle(p: VoiceProfile) {
    expandedId = expandedId === p.id ? null : (p.id ?? null);
  }
</script>

<div class="screen">
  <div class="topbar">
    <button class="icon-btn" onclick={onClose} aria-label="Chiudi">✕</button>
    <h1>Profili voce</h1>
    <span class="spacer"></span>
  </div>

  <div class="content">
    <p class="subtitle">
      Crea un profilo per persona e registra le sue clip per le fasi del timer. Senza registrazione viene usata la voce
      computer.
    </p>

    <div class="add-row">
      <input type="text" bind:value={newName} placeholder="Nome persona (es. Luana)" />
      <button class="btn-add" onclick={addProfile}>+ Aggiungi</button>
    </div>

    {#if profiles.length === 0}
      <p class="empty">Nessun profilo voce.</p>
    {/if}

    {#each profiles as p (p.id)}
      <div class="profile-card">
        <button class="profile-header" onclick={() => toggle(p)}>
          <span class="profile-name">{p.name}</span>
          <span class="chevron">{expandedId === p.id ? '▾' : '▸'}</span>
        </button>
        {#if expandedId === p.id && p.id}
          <div class="profile-body">
            {#each PHRASES as key (key)}
              <div class="phrase-row">
                <div class="phrase-name">{PHRASE_TEXT[key]}</div>
                <VoiceRecorder target={{ type: 'phrase', phraseKey: key, profileId: p.id }} />
              </div>
            {/each}
            <button class="btn-delete" onclick={() => deleteProfile(p)}>Elimina profilo</button>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .screen {
    min-height: 100svh;
    background: var(--bg);
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .topbar h1 {
    font-size: 16px;
    font-weight: 800;
    text-align: center;
    flex: 1;
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 18px;
    padding: 8px 12px;
  }

  .spacer {
    width: 34px;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px 40px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .subtitle {
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .add-row {
    display: flex;
    gap: 8px;
  }

  .add-row input {
    flex: 1;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    font-size: 15px;
    color: var(--text);
  }

  .btn-add {
    background: var(--accent);
    border: none;
    border-radius: var(--radius-sm);
    padding: 0 16px;
    color: #fff;
    font-weight: 700;
    font-size: 14px;
  }

  .empty {
    padding: 20px 0;
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
  }

  .profile-card {
    background: var(--bg-elevated);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .profile-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: transparent;
    border: none;
    padding: 14px 16px;
    text-align: left;
  }

  .profile-name {
    font-size: 16px;
    font-weight: 700;
    color: var(--text);
  }

  .chevron {
    color: var(--text-faint);
    font-size: 13px;
  }

  .profile-body {
    padding: 0 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    border-top: 1px solid var(--border);
    padding-top: 12px;
  }

  .phrase-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .phrase-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .btn-delete {
    background: transparent;
    border: 1px solid #f26d6d;
    border-radius: var(--radius-sm);
    color: #f26d6d;
    padding: 10px;
    font-weight: 700;
    font-size: 13px;
    margin-top: 4px;
  }
</style>
