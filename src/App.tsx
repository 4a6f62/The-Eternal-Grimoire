import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './lib/db';
import type { EncryptedCharacter } from './lib/db';
import { CharacterBuilder } from './components/builder/CharacterBuilder';
import { CharacterSheet } from './components/sheet/CharacterSheet';
import { AuthScreen } from './components/auth/AuthScreen';
import { session, decryptData, encryptData, bufToHex, decodeShareData } from './lib/security';
import { Plus, Trash2, Edit3, Sun, Moon, LogOut } from 'lucide-react';
import type { CharacterType } from './lib/schemas';
import { CharacterImage } from './components/builder/CharacterImage';

function App() {
  const [view, setView] = useState<'dashboard' | 'builder' | 'sheet'>('dashboard');
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterType | null>(null);
  
  // Authentication & session state
  const [username, setUsername] = useState<string>(() => session.username || '');
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(() => session.key);
  const [characters, setCharacters] = useState<CharacterType[]>([]);
  const [migrationStatus, setMigrationStatus] = useState<string>('');
  
  // Public URL sharing state
  const [isSharedMode, setIsSharedMode] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });

  // Query encrypted characters for the active user
  const encryptedList = useLiveQuery<EncryptedCharacter[] | undefined>(
    () => (username ? db.encrypted_characters.where('username').equals(username).toArray() : Promise.resolve<EncryptedCharacter[]>([])),
    [username]
  );

  // Detect shared parameter on page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharePayload = params.get('share');
    if (sharePayload) {
      try {
        const sharedChar = decodeShareData(sharePayload);
        setSelectedCharacter(sharedChar);
        setIsSharedMode(true);
        setView('sheet');
      } catch (err) {
        console.error("Failed to decode shared character:", err);
        alert("Invalid or corrupted share link.");
        // Clean URL parameter
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Decrypt characters reactively when the list updates or the session key changes
  useEffect(() => {
    if (!username || !sessionKey || !encryptedList) {
      setCharacters([]);
      return;
    }

    const decryptAll = async () => {
      try {
        const decrypted: CharacterType[] = [];
        for (const enc of encryptedList) {
          try {
            const plainText = await decryptData(enc.ciphertextHex, enc.ivHex, sessionKey);
            const charData = JSON.parse(plainText);
            decrypted.push({
              ...charData,
              id: enc.id // Map the database auto-increment ID
            });
          } catch (decErr) {
            console.error(`Failed to decrypt character ID ${enc.id}:`, decErr);
          }
        }
        setCharacters(decrypted);
      } catch (err) {
        console.error("Error decrypting character list:", err);
      }
    };

    decryptAll();
  }, [encryptedList, username, sessionKey]);

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Migrate any existing plain/unencrypted characters to the user's encrypted vault
  const migrateLegacyCharacters = async (user: string, key: CryptoKey) => {
    try {
      const legacyChars = await db.characters.toArray();
      if (legacyChars.length === 0) return;

      setMigrationStatus(`Securing and migrating ${legacyChars.length} local characters into your vault...`);

      for (const char of legacyChars) {
        // 1. Allocate the new auto-incremented ID first
        const newId = await db.encrypted_characters.add({
          username: user,
          ciphertextHex: '', // temporary placeholder
          ivHex: '',
          lastModified: char.lastModified || Date.now()
        });

        // 2. Update image URLs and creator within the character object
        const updatedChar = { 
          ...char, 
          id: newId,
          creator: char.creator || user 
        };
        if (char.portraitUrl?.startsWith('local:')) {
          updatedChar.portraitUrl = `local:portrait-${newId}`;
        }
        if (char.tokenUrl?.startsWith('local:')) {
          updatedChar.tokenUrl = `local:token-${newId}`;
        }

        // 3. Encrypt and overwrite the character with the updated image URLs
        const plainText = JSON.stringify(updatedChar);
        const { ciphertextHex, ivHex } = await encryptData(plainText, key);
        await db.encrypted_characters.put({
          id: newId,
          username: user,
          ciphertextHex,
          ivHex,
          lastModified: char.lastModified || Date.now()
        });

        // Migrate portrait image
        if (char.portraitUrl?.startsWith('local:')) {
          const imgId = char.portraitUrl.replace('local:', '');
          const record = await db.images.get(imgId);
          if (record && record.blob) {
            const arrayBuffer = await record.blob.arrayBuffer();
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const encrypted = await window.crypto.subtle.encrypt(
              { name: 'AES-GCM', iv },
              key,
              arrayBuffer
            );
            await db.encrypted_images.put({
              id: `portrait-${newId}`,
              username: user,
              ciphertextHex: bufToHex(encrypted),
              ivHex: bufToHex(iv.buffer)
            });
            await db.images.delete(imgId);
          }
        }

        // Migrate token image
        if (char.tokenUrl?.startsWith('local:')) {
          const imgId = char.tokenUrl.replace('local:', '');
          const record = await db.images.get(imgId);
          if (record && record.blob) {
            const arrayBuffer = await record.blob.arrayBuffer();
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const encrypted = await window.crypto.subtle.encrypt(
              { name: 'AES-GCM', iv },
              key,
              arrayBuffer
            );
            await db.encrypted_images.put({
              id: `token-${newId}`,
              username: user,
              ciphertextHex: bufToHex(encrypted),
              ivHex: bufToHex(iv.buffer)
            });
            await db.images.delete(imgId);
          }
        }

        // Clean up legacy record
        if (char.id) {
          await db.characters.delete(char.id);
        }
      }

      setMigrationStatus(`Successfully migrated and encrypted ${legacyChars.length} characters!`);
      setTimeout(() => setMigrationStatus(''), 4000);
    } catch (err) {
      console.error("Migration of legacy characters failed:", err);
      setMigrationStatus('Migration error occurred.');
    }
  };

  const handleLoginSuccess = (user: string, key: CryptoKey) => {
    session.username = user;
    session.key = key;
    setUsername(user);
    setSessionKey(key);
    migrateLegacyCharacters(user, key);
  };

  const handleLogout = () => {
    session.username = null;
    session.key = null;
    setUsername('');
    setSessionKey(null);
    setView('dashboard');
    setSelectedCharacter(null);
  };

  const handleBack = () => {
    if (isSharedMode) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsSharedMode(false);
    }
    setSelectedCharacter(null);
    setView('dashboard');
  };

  const deleteCharacter = async (e: React.MouseEvent, id?: number) => {
    e.stopPropagation();
    if (id && confirm('Are you sure you want to delete this character?')) {
      await db.encrypted_characters.delete(id);
      await db.encrypted_images.delete(`portrait-${id}`);
      await db.encrypted_images.delete(`token-${id}`);
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

  const activeCharacter = characters.find(c => c.id === selectedCharacter?.id) || selectedCharacter;

  // 1. If viewing a shared character link, bypass login check and show character sheet read-only
  if (isSharedMode && view === 'sheet' && activeCharacter) {
    return (
      <div className="min-h-screen p-8 flex justify-center items-start parchment-texture">
        <CharacterSheet 
          character={activeCharacter} 
          onBack={handleBack} 
          onEdit={() => {}} 
          isSharedReadOnly={true}
        />
      </div>
    );
  }

  // 2. If not logged in, render the login/signup secure screen
  if (!username || !sessionKey) {
    return (
      <div className="min-h-screen p-8 flex justify-center items-start parchment-texture">
        <div className="max-w-md w-full">
          <header className="text-center mb-8 border-b border-dnd-gold/30 pb-4">
            <h1 className="text-5xl tracking-tighter text-dnd-red font-serif">Character Vault</h1>
            <p className="text-sm italic text-ink/70 font-serif mt-1">Encrypted Client-Side Vault</p>
          </header>
          <AuthScreen onLoginSuccess={handleLoginSuccess} />
        </div>
      </div>
    );
  }

  // 3. Logged-in views
  if (view === 'builder') {
    return (
      <div className="min-h-screen p-8 flex justify-center items-start parchment-texture">
        <CharacterBuilder 
          editingCharacter={activeCharacter} 
          onComplete={() => {
            setSelectedCharacter(null);
            setView('dashboard');
          }} 
        />
      </div>
    );
  }

  if (view === 'sheet' && activeCharacter) {
    return (
      <div className="min-h-screen p-8 flex justify-center items-start parchment-texture">
        <CharacterSheet 
          character={activeCharacter} 
          onBack={handleBack} 
          onEdit={() => editCharacter(activeCharacter)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 flex justify-center items-start parchment-texture animate-in fade-in duration-300">
      <main className="max-w-4xl w-full bg-parchment-light p-12 paper-shadow classic-border relative">
        <header className="border-b-4 border-double border-dnd-red pb-6 mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-6xl tracking-tighter text-dnd-red">Character Vault</h1>
            <p className="text-xl italic text-ink/70 font-serif">Vault of {username}</p>
          </div>
          <div className="flex gap-4 items-center">
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-3 border border-border-sepia rounded-full hover:bg-dnd-gold hover:text-white transition-all cursor-pointer shadow-sm bg-parchment-light flex items-center justify-center text-ink"
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button 
              onClick={handleLogout}
              className="p-3 border border-border-sepia rounded-full hover:bg-dnd-red hover:text-white transition-all cursor-pointer shadow-sm bg-parchment-light flex items-center justify-center text-ink"
              title="Lock & Log Out"
            >
              <LogOut size={18} />
            </button>
            <button 
              onClick={() => setView('builder')}
              className="bg-dnd-red text-white px-6 py-2 flex items-center gap-2 font-bold uppercase hover:bg-ink transition-all cursor-pointer shadow-md"
            >
              <Plus size={20} /> New Hero
            </button>
          </div>
        </header>

        {migrationStatus && (
          <div className="p-4 bg-dnd-gold/10 border-l-4 border-dnd-gold text-ink text-sm font-serif italic mb-8 animate-pulse">
            {migrationStatus}
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {characters && characters.length > 0 ? (
            characters.map((char) => (
              <div 
                key={char.id} 
                onClick={() => openCharacter(char)}
                className="border border-border-sepia p-6 bg-parchment-base relative group cursor-pointer hover:shadow-lg transition-all"
              >
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                    onClick={(e) => handleEdit(e, char)}
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
                <div className="flex gap-3 items-center mb-2">
                  {char.tokenUrl && (
                    <div className="w-10 h-10 rounded-full border border-dnd-gold overflow-hidden bg-parchment-light flex-shrink-0 flex items-center justify-center relative shadow-sm">
                      <CharacterImage src={char.tokenUrl} alt={char.name} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <h3 className="text-2xl text-dnd-red leading-tight">{char.name}</h3>
                </div>
                <div className="text-sm italic text-ink/60 uppercase font-bold mb-4 tracking-widest border-b border-dnd-gold/30 pb-1">
                  Lvl {char.classes ? char.classes.reduce((acc: number, c: any) => acc + (c.level || 0), 0) : char.level} {char.race} {char.classes ? char.classes.map((c: any) => `${c.name} ${c.level}`).join(' / ') : char.class}
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
          <span className="text-[10px] uppercase tracking-widest opacity-30">v0.2.0-3column-encrypted</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
