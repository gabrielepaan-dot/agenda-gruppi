<script lang="ts">
  import { db } from './db';
  import type { VoiceRecording } from './types';

  type Target = { type: 'exercise'; exerciseId: number } | { type: 'phrase'; phraseKey: string };

  let { target }: { target: Target } = $props();

  let existing = $state<VoiceRecording | null>(null);
  let status = $state<'idle' | 'recording' | 'error'>('idle');
  let errorMessage = $state('');

  let mediaRecorder: MediaRecorder | null = null;
  let chunks: BlobPart[] = [];
  let stream: MediaStream | null = null;

  async function load() {
    if (target.type === 'exercise') {
      existing = (await db.voiceRecordings.where({ targetType: 'exercise', exerciseId: target.exerciseId }).first()) ?? null;
    } else {
      existing = (await db.voiceRecordings.where({ targetType: 'phrase', phraseKey: target.phraseKey }).first()) ?? null;
    }
  }

  load();

  async function startRecording() {
    errorMessage = '';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
        stream?.getTracks().forEach((t) => t.stop());
        stream = null;
        await saveRecording(blob);
        status = 'idle';
      };
      mediaRecorder.start();
      status = 'recording';
    } catch {
      status = 'error';
      errorMessage = 'Impossibile accedere al microfono.';
    }
  }

  function stopRecording() {
    mediaRecorder?.stop();
  }

  async function saveRecording(blob: Blob) {
    if (existing?.id) {
      await db.voiceRecordings.delete(existing.id);
    }
    const record: VoiceRecording =
      target.type === 'exercise'
        ? { targetType: 'exercise', exerciseId: target.exerciseId, audioBlob: blob, createdAt: Date.now() }
        : { targetType: 'phrase', phraseKey: target.phraseKey, audioBlob: blob, createdAt: Date.now() };
    await db.voiceRecordings.add(record);
    await load();
  }

  function play() {
    if (!existing) return;
    const url = URL.createObjectURL(existing.audioBlob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play();
  }

  async function remove() {
    if (!existing?.id) return;
    await db.voiceRecordings.delete(existing.id);
    existing = null;
  }
</script>

<div class="voice-recorder">
  {#if status === 'recording'}
    <button class="btn rec-active" onclick={stopRecording}>● Ferma registrazione</button>
  {:else if existing}
    <div class="row">
      <span class="label">Registrazione presente</span>
      <button class="icon-btn" onclick={play} aria-label="Ascolta">▶</button>
      <button class="icon-btn" onclick={startRecording} aria-label="Registra di nuovo">●</button>
      <button class="icon-btn danger" onclick={remove} aria-label="Elimina">✕</button>
    </div>
  {:else}
    <button class="btn" onclick={startRecording}>● Registra pronuncia</button>
    <span class="hint">Senza registrazione verrà usata la voce di sistema</span>
  {/if}
  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}
</div>

<style>
  .voice-recorder {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .btn {
    background: var(--bg);
    border: 1px dashed var(--border);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    color: var(--text);
    font-size: 14px;
    font-weight: 600;
    text-align: left;
  }

  .rec-active {
    border: 1px solid #f26d6d;
    color: #f26d6d;
    font-weight: 700;
  }

  .hint {
    font-size: 12px;
    color: var(--text-faint);
    font-weight: 400;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
  }

  .label {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
    color: var(--text);
  }

  .icon-btn {
    background: var(--bg-elevated);
    border: none;
    border-radius: 8px;
    width: 32px;
    height: 32px;
    color: var(--text-muted);
    font-size: 13px;
  }

  .icon-btn.danger {
    color: #f26d6d;
  }

  .error {
    color: #f26d6d;
    font-size: 12px;
    font-weight: 600;
  }
</style>
