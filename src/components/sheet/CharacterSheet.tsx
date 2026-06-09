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
    <div className="max-w-4xl w-full bg-[#1a0f2e] p-8 md:p-12 book-shadow bone-border relative parchment-texture border-necrotic-purple">
      <button 
        onClick={onBack}
        className="absolute top-4 left-4 text-fel-green hover:text-white flex items-center gap-1 font-bold uppercase text-xs cursor-pointer no-print"
      >
        <ChevronLeft size={16} /> Ritual Grounds
      </button>

      <header className="border-b-4 border-double border-fel-green pb-6 mb-8 mt-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-6xl uppercase tracking-tighter leading-none text-fel-green">{character.name}</h1>
            <p className="text-2xl italic text-bone font-bold opacity-80">
              Level {character.level} {character.race} {character.class}
            </p>
          </div>
          <div className="text-right">
             <div className="border-2 border-necrotic-purple p-2 bg-abyssal-black inline-block">
                <div className="text-[10px] font-bold uppercase text-fel-green">Infamy</div>
                <div className="h-6 w-6 border border-fel-green mx-auto mt-1 bg-necrotic-purple/20"></div>
             </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column: Stats */}
        <div className="col-span-12 md:col-span-3 space-y-4">
          {Object.entries(character.stats).map(([ability, score]) => (
            <div key={ability} className="relative pt-4 pb-2 px-2 border-2 border-necrotic-purple bg-abyssal-black text-center rounded-lg shadow-[0_0_15px_rgba(61,0,102,0.3)]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-abyssal-black px-2 text-[10px] font-bold uppercase text-fel-green border border-necrotic-purple rounded-full">
                {ability.substring(0, 3)}
              </div>
              <div className="text-3xl font-bold text-bone">{getModifier(score)}</div>
              <div className="text-sm border-t border-necrotic-purple/30 mt-1 inline-block px-2 rounded-full bg-necrotic-purple/20 text-bone/60">
                {score}
              </div>
            </div>
          ))}
        </div>

        {/* Center Column: Combat & Main Info */}
        <div className="col-span-12 md:col-span-9 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="border-2 border-necrotic-purple p-4 bg-abyssal-black text-center rounded-sm relative">
                <Shield className="absolute top-1 left-1 text-fel-green opacity-20" size={40} />
                <div className="text-[10px] font-bold uppercase text-bone/50">Defense</div>
                <div className="text-4xl font-bold text-bone">10</div>
            </div>
            <div className="border-2 border-necrotic-purple p-4 bg-abyssal-black text-center rounded-sm relative">
                <Zap className="absolute top-1 left-1 text-fel-green opacity-20" size={40} />
                <div className="text-[10px] font-bold uppercase text-bone/50">Reflex</div>
                <div className="text-4xl font-bold text-bone">{getModifier(character.stats.dexterity)}</div>
            </div>
            <div className="border-2 border-necrotic-purple p-4 bg-abyssal-black text-center rounded-sm relative">
                <Activity className="absolute top-1 left-1 text-fel-green opacity-20" size={40} />
                <div className="text-[10px] font-bold uppercase text-bone/50">Vigor</div>
                <div className="text-4xl font-bold text-bone">30ft</div>
            </div>
          </div>

          <div className="border-2 border-necrotic-purple bg-abyssal-black rounded-sm overflow-hidden">
            <div className="bg-necrotic-purple text-bone px-4 py-1 flex items-center gap-2">
              <Heart size={16} className="text-fel-green" />
              <span className="text-sm font-bold uppercase tracking-widest">Essence</span>
            </div>
            <div className="p-6 flex justify-around items-center">
               <div className="text-center">
                  <div className="text-[10px] uppercase font-bold text-bone/50">Manifest</div>
                  <div className="text-5xl font-bold text-bone">{character.hp.current}</div>
               </div>
               <div className="h-12 w-px bg-necrotic-purple/30"></div>
               <div className="text-center">
                  <div className="text-[10px] uppercase font-bold text-bone/50">Threshold</div>
                  <div className="text-5xl font-bold text-bone">{character.hp.max}</div>
               </div>
            </div>
            <div className="bg-necrotic-purple/10 p-2 border-t border-necrotic-purple/30 text-center">
               <div className="text-[10px] uppercase font-bold text-bone/40">Transient Shadow</div>
               <div className="font-bold text-fel-green">{character.hp.temp || '--'}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="space-y-2">
              <h2 className="text-2xl border-b-2 border-necrotic-purple flex items-center gap-2 text-fel-green">
                <Sword size={20} /> Dark Arts & Sorcery
              </h2>
              <div className="space-y-1">
                 <div className="grid grid-cols-4 gap-2 text-[10px] font-bold uppercase text-bone/50 px-2">
                    <div className="col-span-2">Incantation</div>
                    <div>Prec</div>
                    <div>Potency</div>
                 </div>
                 <div className="bg-necrotic-purple/5 p-2 text-sm italic border-b border-necrotic-purple/20 text-bone/60">
                    No rituals bound.
                 </div>
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-2xl border-b-2 border-necrotic-purple flex items-center gap-2 text-fel-green">
                <BookIcon size={20} /> Reliquary
              </h2>
              <div className="space-y-1 text-sm italic text-bone/70 list-disc list-inside bg-necrotic-purple/5 p-4 min-h-[100px] border border-necrotic-purple/20">
                 {character.inventory.length > 0 ? (
                   character.inventory.map((item, i) => <div key={i}>{item.name}</div>)
                 ) : (
                   <div>Your reliquary is empty.</div>
                 )}
              </div>
            </section>
          </div>
        </div>
      </div>

      <footer className="mt-12 pt-4 border-t border-necrotic-purple/30 text-center text-[10px] text-bone/30 uppercase tracking-[0.2em]">
        End of Revelation - Recorded in the Eternal Grimoire
      </footer>
    </div>
  );
}
