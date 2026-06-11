import Dexie, { type Table } from 'dexie';

export interface Character {
  id?: number;
  name: string;
  portraitUrl?: string;
  tokenUrl?: string;
  creator?: string;
  race: string;
  ruleset: '2014' | '2024';
  classes: Array<{ name: string; level: number; subclass?: string }>;
  class?: string;
  level?: number;
  subclass?: string;
  size: string;
  alignment: string;
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
  proficiencies: string[];
  traits: any[];
  feats: any[];
  inventory: any[];
  spells: any[];
  resources: Record<string, any>;
  lastModified: number;
}
export interface FiveEToolsData {
  id: string;
  type: 'spell' | 'item' | 'class' | 'race' | 'background' | 'feat';
  name: string;
  data: any;
}

export interface ImageData {
  id: string; // e.g. "portrait-${charId}" or "token-${charId}"
  blob: Blob;
}

export interface User {
  id?: number;
  username: string;
  salt: string;
  verificationCipher: string;
  verificationIv: string;
  encryptedTotpSecret: string;
  totpSecretIv: string;
  mfaEnabled: boolean;
}

export interface EncryptedCharacter {
  id?: number;
  username: string;
  ciphertextHex: string;
  ivHex: string;
  lastModified: number;
}

export interface EncryptedImageData {
  id: string; // e.g. "portrait-${charId}" or "token-${charId}"
  username: string;
  ciphertextHex: string;
  ivHex: string;
}

export class AppDatabase extends Dexie {
  characters!: Table<Character>;
  fiveetools!: Table<FiveEToolsData>;
  images!: Table<ImageData>;
  users!: Table<User>;
  encrypted_characters!: Table<EncryptedCharacter>;
  encrypted_images!: Table<EncryptedImageData>;

  constructor() {
    super('dndchars_db');
    this.version(1).stores({
      characters: '++id, name, race, class, lastModified',
      fiveetools: 'id, type, name'
    });
    this.version(2).stores({
      characters: '++id, name, race, class, lastModified',
      fiveetools: 'id, type, name',
      images: 'id'
    });
    this.version(3).stores({
      characters: '++id, name, race, class, lastModified',
      fiveetools: 'id, type, name',
      images: 'id',
      users: '++id, username',
      encrypted_characters: '++id, username, lastModified',
      encrypted_images: 'id, username'
    });
  }
}

export const db = new AppDatabase();
