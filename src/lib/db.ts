import Dexie, { type Table } from 'dexie';

import type { Routine, RoutineRun, RoutineRunEvent, RunActionEvent } from '@/lib/types';

class WebRoutinesDb extends Dexie {
  routines!: Table<Routine, number>;
  runs!: Table<RoutineRun, number>;
  runEvents!: Table<RoutineRunEvent, number>;
  runActionEvents!: Table<RunActionEvent, number>;

  constructor() {
    super('WebRoutinesDB');

    this.version(1).stores({
      routines: '++id,name,createdAt,updatedAt',
    });

    this.version(2).stores({
      routines: '++id,name,lastRunAt,createdAt,updatedAt',
      runs: '++id,routineId,startedAt,stoppedAt',
      runEvents: '++id,runId,routineId,timestamp,type',
    });

    this.version(3).stores({
      routines: '++id,name,lastRunAt,createdAt,updatedAt',
      runs: '++id,routineId,startedAt,stoppedAt,completedFull,[routineId+startedAt]',
      runEvents: '++id,runId,routineId,timestamp,type',
    });

    this.version(4).stores({
      routines: '++id,name,lastRunAt,createdAt,updatedAt',
      runs: '++id,routineId,startedAt,stoppedAt,completedFull,[routineId+startedAt]',
      runEvents: '++id,runId,routineId,timestamp,type',
      runActionEvents: '++id,runId,routineId,timestamp,[runId+timestamp],[routineId+timestamp]',
    });
  }
}

export const db = new WebRoutinesDb();
