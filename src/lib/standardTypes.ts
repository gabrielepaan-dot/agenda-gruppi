import type { GroupId } from './groups';

export interface StandardCategory {
  id?: number;
  groupId: GroupId;
  name: string;
}

export interface StandardVariant {
  id?: number;
  categoryId: number;
  name: string;
  warmup: string;
  notes: string;
}
