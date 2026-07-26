import { db } from './db';
import type { Session } from './sessionTypes';
import type { Allenamento } from './standardTypes';
import { copyCircuits, deleteCircuitsFor } from './circuitService';
import { toIsoDate } from './groups';
import { DEFAULT_SECTION_ORDER } from './standardTypes';

export async function applyAllenamentoToSession(allenamento: Allenamento, session: Session): Promise<void> {
  await db.sessions.update(session.id!, {
    esercizi: allenamento.esercizi ?? '',
    notes: allenamento.notes ?? '',
    tipologie: [...(allenamento.tipologie ?? [])],
  });
  await deleteCircuitsFor('session', session.id!);
  await copyCircuits('allenamento', allenamento.id!, 'session', session.id!);
}

export async function saveSessionAsAllenamento(
  session: Session,
  esercizi: string,
  notes: string,
  date: string = toIsoDate(new Date()),
): Promise<number> {
  const newAllenamentoId = (await db.allenamenti.add({
    groupId: session.groupId,
    date,
    esercizi,
    notes,
    tipologie: [...(session.tipologie ?? [])],
    sectionOrder: [...DEFAULT_SECTION_ORDER],
  })) as number;
  await copyCircuits('session', session.id!, 'allenamento', newAllenamentoId);
  return newAllenamentoId;
}
