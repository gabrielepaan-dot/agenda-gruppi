import { db } from './db';
import type { Session } from './sessionTypes';
import type { StandardVariant } from './standardTypes';
import { copyCircuits, deleteCircuitsFor } from './circuitService';

export async function applyVariantToSession(variant: StandardVariant, session: Session): Promise<void> {
  await db.sessions.update(session.id!, { warmup: variant.warmup, notes: variant.notes });
  await deleteCircuitsFor('session', session.id!);
  await copyCircuits('variant', variant.id!, 'session', session.id!);
}

export async function saveSessionAsVariant(
  session: Session,
  categoryId: number,
  name: string,
  warmup: string,
  notes: string,
): Promise<number> {
  const newVariantId = (await db.standardVariants.add({ categoryId, name, warmup, notes })) as number;
  await copyCircuits('session', session.id!, 'variant', newVariantId);
  return newVariantId;
}
