export type PatternCategory =
  | 'spinta_verticale'
  | 'spinta_orizzontale'
  | 'tirata_verticale'
  | 'tirata_orizzontale'
  | 'spinta_gambe'
  | 'tirata_gambe'
  | 'core'
  | 'accessori'
  | 'mobilita'
  | 'multiarticolare';

export const PATTERN_CATEGORIES: PatternCategory[] = [
  'spinta_verticale',
  'spinta_orizzontale',
  'tirata_verticale',
  'tirata_orizzontale',
  'spinta_gambe',
  'tirata_gambe',
  'core',
  'accessori',
  'mobilita',
  'multiarticolare',
];

export const PATTERN_CATEGORY_LABELS: Record<PatternCategory, string> = {
  spinta_verticale: 'Spinta verticale',
  spinta_orizzontale: 'Spinta orizzontale',
  tirata_verticale: 'Trazioni',
  tirata_orizzontale: 'Tirata orizzontale',
  spinta_gambe: 'Spinta gambe',
  tirata_gambe: 'Tirata gambe',
  core: 'Core',
  accessori: 'Accessori',
  mobilita: 'Mobilità',
  multiarticolare: 'Multiarticolare Total body',
};

export const PATTERN_CATEGORY_COLORS: Record<PatternCategory, { bg: string; text: string }> = {
  spinta_verticale: { bg: '#F26D6D', text: '#fff' },
  spinta_orizzontale: { bg: '#3B6FA0', text: '#fff' },
  tirata_verticale: { bg: '#5FB8C9', text: '#111' },
  tirata_orizzontale: { bg: '#9B7EDE', text: '#fff' },
  spinta_gambe: { bg: '#4CAF7D', text: '#111' },
  tirata_gambe: { bg: '#C4FF4D', text: '#111' },
  core: { bg: '#F2A93B', text: '#111' },
  accessori: { bg: '#7A8CFF', text: '#fff' },
  mobilita: { bg: '#4DD0C4', text: '#111' },
  multiarticolare: { bg: '#E091C9', text: '#111' },
};

export type CoreSubcategory = 'antiflessione_frontale' | 'antiflessione_laterale' | 'antirotazione';

export const CORE_SUBCATEGORIES: CoreSubcategory[] = [
  'antiflessione_frontale',
  'antiflessione_laterale',
  'antirotazione',
];

export const CORE_SUBCATEGORY_LABELS: Record<CoreSubcategory, string> = {
  antiflessione_frontale: 'Antiflessione frontale',
  antiflessione_laterale: 'Antiflessione laterale',
  antirotazione: 'Antirotazione',
};

export type Quality = 'forza' | 'potenza';

export const QUALITIES: Quality[] = ['forza', 'potenza'];

export const QUALITY_LABELS: Record<Quality, string> = {
  forza: 'Forza',
  potenza: 'Potenza',
};

export interface Exercise {
  id?: number;
  name: string;
  category: PatternCategory;
  coreSubcategory?: CoreSubcategory;
  quality?: Quality;
  order?: number;
}

export type VoiceRecordingTarget =
  | { type: 'exercise'; exerciseId: number }
  | { type: 'phrase'; phraseKey: string; profileId: number };

export interface VoiceRecording {
  id?: number;
  targetType: 'exercise' | 'phrase';
  exerciseId?: number;
  phraseKey?: string;
  profileId?: number;
  audioBlob: Blob;
  createdAt: number;
}

export interface VoiceProfile {
  id?: number;
  name: string;
  createdAt: number;
}
