import type { GroupId } from './groups';
import type { Tipologia } from './circuitTypes';

export type AllenamentoSection = 'note' | 'esercizi' | 'circuiti';

export const DEFAULT_SECTION_ORDER: AllenamentoSection[] = ['note', 'esercizi', 'circuiti'];

export interface Allenamento {
  id?: number;
  groupId: GroupId;
  date: string; // 'YYYY-MM-DD', default label for this reusable template
  esercizi: string;
  notes: string;
  tipologie: Tipologia[];
  sectionOrder: AllenamentoSection[];
}
