import Dexie, { type EntityTable } from 'dexie';
import type { Exercise, VoiceRecording } from './types';
import type { Circuit, TimerPreset } from './circuitTypes';
import type { Session } from './sessionTypes';
import type { StandardCategory, StandardVariant } from './standardTypes';

const db = new Dexie('agenda-gruppi') as Dexie & {
  exercises: EntityTable<Exercise, 'id'>;
  voiceRecordings: EntityTable<VoiceRecording, 'id'>;
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

export { db };
