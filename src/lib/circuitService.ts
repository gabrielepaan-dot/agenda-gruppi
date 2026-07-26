import { db } from './db';
import type { CircuitOwnerType } from './circuitTypes';

export async function getCircuitsFor(ownerType: CircuitOwnerType, ownerId: number) {
  return (await db.circuits.where('[ownerType+ownerId]').equals([ownerType, ownerId]).toArray()).sort(
    (a, b) => a.order - b.order,
  );
}

export async function deleteCircuitsFor(ownerType: CircuitOwnerType, ownerId: number) {
  await db.circuits.where('[ownerType+ownerId]').equals([ownerType, ownerId]).delete();
}

export async function copyCircuits(
  fromType: CircuitOwnerType,
  fromId: number,
  toType: CircuitOwnerType,
  toId: number,
) {
  const circuits = await getCircuitsFor(fromType, fromId);
  for (const c of circuits) {
    await db.circuits.add({
      ownerType: toType,
      ownerId: toId,
      order: c.order,
      name: c.name,
      exerciseIds: [...c.exerciseIds],
      timerFormat: c.timerFormat,
      tabata: { ...c.tabata },
      emom: { ...c.emom },
      amrap: { ...c.amrap },
    });
  }
}
