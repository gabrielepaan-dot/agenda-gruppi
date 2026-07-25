export type GroupId = 'corso_base' | 'intermedi_corda' | 'pro' | 'corso_intermedio';

export interface Group {
  id: GroupId;
  name: string;
  color: string;
}

export const GROUPS: Record<GroupId, Group> = {
  corso_base: { id: 'corso_base', name: 'Corso base', color: '#4CAF7D' },
  intermedi_corda: { id: 'intermedi_corda', name: 'Intermedi corda', color: '#3B6FA0' },
  pro: { id: 'pro', name: 'Pro', color: '#9B7EDE' },
  corso_intermedio: { id: 'corso_intermedio', name: 'Corso intermedio', color: '#F2A93B' },
};

export interface ScheduleSlot {
  weekday: number; // 1 = lunedì ... 4 = giovedì (JS getDay() convention: 0=domenica)
  order: number;
  groupId: GroupId;
}

export const WEEKLY_SCHEDULE: ScheduleSlot[] = [
  { weekday: 1, order: 1, groupId: 'corso_base' },
  { weekday: 2, order: 1, groupId: 'intermedi_corda' },
  { weekday: 3, order: 1, groupId: 'pro' },
  { weekday: 3, order: 2, groupId: 'corso_intermedio' },
  { weekday: 4, order: 1, groupId: 'intermedi_corda' },
  { weekday: 4, order: 2, groupId: 'pro' },
];

export function slotsForWeekday(weekday: number): ScheduleSlot[] {
  return WEEKLY_SCHEDULE.filter((s) => s.weekday === weekday).sort((a, b) => a.order - b.order);
}

export function slotsForDate(date: Date): ScheduleSlot[] {
  return slotsForWeekday(date.getDay());
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function nextWeekIsoDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + 7);
  return toIsoDate(date);
}
