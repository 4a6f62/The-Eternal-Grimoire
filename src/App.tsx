import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './lib/db';
import { CharacterBuilder } from './components/builder/CharacterBuilder';
import { CharacterSheet } from './components/sheet/CharacterSheet';
import { Plus, Trash2, Edit3 } from 'lucide-react';
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

  const handleEdit = (e: React.MouseEvent, char: CharacterType) => {
    e.stopPropagation();
    editCharacter(char);
  };

  const openCharacter = (char: CharacterType) => {
    setSelectedCharacter(char);
    setView('sheet');
  };

  const editCharacter = (char: CharacterType) => {
    setSelectedCharacter(char);
    setView('builder');
  };

  if (view === 'builder') {
    return (
      <div className="min-h-screen p-8 flex justify-center items-start parchment-texture">
        <CharacterBuilder 
          editingCharacter={selectedCharacter} 
          onComplete={() => {
            setSelectedCharacter(null);
            setView('dashboard');
          }} 
        />
      </div>
    );
  }

  if (view === 'sheet' && selectedCharacter) {
    return (
      <div className="min-h-screen p-8 flex justify-center items-start parchment-texture">
        <CharacterSheet 
          character={selectedCharacter} 
          onBack={() => setView('dashboard')} 
          onEdit={() => editCharacter(selectedCharacter)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 flex justify-center items-start parchment-texture">
      <main className="max-w-4xl w-full bg-parchment-light p-12 paper-shadow classic-border relative">
        <header className="border-b-4 border-double border-dnd-red pb-6 mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-6xl tracking-tighter text-dnd-red">Character Vault</h1>
            <p className="text-xl italic text-ink/70 font-serif">A 5th Edition Companion</p>
          </div>
          <button 
            onClick={() => setView('builder')}
            className="bg-dnd-red text-white px-6 py-2 flex items-center gap-2 font-bold uppercase hover:bg-ink transition-all cursor-pointer shadow-md"
          >
            <Plus size={20} /> New Hero
          </button>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {characters && characters.length > 0 ? (
            characters.map((char) => (
              <div 
                key={char.id} 
                onClick={() => openCharacter(char as CharacterType)}
                className="border border-border-sepia p-6 bg-parchment-base relative group cursor-pointer hover:shadow-lg transition-all"
              >
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                    onClick={(e) => handleEdit(e, char as CharacterType)}
                    className="text-dnd-gold hover:text-ink cursor-pointer p-1"
                   >
                     <Edit3 size={20} />
                   </button>
                   <button 
                    onClick={(e) => deleteCharacter(e, char.id)}
                    className="text-dnd-red hover:text-ink cursor-pointer p-1"
                   >
                     <Trash2 size={20} />
                   </button>
                </div>
                <h3 className="text-2xl mb-1 text-dnd-red">{char.name}</h3>
                <div className="text-sm italic text-ink/60 uppercase font-bold mb-4 tracking-widest border-b border-dnd-gold/30 pb-1">
                  Lvl {char.level} {char.race} {char.class}
                </div>
                
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center border border-border-sepia p-2 bg-parchment-light shadow-sm">
                    <div className="text-[10px] uppercase font-bold text-dnd-gold">Health</div>
                    <div className="font-bold text-ink">{char.hp.current}/{char.hp.max}</div>
                  </div>
                  <div className="text-center border border-border-sepia p-2 bg-parchment-light shadow-sm">
                    <div className="text-[10px] uppercase font-bold text-dnd-gold">Armor</div>
                    <div className="font-bold text-ink">10</div>
                  </div>
                  <div className="text-center border border-border-sepia p-2 bg-parchment-light shadow-sm">
                    <div className="text-[10px] uppercase font-bold text-dnd-gold">Init</div>
                    <div className="font-bold text-ink">{(char.stats.dexterity - 10) / 2 >= 0 ? `+${Math.floor((char.stats.dexterity - 10) / 2)}` : Math.floor((char.stats.dexterity - 10) / 2)}</div>
                  </div>
                </div>

                <button className="w-full bg-parchment-dark border border-border-sepia py-2 text-xs uppercase font-bold group-hover:bg-dnd-gold group-hover:text-white transition-colors">
                  Review Sheet
                </button>
              </div>
            ))
          ) : (
            <div className="col-span-2 text-center py-24 border-2 border-dashed border-border-sepia text-ink/40 italic rounded-lg bg-parchment-base/50">
              No adventurers found. Begin your journey by creating a new hero.
            </div>
          )}
        </section>

        <footer className="mt-16 pt-6 border-t-2 border-dnd-gold/30 text-center text-sm text-ink/40 font-serif italic flex justify-between items-center px-4">
          <span>Forge your legend.</span>
          <span className="text-[10px] uppercase tracking-widest opacity-30">v0.2.0-3column</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
