import { ChevronLeft, Edit3 } from 'lucide-react';
import type { CharacterType } from '../../lib/schemas';

interface Props {
  character: CharacterType;
  onBack: () => void;
  onEdit: () => void;
}

export function CharacterSheet({ character, onBack, onEdit }: Props) {
  const getModifier = (score: number) => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : mod;
  };

  const getModNum = (score: number) => Math.floor((score - 10) / 2);

  const proficiencyBonus = 2; // Default for lvl 1

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
  const inventoryLower = inventoryList.map(i => i.toLowerCase().replace(/ x\d+$/, ''));

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
        name: item,
        bonus: atkBonus >= 0 ? `+${atkBonus}` : `${atkBonus}`,
        damage: `${weapon.dmg}${dmgBonus !== 0 ? (dmgBonus > 0 ? `+${dmgBonus}` : dmgBonus) : ''} ${weapon.type}`
      };
    });

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
        <button 
          onClick={onEdit}
          className="text-dnd-gold hover:text-ink flex items-center gap-1 font-bold uppercase text-xs cursor-pointer"
        >
          <Edit3 size={16} /> Edit Hero
        </button>
      </div>

      {/* Header Info */}
      <header className="border-b-4 border-double border-dnd-red pb-4 mb-8 mt-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-grow">
            <h1 className="text-5xl uppercase tracking-tighter text-dnd-red border-b border-dnd-gold/30">{character.name}</h1>
            <p className="text-xs font-bold uppercase text-dnd-gold mt-1">Character Name</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-[10px] font-bold uppercase bg-parchment-base p-4 border border-border-sepia shadow-inner flex-grow">
            <div className="border-b border-border-sepia">
              <div className="text-ink">
                {character.classes 
                  ? `${character.classes[0].name}${character.classes[0].subclass ? ` (${character.classes[0].subclass})` : ''} ${character.classes.reduce((acc: number, c: any) => acc + (c.level || 0), 0)}`
                  : `${character.class}${character.subclass ? ` (${character.subclass})` : ''} ${character.level}`
                }
              </div>
              <div className="text-dnd-gold">Class & Level</div>
            </div>
            <div className="border-b border-border-sepia">
              <div className="text-ink">Unknown</div>
              <div className="text-dnd-gold">Background</div>
            </div>
            <div className="border-b border-border-sepia">
              <div className="text-ink">Player Name</div>
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
                <div key={ability} className="relative w-20 h-24 border-2 border-dnd-red bg-white rounded-xl flex flex-col items-center justify-center shadow-sm">
                  <div className="text-[10px] font-bold uppercase text-dnd-red absolute top-1">{ability.substring(0, 3)}</div>
                  <div className="text-3xl font-bold mt-1">{getModifier(score)}</div>
                  <div className="absolute -bottom-2 border border-dnd-red bg-white rounded-full px-2 text-xs font-bold w-12 text-center">
                    {score}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex-grow space-y-4">
               <div className="flex items-center gap-2 border border-border-sepia p-2 rounded bg-white shadow-sm">
                  <div className="h-8 w-8 border border-dnd-red flex items-center justify-center font-bold text-lg italic">0</div>
                  <div className="text-[10px] font-bold uppercase text-dnd-gold leading-tight">Inspiration</div>
               </div>
               <div className="flex items-center gap-2 border border-border-sepia p-2 rounded bg-white shadow-sm">
                  <div className="h-8 w-8 border border-dnd-red flex items-center justify-center font-bold text-lg">+{proficiencyBonus}</div>
                  <div className="text-[10px] font-bold uppercase text-dnd-gold leading-tight">Proficiency Bonus</div>
               </div>
               
               <div className="border border-border-sepia p-3 bg-white rounded shadow-sm">
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
            </div>
          </div>

          <div className="border border-border-sepia p-3 bg-white rounded shadow-sm">
            <h3 className="text-[10px] font-bold uppercase text-dnd-gold border-b border-dnd-gold/30 mb-2 text-center">Skills</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
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

        {/* Column 2: Combat & HP */}
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-2">
            <div className="border-2 border-dnd-red bg-white p-2 rounded-lg text-center shadow-sm">
              <div className="text-[8px] font-bold uppercase text-dnd-gold">Armor Class</div>
              <div className="text-3xl font-bold">{ac}</div>
            </div>
            <div className="border-2 border-dnd-red bg-white p-2 rounded-lg text-center shadow-sm">
              <div className="text-[8px] font-bold uppercase text-dnd-gold">Initiative</div>
              <div className="text-3xl font-bold">{getModifier(character.stats.dexterity)}</div>
            </div>
            <div className="border-2 border-dnd-red bg-white p-2 rounded-lg text-center shadow-sm">
              <div className="text-[8px] font-bold uppercase text-dnd-gold">Speed</div>
              <div className="text-3xl font-bold">30ft</div>
            </div>
          </div>

          <div className="border-2 border-dnd-red rounded-lg overflow-hidden bg-white shadow-sm">
             <div className="bg-parchment-base border-b border-dnd-red p-1 text-center text-[8px] font-bold uppercase text-dnd-gold flex justify-between px-4">
                <span>Hit Point Maximum</span>
                <span className="text-ink">{character.hp.max}</span>
             </div>
             <div className="p-4 text-center">
                <div className="text-4xl font-bold">{character.hp.current}</div>
                <div className="text-[8px] font-bold uppercase text-ink/30 mt-1">Current Hit Points</div>
             </div>
          </div>

          <div className="border-2 border-border-sepia rounded-lg p-2 bg-white text-center italic text-xs text-ink/40 shadow-sm">
             Temporary Hit Points
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="border border-border-sepia rounded p-2 bg-white shadow-sm">
                <div className="text-[8px] font-bold uppercase text-dnd-gold border-b border-border-sepia mb-1">Hit Dice</div>
                <div className="text-center py-2 font-bold">1d10</div>
             </div>
             <div className="border border-border-sepia rounded p-2 bg-white shadow-sm">
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

          <div className="border border-border-sepia p-4 bg-white rounded shadow-sm min-h-[300px]">
             <h3 className="text-xs font-bold uppercase text-dnd-red border-b border-dnd-gold/30 mb-4 pb-1">Attacks & Spellcasting</h3>
             <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2 text-[8px] font-bold uppercase text-dnd-gold border-b border-border-sepia pb-1">
                   <div>Name</div>
                   <div>Atk Bonus</div>
                   <div>Damage/Type</div>
                </div>
                {attacks.length > 0 ? attacks.map((atk, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2 text-xs border-b border-border-sepia/30 pb-1">
                    <div className="font-bold capitalize truncate" title={atk.name}>{atk.name}</div>
                    <div className="text-center">{atk.bonus}</div>
                    <div className="truncate" title={atk.damage}>{atk.damage}</div>
                  </div>
                )) : (
                  <div className="text-[10px] italic text-ink/40 py-8 text-center">No attacks defined.</div>
                )}
             </div>
          </div>

          <div className="border border-border-sepia p-4 bg-white rounded shadow-sm flex-grow">
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
                    <span>{item}</span>
                    <span className="opacity-30 italic">x1</span>
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
          <div className="border border-border-sepia p-4 bg-white rounded shadow-sm min-h-[400px]">
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
        </div>
      </div>

      <footer className="mt-12 pt-4 border-t border-border-sepia text-center text-[8px] text-ink/30 uppercase tracking-[0.4em]">
        D&D Character Vault - 5th Edition
      </footer>
    </div>
  );
}
