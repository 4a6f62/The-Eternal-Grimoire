import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './lib/db';
import { CharacterBuilder } from './components/builder/CharacterBuilder';
import { CharacterSheet } from './components/sheet/CharacterSheet';
import { Plus, Trash2 } from 'lucide-react';
import type { CharacterType } from './lib/schemas';

function App() {
  const [view, setView] = useState<'dashboard' | 'builder' | 'sheet'>('dashboard');
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterType | null>(null);
  const characters = useLiveQuery(() => db.characters.toArray());

  const deleteCharacter = async (e: React.MouseEvent, id?: number) => {
    e.stopPropagation();
    if (id && confirm('Are you sure you want to delete this character?')) {
      await db.characters.delete(id);
    }
  };

  const openCharacter = (char: CharacterType) => {
    setSelectedCharacter(char);
    setView('sheet');
  };

  if (view === 'builder') {
    return (
      <div className="min-h-screen p-8 flex justify-center items-start parchment-texture">
        <CharacterBuilder onComplete={() => setView('dashboard')} />
      </div>
    );
  }

  if (view === 'sheet' && selectedCharacter) {
    return (
      <div className="min-h-screen p-8 flex justify-center items-start parchment-texture">
        <CharacterSheet character={selectedCharacter} onBack={() => setView('dashboard')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 flex justify-center items-start parchment-texture">
      <main className="max-w-4xl w-full bg-[#1a0f2e] p-12 book-shadow bone-border relative border-necrotic-purple">
        <header className="border-b-2 border-fel-green pb-4 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-5xl uppercase tracking-tighter text-fel-green">The Eternal Grimoire</h1>
            <p className="text-xl italic text-bone opacity-80">Chronicles of the Shadow-Bound</p>
          </div>
          <button 
            onClick={() => setView('builder')}
            className="bg-necrotic-purple text-bone px-4 py-2 flex items-center gap-2 font-bold uppercase hover:bg-fel-green hover:text-abyssal-black transition-all cursor-pointer border border-fel-green/50"
          >
            <Plus size={20} /> Bind New Soul
          </button>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {characters && characters.length > 0 ? (
            characters.map((char) => (
              <div 
                key={char.id} 
                onClick={() => openCharacter(char as CharacterType)}
                className="border-2 border-necrotic-purple p-6 bg-abyssal-black relative group cursor-pointer hover:border-fel-green transition-all"
              >
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                    onClick={(e) => deleteCharacter(e, char.id)}
                    className="text-fel-green hover:text-white cursor-pointer p-1"
                   >
                     <Trash2 size={20} />
                   </button>
                </div>
                <h3 className="text-2xl mb-1 text-bone">{char.name}</h3>
                <div className="text-sm italic text-fel-green uppercase font-bold mb-4">
                  Level {char.level} {char.race} {char.class}
                </div>
                
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center border border-necrotic-purple p-1 bg-[#1a0f2e]">
                    <div className="text-[10px] uppercase font-bold text-bone/50">HP</div>
                    <div className="font-bold text-bone">{char.hp.current}/{char.hp.max}</div>
                  </div>
                  <div className="text-center border border-necrotic-purple p-1 bg-[#1a0f2e]">
                    <div className="text-[10px] uppercase font-bold text-bone/50">AC</div>
                    <div className="font-bold text-bone">10</div>
                  </div>
                  <div className="text-center border border-necrotic-purple p-1 bg-[#1a0f2e]">
                    <div className="text-[10px] uppercase font-bold text-bone/50">INIT</div>
                    <div className="font-bold text-bone">{(char.stats.dexterity - 10) / 2 >= 0 ? `+${Math.floor((char.stats.dexterity - 10) / 2)}` : Math.floor((char.stats.dexterity - 10) / 2)}</div>
                  </div>
                </div>

                <button className="w-full border border-fel-green py-1 text-xs uppercase font-bold group-hover:bg-fel-green group-hover:text-abyssal-black transition-colors">
                  Consult Tome
                </button>
              </div>
            ))
          ) : (
            <div className="col-span-2 text-center py-20 border-2 border-dashed border-necrotic-purple/50 text-bone/50 italic">
              No souls bound yet. Initiate a new ritual to begin.
            </div>
          )}
        </section>

        <footer className="mt-12 pt-4 border-t border-fel-green/30 text-center text-sm text-bone/40">
          Woven in the shadows of the Eternal Forge.
        </footer>
      </main>
    </div>
  );
}

export default App;
