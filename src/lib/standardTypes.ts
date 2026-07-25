import type { GroupId } from './groups';

export interface StandardVariant {
  id?: number;
  groupId: GroupId;
  name: string;
  notes: string;
}
