import type { Circuit } from './circuitTypes';
import { TimerAudio } from './timerAudio';

export type PhaseKind = 'prepare' | 'work' | 'rest' | 'rest_cycle' | 'interval' | 'amrap' | 'done';

export interface TimerPhase {
  kind: PhaseKind;
  durationSeconds: number;
  exerciseId?: number;
  round?: number;
  cycle?: number;
}

export interface AnnounceSettings {
  frasi: boolean;
  esercizio: boolean;
}

const DEFAULT_PREPARE_SECONDS = 3;
const CUE_KINDS = new Set<PhaseKind>(['rest', 'rest_cycle', 'interval', 'amrap']);

export function buildTimeline(circuit: Pick<Circuit, 'timerFormat' | 'tabata' | 'emom' | 'amrap' | 'exerciseIds'>): TimerPhase[] {
  if (circuit.timerFormat === 'tabata') return buildTabataTimeline(circuit.exerciseIds, circuit.tabata);
  if (circuit.timerFormat === 'emom') return buildEmomTimeline(circuit.emom);
  return buildAmrapTimeline(circuit.amrap);
}

function buildTabataTimeline(exerciseIds: number[], params: Circuit['tabata']): TimerPhase[] {
  const phases: TimerPhase[] = [{ kind: 'prepare', durationSeconds: params.prepareSeconds ?? DEFAULT_PREPARE_SECONDS }];
  const n = exerciseIds.length;
  for (let cycle = 0; cycle < params.cycles; cycle++) {
    for (let round = 0; round < n; round++) {
      phases.push({
        kind: 'work',
        durationSeconds: params.workSeconds,
        exerciseId: exerciseIds[round],
        round: round + 1,
        cycle: cycle + 1,
      });
      const isLastExerciseOfCycle = round === n - 1;
      const isLastCycle = cycle === params.cycles - 1;
      if (!isLastExerciseOfCycle) {
        phases.push({ kind: 'rest', durationSeconds: params.restSeconds, round: round + 1, cycle: cycle + 1 });
      } else if (!isLastCycle) {
        phases.push({ kind: 'rest_cycle', durationSeconds: params.restBetweenCyclesSeconds, round: round + 1, cycle: cycle + 1 });
      }
    }
  }
  phases.push({ kind: 'done', durationSeconds: 0 });
  return phases;
}

function buildEmomTimeline(params: Circuit['emom']): TimerPhase[] {
  const phases: TimerPhase[] = [{ kind: 'prepare', durationSeconds: params.prepareSeconds ?? DEFAULT_PREPARE_SECONDS }];
  for (let round = 0; round < params.rounds; round++) {
    phases.push({ kind: 'interval', durationSeconds: params.intervalSeconds, round: round + 1 });
  }
  phases.push({ kind: 'done', durationSeconds: 0 });
  return phases;
}

function buildAmrapTimeline(params: Circuit['amrap']): TimerPhase[] {
  return [
    { kind: 'prepare', durationSeconds: params.prepareSeconds ?? DEFAULT_PREPARE_SECONDS },
    { kind: 'amrap', durationSeconds: params.timeLimitSeconds },
    { kind: 'done', durationSeconds: 0 },
  ];
}

export interface EngineSnapshot {
  phaseIndex: number;
  phase: TimerPhase;
  remaining: number;
  running: boolean;
  finished: boolean;
}

export class TimerEngine {
  private phases: TimerPhase[];
  private announce: AnnounceSettings;
  private audio: TimerAudio;
  private onUpdate: (snap: EngineSnapshot) => void;

  private phaseIndex = 0;
  private phaseEndTime = 0;
  private running = false;
  private finished = false;
  private cued = new Set<number | string>();
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private completionAnnounced = false;
  private pausedRemaining: number | null = null;

  constructor(phases: TimerPhase[], announce: AnnounceSettings, audio: TimerAudio, onUpdate: (snap: EngineSnapshot) => void) {
    this.phases = phases;
    this.announce = announce;
    this.audio = audio;
    this.onUpdate = onUpdate;
  }

  get voiceActive() {
    return this.announce.frasi || this.announce.esercizio;
  }

  start() {
    this.running = true;
    this.finished = false;
    this.beginPhase(0);
    this.intervalHandle = setInterval(() => this.tick(), 200);
  }

  stop() {
    this.running = false;
    if (this.intervalHandle) clearInterval(this.intervalHandle);
    this.intervalHandle = null;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    this.emit(this.currentRemaining());
  }

  pause() {
    if (!this.running || this.finished) return;
    this.pausedRemaining = this.currentRemaining();
    this.running = false;
    if (this.intervalHandle) clearInterval(this.intervalHandle);
    this.intervalHandle = null;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    this.emit(this.pausedRemaining);
  }

  resume() {
    if (this.running || this.finished || this.pausedRemaining === null) return;
    this.phaseEndTime = Date.now() + this.pausedRemaining * 1000;
    this.pausedRemaining = null;
    this.running = true;
    this.intervalHandle = setInterval(() => this.tick(), 200);
    this.emit(this.currentRemaining());
  }

  private currentRemaining() {
    return Math.max(0, Math.ceil((this.phaseEndTime - Date.now()) / 1000));
  }

  private beginPhase(index: number) {
    this.phaseIndex = index;
    const phase = this.phases[index];
    this.phaseEndTime = Date.now() + phase.durationSeconds * 1000;
    this.cued.clear();
    if (phase.kind === 'prepare') {
      if (this.announce.frasi) this.audio.speakPhrase('prepara');
    } else if ((phase.kind === 'rest' || phase.kind === 'rest_cycle') && this.announce.frasi) {
      this.audio.speakPhrase('riposa');
    } else if ((phase.kind === 'work' || phase.kind === 'interval') && this.phases[index - 1]?.kind === 'prepare') {
      // The countdown that precedes work/interval never gets a chance to preview what's
      // coming next (unlike rest/rest_cycle/interval/amrap, which cue "lavora" a few seconds
      // before ending), so without this the timer goes silent right as prepare hands off to work.
      this.speakUpcoming(phase);
    }
    this.emit(phase.durationSeconds);
  }

  private tick() {
    if (!this.running) return;
    const phase = this.phases[this.phaseIndex];
    const remaining = this.currentRemaining();
    this.maybeCue(phase, remaining);
    this.emit(remaining);
    if (this.phaseEndTime - Date.now() <= 0) {
      this.advance();
    }
  }

  private maybeCue(phase: TimerPhase, remaining: number) {
    if (phase.kind === 'prepare') {
      const cueWindow = Math.min(3, phase.durationSeconds);
      if (remaining >= 1 && remaining <= cueWindow && !this.cued.has(remaining)) {
        this.cued.add(remaining);
        this.audio.playCountdownBeep(remaining);
      }
      return;
    }
    if (!CUE_KINDS.has(phase.kind)) return;
    const cueWindow = Math.min(3, phase.durationSeconds);
    if (remaining < 1 || remaining > cueWindow) return;
    const next = this.phases[this.phaseIndex + 1];
    const isCompletionWindow = !next || next.kind === 'done';

    // The final 3-2-1 countdown is always beeped, never spoken — independent of voice settings.
    if (!this.cued.has(remaining)) {
      this.cued.add(remaining);
      this.audio.playCountdownBeep(remaining);
      if (isCompletionWindow && !this.voiceActive) this.completionAnnounced = true;
    }

    if (this.voiceActive && !this.cued.has('voice')) {
      this.cued.add('voice');
      if (isCompletionWindow) this.announceCompletion();
      else this.speakUpcoming(next);
    }
  }

  private announceCompletion() {
    if (this.completionAnnounced) return;
    this.completionAnnounced = true;
    if (this.announce.frasi) this.audio.speakPhrase('completato');
    else this.audio.beep();
  }

  private speakUpcoming(next: TimerPhase) {
    if (next.kind === 'work') {
      let said = false;
      if (this.announce.frasi) {
        this.audio.speakPhrase('lavora');
        said = true;
      }
      if (this.announce.esercizio && next.exerciseId) {
        this.audio.speakExercise(next.exerciseId);
        said = true;
      }
      if (!said) this.audio.beep();
      return;
    }
    if (next.kind === 'interval') {
      if (this.announce.frasi) this.audio.speakPhrase('lavora');
      else this.audio.beep();
    }
  }

  private advance() {
    const next = this.phaseIndex + 1;
    if (next >= this.phases.length || this.phases[next].kind === 'done') {
      this.announceCompletion();
      this.running = false;
      this.finished = true;
      if (this.intervalHandle) clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      this.emit(0);
      return;
    }
    this.beginPhase(next);
  }

  private emit(remaining: number) {
    this.onUpdate({
      phaseIndex: this.phaseIndex,
      phase: this.phases[this.phaseIndex],
      remaining,
      running: this.running,
      finished: this.finished,
    });
  }
}
