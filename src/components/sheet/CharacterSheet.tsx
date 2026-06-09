import { ChevronLeft, Shield, Sword, Zap, Book as BookIcon, Heart, Activity } from 'lucide-react';
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

  return (
    <div className="max-w-4xl w-full bg-parchment-light p-8 md:p-12 paper-shadow classic-border relative parchment-texture">
      <button 
        onClick={onBack}
        className="absolute top-4 left-4 text-dnd-red hover:text-ink flex items-center gap-1 font-bold uppercase text-xs cursor-pointer no-print"
      >
        <ChevronLeft size={16} /> Dashboard
      </button>

      <header className="border-b-4 border-double border-dnd-red pb-6 mb-8 mt-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-6xl uppercase tracking-tighter leading-none text-dnd-red">{character.name}</h1>
            <p className="text-2xl italic text-ink/70 font-serif">
              Level {character.level} {character.race} {character.class}
            </p>
          </div>
          <div className="text-right">
             <div className="border-2 border-dnd-gold p-2 bg-parchment-base inline-block shadow-inner">
                <div className="text-[10px] font-bold uppercase text-dnd-red">Inspiration</div>
                <div className="h-6 w-6 border border-dnd-gold mx-auto mt-1 bg-white"></div>
             </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column: Stats */}
        <div className="col-span-12 md:col-span-3 space-y-4">
          {Object.entries(character.stats).map(([ability, score]) => (
            <div key={ability} className="relative pt-4 pb-2 px-2 border-2 border-dnd-red bg-white text-center rounded-lg shadow-sm">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-2 text-[10px] font-bold uppercase text-dnd-red border border-dnd-red rounded-full">
                {ability.substring(0, 3)}
              </div>
              <div className="text-3xl font-bold text-ink">{getModifier(score)}</div>
              <div className="text-sm border-t border-border-sepia mt-1 inline-block px-2 rounded-full bg-parchment-base text-ink/60">
                {score}
              </div>
            </div>
          ))}
        </div>

        {/* Center Column: Combat & Main Info */}
        <div className="col-span-12 md:col-span-9 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="border-2 border-dnd-red p-4 bg-white text-center rounded-sm relative shadow-sm">
                <Shield className="absolute top-1 left-1 text-dnd-gold opacity-10" size={40} />
                <div className="text-[10px] font-bold uppercase text-dnd-gold">Armor Class</div>
                <div className="text-4xl font-bold text-ink">10</div>
            </div>
            <div className="border-2 border-dnd-red p-4 bg-white text-center rounded-sm relative shadow-sm">
                <Zap className="absolute top-1 left-1 text-dnd-gold opacity-10" size={40} />
                <div className="text-[10px] font-bold uppercase text-dnd-gold">Initiative</div>
                <div className="text-4xl font-bold text-ink">{getModifier(character.stats.dexterity)}</div>
            </div>
            <div className="border-2 border-dnd-red p-4 bg-white text-center rounded-sm relative shadow-sm">
                <Activity className="absolute top-1 left-1 text-dnd-gold opacity-10" size={40} />
                <div className="text-[10px] font-bold uppercase text-dnd-gold">Speed</div>
                <div className="text-4xl font-bold text-ink">30ft</div>
            </div>
          </div>

          <div className="border-2 border-dnd-red bg-white rounded-sm overflow-hidden shadow-sm">
            <div className="bg-dnd-red text-white px-4 py-1 flex items-center gap-2">
              <Heart size={16} />
              <span className="text-sm font-bold uppercase tracking-widest">Hit Points</span>
            </div>
            <div className="p-6 flex justify-around items-center">
               <div className="text-center">
                  <div className="text-[10px] uppercase font-bold text-dnd-gold">Current</div>
                  <div className="text-5xl font-bold text-ink">{character.hp.current}</div>
               </div>
               <div className="h-12 w-px bg-border-sepia"></div>
               <div className="text-center">
                  <div className="text-[10px] uppercase font-bold text-dnd-gold">Max</div>
                  <div className="text-5xl font-bold text-ink">{character.hp.max}</div>
               </div>
            </div>
            <div className="bg-parchment-base p-2 border-t border-border-sepia text-center">
               <div className="text-[10px] uppercase font-bold text-ink/40">Temporary Hit Points</div>
               <div className="font-bold text-ink/60">{character.hp.temp || '--'}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="space-y-2">
              <h2 className="text-2xl border-b-2 border-dnd-gold flex items-center gap-2 text-dnd-red">
                <Sword size={20} /> Attacks & Spells
              </h2>
              <div className="space-y-1">
                 <div className="grid grid-cols-4 gap-2 text-[10px] font-bold uppercase text-dnd-gold px-2">
                    <div className="col-span-2">Name</div>
                    <div>Atk</div>
                    <div>Damage</div>
                 </div>
                 <div className="bg-parchment-base/50 p-2 text-sm italic border-b border-border-sepia text-ink/40">
                    No items or spells added.
                 </div>
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-2xl border-b-2 border-dnd-gold flex items-center gap-2 text-dnd-red">
                <BookIcon size={20} /> Equipment
              </h2>
              <div className="space-y-1 text-sm italic text-ink/60 list-disc list-inside bg-parchment-base/50 p-4 min-h-[100px] border border-border-sepia">
                 {character.inventory.length > 0 ? (
                   character.inventory.map((item, i) => <div key={i}>{item.name}</div>)
                 ) : (
                   <div>Inventory is empty.</div>
                 )}
              </div>
            </section>
          </div>
        </div>
      </div>

      <footer className="mt-12 pt-4 border-t border-border-sepia text-center text-[10px] text-ink/30 uppercase tracking-[0.2em]">
        End of Sheet
      </footer>
    </div>
  );
}
