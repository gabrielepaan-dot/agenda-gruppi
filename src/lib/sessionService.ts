import { db } from './db';
import type { Session } from './sessionTypes';
import type { GroupId } from './groups';
import { copyCircuits } from './circuitService';

export async function duplicateSessionTo(session: Session, newDate: string): Promise<number> {
  const newSessionId = (await db.sessions.add({
    date: newDate,
    groupId: session.groupId,
    notes: session.notes,
    tipologie: [...(session.tipologie ?? [])],
  })) as number;
  await copyCircuits('session', session.id!, 'session', newSessionId);
  return newSessionId;
}

export async function ensureSessionForDate(date: string, groupId: GroupId): Promise<Session> {
  const existing = await db.sessions.where({ date, groupId }).first();
  if (existing) return existing;

  const groupSessions = await db.sessions.where('groupId').equals(groupId).toArray();
  const past = groupSessions.filter((s) => s.date < date).sort((a, b) => (a.date < b.date ? 1 : -1));

  let newId: number;
  if (past.length > 0) {
    newId = await duplicateSessionTo(past[0], date);
  } else {
    newId = (await db.sessions.add({ date, groupId, notes: '', tipologie: [] })) as number;
  }
  return (await db.sessions.get(newId))!;
}

export async function lastPastSession(groupId: GroupId, beforeDate: string): Promise<Session | null> {
  const groupSessions = await db.sessions.where('groupId').equals(groupId).toArray();
  const past = groupSessions.filter((s) => s.date < beforeDate).sort((a, b) => (a.date < b.date ? 1 : -1));
  return past[0] ?? null;
}
