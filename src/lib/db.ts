import Dexie, { type EntityTable } from 'dexie';
import type { Exercise, VoiceRecording, VoiceProfile } from './types';
import type { Circuit, TimerPreset } from './circuitTypes';
import type { Session } from './sessionTypes';
import type { StandardCategory, StandardVariant } from './standardTypes';

const db = new Dexie('agenda-gruppi') as Dexie & {
  exercises: EntityTable<Exercise, 'id'>;
  voiceRecordings: EntityTable<VoiceRecording, 'id'>;
  voiceProfiles: EntityTable<VoiceProfile, 'id'>;
  circuits: EntityTable<Circuit, 'id'>;
  timerPresets: EntityTable<TimerPreset, 'id'>;
  sessions: EntityTable<Session, 'id'>;
  standardCategories: EntityTable<StandardCategory, 'id'>;
  standardVariants: EntityTable<StandardVariant, 'id'>;
};

db.version(1).stores({
  exercises: '++id, name, category',
  voiceRecordings: '++id, targetType, exerciseId, phraseKey',
});

db.version(2).stores({
  circuits: '++id, name, timerFormat',
});

db.version(3).stores({
  timerPresets: '++id, name, timerFormat',
});

db.version(4).stores({
  circuits: '++id, sessionId, order, name, timerFormat',
  sessions: '++id, date, groupId',
});

db.version(5).stores({
  circuits: '++id, [ownerType+ownerId], order, name, timerFormat',
  standardCategories: '++id, groupId, name',
  standardVariants: '++id, categoryId, name',
});

db.version(6)
  .stores({
    voiceProfiles: '++id, name',
    voiceRecordings: '++id, targetType, exerciseId, phraseKey, profileId',
  })
  .upgrade(async (tx) => {
    const all = await tx.table('voiceRecordings').toArray();
    const orphaned = all.filter((r: VoiceRecording) => r.targetType === 'phrase' && r.profileId === undefined);
    if (orphaned.length === 0) return;
    const profileId = await tx.table('voiceProfiles').add({ name: 'Voce salvata', createdAt: Date.now() });
    await Promise.all(orphaned.map((r: VoiceRecording) => tx.table('voiceRecordings').update(r.id, { profileId })));
  });

export { db };
