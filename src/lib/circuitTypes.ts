export type Tipologia = 'forza' | 'potenza' | 'resistenza';

export const TIPOLOGIE: Tipologia[] = ['forza', 'potenza', 'resistenza'];

export const TIPOLOGIA_LABELS: Record<Tipologia, string> = {
  forza: 'Forza',
  potenza: 'Potenza',
  resistenza: 'Resistenza',
};

export const TIPOLOGIA_COLORS: Record<Tipologia, { bg: string; text: string }> = {
  forza: { bg: '#3B6FA0', text: '#fff' },
  potenza: { bg: '#E8622C', text: '#fff' },
  resistenza: { bg: '#4CAF7D', text: '#111' },
};

export type TimerFormat = 'tabata' | 'emom' | 'amrap';

export const TIMER_FORMATS: TimerFormat[] = ['tabata', 'emom', 'amrap'];

export const TIMER_FORMAT_LABELS: Record<TimerFormat, string> = {
  tabata: 'Tabata',
  emom: 'Emom',
  amrap: 'Amrap',
};

export const TIMER_FORMAT_COLORS: Record<TimerFormat, string> = {
  tabata: '#C4FF4D',
  emom: '#5FB8C9',
  amrap: '#9B7EDE',
};

export type RestType = 'between_exercises' | 'only_between_cycles';

export const REST_TYPE_LABELS: Record<RestType, string> = {
  between_exercises: 'Riposo dopo ogni esercizio',
  only_between_cycles: 'Nessun riposo tra esercizi, solo tra i cicli',
};

export interface TabataParams {
  workSeconds: number;
  restSeconds: number;
  restType: RestType;
  cycles: number;
  restBetweenCyclesSeconds: number;
}

export interface EmomParams {
  intervalSeconds: number;
  rounds: number;
}

export interface AmrapParams {
  timeLimitSeconds: number;
}

export const DEFAULT_TABATA_PARAMS: TabataParams = {
  workSeconds: 20,
  restSeconds: 10,
  restType: 'between_exercises',
  cycles: 3,
  restBetweenCyclesSeconds: 60,
};

export const DEFAULT_EMOM_PARAMS: EmomParams = {
  intervalSeconds: 60,
  rounds: 8,
};

export const DEFAULT_AMRAP_PARAMS: AmrapParams = {
  timeLimitSeconds: 600,
};

export type CircuitOwnerType = 'session' | 'variant';

export interface Circuit {
  id?: number;
  ownerType: CircuitOwnerType;
  ownerId: number;
  order: number;
  name: string;
  tipologia: Tipologia;
  exerciseIds: number[];
  timerFormat: TimerFormat;
  tabata: TabataParams;
  emom: EmomParams;
  amrap: AmrapParams;
}

export interface TimerPreset {
  id?: number;
  name: string;
  timerFormat: TimerFormat;
  tabata: TabataParams;
  emom: EmomParams;
  amrap: AmrapParams;
}

export function formatSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s}″`;
  if (s === 0) return `${m}'`;
  return `${m}'${String(s).padStart(2, '0')}″`;
}

export function circuitSummary(circuit: Circuit): string {
  const n = circuit.exerciseIds.length;
  const esercizi = `${n} esercizi${n === 1 ? 'o' : ''}`;
  if (circuit.timerFormat === 'tabata') {
    const { workSeconds, restSeconds, cycles } = circuit.tabata;
    return `${esercizi} · ${formatSeconds(workSeconds)}/${formatSeconds(restSeconds)} · x${cycles} cicli`;
  }
  if (circuit.timerFormat === 'emom') {
    const { intervalSeconds, rounds } = circuit.emom;
    return `ogni ${formatSeconds(intervalSeconds)} · x${rounds} round`;
  }
  const { timeLimitSeconds } = circuit.amrap;
  return `${esercizi} · ${formatSeconds(timeLimitSeconds)} AMRAP`;
}
