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
      <main className="max-w-4xl w-full bg-parchment-dark p-12 book-shadow gold-border relative">
        <header className="border-b-2 border-dnd-red pb-4 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-5xl uppercase tracking-tighter">My Characters</h1>
            <p className="text-xl italic opacity-80">D&D 5e Character Manager</p>
          </div>
          <button 
            onClick={() => setView('builder')}
            className="bg-dnd-red text-parchment px-4 py-2 flex items-center gap-2 font-bold uppercase hover:bg-deep-brown transition-colors cursor-pointer"
          >
            <Plus size={20} /> Create New
          </button>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {characters && characters.length > 0 ? (
            characters.map((char) => (
              <div 
                key={char.id} 
                onClick={() => openCharacter(char as CharacterType)}
                className="border-2 border-dnd-red p-6 bg-parchment relative group cursor-pointer hover:gold-border transition-all"
              >
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                    onClick={(e) => deleteCharacter(e, char.id)}
                    className="text-dnd-red hover:text-deep-brown cursor-pointer p-1"
                   >
                     <Trash2 size={20} />
                   </button>
                </div>
                <h3 className="text-2xl mb-1">{char.name}</h3>
                <div className="text-sm italic text-gold uppercase font-bold mb-4">
                  Level {char.level} {char.race} {char.class}
                </div>
                
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center border border-gold/30 p-1">
                    <div className="text-[10px] uppercase font-bold">HP</div>
                    <div className="font-bold">{char.hp.current}/{char.hp.max}</div>
                  </div>
                  <div className="text-center border border-gold/30 p-1">
                    <div className="text-[10px] uppercase font-bold">AC</div>
                    <div className="font-bold">10</div>
                  </div>
                  <div className="text-center border border-gold/30 p-1">
                    <div className="text-[10px] uppercase font-bold">INIT</div>
                    <div className="font-bold">{(char.stats.dexterity - 10) / 2 >= 0 ? `+${Math.floor((char.stats.dexterity - 10) / 2)}` : Math.floor((char.stats.dexterity - 10) / 2)}</div>
                  </div>
                </div>

                <button className="w-full border border-dnd-red py-1 text-xs uppercase font-bold group-hover:bg-dnd-red group-hover:text-parchment transition-colors">
                  Open Sheet
                </button>
              </div>
            ))
          ) : (
            <div className="col-span-2 text-center py-20 border-2 border-dashed border-gold/50 opacity-50 italic">
              No characters found. Create your first hero to begin!
            </div>
          )}
        </section>

        <footer className="mt-12 pt-4 border-t border-gold/30 text-center text-sm opacity-60">
          Built for the 5th Edition of the world's greatest roleplaying game.
        </footer>
      </main>
    </div>
  );
}

export default App;
