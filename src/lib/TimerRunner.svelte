<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Circuit } from './circuitTypes';
  import { buildTimeline, TimerEngine, type AnnounceSettings, type EngineSnapshot, type TimerPhase } from './timerEngine';
  import { TimerAudio, type VoiceSelection } from './timerAudio';
  import { WakeLockManager } from './wakeLock';

  let {
    config,
    announce,
    voiceSelection,
    exerciseNames,
    onExit,
  }: {
    config: Pick<Circuit, 'timerFormat' | 'tabata' | 'emom' | 'amrap' | 'exerciseIds'>;
    announce: AnnounceSettings;
    voiceSelection: VoiceSelection;
    exerciseNames: string[];
    onExit: () => void;
  } = $props();

  const phases: TimerPhase[] = buildTimeline(config);
  const audio = new TimerAudio();
  const wakeLock = new WakeLockManager();
  let engine: TimerEngine;

  let snapshot = $state<EngineSnapshot>({
    phaseIndex: 0,
    phase: phases[0],
    remaining: phases[0].durationSeconds,
    running: false,
    finished: false,
  });
  let stopped = $state(false);

  const PHASE_LABELS: Record<TimerPhase['kind'], string> = {
    prepare: 'Preparati',
    work: 'Lavora',
    rest: 'Riposa',
    rest_cycle: 'Riposo tra i cicli',
    interval: 'Vai',
    amrap: 'AMRAP',
    done: 'Completato',
  };

  function formatClock(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  const currentRoundIndex = $derived.by(() => {
    const phase = snapshot.phase;
    if (phase.kind === 'work') return (phase.round ?? 1) - 1;
    if (phase.kind === 'rest' || phase.kind === 'rest_cycle' || phase.kind === 'prepare') {
      const next = phases[snapshot.phaseIndex + 1];
      if (next && next.kind === 'work') return (next.round ?? 1) - 1;
      if (phase.kind === 'prepare' && phases[1]?.kind === 'work') return 0;
    }
    return -1;
  });

  const totalCycles = config.timerFormat === 'tabata' ? config.tabata.cycles : 0;
  const totalRounds = config.timerFormat === 'tabata' ? config.exerciseIds.length : config.timerFormat === 'emom' ? config.emom.rounds : 0;

  onMount(() => {
    audio.setComputerVoice(voiceSelection.computerVoiceURI);
    audio.setMode(voiceSelection.mode === 'profile' ? { kind: 'profile', profileId: voiceSelection.profileId } : { kind: 'computer' });
    engine = new TimerEngine(phases, announce, audio, (snap) => {
      snapshot = snap;
    });
    audio.unlock();
    wakeLock.acquire();
    engine.start();
  });

  onDestroy(() => {
    engine?.stop();
    wakeLock.destroy();
  });

  function handleStop() {
    if (!confirm('Interrompere il timer?')) return;
    engine.stop();
    stopped = true;
    wakeLock.release();
  }

  function handlePauseToggle() {
    if (snapshot.running) {
      engine.pause();
    } else {
      engine.resume();
    }
  }

  function handleExit() {
    wakeLock.release();
    onExit();
  }
</script>

<div class="runner">
  {#if snapshot.finished || stopped}
    <div class="end-screen">
      <div class="end-icon">{snapshot.finished ? '✓' : '■'}</div>
      <h2>{snapshot.finished ? 'Allenamento completato' : 'Timer interrotto'}</h2>
      <button class="btn-close" onclick={handleExit}>Chiudi</button>
    </div>
  {:else}
    <div class="phase-label" class:is-rest={snapshot.phase.kind === 'rest' || snapshot.phase.kind === 'rest_cycle'} class:is-prepare={snapshot.phase.kind === 'prepare'}>
      {PHASE_LABELS[snapshot.phase.kind]}
    </div>

    <div class="clock">{formatClock(snapshot.remaining)}</div>

    {#if config.timerFormat === 'tabata' && snapshot.phase.kind !== 'prepare'}
      <div class="meta">Round {(snapshot.phase.round ?? currentRoundIndex + 1)}/{totalRounds} · Ciclo {(snapshot.phase.cycle ?? 1)}/{totalCycles}</div>
    {:else if config.timerFormat === 'emom' && snapshot.phase.kind === 'interval'}
      <div class="meta">Round {snapshot.phase.round}/{totalRounds}</div>
    {/if}

    {#if exerciseNames.length > 0}
      <div class="exercise-list">
        {#each exerciseNames as name, i}
          <div class="exercise-row" class:active={i === currentRoundIndex}>
            <span class="idx">{i + 1}</span>
            <span class="ex-name">{name}</span>
          </div>
        {/each}
      </div>
    {/if}

    <div class="controls-row">
      <button class="btn-pause" onclick={handlePauseToggle}>
        {snapshot.running ? '⏸ Pausa' : '▶ Riprendi'}
      </button>
      <button class="btn-stop" onclick={handleStop}>■ Stop</button>
    </div>
  {/if}
</div>

<style>
  .runner {
    position: fixed;
    inset: 0;
    z-index: 95;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 24px 32px;
  }

  .phase-label {
    font-size: 20px;
    font-weight: 800;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .phase-label.is-rest {
    color: #5fb8c9;
  }

  .phase-label.is-prepare {
    color: var(--text-muted);
  }

  .clock {
    font-size: 96px;
    font-weight: 800;
    line-height: 1;
    margin: 16px 0;
    font-variant-numeric: tabular-nums;
  }

  .meta {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 20px;
  }

  .exercise-list {
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    flex: 1;
  }

  .exercise-row {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
    padding: 10px 14px;
    color: var(--text-muted);
  }

  .exercise-row.active {
    background: var(--accent);
    color: #fff;
  }

  .idx {
    font-size: 13px;
    font-weight: 700;
    opacity: 0.7;
  }

  .ex-name {
    font-size: 15px;
    font-weight: 700;
  }

  .controls-row {
    margin-top: 24px;
    width: 100%;
    max-width: 360px;
    display: flex;
    gap: 12px;
  }

  .btn-pause {
    flex: 1;
    background: var(--accent);
    border: none;
    border-radius: var(--radius-md);
    padding: 15px;
    color: #fff;
    font-size: 16px;
    font-weight: 700;
  }

  .btn-stop {
    flex: 1;
    background: transparent;
    border: 1px solid #f26d6d;
    border-radius: var(--radius-md);
    padding: 15px;
    color: #f26d6d;
    font-size: 16px;
    font-weight: 700;
  }

  .end-screen {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    text-align: center;
  }

  .end-icon {
    font-size: 48px;
    color: var(--accent);
  }

  .end-screen h2 {
    font-size: 20px;
    font-weight: 800;
  }

  .btn-close {
    margin-top: 12px;
    background: var(--accent);
    border: none;
    border-radius: var(--radius-md);
    padding: 14px 32px;
    color: #fff;
    font-size: 16px;
    font-weight: 700;
  }
</style>
