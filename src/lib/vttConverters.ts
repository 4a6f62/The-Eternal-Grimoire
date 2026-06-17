import type { CharacterType } from './schemas';
import { db } from './db';

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
// Convert our character data to Roll20 Character JSON (OGL / 5e Sheet representation)
export async function exportToRoll20(character: CharacterType): Promise<any> {
  // Helper to generate a Roll20-like unique repeating row ID
  const generateRowId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '-';
    for (let i = 0; i < 19; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const getModNum = (score: number) => Math.floor((score - 10) / 2);

  // Ability scores and modifiers
  const stats = character.stats;
  const strMod = getModNum(stats.strength);
  const dexMod = getModNum(stats.dexterity);
  const conMod = getModNum(stats.constitution);
  const intMod = getModNum(stats.intelligence);
  const wisMod = getModNum(stats.wisdom);
  const chaMod = getModNum(stats.charisma);

  // Calculate total level
  let totalLevel = 0;
  const classesList = character.classes || [];
  classesList.forEach((c) => {
    totalLevel += Number(c.level) || 0;
  });
  if (totalLevel === 0) totalLevel = 1;

  // Calculate proficiency bonus (pb)
  const pb = Math.floor((totalLevel - 1) / 4) + 2;

  // Calculate AC
  const ARMOR_DATA: Record<string, { base: number, dexMod: boolean, maxDex?: number }> = {
    'padded armor': { base: 11, dexMod: true },
    'leather armor': { base: 11, dexMod: true },
    'studded leather armor': { base: 12, dexMod: true },
    'hide armor': { base: 12, dexMod: true, maxDex: 2 },
    'chain shirt': { base: 13, dexMod: true, maxDex: 2 },
    'scale mail': { base: 14, dexMod: true, maxDex: 2 },
    'breastplate': { base: 14, dexMod: true, maxDex: 2 },
    'half plate armor': { base: 15, dexMod: true, maxDex: 2 },
    'ring mail': { base: 14, dexMod: false },
    'chain mail': { base: 16, dexMod: false },
    'splint armor': { base: 17, dexMod: false },
    'plate armor': { base: 18, dexMod: false },
  };

  const inventoryList = character.inventory || [];
  const inventoryLower = inventoryList.map(i => (typeof i === 'string' ? i : i.name).toLowerCase());

  let ac = 10 + dexMod;
  const equippedArmor = inventoryLower.find(item => ARMOR_DATA[item]);
  if (equippedArmor) {
    const armor = ARMOR_DATA[equippedArmor];
    ac = armor.base;
    if (armor.dexMod) {
      let currentDexMod = dexMod;
      if (armor.maxDex !== undefined) currentDexMod = Math.min(currentDexMod, armor.maxDex);
      ac += currentDexMod;
    }
  }
  if (inventoryLower.includes('shield')) {
    ac += 2;
  }
  if (character.resources?.fightingStyle === 'Defense' && equippedArmor) {
    ac += 1;
  }

  // Set up attributes
  const attribs: any[] = [
    // Ability scores, bases and modifiers
    { name: 'strength', current: stats.strength },
    { name: 'strength_base', current: stats.strength },
    { name: 'strength_mod', current: strMod },
    { name: 'strength_flag', current: 0 },

    { name: 'dexterity', current: stats.dexterity },
    { name: 'dexterity_base', current: stats.dexterity },
    { name: 'dexterity_mod', current: dexMod },
    { name: 'dexterity_flag', current: 0 },

    { name: 'constitution', current: stats.constitution },
    { name: 'constitution_base', current: stats.constitution },
    { name: 'constitution_mod', current: conMod },
    { name: 'constitution_flag', current: 0 },

    { name: 'intelligence', current: stats.intelligence },
    { name: 'intelligence_base', current: stats.intelligence },
    { name: 'intelligence_mod', current: intMod },
    { name: 'intelligence_flag', current: 0 },

    { name: 'wisdom', current: stats.wisdom },
    { name: 'wisdom_base', current: stats.wisdom },
    { name: 'wisdom_mod', current: wisMod },
    { name: 'wisdom_flag', current: 0 },

    { name: 'charisma', current: stats.charisma },
    { name: 'charisma_base', current: stats.charisma },
    { name: 'charisma_mod', current: chaMod },
    { name: 'charisma_flag', current: 0 },

    // HP
    { name: 'hp', current: character.hp.current, max: character.hp.max },
    { name: 'hp_temp', current: character.hp.temp || 0 },

    // Basic details
    { name: 'race', current: character.race },
    { name: 'background', current: character.background || '' },
    { name: 'alignment', current: character.alignment || 'True Neutral' },
    { name: 'size', current: character.size },
    { name: 'speed', current: 30 },
    { name: 'ac', current: ac },
    { name: 'level', current: totalLevel },
    { name: 'pb', current: pb },
    { name: 'pb_type', current: '0' },

    // Charactermancer prevention
    { name: 'l1mancer_status', current: 'completed' },
    { name: 'charactermancer_step', current: '' },
    { name: 'lpmancer_status', current: '' },
    { name: 'mancer_confirm', current: 'on' },
    { name: 'showleveler', current: 0 },
  ];

  // Saves
  const checkSaveProf = (stat: string) => {
    const formatted = stat.charAt(0).toUpperCase() + stat.slice(1);
    return character.proficiencies?.includes(formatted) ? `(@{pb})` : '0';
  };
  const getSaveBonus = (stat: string, mod: number) => {
    const formatted = stat.charAt(0).toUpperCase() + stat.slice(1);
    return character.proficiencies?.includes(formatted) ? mod + pb : mod;
  };

  attribs.push({ name: 'strength_save_prof', current: checkSaveProf('strength') });
  attribs.push({ name: 'strength_save_bonus', current: getSaveBonus('strength', strMod) });
  attribs.push({ name: 'dexterity_save_prof', current: checkSaveProf('dexterity') });
  attribs.push({ name: 'dexterity_save_bonus', current: getSaveBonus('dexterity', dexMod) });
  attribs.push({ name: 'constitution_save_prof', current: checkSaveProf('constitution') });
  attribs.push({ name: 'constitution_save_bonus', current: getSaveBonus('constitution', conMod) });
  attribs.push({ name: 'intelligence_save_prof', current: checkSaveProf('intelligence') });
  attribs.push({ name: 'intelligence_save_bonus', current: getSaveBonus('intelligence', intMod) });
  attribs.push({ name: 'wisdom_save_prof', current: checkSaveProf('wisdom') });
  attribs.push({ name: 'wisdom_save_bonus', current: getSaveBonus('wisdom', wisMod) });
  attribs.push({ name: 'charisma_save_prof', current: checkSaveProf('charisma') });
  attribs.push({ name: 'charisma_save_bonus', current: getSaveBonus('charisma', chaMod) });
  
  attribs.push({ name: 'death_save_bonus', current: 0 });
  attribs.push({ name: 'global_save_mod_flag', current: '1' });
  attribs.push({ name: 'global_save_mod', current: '' });

  // Skills
  const skillMapping: Record<string, { ability: string, mod: number }> = {
    'Acrobatics': { ability: 'dexterity', mod: dexMod },
    'Animal Handling': { ability: 'wisdom', mod: wisMod },
    'Arcana': { ability: 'intelligence', mod: intMod },
    'Athletics': { ability: 'strength', mod: strMod },
    'Deception': { ability: 'charisma', mod: chaMod },
    'History': { ability: 'intelligence', mod: intMod },
    'Insight': { ability: 'wisdom', mod: wisMod },
    'Intimidation': { ability: 'charisma', mod: chaMod },
    'Investigation': { ability: 'intelligence', mod: intMod },
    'Medicine': { ability: 'wisdom', mod: wisMod },
    'Nature': { ability: 'intelligence', mod: intMod },
    'Perception': { ability: 'wisdom', mod: wisMod },
    'Performance': { ability: 'charisma', mod: chaMod },
    'Persuasion': { ability: 'charisma', mod: chaMod },
    'Religion': { ability: 'intelligence', mod: intMod },
    'Sleight of Hand': { ability: 'dexterity', mod: dexMod },
    'Stealth': { ability: 'dexterity', mod: dexMod },
    'Survival': { ability: 'wisdom', mod: wisMod }
  };

  for (const [skillName, info] of Object.entries(skillMapping)) {
    const attrName = skillName.toLowerCase().replace(/\s+/g, '_');
    const isProf = character.proficiencies?.includes(skillName);
    attribs.push({
      name: `${attrName}_prof`,
      current: isProf ? `(@{pb}*@{${attrName}_type})` : '0'
    });
    attribs.push({
      name: `${attrName}_type`,
      current: isProf ? 1 : 0
    });
    attribs.push({
      name: `${attrName}_bonus`,
      current: isProf ? info.mod + pb : info.mod
    });
  }

  // Classes & levels representation
  let baseClassAssigned = false;
  let multiclassIdx = 1;
  const classDisplayParts: string[] = [];

  classesList.forEach((cls) => {
    const className = cls.name;
    const classLevel = cls.level;
    const subclass = cls.subclass || '';

    // class_display parts (e.g. "Oathbreaker Paladin 7")
    const displayName = subclass ? `${subclass} ${className} ${classLevel}` : `${className} ${classLevel}`;
    classDisplayParts.push(displayName);

    if (!baseClassAssigned) {
      attribs.push({ name: 'class', current: className });
      attribs.push({ name: 'base_level', current: classLevel });
      attribs.push({ name: 'subclass', current: subclass });
      baseClassAssigned = true;
    } else {
      if (multiclassIdx <= 3) {
        attribs.push({ name: `multiclass${multiclassIdx}`, current: className });
        attribs.push({ name: `multiclass${multiclassIdx}_lvl`, current: classLevel });
        attribs.push({ name: `multiclass${multiclassIdx}_subclass`, current: subclass });
        attribs.push({ name: `multiclass${multiclassIdx}_flag`, current: '1' });
        multiclassIdx++;
      }
    }
  });

  attribs.push({ name: 'class_display', current: classDisplayParts.join(', ') });

  // Languages representation
  if (character.languages && character.languages.length > 0) {
    attribs.push({ name: 'languages', current: character.languages.join(', ') });
  }

  // Spellcasting ability & modifiers
  let spellcastingAbility = 'charisma';
  if (classesList.length > 0) {
    const mainClass = classesList[0].name.toLowerCase();
    if (['wizard', 'artificer'].includes(mainClass)) {
      spellcastingAbility = 'intelligence';
    } else if (['cleric', 'druid', 'ranger'].includes(mainClass)) {
      spellcastingAbility = 'wisdom';
    }
  }

  const spellcastingAbilityMod = getModNum(stats[spellcastingAbility as keyof typeof stats] || 10);
  attribs.push({ name: 'spellcasting_ability', current: `@{${spellcastingAbility}_mod}+` });
  attribs.push({ name: 'spell_save_dc', current: 8 + pb + spellcastingAbilityMod });
  attribs.push({ name: 'spell_attack_bonus', current: pb + spellcastingAbilityMod });
  attribs.push({ name: 'spell_attack_mod', current: 0 });
  attribs.push({ name: 'cust_spellcasting_ability', current: '' });

  // Calculate spell slots
  const SPELL_SLOTS_TABLE: Record<number, number[]> = {
    1: [2],
    2: [3],
    3: [4, 2],
    4: [4, 3],
    5: [4, 3, 2],
    6: [4, 3, 3],
    7: [4, 3, 3, 1],
    8: [4, 3, 3, 2],
    9: [4, 3, 3, 3, 1],
    10: [4, 3, 3, 3, 2],
    11: [4, 3, 3, 3, 2, 1],
    12: [4, 3, 3, 3, 2, 1],
    13: [4, 3, 3, 3, 2, 1, 1],
    14: [4, 3, 3, 3, 2, 1, 1],
    15: [4, 3, 3, 3, 2, 1, 1, 1],
    16: [4, 3, 3, 3, 2, 1, 1, 1],
    17: [4, 3, 3, 3, 2, 1, 1, 1, 1, 1],
    18: [4, 3, 3, 3, 3, 1, 1, 1, 1, 1],
    19: [4, 3, 3, 3, 3, 2, 1, 1, 1, 1],
    20: [4, 3, 3, 3, 3, 2, 2, 1, 1, 1]
  };

  let warlockLevel = 0;
  let casterLevel = 0;

  classesList.forEach((c) => {
    const name = c.name.toLowerCase();
    const lvl = Number(c.level) || 0;
    if (name === 'warlock') {
      warlockLevel = lvl;
    } else if (['cleric', 'druid', 'bard', 'sorcerer', 'wizard'].includes(name)) {
      casterLevel += lvl;
    } else if (['paladin', 'ranger'].includes(name)) {
      casterLevel += Math.floor(lvl / 2);
    } else if (['fighter', 'rogue'].includes(name)) {
      const sub = c.subclass?.toLowerCase() || '';
      if (sub.includes('eldritch knight') || sub.includes('arcane trickster')) {
        casterLevel += Math.floor(lvl / 3);
      }
    }
  });

  const slotsTotal: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
  const maxSlots = SPELL_SLOTS_TABLE[casterLevel] || [];
  maxSlots.forEach((count, idx) => {
    slotsTotal[idx + 1] = count;
  });

  // Warlock Pact Magic slots
  let pactMaxSlots = 0;
  let pactSlotLvl = 0;
  if (warlockLevel > 0) {
    if (warlockLevel === 1) { pactMaxSlots = 1; pactSlotLvl = 1; }
    else if (warlockLevel === 2) { pactMaxSlots = 2; pactSlotLvl = 1; }
    else if (warlockLevel >= 3 && warlockLevel <= 4) { pactMaxSlots = 2; pactSlotLvl = 2; }
    else if (warlockLevel >= 5 && warlockLevel <= 6) { pactMaxSlots = 2; pactSlotLvl = 3; }
    else if (warlockLevel >= 7 && warlockLevel <= 8) { pactMaxSlots = 2; pactSlotLvl = 4; }
    else if (warlockLevel >= 9 && warlockLevel <= 10) { pactMaxSlots = 2; pactSlotLvl = 5; }
    else if (warlockLevel >= 11 && warlockLevel <= 16) { pactMaxSlots = 3; pactSlotLvl = 5; }
    else if (warlockLevel >= 17) { pactMaxSlots = 4; pactSlotLvl = 5; }
  }

  if (warlockLevel > 0 && pactSlotLvl > 0) {
    slotsTotal[pactSlotLvl] = (slotsTotal[pactSlotLvl] || 0) + pactMaxSlots;
  }

  for (let i = 1; i <= 9; i++) {
    attribs.push({ name: `lvl${i}_slots_total`, current: slotsTotal[i] || 0 });
    attribs.push({ name: `lvl${i}_slots_expended`, current: slotsTotal[i] || 0 }); // current represents remaining slots
  }

  // Weapon details database mapping
  const WEAPON_DATA: Record<string, { dmg: string, type: string, prop: string[] }> = {
    'club': { dmg: '1d4', type: 'bludgeoning', prop: ['light'] },
    'dagger': { dmg: '1d4', type: 'piercing', prop: ['finesse', 'light', 'thrown'] },
    'greatclub': { dmg: '1d8', type: 'bludgeoning', prop: ['two-handed'] },
    'handaxe': { dmg: '1d6', type: 'slashing', prop: ['light', 'thrown'] },
    'javelin': { dmg: '1d6', type: 'piercing', prop: ['thrown'] },
    'light hammer': { dmg: '1d4', type: 'bludgeoning', prop: ['light', 'thrown'] },
    'mace': { dmg: '1d6', type: 'bludgeoning', prop: [] },
    'quarterstaff': { dmg: '1d6', type: 'bludgeoning', prop: ['versatile'] },
    'sickle': { dmg: '1d4', type: 'slashing', prop: ['light'] },
    'spear': { dmg: '1d6', type: 'piercing', prop: ['thrown', 'versatile'] },
    'light crossbow': { dmg: '1d8', type: 'piercing', prop: ['ammunition', 'range', 'two-handed'] },
    'dart': { dmg: '1d4', type: 'piercing', prop: ['finesse', 'thrown'] },
    'shortbow': { dmg: '1d6', type: 'piercing', prop: ['ammunition', 'range', 'two-handed'] },
    'sling': { dmg: '1d4', type: 'bludgeoning', prop: ['ammunition', 'range'] },
    'battleaxe': { dmg: '1d8', type: 'slashing', prop: ['versatile'] },
    'flail': { dmg: '1d8', type: 'bludgeoning', prop: [] },
    'glaive': { dmg: '1d10', type: 'slashing', prop: ['heavy', 'reach', 'two-handed'] },
    'greataxe': { dmg: '1d12', type: 'slashing', prop: ['heavy', 'two-handed'] },
    'greatsword': { dmg: '2d6', type: 'slashing', prop: ['heavy', 'two-handed'] },
    'halberd': { dmg: '1d10', type: 'slashing', prop: ['heavy', 'reach', 'two-handed'] },
    'lance': { dmg: '1d12', type: 'piercing', prop: ['reach', 'special'] },
    'longsword': { dmg: '1d8', type: 'slashing', prop: ['versatile'] },
    'maul': { dmg: '2d6', type: 'bludgeoning', prop: ['heavy', 'two-handed'] },
    'morningstar': { dmg: '1d8', type: 'piercing', prop: [] },
    'pike': { dmg: '1d10', type: 'piercing', prop: ['heavy', 'reach', 'two-handed'] },
    'rapier': { dmg: '1d8', type: 'piercing', prop: ['finesse'] },
    'scimitar': { dmg: '1d6', type: 'slashing', prop: ['finesse', 'light'] },
    'shortsword': { dmg: '1d6', type: 'piercing', prop: ['finesse', 'light'] },
    'trident': { dmg: '1d6', type: 'piercing', prop: ['thrown', 'versatile'] },
    'war pick': { dmg: '1d8', type: 'piercing', prop: [] },
    'warhammer': { dmg: '1d8', type: 'bludgeoning', prop: ['versatile'] },
    'whip': { dmg: '1d4', type: 'slashing', prop: ['finesse', 'reach'] },
    'blowgun': { dmg: '1', type: 'piercing', prop: ['ammunition', 'range'] },
    'hand crossbow': { dmg: '1d6', type: 'piercing', prop: ['ammunition', 'light', 'range'] },
    'heavy crossbow': { dmg: '1d10', type: 'piercing', prop: ['ammunition', 'heavy', 'range', 'two-handed'] },
    'longbow': { dmg: '1d8', type: 'piercing', prop: ['ammunition', 'heavy', 'range', 'two-handed'] },
    'net': { dmg: '-', type: 'none', prop: ['special', 'thrown'] },
    'unarmed strike': { dmg: '1', type: 'bludgeoning', prop: [] }
  };

  // Export Inventory items to repeating section
  character.inventory?.forEach((item) => {
    const rowId = generateRowId();
    const itemName = item.name;
    const nameLower = itemName.toLowerCase();
    
    attribs.push({ name: `repeating_inventory_${rowId}_itemname`, current: itemName });
    attribs.push({ name: `repeating_inventory_${rowId}_itemcount`, current: item.quantity || 1 });
    if (item.weight !== undefined) {
      attribs.push({ name: `repeating_inventory_${rowId}_itemweight`, current: item.weight });
    }
    attribs.push({ name: `repeating_inventory_${rowId}_equipped`, current: 1 });

    const weaponInfo = WEAPON_DATA[nameLower] || (item.type === 'weapon' ? { dmg: '1d4', type: 'slashing', prop: [] } : null);

    if (weaponInfo) {
      const atkRowId = generateRowId();
      
      // Link inventory item and attack
      attribs.push({ name: `repeating_inventory_${rowId}_hasattack`, current: 1 });
      attribs.push({ name: `repeating_inventory_${rowId}_itemattackid`, current: atkRowId });
      
      // Determine attack ability (Strength or Dexterity)
      let atkAbility = 'strength_mod';
      let atkAbilityLabel = 'STR';
      if (weaponInfo.prop.includes('finesse')) {
        if (dexMod > strMod) {
          atkAbility = 'dexterity_mod';
          atkAbilityLabel = 'DEX';
        }
      } else if (weaponInfo.prop.includes('ammunition') || nameLower === 'dart') {
        atkAbility = 'dexterity_mod';
        atkAbilityLabel = 'DEX';
      }

      const abilityBonus = atkAbility === 'dexterity_mod' ? dexMod : strMod;
      const attackBonus = abilityBonus + pb;
      const rangeVal = weaponInfo.prop.includes('thrown') || weaponInfo.prop.includes('ammunition') ? 'Ranged' : 'Melee';

      // Create repeating attack
      attribs.push({ name: `repeating_attack_${atkRowId}_itemid`, current: rowId });
      attribs.push({ name: `repeating_attack_${atkRowId}_atkname`, current: itemName });
      attribs.push({ name: `repeating_attack_${atkRowId}_atkattr_base`, current: `@{${atkAbility}}` });
      attribs.push({ name: `repeating_attack_${atkRowId}_atkbonus`, current: attackBonus >= 0 ? `+${attackBonus}` : attackBonus.toString() });
      attribs.push({ name: `repeating_attack_${atkRowId}_atkrange`, current: rangeVal });
      attribs.push({ name: `repeating_attack_${atkRowId}_atkcritrange`, current: 20 });
      attribs.push({ name: `repeating_attack_${atkRowId}_dmgattr`, current: `@{${atkAbility}}` });
      attribs.push({ name: `repeating_attack_${atkRowId}_dmgbase`, current: weaponInfo.dmg });
      attribs.push({ name: `repeating_attack_${atkRowId}_dmgtype`, current: weaponInfo.type.charAt(0).toUpperCase() + weaponInfo.type.slice(1) });
      attribs.push({ name: `repeating_attack_${atkRowId}_options-flag`, current: '0' });

      // Roll templates
      const rollbase = `@{wtype}&{template:atk} {{mod=@{atkbonus}}} {{rname=[@{atkname}](~repeating_attack_attack_dmg)}} {{rnamec=[@{atkname}](~repeating_attack_attack_crit)}} {{r1=[[@{d20}cs>@{atkcritrange} + @{${atkAbility}}[${atkAbilityLabel}] + @{pb}[PROF]]]}} @{rtype}cs>@{atkcritrange} + @{${atkAbility}}[${atkAbilityLabel}] + @{pb}[PROF]]]}} {{range=@{atkrange}}} {{desc=@{atk_desc}}} {{spelllevel=@{spelllevel}}} {{innate=@{spell_innate}}} {{globalattack=@{global_attack_mod}}} ammo=@{ammo} @{charname_output}`;
      const rollbaseDmg = `@{wtype}&{template:dmg} {{rname=@{atkname}}} @{atkflag} {{range=@{atkrange}}} @{dmgflag} {{dmg1=[[@{dmgbase} + @{${atkAbility}}[${atkAbilityLabel}]]]}} {{dmg1type=@{dmgtype}}} @{dmg2flag} {{dmg2=[[0]]}} {{dmg2type=}} @{saveflag} {{desc=@{atk_desc}}} @{hldmg} {{spelllevel=@{spelllevel}}} {{innate=@{spell_innate}}} {{globaldamage=[[0]]}} {{globaldamagetype=@{global_damage_mod_type}}} @{charname_output}`;
      const rollbaseCrit = `@{wtype}&{template:dmg} {{crit=1}} {{rname=@{atkname}}} @{atkflag} {{range=@{atkrange}}} @{dmgflag} {{dmg1=[[@{dmgbase} + @{${atkAbility}}[${atkAbilityLabel}]]]}} {{dmg1type=@{dmgtype}}} @{dmg2flag} {{dmg2=[[0]]}} {{dmg2type=}} {{crit1=[[@{dmgbase}]]}} {{crit2=[[0]]}} @{saveflag} {{desc=@{atk_desc}}} @{hldmg}  {{spelllevel=@{spelllevel}}} {{innate=@{spell_innate}}} {{globaldamage=[[0]]}} {{globaldamagecrit=[[0]]}} {{globaldamagetype=@{global_damage_mod_type}}} @{charname_output}`;

      attribs.push({ name: `repeating_attack_${atkRowId}_rollbase`, current: rollbase });
      attribs.push({ name: `repeating_attack_${atkRowId}_rollbase_dmg`, current: rollbaseDmg });
      attribs.push({ name: `repeating_attack_${atkRowId}_rollbase_crit`, current: rollbaseCrit });
    }
  });

  // Export Spells to repeating sections
  for (const spell of character.spells || []) {
    const rowId = generateRowId();
    const lvl = Number(spell.level);
    const prefix = lvl === 0 ? 'cantrip' : `level${lvl}`;
    const spellKey = `repeating_spell-${prefix}_${rowId}`;

    attribs.push({ name: `${spellKey}_spellname`, current: spell.name });
    attribs.push({ name: `${spellKey}_spelldescription`, current: spell.desc || '' });
    attribs.push({ name: `${spellKey}_spelllevel`, current: lvl === 0 ? 'cantrip' : lvl.toString() });

    // Try to get detailed spell data from Dexie
    let spellData: any = null;
    try {
      let spellDbEntry = await db.fiveetools.get(`spell:${spell.name.toLowerCase().replace(/\s+/g, '-')}-${spell.source.toLowerCase()}`);
      if (!spellDbEntry) {
        spellDbEntry = await db.fiveetools.where('name').equalsIgnoreCase(spell.name).first();
      }
      if (spellDbEntry) {
        spellData = spellDbEntry.data;
      }
    } catch (e) {
      console.warn(`Could not fetch details for spell ${spell.name}:`, e);
    }

    let castingTime = '1 action';
    let range = 'Self';
    let duration = 'Instantaneous';
    let concentration = '';
    let ritual = '';
    let componentsV = 0;
    let componentsS = 0;
    let componentsM = 0;
    let materials = '';
    let school = 'evocation';

    if (spellData) {
      // 1. Casting time
      if (spellData.time && Array.isArray(spellData.time) && spellData.time[0]) {
        castingTime = `${spellData.time[0].number} ${spellData.time[0].unit}`;
      }

      // 2. Range
      if (spellData.range) {
        const r = spellData.range;
        if (r.type === 'self') range = 'Self';
        else if (r.type === 'special') range = 'Special';
        else if (r.distance) {
          const dist = r.distance;
          if (dist.type === 'feet') range = `${dist.amount} feet`;
          else if (dist.type === 'touch') range = 'Touch';
          else if (dist.type === 'sight') range = 'Sight';
          else if (dist.type === 'unlimited') range = 'Unlimited';
          else if (dist.type === 'miles') range = `${dist.amount} mile${dist.amount > 1 ? 's' : ''}`;
        }
      }

      // 3. Duration & Concentration
      if (spellData.duration && Array.isArray(spellData.duration) && spellData.duration[0]) {
        const d = spellData.duration[0];
        if (d.type === 'instant') duration = 'Instantaneous';
        else if (d.type === 'permanent') duration = 'Permanent';
        else if (d.type === 'timed' && d.duration) {
          duration = `${d.duration.amount} ${d.duration.type}${d.duration.amount > 1 ? 's' : ''}`;
          if (d.concentration) {
            concentration = 'Concentration';
            duration = `Concentration, up to ${duration}`;
          }
        }
      }

      // 4. Ritual
      if (spellData.meta?.ritual) ritual = 'Ritual';

      // 5. Components
      if (spellData.components) {
        if (spellData.components.v) componentsV = 1;
        if (spellData.components.s) componentsS = 1;
        if (spellData.components.m) {
          componentsM = 1;
          materials = typeof spellData.components.m === 'string' 
            ? spellData.components.m 
            : (spellData.components.m.text || '');
        }
      }

      // 6. School mapping
      const schoolMapping: Record<string, string> = {
        'A': 'abjuration',
        'C': 'conjuration',
        'D': 'divination',
        'E': 'enchantment',
        'V': 'evocation',
        'I': 'illusion',
        'N': 'necromancy',
        'T': 'transmutation'
      };
      if (spellData.school) {
        school = schoolMapping[spellData.school.toUpperCase()] || 'evocation';
      }
    }

    attribs.push({ name: `${spellKey}_spellcastingtime`, current: castingTime });
    attribs.push({ name: `${spellKey}_spellrange`, current: range });
    attribs.push({ name: `${spellKey}_spellduration`, current: duration });
    attribs.push({ name: `${spellKey}_spellconcentration`, current: concentration });
    attribs.push({ name: `${spellKey}_spellritual`, current: ritual });
    attribs.push({ name: `${spellKey}_spellschool`, current: school });
    attribs.push({ name: `${spellKey}_spellcomp_v`, current: componentsV ? '{{v=1}}' : 0 });
    attribs.push({ name: `${spellKey}_spellcomp_s`, current: componentsS ? '{{s=1}}' : 0 });
    attribs.push({ name: `${spellKey}_spellcomp_m`, current: componentsM ? '{{m=1}}' : 0 });
    attribs.push({ name: `${spellKey}_spellcomp_materials`, current: materials });
    attribs.push({ name: `${spellKey}_details-flag`, current: 0 });
    attribs.push({ name: `${spellKey}_options-flag`, current: 0 });

    // Output formatting heuristic
    let spelloutput = 'SPELLCARD';
    const textToSearch = ((spell.name || '') + ' ' + (spell.desc || '')).toLowerCase();
    if (lvl > 0 && (
      textToSearch.includes('damage') ||
      textToSearch.includes('heal') ||
      textToSearch.includes('wounds') ||
      textToSearch.includes('smite') ||
      textToSearch.includes('restore') ||
      textToSearch.includes('blast') ||
      textToSearch.includes('bolt') ||
      textToSearch.includes('missile')
    )) {
      spelloutput = 'ATTACK';
    }
    attribs.push({ name: `${spellKey}_spelloutput`, current: spelloutput });
  }

  return {
    schema_version: 3,
    name: character.name,
    avatar: character.portraitUrl?.startsWith('http') ? character.portraitUrl : '',
    attribs,
    abilities: []
  };
}

function getSourceString(source: any): string {
  if (!source) return '';
  if (typeof source === 'string') return source;
  if (typeof source === 'object') {
    const val = source.book || source.value || source.custom || source.long || source.short || '';
    return val.toString();
  }
  return source.toString();
}

const standardClasses = [
  'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 
  'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard', 
  'artificer', 'blood hunter', 'bloodhunter'
];

function parseClassString(displayStr: string): { name: string; level: number; subclass?: string }[] {
  const parsed: { name: string; level: number; subclass?: string }[] = [];
  const parts = displayStr.split(/[,/]/);
  
  parts.forEach(part => {
    const trimmed = part.trim();
    if (!trimmed) return;
    
    let nameWithSubclass = trimmed;
    let level = 1;
    
    const match = trimmed.match(/^(.*?)\s+(\d+)$/);
    if (match) {
      nameWithSubclass = match[1].trim();
      level = parseInt(match[2], 10);
    }
    
    let className = nameWithSubclass;
    let subclass = '';
    
    const nameLower = nameWithSubclass.toLowerCase();
    for (const stdClass of standardClasses) {
      const idx = nameLower.indexOf(stdClass);
      if (idx !== -1) {
        className = nameWithSubclass.substring(idx, idx + stdClass.length);
        subclass = nameWithSubclass.substring(0, idx).trim();
        break;
      }
    }
    
    parsed.push({
      name: className.charAt(0).toUpperCase() + className.slice(1),
      level,
      subclass: subclass || undefined
    });
  });
  
  return parsed;
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
    race: 'Human',
    languages: ['Common'],
    alignment: 'True Neutral',
    size: 'Medium',
    ruleset: '2014',
    resources: {},
    proficiencies: []
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
          source: getSourceString(item.system?.source) || 'Foundry VTT',
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
  const has2024Source = json.items?.some((i: any) => {
    const srcStr = getSourceString(i.system?.source).toLowerCase();
    return srcStr.includes('2024') || srcStr === 'xphb';
  });
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
    race: 'Human',
    languages: ['Common'],
    alignment: 'True Neutral',
    size: 'Medium',
    ruleset: '2014',
    resources: {},
    proficiencies: []
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
  // 1. Try parsing class_display or class_and_level first as it contains the full formatted multiclass details
  const classDisplay = getAttr('class_display') || getAttr('class_and_level');
  if (classDisplay) {
    const parsed = parseClassString(classDisplay);
    if (parsed.length > 0) {
      char.classes = parsed;
    }
  }

  // 2. Fallback to individual OGL sheet standard naming: class, base_level, subclass
  if (char.classes!.length === 0) {
    const class1 = getAttr('class');
    const level1 = Number(getAttr('base_level'));
    if (class1 && level1 && !class1.includes(',') && !class1.includes('/')) {
      char.classes!.push({
        name: class1,
        level: level1,
        subclass: getAttr('subclass') || ''
      });
      
      for (let i = 1; i <= 3; i++) {
        const mcName = getAttr(`multiclass${i}`);
        const mcLvl = Number(getAttr(`multiclass${i}_lvl`));
        if (mcName && mcLvl) {
          char.classes!.push({
            name: mcName,
            level: mcLvl,
            subclass: getAttr(`multiclass${i}_subclass`) || ''
          });
        }
      }
    }
  }

  // 3. Fallback to custom format class_1, level_1, subclass_1
  if (char.classes!.length === 0) {
    let idx = 1;
    while (true) {
      const clsName = getAttr(`class_${idx}`) || getAttr(`class${idx}`);
      const level = Number(getAttr(`level_${idx}`) || getAttr(`level${idx}`));
      if (!clsName) break;
      const subclass = getAttr(`subclass_${idx}`) || getAttr(`subclass${idx}`) || '';
      char.classes!.push({ name: clsName, level: level || 1, subclass });
      idx++;
    }
  }

  // 4. Ultimate fallback: single class attribute (e.g. just "class" without base_level)
  if (char.classes!.length === 0) {
    const fallbackClass = getAttr('class');
    if (fallbackClass) {
      const parsed = parseClassString(fallbackClass);
      if (parsed.length > 0) {
        char.classes = parsed;
      }
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
