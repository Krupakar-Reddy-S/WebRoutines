import Dexie, { type Table } from 'dexie';

import type { Routine } from '@/lib/types';

class WebRoutinesDb extends Dexie {
  routines!: Table<Routine, number>;

  constructor() {
    super('WebRoutinesDB');

    this.version(1).stores({
      routines: '++id,name,createdAt,updatedAt',
    });
  }
}

export const db = new WebRoutinesDb();
