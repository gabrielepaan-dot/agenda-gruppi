import type { GroupId } from './groups';

export interface Session {
  id?: number;
  date: string; // 'YYYY-MM-DD'
  groupId: GroupId;
  notes: string;
}
