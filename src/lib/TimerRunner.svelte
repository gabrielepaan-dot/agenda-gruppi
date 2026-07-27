<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { TIMER_FORMAT_LABELS, type Circuit } from './circuitTypes';
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
    config: Pick<Circuit, 'timerFormat' | 'tabata' | 'emom' | 'amrap' | 'exerciseIds' | 'freeText'>;
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
  const totalRounds =
    config.timerFormat === 'tabata'
      ? config.exerciseIds.length > 0
        ? config.exerciseIds.length
        : Math.max(1, config.tabata.genericRounds ?? 8)
      : config.timerFormat === 'emom'
        ? config.emom.rounds
        : 0;

  const roundsRemaining = $derived.by(() => {
    if (totalRounds === 0) return 0;
    const round = snapshot.phase.round;
    if (round == null) return totalRounds;
    return Math.max(1, totalRounds - round + 1);
  });

  const cyclesRemaining = $derived.by(() => {
    if (totalCycles === 0) return 0;
    const cycle = snapshot.phase.cycle;
    if (cycle == null) return totalCycles;
    return Math.max(1, totalCycles - cycle + 1);
  });

  const nextPhase = $derived.by<TimerPhase | null>(() => {
    const next = phases[snapshot.phaseIndex + 1];
    return next && next.kind !== 'done' ? next : null;
  });

  const totalRemainingSeconds = $derived.by(() => {
    let sum = snapshot.remaining;
    for (let i = snapshot.phaseIndex + 1; i < phases.length; i++) {
      sum += phases[i].durationSeconds;
    }
    return sum;
  });

  const phaseIsGreen = $derived(
    snapshot.phase.kind === 'work' || snapshot.phase.kind === 'interval' || snapshot.phase.kind === 'amrap',
  );
  const phaseIsRed = $derived(
    snapshot.phase.kind === 'rest' || snapshot.phase.kind === 'rest_cycle' || snapshot.phase.kind === 'prepare',
  );

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
    <div class="header-row" class:is-green={phaseIsGreen} class:is-red={phaseIsRed}>
      <span class="header-format">{TIMER_FORMAT_LABELS[config.timerFormat]}</span>
      <span class="header-clock">{formatClock(totalRemainingSeconds)}</span>
    </div>

    <div class="phase-banner" class:is-green={phaseIsGreen} class:is-red={phaseIsRed}>
      <div class="phase-banner-label">{PHASE_LABELS[snapshot.phase.kind]}</div>
      <div class="phase-banner-clock">{formatClock(snapshot.remaining)}</div>
    </div>

    {#if nextPhase}
      <div
        class="next-banner"
        class:is-green={nextPhase.kind === 'work' || nextPhase.kind === 'interval' || nextPhase.kind === 'amrap'}
        class:is-red={nextPhase.kind === 'rest' || nextPhase.kind === 'rest_cycle' || nextPhase.kind === 'prepare'}
      >
        {PHASE_LABELS[nextPhase.kind]}: {formatClock(nextPhase.durationSeconds)}
      </div>
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

    <div class="stats-row">
      <div class="stat-col">
        {#if totalRounds > 0}
          <div class="stat-number stat-round">{roundsRemaining}</div>
          <div class="stat-label">Round rimasti</div>
        {/if}
      </div>

      <div class="stat-col center-col">
        <button class="btn-pause" onclick={handlePauseToggle} aria-label={snapshot.running ? 'Pausa' : 'Riprendi'}>
          {snapshot.running ? '⏸' : '▶'}
        </button>
        <div class="pause-label">{snapshot.running ? 'Pausa' : 'Riprendi'}</div>
      </div>

      <div class="stat-col">
        {#if totalCycles > 0}
          <div class="stat-number stat-cicli">{cyclesRemaining}</div>
          <div class="stat-label">Cicli rimasti</div>
        {/if}
      </div>
    </div>

    <button class="btn-stop" onclick={handleStop}>■ Stop</button>
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
    align-items: stretch;
    overflow-y: auto;
  }

  .header-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 24px 24px 16px;
    flex-shrink: 0;
    color: var(--accent);
  }

  .header-row.is-green {
    color: #8ce05a;
  }

  .header-row.is-red {
    color: #f26d6d;
  }

  .header-format {
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .header-clock {
    font-size: 22px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .phase-banner {
    flex-shrink: 0;
    width: 100%;
    padding: 28px 24px 32px;
    text-align: center;
    background: var(--bg-elevated);
    color: var(--text);
  }

  .phase-banner.is-green {
    background: #8ce05a;
    color: #111;
  }

  .phase-banner.is-red {
    background: #f26d6d;
    color: #fff;
  }

  .phase-banner-label {
    font-size: 26px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 6px;
  }

  .phase-banner-clock {
    font-size: 76px;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .next-banner {
    flex-shrink: 0;
    width: 100%;
    padding: 12px 24px;
    text-align: center;
    font-size: 16px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    background: var(--bg-elevated);
    color: var(--text-muted);
  }

  .next-banner.is-green {
    background: rgba(140, 224, 90, 0.18);
    color: #8ce05a;
  }

  .next-banner.is-red {
    background: rgba(242, 109, 109, 0.18);
    color: #f26d6d;
  }

  .exercise-list {
    width: 100%;
    max-width: 360px;
    margin: 20px auto 0;
    padding: 0 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
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

  .stats-row {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 28px 32px 16px;
    margin-top: auto;
  }

  .stat-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .stat-number {
    font-size: 40px;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .stat-round {
    color: #5fb8c9;
  }

  .stat-cicli {
    color: #f2c94c;
  }

  .stat-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.02em;
    text-align: center;
  }

  .center-col {
    flex: 0 0 auto;
  }

  .btn-pause {
    width: 76px;
    height: 76px;
    border-radius: 50%;
    background: var(--accent);
    border: none;
    color: #fff;
    font-size: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pause-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .btn-stop {
    flex-shrink: 0;
    margin: 8px 24px 24px;
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
