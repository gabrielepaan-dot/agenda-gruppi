import type { GroupId } from './groups';
import type { Tipologia } from './circuitTypes';

export interface Session {
  id?: number;
  date: string; // 'YYYY-MM-DD'
  groupId: GroupId;
  notes: string;
  tipologie: Tipologia[];
}
