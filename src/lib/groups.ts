export type GroupId = 'corso_base' | 'intermedi_corda' | 'pro_mer' | 'pro_gio' | 'corso_intermedio';

export interface Group {
  id: GroupId;
  name: string;
  color: string;
}

export const GROUPS: Record<GroupId, Group> = {
  corso_base: { id: 'corso_base', name: 'Corso base', color: '#4CAF7D' },
  intermedi_corda: { id: 'intermedi_corda', name: 'Intermedi corda', color: '#3B6FA0' },
  pro_mer: { id: 'pro_mer', name: 'Pro', color: '#9B7EDE' },
  pro_gio: { id: 'pro_gio', name: 'Pro', color: '#7E5EC4' },
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
  { weekday: 3, order: 1, groupId: 'pro_mer' },
  { weekday: 3, order: 2, groupId: 'corso_intermedio' },
  { weekday: 4, order: 1, groupId: 'intermedi_corda' },
  { weekday: 4, order: 2, groupId: 'pro_gio' },
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

export function nextScheduledDate(groupId: GroupId, fromDate: Date = new Date()): string {
  const weekdays = WEEKLY_SCHEDULE.filter((s) => s.groupId === groupId).map((s) => s.weekday);
  for (let i = 1; i <= 7; i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    if (weekdays.includes(d.getDay())) return toIsoDate(d);
  }
  throw new Error('gruppo senza giorni schedulati');
}

export const WEEKDAY_NAMES: Record<number, string> = {
  0: 'domenica',
  1: 'lunedì',
  2: 'martedì',
  3: 'mercoledì',
  4: 'giovedì',
  5: 'venerdì',
  6: 'sabato',
};

const MONTH_NAMES: Record<number, string> = {
  0: 'gennaio',
  1: 'febbraio',
  2: 'marzo',
  3: 'aprile',
  4: 'maggio',
  5: 'giugno',
  6: 'luglio',
  7: 'agosto',
  8: 'settembre',
  9: 'ottobre',
  10: 'novembre',
  11: 'dicembre',
};

export function formatShortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAY_NAMES[date.getDay()]} ${d} ${MONTH_NAMES[m - 1]}`;
}

export function candidateDatesForGroup(groupId: GroupId, weeksBack = 8, weeksForward = 26): string[] {
  const weekdays = WEEKLY_SCHEDULE.filter((s) => s.groupId === groupId).map((s) => s.weekday);
  const dates: string[] = [];
  const today = new Date();
  for (let offset = -weeksBack * 7; offset <= weeksForward * 7; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    if (weekdays.includes(d.getDay())) dates.push(toIsoDate(d));
  }
  return dates;
}
