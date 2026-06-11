import { useState } from 'react';
import { ChevronLeft, Edit3, Sun, Moon, Share2 } from 'lucide-react';
import type { CharacterType } from '../../lib/schemas';
import { db } from '../../lib/db';
import { CharacterImage } from '../builder/CharacterImage';
import { session, encryptData, encodeShareData } from '../../lib/security';

interface Props {
  character: CharacterType;
  onBack: () => void;
  onEdit: () => void;
  isSharedReadOnly?: boolean;
}

export function CharacterSheet({ character, onBack, onEdit, isSharedReadOnly = false }: Props) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || saved === null;
  });
  const toggleTheme = () => {
    const val = document.body.classList.toggle('dark');
    localStorage.setItem('theme', val ? 'dark' : 'light');
    setIsDark(val);
  };

  const getModifier = (score: number) => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : mod;
  };

  const getModNum = (score: number) => Math.floor((score - 10) / 2);

  const totalLevel = character.classes ? character.classes.reduce((acc: number, c: any) => acc + (Number(c.level) || 0), 0) : (Number(character.level) || 1);
  const proficiencyBonus = Math.floor((totalLevel - 1) / 4) + 2;

  const stats = character.stats as Record<string, number>;

  // Basic equipment data for calculations
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
  };

  const inventoryList = character.inventory || [];
  const inventoryLower = inventoryList.map(i => (typeof i === 'string' ? i : i.name).toLowerCase());

  // Calculate AC
  let ac = 10 + getModNum(stats.dexterity);
  const equippedArmor = inventoryLower.find(item => ARMOR_DATA[item]);
  if (equippedArmor) {
    const armor = ARMOR_DATA[equippedArmor];
    ac = armor.base;
    if (armor.dexMod) {
      let dexMod = getModNum(stats.dexterity);
      if (armor.maxDex !== undefined) dexMod = Math.min(dexMod, armor.maxDex);
      ac += dexMod;
    }
  }
  if (inventoryLower.includes('shield')) {
    ac += 2;
  }

  // Defense Fighting Style
  if (character.resources?.fightingStyle === 'Defense' && equippedArmor) {
    ac += 1;
  }

  // Spell slots tables
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

  // Multiclass spell caster calculations
  const classesList = character.classes || [];
  let warlockLevel = 0;
  let casterLevel = 0;
  let paladinLevel = 0;
  let clericLevel = 0;
  let sorcererLevel = 0;
  let druidLevel = 0;
  let monkLevel = 0;

  classesList.forEach((c: any) => {
    const name = c.name.toLowerCase();
    const lvl = Number(c.level) || 0;
    
    if (name === 'warlock') {
      warlockLevel = lvl;
    } else if (['cleric', 'druid', 'bard', 'sorcerer', 'wizard'].includes(name)) {
      casterLevel += lvl;
      if (name === 'cleric') clericLevel = lvl;
      if (name === 'druid') druidLevel = lvl;
      if (name === 'sorcerer') sorcererLevel = lvl;
    } else if (['paladin', 'ranger'].includes(name)) {
      casterLevel += Math.floor(lvl / 2);
      if (name === 'paladin') paladinLevel = lvl;
    } else if (['monk'].includes(name)) {
      monkLevel = lvl;
    } else if (['fighter', 'rogue'].includes(name)) {
      const sub = c.subclass?.toLowerCase() || '';
      if (sub.includes('eldritch knight') || sub.includes('arcane trickster')) {
        casterLevel += Math.floor(lvl / 3);
      }
    }
  });

  const maxSlots = SPELL_SLOTS_TABLE[casterLevel] || [];
  
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

  // Calculate resource limits
  const chaMod = getModNum(stats.charisma);
  const divineSenseMax = paladinLevel >= 1 ? Math.max(1, 1 + chaMod) : 0;
  
  let channelDivinityMax = 0;
  if (clericLevel >= 2 || paladinLevel >= 3) {
    if (clericLevel >= 18) channelDivinityMax = 3;
    else if (clericLevel >= 6) channelDivinityMax = 2;
    else channelDivinityMax = 1;
  }
  
  const layOnHandsMax = paladinLevel * 5;
  const sorceryPointsMax = sorcererLevel >= 2 ? sorcererLevel : 0;
  const wildShapeMax = druidLevel >= 2 ? 2 : 0;
  const kiPointsMax = monkLevel >= 2 ? monkLevel : 0;

  // DB update handlers
  const saveCharacter = async (updated: CharacterType) => {
    if (session.key && session.username) {
      const plainText = JSON.stringify(updated);
      const { ciphertextHex, ivHex } = await encryptData(plainText, session.key);
      await db.encrypted_characters.put({
        id: updated.id,
        username: session.username,
        ciphertextHex,
        ivHex,
        lastModified: Date.now()
      });
    } else {
      await db.characters.put(updated);
    }
  };

  const [shareSuccess, setShareSuccess] = useState(false);

  const handleShareClick = async () => {
    try {
      const payload = await encodeShareData(character);
      const shareUrl = `${window.location.origin}${window.location.pathname}?share=${payload}`;
      navigator.clipboard.writeText(shareUrl);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to generate share link", err);
      alert("Failed to generate share link.");
    }
  };

  const updateResource = async (key: string, value: any) => {
    const updated = {
      ...character,
      resources: {
        ...character.resources,
        [key]: value
      }
    };
    await saveCharacter(updated);
  };

  const setSpellSlotsUsed = async (level: number, usedCount: number) => {
    const spellSlotsUsed = { ...(character.resources?.spellSlotsUsed || {}) };
    spellSlotsUsed[level] = Math.max(0, usedCount);
    await updateResource('spellSlotsUsed', spellSlotsUsed);
  };

  const setPactSlotsUsed = async (usedCount: number) => {
    await updateResource('pactSlotsUsed', Math.max(0, usedCount));
  };

  const handleShortRest = async () => {
    const updatedResources = { ...character.resources };
    updatedResources.channelDivinityUsed = 0;
    updatedResources.kiPointsUsed = 0;
    updatedResources.wildShapeUsed = 0;
    updatedResources.pactSlotsUsed = 0;
    const updated = {
      ...character,
      resources: updatedResources
    };
    await saveCharacter(updated);
    alert('Short Rest taken! Channel Divinity, Ki, Wild Shape, and Pact Magic slots have been restored.');
  };

  const handleLongRest = async () => {
    const updatedResources = { ...character.resources };
    updatedResources.divineSenseUsed = 0;
    updatedResources.channelDivinityUsed = 0;
    updatedResources.layOnHandsUsed = 0;
    updatedResources.sorceryPointsUsed = 0;
    updatedResources.wildShapeUsed = 0;
    updatedResources.kiPointsUsed = 0;
    updatedResources.pactSlotsUsed = 0;
    updatedResources.spellSlotsUsed = {};
    const updated = {
      ...character,
      hp: {
        ...character.hp,
        current: character.hp.max
      },
      resources: updatedResources
    };
    await saveCharacter(updated);
    alert('Long Rest taken! HP, spell slots, and all class resources have been fully restored.');
  };

  // Calculate Attacks
  const attacks = inventoryLower
    .filter(item => WEAPON_DATA[item])
    .map(item => {
      const weapon = WEAPON_DATA[item];
      const isFinesse = weapon.prop.includes('finesse');
      const isRanged = weapon.prop.includes('range');
      
      const strMod = getModNum(stats.strength);
      const dexMod = getModNum(stats.dexterity);
      
      let attackStatMod = strMod;
      if (isRanged) attackStatMod = dexMod;
      else if (isFinesse) attackStatMod = Math.max(strMod, dexMod);

      const atkBonus = attackStatMod + proficiencyBonus; // Assuming proficiency for simplicity
      const dmgBonus = attackStatMod;

      return {
        name: item.charAt(0).toUpperCase() + item.slice(1),
        bonus: atkBonus >= 0 ? `+${atkBonus}` : `${atkBonus}`,
        damage: `${weapon.dmg}${dmgBonus !== 0 ? (dmgBonus > 0 ? `+${dmgBonus}` : dmgBonus) : ''} ${weapon.type}`
      };
    });

  const getSpellcastingStat = (className?: string) => {
    const cls = className?.toLowerCase() || '';
    if (['cleric', 'druid', 'ranger'].includes(cls)) return 'wisdom';
    if (['wizard', 'artificer'].includes(cls)) return 'intelligence';
    if (['sorcerer', 'warlock', 'paladin', 'bard'].includes(cls)) return 'charisma';
    
    // Fallback: pick the highest mod among Int, Wis, Cha
    const intMod = getModNum(stats.intelligence);
    const wisMod = getModNum(stats.wisdom);
    const chaMod = getModNum(stats.charisma);
    if (intMod >= wisMod && intMod >= chaMod) return 'intelligence';
    if (wisMod >= intMod && wisMod >= chaMod) return 'wisdom';
    return 'charisma';
  };

  // Helper to extract damage spells as attacks
  const spellAttacks = (character.spells || [])
    .map((s: any) => {
      const desc = s.desc || '';
      const text = desc.toLowerCase();
      
      const dmgTypes = ['fire', 'cold', 'lightning', 'thunder', 'acid', 'poison', 'force', 'necrotic', 'radiant', 'psychic', 'bludgeoning', 'piercing', 'slashing'];
      const foundType = dmgTypes.find(t => text.includes(t));
      
      const diceRegex = /(\d+d\d+)/;
      const diceMatch = desc.match(diceRegex);
      
      if (foundType && diceMatch) {
        const dice = diceMatch[1];
        
        const statKey = getSpellcastingStat(s.class);
        const spellcastingMod = getModNum(stats[statKey]);
        const atkBonus = spellcastingMod + proficiencyBonus;
        const saveDc = 8 + spellcastingMod + proficiencyBonus;
        
        let bonusText = '';
        if (text.includes('spell attack') || text.includes('attack roll')) {
          bonusText = atkBonus >= 0 ? `+${atkBonus}` : `${atkBonus}`;
        } else {
          const saveTypes = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
          const saveAbbr: Record<string, string> = {
            strength: 'STR', dexterity: 'DEX', constitution: 'CON',
            intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA'
          };
          const foundSave = saveTypes.find(t => text.includes(`${t} saving throw`) || text.includes(`${t} save`));
          if (foundSave) {
            bonusText = `DC ${saveDc} ${saveAbbr[foundSave]}`;
          } else {
            bonusText = `DC ${saveDc}`;
          }
        }
        
        return {
          name: s.name,
          bonus: bonusText,
          damage: `${dice} ${foundType}`
        };
      }
      return null;
    })
    .filter((s: any): s is { name: string; bonus: string; damage: string } => s !== null);

  const allAttacks = [...attacks, ...spellAttacks];

  const skillMapping: Record<string, string> = {
    'Acrobatics': 'dexterity',
    'Animal Handling': 'wisdom',
    'Arcana': 'intelligence',
    'Athletics': 'strength',
    'Deception': 'charisma',
    'History': 'intelligence',
    'Insight': 'wisdom',
    'Intimidation': 'charisma',
    'Investigation': 'intelligence',
    'Medicine': 'wisdom',
    'Nature': 'intelligence',
    'Perception': 'wisdom',
    'Performance': 'charisma',
    'Persuasion': 'charisma',
    'Religion': 'intelligence',
    'Sleight of Hand': 'dexterity',
    'Stealth': 'dexterity',
    'Survival': 'wisdom'
  };

  return (
    <div className="max-w-5xl w-full bg-parchment-light p-8 md:p-10 paper-shadow classic-border relative parchment-texture">
      <div className="absolute top-4 left-4 right-4 flex justify-between no-print">
        <button 
          onClick={onBack}
          className="text-dnd-red hover:text-ink flex items-center gap-1 font-bold uppercase text-xs cursor-pointer"
        >
          <ChevronLeft size={16} /> Dashboard
        </button>
        <div className="flex gap-4 items-center">
          <button 
            onClick={toggleTheme}
            className="text-dnd-gold hover:text-ink flex items-center gap-1 font-bold uppercase text-xs cursor-pointer"
            title="Toggle Theme"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
            {isDark ? 'Light' : 'Dark'}
          </button>
          <button 
            onClick={handleShareClick}
            className="text-dnd-gold hover:text-ink flex items-center gap-1 font-bold uppercase text-xs cursor-pointer"
            title="Copy share link to clipboard"
          >
            {shareSuccess ? (
              <span className="text-fel-green animate-pulse">Copied Link!</span>
            ) : (
              <>
                <Share2 size={16} /> Share
              </>
            )}
          </button>
          {!isSharedReadOnly && (
            <button 
              onClick={onEdit}
              className="text-dnd-gold hover:text-ink flex items-center gap-1 font-bold uppercase text-xs cursor-pointer"
            >
              <Edit3 size={16} /> Edit Hero
            </button>
          )}
        </div>
      </div>

      {/* Header Info */}
      <header className="border-b-4 border-double border-dnd-red pb-4 mb-8 mt-6">
        <div className="flex flex-col md:flex-row gap-6 items-center md:items-stretch">
          {character.portraitUrl && (
            <div className="w-20 h-24 border-2 border-dnd-red overflow-hidden bg-parchment-light shadow-sm rounded flex-shrink-0 relative self-center">
              <CharacterImage src={character.portraitUrl} alt={character.name} className="h-full w-full object-cover" />
            </div>
          )}
          {character.tokenUrl && !character.portraitUrl && (
            <div className="w-20 h-20 border-2 border-dnd-red rounded-full overflow-hidden bg-parchment-light shadow-sm flex-shrink-0 flex items-center justify-center relative self-center">
              <CharacterImage src={character.tokenUrl} alt={character.name} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="flex-grow">
            <h1 className="text-5xl uppercase tracking-tighter text-dnd-red border-b border-dnd-gold/30 flex items-center gap-3">
              {character.tokenUrl && character.portraitUrl && (
                <div className="w-8 h-8 rounded-full border border-dnd-gold overflow-hidden bg-parchment-light shadow-sm flex-shrink-0 inline-block align-middle">
                  <CharacterImage src={character.tokenUrl} alt="Token" className="h-full w-full object-cover" />
                </div>
              )}
              {character.name}
            </h1>
            <p className="text-xs font-bold uppercase text-dnd-gold mt-1">Character Name</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-[10px] font-bold uppercase bg-parchment-base p-4 border border-border-sepia shadow-inner flex-grow">
            <div className="border-b border-border-sepia">
              <div className="text-ink">
                {character.classes 
                  ? character.classes.map((c: any) => `${c.name}${c.subclass ? ` (${c.subclass})` : ''} ${c.level}`).join(' / ')
                  : `${character.class}${character.subclass ? ` (${character.subclass})` : ''} ${character.level}`
                }
              </div>
              <div className="text-dnd-gold">Class & Level</div>
            </div>
            <div className="border-b border-border-sepia">
              <div className="text-ink">{character.background || 'Unknown'}</div>
              <div className="text-dnd-gold">Background</div>
            </div>
            <div className="border-b border-border-sepia">
               <div className="text-ink">{character.creator || 'Local Player'}</div>
               <div className="text-dnd-gold">Player Name</div>
            </div>
            <div className="border-b border-border-sepia">
              <div className="text-ink">{character.race}</div>
              <div className="text-dnd-gold">Race</div>
            </div>
            <div className="border-b border-border-sepia">
              <div className="text-ink">{character.size || 'Medium'}</div>
              <div className="text-dnd-gold">Size</div>
            </div>
            <div className="border-b border-border-sepia">
              <div className="text-ink">{character.alignment || 'True Neutral'}</div>
              <div className="text-dnd-gold">Alignment</div>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Column 1: Attributes & Skills */}
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="flex flex-col gap-3">
              {Object.entries(character.stats).map(([ability, score]) => (
                <div key={ability} className="relative w-20 h-24 border-2 border-dnd-red bg-parchment-light rounded-xl flex flex-col items-center justify-center shadow-sm">
                  <div className="text-[10px] font-bold uppercase text-dnd-red absolute top-1">{ability.substring(0, 3)}</div>
                  <div className="text-3xl font-bold mt-1">{getModifier(score)}</div>
                  <div className="absolute -bottom-2 border border-dnd-red bg-parchment-light rounded-full px-2 text-xs font-bold w-12 text-center">
                    {score}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex-grow space-y-4">
               <div className="flex items-center gap-2 border border-border-sepia p-2 rounded bg-parchment-light shadow-sm">
                  <div className="h-8 w-8 border border-dnd-red flex items-center justify-center font-bold text-lg italic">0</div>
                  <div className="text-[10px] font-bold uppercase text-dnd-gold leading-tight">Inspiration</div>
               </div>
               <div className="flex items-center gap-2 border border-border-sepia p-2 rounded bg-parchment-light shadow-sm">
                  <div className="h-8 w-8 border border-dnd-red flex items-center justify-center font-bold text-lg">+{proficiencyBonus}</div>
                  <div className="text-[10px] font-bold uppercase text-dnd-gold leading-tight">Proficiency Bonus</div>
               </div>
               
               <div className="border border-border-sepia p-3 bg-parchment-light rounded shadow-sm">
                  <h3 className="text-[10px] font-bold uppercase text-dnd-gold border-b border-dnd-gold/30 mb-2">Saving Throws</h3>
                  <div className="space-y-1 text-xs">
                    {Object.keys(character.stats).map(s => (
                      <div key={s} className="flex items-center gap-2">
                        <div className="h-3 w-3 border border-border-sepia rounded-full"></div>
                        <span className="w-6 text-center border-b border-border-sepia">{getModifier(stats[s.toLowerCase()])}</span>
                        <span className="capitalize">{s}</span>
                      </div>
                    ))}
                  </div>
               </div>

                <div className="border border-border-sepia p-3 bg-parchment-light rounded shadow-sm">
                  <h3 className="text-[10px] font-bold uppercase text-dnd-gold border-b border-dnd-gold/30 mb-2 text-center">Skills</h3>
                  <div className="space-y-1 text-xs">
                    {Object.entries(skillMapping).map(([skill, ability]) => {
                      const isProficient = character.proficiencies?.includes(skill);
                      const baseMod = Math.floor((stats[ability] - 10) / 2);
                      const totalMod = isProficient ? baseMod + proficiencyBonus : baseMod;
                      const displayMod = totalMod >= 0 ? `+${totalMod}` : totalMod;
                      
                      return (
                        <div key={skill} className="flex items-center gap-2">
                          <div className={`h-2 w-2 border border-border-sepia rounded-full flex-shrink-0 ${isProficient ? 'bg-dnd-red border-dnd-red' : ''}`}></div>
                          <span className="w-5 text-center border-b border-border-sepia flex-shrink-0">{displayMod}</span>
                          <span className="truncate">{skill} <span className="text-[8px] opacity-40 italic">({ability.substring(0, 3)})</span></span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

         

        {/* Column 2: Combat & HP */}
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-2">
            <div className="border-2 border-dnd-red bg-parchment-light p-2 rounded-lg text-center shadow-sm">
              <div className="text-[8px] font-bold uppercase text-dnd-gold">Armor Class</div>
              <div className="text-3xl font-bold">{ac}</div>
            </div>
            <div className="border-2 border-dnd-red bg-parchment-light p-2 rounded-lg text-center shadow-sm">
              <div className="text-[8px] font-bold uppercase text-dnd-gold">Initiative</div>
              <div className="text-3xl font-bold">{getModifier(character.stats.dexterity)}</div>
            </div>
            <div className="border-2 border-dnd-red bg-parchment-light p-2 rounded-lg text-center shadow-sm">
              <div className="text-[8px] font-bold uppercase text-dnd-gold">Speed</div>
              <div className="text-3xl font-bold">30ft</div>
            </div>
          </div>

          <div className="border-2 border-dnd-red rounded-lg overflow-hidden bg-parchment-light shadow-sm">
             <div className="bg-parchment-base border-b border-dnd-red p-1 text-center text-[8px] font-bold uppercase text-dnd-gold flex justify-between px-4">
                <span>Hit Point Maximum</span>
                <span className="text-ink">{character.hp.max}</span>
             </div>
             <div className="p-4 text-center">
                <div className="text-4xl font-bold">{character.hp.current}</div>
                <div className="text-[8px] font-bold uppercase text-ink/30 mt-1">Current Hit Points</div>
             </div>
          </div>

          <div className="border-2 border-border-sepia rounded-lg p-2 bg-parchment-light text-center italic text-xs text-ink/40 shadow-sm">
             Temporary Hit Points
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="border border-border-sepia rounded p-2 bg-parchment-light shadow-sm">
                <div className="text-[8px] font-bold uppercase text-dnd-gold border-b border-border-sepia mb-1">Hit Dice</div>
                <div className="text-center py-2 font-bold">1d10</div>
             </div>
             <div className="border border-border-sepia rounded p-2 bg-parchment-light shadow-sm">
                <div className="text-[8px] font-bold uppercase text-dnd-gold border-b border-border-sepia mb-1">Death Saves</div>
                <div className="flex flex-col gap-1 items-center py-1">
                   <div className="flex gap-1">
                      <span className="text-[6px] uppercase font-bold w-12 text-right">Successes</span>
                      {[1,2,3].map(i => <div key={i} className="h-2 w-2 border border-border-sepia rounded-full"></div>)}
                   </div>
                   <div className="flex gap-1">
                      <span className="text-[6px] uppercase font-bold w-12 text-right">Failures</span>
                      {[1,2,3].map(i => <div key={i} className="h-2 w-2 border border-border-sepia rounded-full"></div>)}
                   </div>
                </div>
             </div>
          </div>

          {/* Resting & Resources Card */}
          <div className="border border-border-sepia p-4 bg-parchment-light rounded shadow-sm space-y-4">
             <div className="flex justify-between items-center border-b border-dnd-gold/30 pb-1">
                <h3 className="text-xs font-bold uppercase text-dnd-red">Resting & Resources</h3>
                {!isSharedReadOnly && (
                   <div className="flex gap-2">
                      <button 
                        onClick={handleShortRest}
                        className="px-2 py-0.5 border border-dnd-gold/50 hover:bg-dnd-gold hover:text-white rounded text-[8px] font-bold uppercase tracking-wider transition-colors cursor-pointer bg-parchment-base text-ink"
                      >
                        Short Rest
                      </button>
                      <button 
                        onClick={handleLongRest}
                        className="px-2 py-0.5 border border-dnd-red/50 hover:bg-dnd-red hover:text-white rounded text-[8px] font-bold uppercase tracking-wider transition-colors cursor-pointer bg-parchment-base text-ink"
                      >
                        Long Rest
                      </button>
                   </div>
                )}
             </div>

             {/* Class Resources Section */}
             {(divineSenseMax > 0 || channelDivinityMax > 0 || layOnHandsMax > 0 || sorceryPointsMax > 0 || wildShapeMax > 0 || kiPointsMax > 0) && (
                <div className="space-y-2">
                   <h4 className="text-[8px] font-bold uppercase text-dnd-gold tracking-widest border-b border-border-sepia/20 pb-0.5">Class Features</h4>
                   <div className="grid grid-cols-1 gap-2 text-xs">
                      {divineSenseMax > 0 && (
                         <div className="flex justify-between items-center">
                            <span className="font-serif text-[10px]">Divine Sense</span>
                            <div className="flex items-center gap-2">
                               {!isSharedReadOnly && (
                                 <button 
                                   disabled={(character.resources?.divineSenseUsed || 0) <= 0}
                                   onClick={() => updateResource('divineSenseUsed', Math.max(0, (character.resources?.divineSenseUsed || 0) - 1))}
                                   className="w-4 h-4 border border-border-sepia rounded flex items-center justify-center font-bold hover:border-dnd-red disabled:opacity-30 cursor-pointer text-[10px]"
                                 >-</button>
                               )}
                               <span className="w-8 text-center font-bold text-[10px]">{divineSenseMax - (character.resources?.divineSenseUsed || 0)} / {divineSenseMax}</span>
                               {!isSharedReadOnly && (
                                 <button 
                                   disabled={(character.resources?.divineSenseUsed || 0) >= divineSenseMax}
                                   onClick={() => updateResource('divineSenseUsed', (character.resources?.divineSenseUsed || 0) + 1)}
                                   className="w-4 h-4 border border-border-sepia rounded flex items-center justify-center font-bold hover:border-dnd-red disabled:opacity-30 cursor-pointer text-[10px]"
                                 >+</button>
                               )}
                            </div>
                         </div>
                      )}
                      
                      {channelDivinityMax > 0 && (
                         <div className="flex justify-between items-center">
                            <span className="font-serif text-[10px]">Channel Divinity</span>
                            <div className="flex items-center gap-2">
                               {!isSharedReadOnly && (
                                 <button 
                                   disabled={(character.resources?.channelDivinityUsed || 0) <= 0}
                                   onClick={() => updateResource('channelDivinityUsed', Math.max(0, (character.resources?.channelDivinityUsed || 0) - 1))}
                                   className="w-4 h-4 border border-border-sepia rounded flex items-center justify-center font-bold hover:border-dnd-red disabled:opacity-30 cursor-pointer text-[10px]"
                                 >-</button>
                               )}
                               <span className="w-8 text-center font-bold text-[10px]">{channelDivinityMax - (character.resources?.channelDivinityUsed || 0)} / {channelDivinityMax}</span>
                               {!isSharedReadOnly && (
                                 <button 
                                   disabled={(character.resources?.channelDivinityUsed || 0) >= channelDivinityMax}
                                   onClick={() => updateResource('channelDivinityUsed', (character.resources?.channelDivinityUsed || 0) + 1)}
                                   className="w-4 h-4 border border-border-sepia rounded flex items-center justify-center font-bold hover:border-dnd-red disabled:opacity-30 cursor-pointer text-[10px]"
                                 >+</button>
                               )}
                            </div>
                         </div>
                      )}

                      {layOnHandsMax > 0 && (
                         <div className="flex justify-between items-center">
                            <span className="font-serif text-[10px]">Lay on Hands Pool</span>
                            <div className="flex items-center gap-1">
                               <input 
                                 type="number"
                                 min="0"
                                 max={layOnHandsMax}
                                 disabled={isSharedReadOnly}
                                 className="w-12 bg-parchment-base border border-border-sepia p-1 text-[10px] text-center rounded text-ink focus:outline-none focus:border-dnd-red"
                                 value={layOnHandsMax - (character.resources?.layOnHandsUsed || 0)}
                                 onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (!isNaN(val)) {
                                       updateResource('layOnHandsUsed', Math.max(0, Math.min(layOnHandsMax, layOnHandsMax - val)));
                                    }
                                 }}
                               />
                               <span className="text-[10px] opacity-50">/ {layOnHandsMax} HP</span>
                            </div>
                         </div>
                      )}

                      {sorceryPointsMax > 0 && (
                         <div className="flex justify-between items-center">
                            <span className="font-serif text-[10px]">Sorcery Points</span>
                            <div className="flex items-center gap-2">
                               {!isSharedReadOnly && (
                                 <button 
                                   disabled={(character.resources?.sorceryPointsUsed || 0) <= 0}
                                   onClick={() => updateResource('sorceryPointsUsed', Math.max(0, (character.resources?.sorceryPointsUsed || 0) - 1))}
                                   className="w-4 h-4 border border-border-sepia rounded flex items-center justify-center font-bold hover:border-dnd-red disabled:opacity-30 cursor-pointer text-[10px]"
                                 >-</button>
                               )}
                               <span className="w-8 text-center font-bold text-[10px]">{sorceryPointsMax - (character.resources?.sorceryPointsUsed || 0)} / {sorceryPointsMax}</span>
                               {!isSharedReadOnly && (
                                 <button 
                                   disabled={(character.resources?.sorceryPointsUsed || 0) >= sorceryPointsMax}
                                   onClick={() => updateResource('sorceryPointsUsed', (character.resources?.sorceryPointsUsed || 0) + 1)}
                                   className="w-4 h-4 border border-border-sepia rounded flex items-center justify-center font-bold hover:border-dnd-red disabled:opacity-30 cursor-pointer text-[10px]"
                                 >+</button>
                               )}
                            </div>
                         </div>
                      )}

                      {wildShapeMax > 0 && (
                         <div className="flex justify-between items-center">
                            <span className="font-serif text-[10px]">Wild Shape</span>
                            <div className="flex items-center gap-2">
                               {!isSharedReadOnly && (
                                 <button 
                                   disabled={(character.resources?.wildShapeUsed || 0) <= 0}
                                   onClick={() => updateResource('wildShapeUsed', Math.max(0, (character.resources?.wildShapeUsed || 0) - 1))}
                                   className="w-4 h-4 border border-border-sepia rounded flex items-center justify-center font-bold hover:border-dnd-red disabled:opacity-30 cursor-pointer text-[10px]"
                                 >-</button>
                               )}
                               <span className="w-8 text-center font-bold text-[10px]">{wildShapeMax - (character.resources?.wildShapeUsed || 0)} / {wildShapeMax}</span>
                               {!isSharedReadOnly && (
                                 <button 
                                   disabled={(character.resources?.wildShapeUsed || 0) >= wildShapeMax}
                                   onClick={() => updateResource('wildShapeUsed', (character.resources?.wildShapeUsed || 0) + 1)}
                                   className="w-4 h-4 border border-border-sepia rounded flex items-center justify-center font-bold hover:border-dnd-red disabled:opacity-30 cursor-pointer text-[10px]"
                                 >+</button>
                               )}
                            </div>
                         </div>
                      )}

                      {kiPointsMax > 0 && (
                         <div className="flex justify-between items-center">
                            <span className="font-serif text-[10px]">Ki Points</span>
                            <div className="flex items-center gap-2">
                               {!isSharedReadOnly && (
                                 <button 
                                   disabled={(character.resources?.kiPointsUsed || 0) <= 0}
                                   onClick={() => updateResource('kiPointsUsed', Math.max(0, (character.resources?.kiPointsUsed || 0) - 1))}
                                   className="w-4 h-4 border border-border-sepia rounded flex items-center justify-center font-bold hover:border-dnd-red disabled:opacity-30 cursor-pointer text-[10px]"
                                 >-</button>
                               )}
                               <span className="w-8 text-center font-bold text-[10px]">{kiPointsMax - (character.resources?.kiPointsUsed || 0)} / {kiPointsMax}</span>
                               {!isSharedReadOnly && (
                                 <button 
                                   disabled={(character.resources?.kiPointsUsed || 0) >= kiPointsMax}
                                   onClick={() => updateResource('kiPointsUsed', (character.resources?.kiPointsUsed || 0) + 1)}
                                   className="w-4 h-4 border border-border-sepia rounded flex items-center justify-center font-bold hover:border-dnd-red disabled:opacity-30 cursor-pointer text-[10px]"
                                 >+</button>
                               )}
                            </div>
                         </div>
                      )}
                   </div>
                </div>
             )}

             {/* Spell Slots Section */}
             {(maxSlots.length > 0 || warlockLevel > 0) && (
                <div className="space-y-2">
                   <h4 className="text-[8px] font-bold uppercase text-dnd-gold tracking-widest border-b border-border-sepia/20 pb-0.5">Spell Slots</h4>
                   <div className="space-y-1.5">
                      {/* Pact Magic Slots */}
                      {warlockLevel > 0 && pactMaxSlots > 0 && (() => {
                         const pactUsed = character.resources?.pactSlotsUsed || 0;
                         return (
                            <div className="flex items-center justify-between py-1 border-b border-border-sepia/10">
                               <span className="font-serif text-[10px] text-necrotic-purple font-bold">Pact Magic (Lvl {pactSlotLvl})</span>
                               <div className="flex gap-1.5">
                                  {Array.from({ length: pactMaxSlots }).map((_, i) => {
                                     const isUsed = i < pactUsed;
                                     return (
                                        <button
                                           key={i}
                                           onClick={() => !isSharedReadOnly && setPactSlotsUsed(isUsed ? i : i + 1)}
                                           className={`w-3.5 h-3.5 rounded-full border transition-all ${
                                              isSharedReadOnly ? 'cursor-default' : 'cursor-pointer'
                                           } ${
                                              isUsed 
                                                 ? 'bg-necrotic-purple border-necrotic-purple shadow-[0_0_8px_rgba(124,58,237,0.5)]' 
                                                 : 'border-border-sepia hover:border-necrotic-purple bg-transparent'
                                           }`}
                                           title={`Pact Slot ${i + 1}`}
                                        />
                                     );
                                  })}
                               </div>
                            </div>
                         );
                      })()}

                      {/* Standard Caster Slots */}
                      {maxSlots.map((max, index) => {
                         const level = index + 1;
                         const used = character.resources?.spellSlotsUsed?.[level] || 0;
                         return (
                            <div key={level} className="flex items-center justify-between py-1 border-b border-border-sepia/10">
                               <span className="font-serif text-[10px]">Level {level} Slots</span>
                               <div className="flex gap-1.5">
                                  {Array.from({ length: max }).map((_, i) => {
                                     const isUsed = i < used;
                                     return (
                                        <button
                                           key={i}
                                           onClick={() => setSpellSlotsUsed(level, isUsed ? i : i + 1)}
                                           className={`w-3.5 h-3.5 rounded-full border transition-all cursor-pointer ${
                                              isUsed 
                                                 ? 'bg-dnd-red border-dnd-red shadow-[0_0_8px_rgba(74,111,98,0.5)]' 
                                                 : 'border-border-sepia hover:border-dnd-red bg-transparent'
                                           }`}
                                           title={`Lvl ${level} Slot ${i + 1}`}
                                        />
                                     );
                                  })}
                               </div>
                            </div>
                         );
                      })}
                   </div>
                </div>
             )}
          </div>

          <div className="border border-border-sepia p-4 bg-parchment-light rounded shadow-sm min-h-[300px]">
             <h3 className="text-xs font-bold uppercase text-dnd-red border-b border-dnd-gold/30 mb-4 pb-1">Attacks & Spellcasting</h3>
             <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2 text-[8px] font-bold uppercase text-dnd-gold border-b border-border-sepia pb-1">
                   <div>Name</div>
                   <div>Atk Bonus</div>
                   <div>Damage/Type</div>
                </div>
                {allAttacks.length > 0 ? allAttacks.map((atk, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2 text-xs border-b border-border-sepia/30 pb-1">
                    <div className="font-bold truncate" title={atk.name}>{atk.name}</div>
                    <div className="text-center">{atk.bonus}</div>
                    <div className="truncate text-dnd-gold font-serif italic" title={atk.damage}>{atk.damage}</div>
                  </div>
                )) : (
                  <div className="text-[10px] italic text-ink/40 py-8 text-center">No attacks defined.</div>
                )}
             </div>
          </div>

          <div className="border border-border-sepia p-4 bg-parchment-light rounded shadow-sm flex-grow">
             <h3 className="text-xs font-bold uppercase text-dnd-red border-b border-dnd-gold/30 mb-4 pb-1">Equipment & Inventory</h3>
             <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="border border-border-sepia p-1 text-center">
                  <div className="text-[6px] uppercase font-bold text-dnd-gold">CP</div>
                  <div className="text-xs">0</div>
                </div>
                <div className="border border-border-sepia p-1 text-center">
                  <div className="text-[6px] uppercase font-bold text-dnd-gold">SP</div>
                  <div className="text-xs">0</div>
                </div>
                <div className="border border-border-sepia p-1 text-center">
                  <div className="text-[6px] uppercase font-bold text-dnd-gold">GP</div>
                  <div className="text-xs">0</div>
                </div>
                <div className="border border-border-sepia p-1 text-center">
                  <div className="text-[6px] uppercase font-bold text-dnd-gold">PP</div>
                  <div className="text-xs">0</div>
                </div>
             </div>
             <div className="space-y-1 text-[10px] min-h-[150px]">
                {character.inventory?.map((item, i) => (
                  <div key={i} className="border-b border-border-sepia/30 py-1 flex justify-between">
                    <span>{typeof item === 'string' ? item : item.name}</span>
                    <span className="opacity-30 italic">x{typeof item === 'string' ? 1 : (item.quantity || 1)}</span>
                  </div>
                ))}
                {(!character.inventory || character.inventory.length === 0) && (
                  <div className="italic text-ink/30 py-4 text-center">Empty inventory</div>
                )}
             </div>
          </div>
        </div>
{/* Column 3: Traits & Features */}
        <div className="space-y-6">
          <div className="border border-border-sepia p-4 bg-parchment-light rounded shadow-sm min-h-[400px]">
            <h3 className="text-xs font-bold uppercase text-dnd-red border-b border-dnd-gold/30 mb-4 pb-1">Features & Traits</h3>
            <div className="space-y-3 text-[10px]">
              {(() => {
                const uniqueTraits = new Map();
                character.traits?.forEach(trait => {
                  const name = typeof trait === 'string' ? trait : trait.name;
                  if (!uniqueTraits.has(name)) {
                    uniqueTraits.set(name, trait);
                  }
                });

                return Array.from(uniqueTraits.values()).map((trait, i) => {
                  const name = typeof trait === 'string' ? trait : trait.name;
                  const desc = typeof trait === 'string' ? '' : trait.desc;
                  
                  return (
                    <details key={i} className="border-b border-border-sepia/30 pb-1 group cursor-pointer">
                      <summary className="font-bold text-dnd-gold outline-none">{name}</summary>
                      {desc && <div className="mt-1 text-[8px] italic text-ink/70 leading-relaxed pr-2">{desc}</div>}
                    </details>
                  );
                });
              })()}
              {character.feats?.map((feat, i) => {
                if (!feat) return null;
                const name = typeof feat === 'string' ? feat : feat.name;
                const desc = typeof feat === 'string' ? '' : feat.desc;
                if (!name) return null;
                
                return (
                  <details key={`feat-${i}`} className="border-b border-border-sepia/30 pb-1 group cursor-pointer">
                    <summary className="font-bold text-necrotic-purple outline-none flex flex-col">
                       <span className="uppercase text-[8px] opacity-70">Feat / ASI</span>
                       <span className="text-ink">{name}</span>
                    </summary>
                    {desc && <div className="mt-1 text-[8px] italic text-ink/70 leading-relaxed pr-2">{desc}</div>}
                  </details>
                );
              })}
              {(!character.traits || character.traits.length === 0) && (!character.feats || character.feats.length === 0) && (
                <div className="italic text-ink/30 py-4 text-center">No features selected.</div>
              )}
            </div>
          </div>

          <div className="border border-border-sepia p-4 bg-parchment-light rounded shadow-sm min-h-[400px]">
            <h3 className="text-xs font-bold uppercase text-dnd-red border-b border-dnd-gold/30 mb-4 pb-1">Spells</h3>
            <div className="space-y-3 text-[10px]">
              {character.spells?.length > 0 ? (
                // Group by level
                [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => {
                  const levelSpells = character.spells.filter((s: any) => s.level === level);
                  if (levelSpells.length === 0) return null;
                  return (
                    <div key={level} className="space-y-1">
                      <div className="text-[8px] font-black uppercase text-dnd-gold bg-parchment-base px-2 py-0.5 border-b border-dnd-gold/30">
                        {level === 0 ? 'Cantrips' : `Level ${level}`}
                      </div>
                      {levelSpells.map((s: any, idx: number) => {
                        const isPreparedClass = s.class ? ['cleric', 'paladin', 'wizard', 'druid', 'artificer'].includes(s.class.toLowerCase()) : false;
                        const badgeText = s.isAlwaysPrepared 
                          ? 'always prepared' 
                          : s.level === 0 
                            ? 'cantrip' 
                            : isPreparedClass 
                              ? 'prepared' 
                              : 'learned';
                        
                        return (
                          <details key={idx} className="border-b border-border-sepia/20 pb-1 group cursor-pointer pl-1">
                            <summary className="font-bold text-ink outline-none flex items-center justify-between pr-2">
                              <span>
                                {s.name} {s.class && <span className="text-[7px] text-dnd-gold font-normal tracking-wide lowercase ml-1">({s.class})</span>}
                              </span>
                              <span className={`text-[6px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                s.isAlwaysPrepared 
                                  ? 'bg-[#e9d5ff] text-[#6b21a8] border-[#c084fc]/30' 
                                  : badgeText === 'prepared' 
                                    ? 'bg-[#dcfce7] text-[#166534] border-[#86efac]/30' 
                                    : 'bg-[#fef9c3] text-[#854d0e] border-[#fde047]/30'
                              }`}>
                                {badgeText}
                              </span>
                            </summary>
                            <div className="mt-1 text-[8px] italic text-ink/70 leading-relaxed pr-2">{s.desc}</div>
                          </details>
                        );
                      })}
                    </div>
                  );
                })
              ) : (
                <div className="italic text-ink/30 py-4 text-center">No spells prepared.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-12 pt-4 border-t border-border-sepia text-center text-[8px] text-ink/30 uppercase tracking-[0.4em]">
        D&D Character Vault - 5th Edition
      </footer>
    </div>
  );
}
