import { ChevronLeft } from 'lucide-react';
import type { CharacterType } from '../../lib/schemas';

interface Props {
  character: CharacterType;
  onBack: () => void;
}

export function CharacterSheet({ character, onBack }: Props) {
  const getModifier = (score: number) => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : mod;
  };

  const proficiencyBonus = 2; // Default for lvl 1

  const stats = character.stats as Record<string, number>;

  return (
    <div className="max-w-5xl w-full bg-parchment-light p-8 md:p-10 paper-shadow classic-border relative parchment-texture">
      <button 
        onClick={onBack}
        className="absolute top-4 left-4 text-dnd-red hover:text-ink flex items-center gap-1 font-bold uppercase text-xs cursor-pointer no-print"
      >
        <ChevronLeft size={16} /> Dashboard
      </button>

      {/* Header Info */}
      <header className="border-b-4 border-double border-dnd-red pb-4 mb-8 mt-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-grow">
            <h1 className="text-5xl uppercase tracking-tighter text-dnd-red border-b border-dnd-gold/30">{character.name}</h1>
            <p className="text-xs font-bold uppercase text-dnd-gold mt-1">Character Name</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-[10px] font-bold uppercase bg-parchment-base p-4 border border-border-sepia shadow-inner flex-grow">
            <div className="border-b border-border-sepia">
              <div className="text-ink">{character.class} {character.level}</div>
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
              <div className="text-ink">Neutral</div>
              <div className="text-dnd-gold">Alignment</div>
            </div>
            <div className="border-b border-border-sepia">
              <div className="text-ink">0</div>
              <div className="text-dnd-gold">Experience Points</div>
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
            <div className="space-y-1 text-[10px]">
              {['Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival'].map(skill => (
                <div key={skill} className="flex items-center gap-2">
                  <div className="h-2 w-2 border border-border-sepia rounded-full"></div>
                  <span className="w-5 text-center border-b border-border-sepia">+0</span>
                  <span>{skill} <span className="text-[8px] opacity-40 italic">(Dex)</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Column 2: Combat & HP */}
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-2">
            <div className="border-2 border-dnd-red bg-white p-2 rounded-lg text-center shadow-sm">
              <div className="text-[8px] font-bold uppercase text-dnd-gold">Armor Class</div>
              <div className="text-3xl font-bold">10</div>
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
                <div className="text-[10px] italic text-ink/40 py-8 text-center">No attacks defined.</div>
             </div>
          </div>
        </div>

        {/* Column 3: Traits & Features */}
        <div className="space-y-6">
          <div className="space-y-4">
            {['Personality Traits', 'Ideals', 'Bonds', 'Flaws'].map(trait => (
              <div key={trait} className="border border-border-sepia p-3 bg-white rounded shadow-sm">
                <h3 className="text-[8px] font-bold uppercase text-dnd-gold border-b border-border-sepia mb-1">{trait}</h3>
                <div className="min-h-[40px] text-[10px] italic text-ink/50">Describe your character's {trait.toLowerCase()}...</div>
              </div>
            ))}
          </div>

          <div className="border border-border-sepia p-4 bg-white rounded shadow-sm flex-grow min-h-[400px]">
             <h3 className="text-xs font-bold uppercase text-dnd-red border-b border-dnd-gold/30 mb-4 pb-1">Features & Traits</h3>
             <div className="space-y-2 text-[10px]">
                <div className="font-bold border-b border-border-sepia pb-1">Racial Traits</div>
                <div className="italic text-ink/60 p-2 bg-parchment-base/20 rounded">No traits imported from {character.race}.</div>
                
                <div className="font-bold border-b border-border-sepia pb-1 mt-4">Class Features</div>
                <div className="italic text-ink/60 p-2 bg-parchment-base/20 rounded">Level 1 {character.class} features pending...</div>
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
