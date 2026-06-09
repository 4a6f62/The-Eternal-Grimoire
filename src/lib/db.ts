import Dexie, { type Table } from 'dexie';

export interface Character {
  id?: number;
  name: string;
  level: number;
  race: string;
  class: string;
  hp: {
    current: number;
    max: number;
    temp: number;
  };
  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  inventory: any[];
  spells: any[];
  resources: Record<string, any>;
  lastModified: number;
}

export interface FiveEToolsData {
  id: string; // e.g., "spell:fireball"
  type: 'spell' | 'item' | 'class' | 'race';
  name: string;
  data: any;
}

export class AppDatabase extends Dexie {
  characters!: Table<Character>;
  fiveetools!: Table<FiveEToolsData>;

  constructor() {
    super('dndchars_db');
    this.version(1).stores({
      characters: '++id, name, race, class, lastModified',
      fiveetools: 'id, type, name'
    });
  }
}

export const db = new AppDatabase();
