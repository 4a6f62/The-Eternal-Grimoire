import type { CharacterType } from './schemas';

// Convert our character data to Foundry VTT Actor JSON (dnd5e system)
export function exportToFoundry(character: CharacterType): any {
  const abilities: Record<string, any> = {};
  const statsMap: Record<string, string> = {
    strength: 'str',
    dexterity: 'dex',
    constitution: 'con',
    intelligence: 'int',
    wisdom: 'wis',
    charisma: 'cha'
  };

  for (const [stat, value] of Object.entries(character.stats)) {
    const key = statsMap[stat];
    if (key) {
      abilities[key] = { value, proficient: character.proficiencies?.includes(stat.charAt(0).toUpperCase() + stat.slice(1)) ? 1 : 0 };
    }
  }

  const sizeMap: Record<string, string> = {
    'Small': 'sm',
    'Medium': 'med',
    'Large': 'lg',
    'Huge': 'huge',
    'Gargantuan': 'grg'
  };

  const items: any[] = [];

  // Add classes as items
  character.classes?.forEach(cls => {
    items.push({
      name: cls.name,
      type: 'class',
      system: {
        levels: cls.level,
        subclass: cls.subclass || ''
      }
    });
  });

  // Add spells as items
  character.spells?.forEach(spell => {
    items.push({
      name: spell.name,
      type: 'spell',
      system: {
        level: spell.level,
        preparation: {
          prepared: spell.isAlwaysPrepared || false,
          mode: spell.isAlwaysPrepared ? 'always' : 'prepared'
        }
      }
    });
  });

  // Add inventory items
  character.inventory?.forEach(item => {
    items.push({
      name: item.name,
      type: item.type || 'equipment',
      system: {
        quantity: item.quantity || 1,
        weight: item.weight || 0
      }
    });
  });

  return {
    name: character.name,
    type: 'character',
    img: character.portraitUrl?.startsWith('http') ? character.portraitUrl : '',
    system: {
      abilities,
      attributes: {
        hp: {
          value: character.hp.current,
          max: character.hp.max,
          temp: character.hp.temp || 0
        }
      },
      details: {
        race: character.race,
        background: character.background || '',
        alignment: character.alignment || 'True Neutral'
      },
      traits: {
        size: sizeMap[character.size] || 'med',
        languages: {
          value: character.languages?.map(l => l.toLowerCase()) || ['common']
        }
      }
    },
    items
  };
}

// Convert our character data to Roll20 Character JSON (OGL / 5e Sheet representation)
export function exportToRoll20(character: CharacterType): any {
  const attribs: any[] = [
    { name: 'strength', current: character.stats.strength },
    { name: 'dexterity', current: character.stats.dexterity },
    { name: 'constitution', current: character.stats.constitution },
    { name: 'intelligence', current: character.stats.intelligence },
    { name: 'wisdom', current: character.stats.wisdom },
    { name: 'charisma', current: character.stats.charisma },
    { name: 'hp', current: character.hp.current, max: character.hp.max },
    { name: 'hp_temp', current: character.hp.temp || 0 },
    { name: 'race', current: character.race },
    { name: 'background', current: character.background || '' },
    { name: 'alignment', current: character.alignment || 'True Neutral' },
    { name: 'size', current: character.size }
  ];

  // Roll20 classes & levels attributes representation
  character.classes?.forEach((cls, idx) => {
    const num = idx + 1;
    attribs.push({ name: `class_${num}`, current: cls.name });
    attribs.push({ name: `level_${num}`, current: cls.level });
    if (cls.subclass) {
      attribs.push({ name: `subclass_${num}`, current: cls.subclass });
    }
  });

  // Combined field representation
  const classStr = character.classes?.map(c => `${c.name} ${c.level}`).join(' / ');
  attribs.push({ name: 'class_and_level', current: classStr });

  return {
    schema_version: 3,
    name: character.name,
    avatar: character.portraitUrl?.startsWith('http') ? character.portraitUrl : '',
    attribs,
    abilities: []
  };
}

// Parse Foundry VTT Actor JSON into character data
export function importFromFoundry(json: any): { character: Partial<CharacterType>; warnings: string[] } {
  const warnings: string[] = [];
  const stats = { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 };
  const char: Partial<CharacterType> = {
    name: json.name || 'Unnamed Foundry Hero',
    stats,
    hp: { current: 10, max: 10, temp: 0 },
    classes: [],
    spells: [],
    inventory: [],
    traits: [],
    feats: [],
    languages: ['Common'],
    alignment: 'True Neutral',
    size: 'Medium',
    ruleset: '2014'
  };

  const sys = json.system || {};

  // Parse abilities
  if (sys.abilities) {
    const map: Record<string, 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'> = {
      str: 'strength',
      dex: 'dexterity',
      con: 'constitution',
      int: 'intelligence',
      wis: 'wisdom',
      cha: 'charisma'
    };
    for (const [key, details] of Object.entries(sys.abilities)) {
      const target = map[key];
      if (target && details && typeof details === 'object') {
        const val = (details as any).value || 10;
        stats[target] = val;
      }
    }
  }

  // Parse HP
  if (sys.attributes?.hp) {
    char.hp = {
      current: Number(sys.attributes.hp.value) || 10,
      max: Number(sys.attributes.hp.max) || 10,
      temp: Number(sys.attributes.hp.temp) || 0
    };
  }

  // Details
  if (sys.details) {
    char.race = sys.details.race || 'Human';
    char.background = sys.details.background || '';
    char.alignment = sys.details.alignment || 'True Neutral';
  }

  // Size
  if (sys.traits?.size) {
    const sizeMap: Record<string, string> = {
      sm: 'Small',
      med: 'Medium',
      lg: 'Large',
      huge: 'Huge',
      grg: 'Gargantuan'
    };
    char.size = sizeMap[sys.traits.size.toLowerCase()] || 'Medium';
  }

  // Languages
  if (sys.traits?.languages?.value) {
    const langs = sys.traits.languages.value.map((l: string) => l.charAt(0).toUpperCase() + l.slice(1));
    if (langs.length > 0) char.languages = langs;
  }

  // Parse items (classes, spells, inventory)
  if (Array.isArray(json.items)) {
    json.items.forEach((item: any) => {
      if (!item || !item.name) return;

      if (item.type === 'class') {
        const clsName = item.name;
        const level = Number(item.system?.levels) || 1;
        const subclass = item.system?.subclass || '';
        char.classes!.push({ name: clsName, level, subclass });
      } else if (item.type === 'spell') {
        char.spells!.push({
          name: item.name,
          level: Number(item.system?.level) || 0,
          desc: item.system?.description?.value ? item.system.description.value.replace(/<[^>]*>/g, '') : 'Spell imported from Foundry.',
          source: item.system?.source || 'Foundry VTT',
          isAlwaysPrepared: item.system?.preparation?.mode === 'always'
        });
      } else if (['weapon', 'equipment', 'loot', 'consumable', 'backpack'].includes(item.type)) {
        char.inventory!.push({
          name: item.name,
          quantity: Number(item.system?.quantity) || 1,
          weight: Number(item.system?.weight) || 0,
          type: item.type
        });
      }
    });
  }

  // Fallback for single class if items array did not contain a class type
  if (char.classes!.length === 0) {
    const fallbackClass = sys.details?.class || 'Fighter';
    const fallbackLevel = Number(sys.details?.level) || 1;
    char.classes!.push({ name: fallbackClass, level: fallbackLevel });
    warnings.push(`No class item found. Created default "${fallbackClass} ${fallbackLevel}" class representation.`);
  }

  // Try to detect ruleset
  const has2024Source = json.items?.some((i: any) => i.system?.source?.toLowerCase().includes('2024') || i.system?.source?.toLowerCase() === 'xphb');
  char.ruleset = has2024Source ? '2024' : '2014';

  return { character: char, warnings };
}

// Parse Roll20 Character JSON into character data
export function importFromRoll20(json: any): { character: Partial<CharacterType>; warnings: string[] } {
  const warnings: string[] = [];
  const stats = { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 };
  const char: Partial<CharacterType> = {
    name: json.name || 'Unnamed Roll20 Hero',
    stats,
    hp: { current: 10, max: 10, temp: 0 },
    classes: [],
    spells: [],
    inventory: [],
    traits: [],
    feats: [],
    languages: ['Common'],
    alignment: 'True Neutral',
    size: 'Medium',
    ruleset: '2014'
  };

  const attribs = Array.isArray(json.attribs) ? json.attribs : [];
  
  const getAttr = (name: string): any => {
    return attribs.find((a: any) => a && a.name === name)?.current;
  };
  const getAttrMax = (name: string): any => {
    return attribs.find((a: any) => a && a.name === name)?.max;
  };

  // Stats mapping
  const statsMap = {
    strength: ['strength', 'str'],
    dexterity: ['dexterity', 'dex'],
    constitution: ['constitution', 'con'],
    intelligence: ['intelligence', 'int'],
    wisdom: ['wisdom', 'wis'],
    charisma: ['charisma', 'cha']
  };

  for (const [key, aliases] of Object.entries(statsMap)) {
    let val: any = undefined;
    for (const alias of aliases) {
      val = getAttr(alias);
      if (val !== undefined) break;
    }
    if (val !== undefined) {
      stats[key as keyof typeof stats] = Number(val) || 10;
    }
  }

  // HP
  const hpVal = getAttr('hp');
  const hpMax = getAttrMax('hp') || hpVal;
  if (hpVal !== undefined) {
    char.hp = {
      current: Number(hpVal) || 10,
      max: Number(hpMax) || 10,
      temp: Number(getAttr('hp_temp')) || 0
    };
  }

  // Basic Info
  char.race = getAttr('race') || 'Human';
  char.background = getAttr('background') || '';
  char.alignment = getAttr('alignment') || 'True Neutral';
  char.size = getAttr('size') || 'Medium';

  // Classes & Levels
  // Look for class_1, level_1 etc.
  let idx = 1;
  while (true) {
    const clsName = getAttr(`class_${idx}`) || getAttr(`class${idx}`);
    const level = Number(getAttr(`level_${idx}`) || getAttr(`level${idx}`));
    if (!clsName) break;
    const subclass = getAttr(`subclass_${idx}`) || getAttr(`subclass${idx}`) || '';
    char.classes!.push({ name: clsName, level: level || 1, subclass });
    idx++;
  }

  // Fallback: parse class_and_level
  if (char.classes!.length === 0) {
    const classAndLvl = getAttr('class_and_level') || getAttr('class');
    if (classAndLvl) {
      const parts = classAndLvl.split('/');
      parts.forEach((p: string) => {
        const match = p.trim().match(/^([A-Za-z\s]+)\s+(\d+)$/);
        if (match) {
          char.classes!.push({ name: match[1].trim(), level: Number(match[2]) || 1 });
        }
      });
    }
  }

  if (char.classes!.length === 0) {
    char.classes!.push({ name: 'Fighter', level: 1 });
    warnings.push('Could not parse class/level from Roll20 sheet. Defaulted to Fighter 1.');
  }

  // Repeating section parsing for inventory/spells (if available in attributes)
  const itemNames = new Map<string, string>();
  const itemQtys = new Map<string, number>();
  const itemWeights = new Map<string, number>();

  const spellNames = new Map<string, string>();
  const spellLevels = new Map<string, number>();
  
  attribs.forEach((a: any) => {
    if (!a || !a.name) return;
    
    // Inventory matching
    let match = a.name.match(/^repeating_inventory_([^_]+)_itemname$/);
    if (match) {
      itemNames.set(match[1], a.current);
    }
    match = a.name.match(/^repeating_inventory_([^_]+)_itemcount$/);
    if (match) {
      itemQtys.set(match[1], Number(a.current) || 1);
    }
    match = a.name.match(/^repeating_inventory_([^_]+)_itemweight$/);
    if (match) {
      itemWeights.set(match[1], Number(a.current) || 0);
    }

    // Spells matching
    match = a.name.match(/^repeating_spell-cantrip_([^_]+)_spellname$/);
    if (match) {
      spellNames.set('cantrip_' + match[1], a.current);
      spellLevels.set('cantrip_' + match[1], 0);
    }
    match = a.name.match(/^repeating_spell-level(\d)_([^_]+)_spellname$/);
    if (match) {
      spellNames.set(match[1] + '_' + match[2], a.current);
      spellLevels.set(match[1] + '_' + match[2], Number(match[1]));
    }
  });

  itemNames.forEach((name, id) => {
    char.inventory!.push({
      name,
      quantity: itemQtys.get(id) || 1,
      weight: itemWeights.get(id) || 0
    });
  });

  spellNames.forEach((name, id) => {
    char.spells!.push({
      name,
      level: spellLevels.get(id) || 0,
      desc: 'Spell imported from Roll20.',
      source: 'Roll20'
    });
  });

  return { character: char, warnings };
}

// Check character rules and point out errors or warnings
export function validateCharacterRules(character: Partial<CharacterType>): string[] {
  const errors: string[] = [];

  // 1. Name Check
  if (!character.name || character.name.trim() === '') {
    errors.push('Character Name is missing.');
  }

  // 2. Ability Scores Check
  if (character.stats) {
    const limit = 20;
    for (const [stat, val] of Object.entries(character.stats)) {
      if (val < 1 || val > 30) {
        errors.push(`Ability score for ${stat.toUpperCase()} (${val}) must be between 1 and 30.`);
      } else if (val > limit) {
        errors.push(`Ability score for ${stat.toUpperCase()} (${val}) exceeds standard maximum (20) without magic items or epic boons.`);
      }
    }
  }

  // 3. Class Level Check
  if (character.classes && character.classes.length > 0) {
    let totalLvl = 0;
    character.classes.forEach(c => {
      if (c.level < 1 || c.level > 20) {
        errors.push(`Class level for ${c.name} (${c.level}) must be between 1 and 20.`);
      }
      totalLvl += c.level;

      // Subclass checks (D&D subclass milestones)
      if (c.subclass) {
        const scAtLevel1 = ['cleric', 'sorcerer', 'warlock'];
        const scAtLevel2 = ['druid', 'wizard'];
        const lowerCls = c.name.toLowerCase();
        
        if (character.ruleset === '2024') {
          if (c.level < 3) {
            errors.push(`Subclass "${c.subclass}" assigned to ${c.name} level ${c.level} (subclasses require level 3 under 2024 rules).`);
          }
        } else {
          if (scAtLevel1.includes(lowerCls) && c.level < 1) {
            errors.push(`Subclass "${c.subclass}" assigned to ${c.name} level ${c.level} (subclasses require level 1).`);
          } else if (scAtLevel2.includes(lowerCls) && c.level < 2) {
            errors.push(`Subclass "${c.subclass}" assigned to ${c.name} level ${c.level} (subclasses require level 2).`);
          } else if (!scAtLevel1.includes(lowerCls) && !scAtLevel2.includes(lowerCls) && c.level < 3) {
            errors.push(`Subclass "${c.subclass}" assigned to ${c.name} level ${c.level} (subclasses require level 3).`);
          }
        }
      }
    });

    if (totalLvl < 1 || totalLvl > 20) {
      errors.push(`Total character level (${totalLvl}) must be between 1 and 20.`);
    }
  } else {
    errors.push('No class/level configuration defined.');
  }

  // 4. HP sanity check
  if (character.hp && character.stats) {
    if (character.hp.max <= 0) {
      errors.push(`Max HP (${character.hp.max}) must be greater than 0.`);
    }
  }

  // 5. Proficiencies check
  if (character.proficiencies) {
    const duplicates = character.proficiencies.filter((item, index) => character.proficiencies!.indexOf(item) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate proficiencies selected: ${duplicates.join(', ')}.`);
    }
  }

  return errors;
}
