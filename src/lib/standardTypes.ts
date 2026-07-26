import type { GroupId } from './groups';
import type { Tipologia } from './circuitTypes';

export interface StandardVariant {
  id?: number;
  groupId: GroupId;
  date: string; // 'YYYY-MM-DD', default label for this reusable template
  notes: string;
  tipologie: Tipologia[];
}
