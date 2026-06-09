import { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { CharacterSchema } from '../../lib/schemas';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { fetchAndCache5eData, fetchClassDetails } from '../../lib/dataFetcher';

type Step = 'Basics' | 'Abilities' | 'Proficiencies' | 'Features' | 'Equipment' | 'Review';

const STEPS: Step[] = ['Basics', 'Abilities', 'Proficiencies', 'Features', 'Equipment', 'Review'];

const ALL_SKILLS = [
  'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 
  'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception', 
  'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival'
];

const WEAPONS: Record<string, string[]> = {
  weaponSimple: ['Club', 'Dagger', 'Greatclub', 'Handaxe', 'Javelin', 'Light hammer', 'Mace', 'Quarterstaff', 'Sickle', 'Spear', 'Light crossbow', 'Dart', 'Shortbow', 'Sling'],
  weaponMartial: ['Battleaxe', 'Flail', 'Glaive', 'Greataxe', 'Greatsword', 'Halberd', 'Lance', 'Longsword', 'Maul', 'Morningstar', 'Pike', 'Rapier', 'Scimitar', 'Shortsword', 'Trident', 'War pick', 'Warhammer', 'Whip', 'Blowgun', 'Hand crossbow', 'Heavy crossbow', 'Longbow', 'Net'],
  weaponSimpleMelee: ['Club', 'Dagger', 'Greatclub', 'Handaxe', 'Javelin', 'Light hammer', 'Mace', 'Quarterstaff', 'Sickle', 'Spear'],
  weaponMartialMelee: ['Battleaxe', 'Flail', 'Glaive', 'Greataxe', 'Greatsword', 'Halberd', 'Lance', 'Longsword', 'Maul', 'Morningstar', 'Pike', 'Rapier', 'Scimitar', 'Shortsword', 'Trident', 'War pick', 'Warhammer', 'Whip']
};

export function CharacterBuilder({ onComplete, editingCharacter }: { onComplete: () => void, editingCharacter?: any }) {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [formData, setFormData] = useState<any>(editingCharacter || {
    name: '',
    level: 1,
    race: '',
    class: '',
    size: 'Medium',
    stats: {
      strength: 8,
      dexterity: 8,
      constitution: 8,
      intelligence: 8,
      wisdom: 8,
      charisma: 8,
    },
    hp: { current: 10, max: 10, temp: 0 },
    proficiencies: [],
    traits: [],
    feats: [],
    inventory: [],
    spells: [],
    resources: {},
  });

  const races = useLiveQuery(() => db.fiveetools.where('type').equals('race').toArray());
  const classes = useLiveQuery(() => db.fiveetools.where('type').equals('class').toArray());
  const featsList = useLiveQuery(() => db.fiveetools.where('type').equals('feat').toArray());

  const selectedRaceData = races?.find(r => r.name === formData.race);

  const cleanText = (text: string) => {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\{@\w+ ([^|}]+)(?:\|[^}]*)?\}/g, '$1') // Handle {@tag text|optional}
      .replace(/\{@\w+ ([^}]+)\}/g, '$1') // Handle simple {@tag text}
      .trim();
  };

  const getRaceDescription = () => {
    if (!selectedRaceData?.data?.entries) return 'Select a race to see its unique traits and history.';
    
    const extractText = (entry: any): string => {
      if (typeof entry === 'string') return entry;
      if (entry.entries) return entry.entries.map(extractText).join(' ');
      return '';
    };

    const description = selectedRaceData.data.entries
      .map((e: any) => {
        if (typeof e === 'string') return e;
        if (e.name && e.entries) return `${e.name}. ${e.entries.map(extractText).join(' ')}`;
        return '';
      })
      .filter(Boolean)
      .join('\n\n');

    return cleanText(description) || 'A unique lineage with diverse abilities.';
  };

  const getClassDescription = (className: string) => {
    const descriptions: Record<string, string> = {
      'Barbarian': 'A fierce warrior of primitive background who can enter a battle rage.',
      'Bard': 'An inspiring magician whose power echoes the music of creation.',
      'Cleric': 'A priestly champion who wields divine magic in service of a higher power.',
      'Druid': 'A priest of the Old Faith, wielding the powers of nature and adopting animal forms.',
      'Fighter': 'A master of martial combat, skilled with a variety of weapons and armor.',
      'Monk': 'A master of martial arts, harnessing the power of the body in pursuit of physical and spiritual perfection.',
      'Paladin': 'A holy warrior bound to a sacred oath.',
      'Ranger': 'A warrior who uses martial prowess and nature magic to combat threats on the edges of civilization.',
      'Rogue': 'A scoundrel who uses stealth and trickery to overcome obstacles and enemies.',
      'Sorcerer': 'A spellcaster who draws on innate magic from a bloodline or cosmic gift.',
      'Warlock': 'A wielder of magic that is derived from a bargain with an extraplanar entity.',
      'Wizard': 'A scholarly magic-user capable of wielding cosom-altering powers.',
    };
    return cleanText(descriptions[className] || 'A hero with specialized skills and powerful potential.');
  };

  const getRacialBonus = (statName: string) => {
    if (!selectedRaceData?.data?.ability) return 0;
    const ability = selectedRaceData.data.ability[0];
    const key = statName.toLowerCase().substring(0, 3);
    return ability[key] || 0;
  };

  const getPointCost = (score: number) => {
    if (score <= 13) return score - 8;
    if (score === 14) return 7;
    if (score === 15) return 9;
    return 0;
  };

  const pointsUsed = Object.values(formData.stats).reduce((acc: number, score: any) => acc + getPointCost(score), 0);
  const pointsRemaining = 27 - pointsUsed;

  const updateStat = (stat: string, delta: number) => {
    const currentScore = formData.stats[stat];
    const newScore = currentScore + delta;
    if (newScore < 8 || newScore > 15) return;
    
    const currentCost = getPointCost(currentScore);
    const newCost = getPointCost(newScore);
    const costDiff = newCost - currentCost;

    if (pointsRemaining >= costDiff) {
      setFormData({
        ...formData,
        stats: { ...formData.stats, [stat]: newScore }
      });
    }
  };

  useEffect(() => {
    fetchAndCache5eData('race');
    fetchAndCache5eData('class');
    fetchAndCache5eData('feats');
  }, []);

  // Fetch full class data if editing an existing character
  useEffect(() => {
    if (formData.class && classes) {
      const classData = classes.find(c => c.name === formData.class);
      if (classData?.data?.filename && !classData.data.fullData) {
        fetchClassDetails(formData.class, classData.data.filename).catch(console.error);
      }
    }
  }, [formData.class, classes]);

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const saveCharacter = async () => {
    try {
      const racialProfs = (selectedRaceData?.data?.skillProficiencies?.[0] 
        ? Object.keys(selectedRaceData.data.skillProficiencies[0]).map(s => s.charAt(0).toUpperCase() + s.slice(1))
        : []).filter(s => ALL_SKILLS.includes(s));

      const allProficiencies = Array.from(new Set([...formData.proficiencies, ...racialProfs]));

      // Extract equipment from choices
      const selectedClassData = classes?.find(c => c.name === formData.class);
      const classDetails = selectedClassData?.data?.fullData?.class?.find((c: any) => c.name === formData.class);
      const equipmentOptions = classDetails?.startingEquipment?.default || [];
      const equipmentData = classDetails?.startingEquipment?.defaultData || [];
      
      const inventory = equipmentOptions.flatMap((opt: string, idx: number) => {
        const parts = opt.split(' or ');
        
        // If equipmentData has the '_' key, it means it's an automatic inclusion, not a choice.
        const isAutomatic = equipmentData[idx] && equipmentData[idx]['_'];
        const choiceKey = isAutomatic ? '_' : (formData.resources.equipmentChoices?.[idx] || 'a');
        
        if (equipmentData.length > 0 && equipmentData[idx] && equipmentData[idx][choiceKey]) {
            // Build from structured data
            return equipmentData[idx][choiceKey].map((itemObj: any, itemIdx: number) => {
              if (typeof itemObj === 'string') return cleanText(itemObj.split('|')[0]);
              if (itemObj.item) {
                  const name = cleanText(itemObj.item.split('|')[0]);
                  return itemObj.quantity > 1 ? `${name} x${itemObj.quantity}` : name;
              }
              if (itemObj.equipmentType) {
                  const qty = itemObj.quantity || 1;
                  return Array.from({length: qty}).map((_, qIdx) => {
                      const spec = formData.resources.equipmentSpecifics?.[idx]?.[choiceKey]?.[`${itemIdx}-${qIdx}`];
                      const defaultWep = (WEAPONS[itemObj.equipmentType] || WEAPONS.weaponSimple)[0];
                      return spec ? cleanText(spec) : cleanText(defaultWep);
                  }).join('|||');
              }
              return "Item";
            });
        }

        // Fallback to basic string parsing
        if (parts.length < 2) {
            // For automatic strings, split by " and "
            return opt.split(/ and /i).map(s => cleanText(s.replace(/^[Aa]n? /, '').trim()));
        }
        
        const choice = choiceKey === 'a' ? parts[0].replace('(a) ', '') : 
                       choiceKey === 'b' ? parts[1].replace('(b) ', '') : 
                       choiceKey === 'c' && parts[2] ? parts[2].replace('(c) ', '') : parts[0];
        
        return cleanText(choice);
      }).flatMap((i: string) => i.split('|||')).filter(Boolean);

      const validated = CharacterSchema.parse({
        ...formData,
        proficiencies: allProficiencies,
        inventory,
        lastModified: Date.now(),
      });

      if (formData.id) {
        await db.characters.put(validated);
      } else {
        await db.characters.add(validated);
      }
      onComplete();
    } catch (err) {
      console.error('Validation failed', err);
      alert('Please check your data. Some fields are missing or invalid.');
    }
  };

  const canProgress = () => {
    switch (STEPS[currentStep]) {
      case 'Basics':
        return formData.name && formData.race && formData.class;
      case 'Abilities':
        return pointsRemaining === 0;
      case 'Proficiencies': {
        const selectedClassData = classes?.find(c => c.name === formData.class);
        const classDetails = selectedClassData?.data?.fullData?.class?.find((c: any) => c.name === formData.class);
        const skillChoices = classDetails?.startingProficiencies?.skills?.[0]?.choose;
        const maxChoices = skillChoices?.count || 0;
        return formData.proficiencies.length >= maxChoices;
      }
      case 'Features': {
        const hasFeatRequirement = selectedRaceData?.data?.feats?.some((f: any) => f.any || f.anyFromCategory);
        const selectedClassData = classes?.find(c => c.name === formData.class);
        const classFeatureData = selectedClassData?.data?.fullData?.classFeature || [];
        const subclassFeatureData = selectedClassData?.data?.fullData?.subclassFeature || [];
        
        const rawFeatures = [...classFeatureData, ...subclassFeatureData].filter(f => f.level <= formData.level);
        const asiCount = rawFeatures.filter(f => f.name === 'Ability Score Improvement').length;
        const totalFeatSlots = (hasFeatRequirement ? 1 : 0) + asiCount;
        
        return (formData.feats?.filter(Boolean).length || 0) >= totalFeatSlots;
      }
      case 'Equipment': {
        const selectedClassData = classes?.find(c => c.name === formData.class);
        const classDetails = selectedClassData?.data?.fullData?.class?.find((c: any) => c.name === formData.class);
        const equipmentOptions = classDetails?.startingEquipment?.default || [];
        const requiredChoices = equipmentOptions.filter((o: string) => o.includes(' or ')).length;
        return Object.keys(formData.resources.equipmentChoices || {}).length >= requiredChoices;
      }
      default:
        return true;
    }
  };

  const renderStep = () => {
    switch (STEPS[currentStep]) {
      case 'Basics':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-4xl border-b-2 border-fel-green mb-8 pb-2 text-fel-green tracking-tighter">Character Identity</h2>
            <div className="grid grid-cols-1 gap-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="flex flex-col md:col-span-3">
                  <label className="text-xs font-bold uppercase text-bone/60 mb-2 tracking-widest">Character Name</label>
                  <input
                    type="text"
                    className="bg-abyssal-black/50 border border-fel-green/30 p-4 font-serif text-2xl text-bone focus:outline-none focus:border-fel-green shadow-inner transition-all placeholder:text-bone/20 h-full"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Tordek"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold uppercase text-bone/60 mb-2 tracking-widest">Level</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    className="bg-abyssal-black/50 border border-fel-green/30 p-4 font-serif text-2xl text-center text-bone focus:outline-none focus:border-fel-green shadow-inner transition-all h-full"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col space-y-4">
                  <div className="flex flex-col">
                    <label className="text-xs font-bold uppercase text-bone/60 mb-2 tracking-widest">Race</label>
                    <select
                      className="bg-abyssal-black/50 border border-fel-green/30 p-4 font-serif text-lg text-bone focus:outline-none focus:border-fel-green appearance-none cursor-pointer"
                      value={formData.race}
                      onChange={(e) => setFormData({ ...formData, race: e.target.value })}
                    >
                      <option value="">Choose Race...</option>
                      {races?.map(r => (
                        <option key={r.id} value={r.name} className="bg-abyssal-black text-bone">{r.name}</option>
                      ))}
                    </select>
                  </div>
                  {formData.race && (
                    <div className="p-4 bg-necrotic-purple/10 border-l-4 border-necrotic-purple animate-in fade-in slide-in-from-left-2">
                      <p className="text-bone/80 text-sm leading-relaxed italic">
                        {getRaceDescription()}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col space-y-4">
                  <div className="flex flex-col">
                    <label className="text-xs font-bold uppercase text-bone/60 mb-2 tracking-widest">Class</label>
                    <select
                      className="bg-abyssal-black/50 border border-fel-green/30 p-4 font-serif text-lg text-bone focus:outline-none focus:border-fel-green appearance-none cursor-pointer"
                      value={formData.class}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, class: val, subclass: '' });
                        
                        // Immediately fetch class details when selected
                        const classData = classes?.find(c => c.name === val);
                        if (classData?.data?.filename) {
                          // Using a timeout to not block the UI render
                          setTimeout(() => {
                            fetchClassDetails(val, classData.data.filename).catch(console.error);
                          }, 0);
                        }
                      }}
                    >
                      <option value="">Choose Class...</option>
                      {classes?.map(c => (
                        <option key={c.id} value={c.name} className="bg-abyssal-black text-bone">{c.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  {formData.class && (() => {
                    const selectedClassData = classes?.find(c => c.name === formData.class);
                    const subclasses = selectedClassData?.data?.fullData?.subclass || [];
                    const subclassTitle = selectedClassData?.data?.fullData?.class?.[0]?.subclassTitle || 'Subclass';
                    
                    if (subclasses.length === 0) return null;
                    
                    return (
                      <div className="flex flex-col mt-4 animate-in fade-in slide-in-from-top-2">
                        <label className="text-xs font-bold uppercase text-necrotic-purple/80 mb-2 tracking-widest">{subclassTitle}</label>
                        <select
                          className="bg-abyssal-black/50 border border-necrotic-purple/30 p-4 font-serif text-lg text-bone focus:outline-none focus:border-necrotic-purple appearance-none cursor-pointer"
                          value={formData.subclass || ''}
                          onChange={(e) => setFormData({ ...formData, subclass: e.target.value })}
                        >
                          <option value="">Choose {subclassTitle}...</option>
                          {subclasses.map((sc: any) => (
                            <option key={sc.shortName || sc.name} value={sc.name} className="bg-abyssal-black text-bone">{sc.name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })()}

                  {formData.class && (
                    <div className="p-4 bg-fel-green/10 border-l-4 border-fel-green animate-in fade-in slide-in-from-left-2 mt-4">
                      <p className="text-bone/80 text-sm leading-relaxed italic">
                        {getClassDescription(formData.class)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Size Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col">
                  <label className="text-xs font-bold uppercase text-bone/60 mb-2 tracking-widest">Size</label>
                  <div className="flex gap-4">
                    {['Small', 'Medium'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setFormData({ ...formData, size: s })}
                        className={`flex-1 p-4 border transition-all cursor-pointer text-center font-bold uppercase tracking-wider ${
                          formData.size === s
                            ? 'bg-fel-green text-abyssal-black border-fel-green shadow-[0_0_15px_rgba(74,222,128,0.3)]'
                            : 'bg-abyssal-black/50 border-fel-green/30 text-bone/60 hover:border-fel-green/60'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-bold uppercase text-bone/60 mb-2 tracking-widest">Alignment</label>
                  <select
                    className="bg-abyssal-black/50 border border-fel-green/30 p-4 font-serif text-lg text-bone focus:outline-none focus:border-fel-green appearance-none cursor-pointer h-full"
                    value={formData.alignment}
                    onChange={(e) => setFormData({ ...formData, alignment: e.target.value })}
                  >
                    {['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'].map(a => (
                      <option key={a} value={a} className="bg-abyssal-black text-bone">{a}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {formData.name && formData.race && formData.class && (
              <div className="pt-8 flex justify-center animate-in zoom-in duration-300">
                <button
                  onClick={nextStep}
                  className="bg-fel-green text-abyssal-black px-12 py-4 rounded-full font-black uppercase tracking-widest hover:bg-white hover:scale-105 transition-all shadow-[0_0_20px_rgba(74,222,128,0.4)] cursor-pointer group"
                >
                  Embark on Adventure <ChevronRight className="inline-block ml-2 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            )}
          </div>
        );
      case 'Abilities':
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center border-b-2 border-fel-green mb-6 pb-2">
              <h2 className="text-3xl text-fel-green">Ability Scores</h2>
              <div className={`px-4 py-1 rounded-full border-2 font-bold ${pointsRemaining < 0 ? 'border-red-600 text-red-600 bg-red-50' : 'border-fel-green text-fel-green bg-abyssal-black/50'}`}>
                Points: {pointsRemaining} / 27
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'].map((stat) => {
                const statKey = stat.toLowerCase();
                const baseScore = formData.stats[statKey];
                const racialBonus = getRacialBonus(stat);
                const total = baseScore + racialBonus;
                const modifier = Math.floor((total - 10) / 2);

                return (
                  <div key={stat} className="p-4 bg-abyssal-black/40 border border-fel-green/20 flex items-center justify-between shadow-sm group hover:border-fel-green/50 transition-colors">
                    <div className="flex-1">
                      <label className="text-xs font-bold uppercase text-bone/40 block tracking-widest">{stat}</label>
                      <div className="text-4xl font-bold text-bone">
                        {total} <span className="text-lg text-fel-green ml-1">({modifier >= 0 ? `+${modifier}` : modifier})</span>
                      </div>
                      {racialBonus > 0 && <div className="text-[10px] text-necrotic-purple font-bold italic tracking-wide">+{racialBonus} from {formData.race}</div>}
                    </div>
                    
                    <div className="flex items-center gap-3 bg-abyssal-black/60 p-2 border border-fel-green/30 rounded-lg shadow-inner">
                      <button 
                        onClick={() => updateStat(statKey, -1)}
                        className="w-8 h-8 flex items-center justify-center font-bold text-xl text-fel-green hover:bg-fel-green hover:text-abyssal-black transition-all rounded-full border border-fel-green/30 cursor-pointer"
                      >
                        -
                      </button>
                      <div className="text-xl font-bold w-6 text-center text-bone">{baseScore}</div>
                      <button 
                        onClick={() => updateStat(statKey, 1)}
                        className="w-8 h-8 flex items-center justify-center font-bold text-xl text-fel-green hover:bg-fel-green hover:text-abyssal-black transition-all rounded-full border border-fel-green/30 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 'Proficiencies': {
        const selectedClassData = classes?.find(c => c.name === formData.class);
        const classDetails = selectedClassData?.data?.fullData?.class?.find((c: any) => c.name === formData.class);
        
        if (!classDetails) {
          if (selectedClassData?.data?.filename && !selectedClassData?.data?.fullData) {
              fetchClassDetails(formData.class, selectedClassData.data.filename);
          }

          return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-12 h-12 border-4 border-fel-green border-t-transparent rounded-full animate-spin"></div>
              <p className="text-fel-green font-bold animate-pulse">Consulting the Grimoires...</p>
            </div>
          );
        }

        const skillChoices = classDetails?.startingProficiencies?.skills?.[0]?.choose;
        const maxChoices = skillChoices?.count || 0;
        const availableSkills = skillChoices?.from || [];

        // Racial proficiencies
        const racialProfs = (selectedRaceData?.data?.skillProficiencies?.[0] 
          ? Object.keys(selectedRaceData.data.skillProficiencies[0]).map(s => s.charAt(0).toUpperCase() + s.slice(1))
          : []).filter(s => ALL_SKILLS.includes(s));

        const toggleSkill = (skill: string) => {
          if (racialProfs.includes(skill)) return; // Can't toggle racial skills
          const newProfs = formData.proficiencies.includes(skill)
            ? formData.proficiencies.filter((p: string) => p !== skill)
            : formData.proficiencies.length < maxChoices
              ? [...formData.proficiencies, skill]
              : formData.proficiencies;
          setFormData({ ...formData, proficiencies: newProfs });
        };

        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center border-b-2 border-fel-green mb-6 pb-2">
              <h2 className="text-3xl text-fel-green">Skill Proficiencies</h2>
              <div className="px-4 py-1 rounded-full border-2 border-fel-green text-fel-green font-bold bg-abyssal-black/50">
                Class: {formData.proficiencies.length} / {maxChoices}
              </div>
            </div>

            {racialProfs.length > 0 && (
              <div className="p-4 bg-necrotic-purple/10 border-l-4 border-necrotic-purple mb-6">
                <p className="text-xs font-bold uppercase text-necrotic-purple mb-1">Racial Proficiencies</p>
                <div className="flex gap-2">
                  {racialProfs.map(s => (
                    <span key={s} className="px-2 py-1 bg-necrotic-purple text-bone text-[10px] font-bold rounded uppercase">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="text-bone/60 italic text-sm mb-4">
              Choose {maxChoices} skills from your class: {formData.class}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {ALL_SKILLS.map((skill) => {
                const isRacial = racialProfs.includes(skill);
                const isAvailable = availableSkills.includes(skill.toLowerCase());
                const isSelected = formData.proficiencies.includes(skill) || isRacial;
                const isDisabled = isRacial || (!isSelected && formData.proficiencies.length >= maxChoices);

                return (
                  <button
                    key={skill}
                    disabled={(!isAvailable && !isRacial) || isDisabled}
                    onClick={() => toggleSkill(skill)}
                    className={`p-4 border text-left transition-all cursor-pointer flex justify-between items-center ${
                      isRacial
                        ? 'bg-necrotic-purple/40 border-necrotic-purple text-bone font-bold opacity-100'
                        : isSelected 
                          ? 'bg-fel-green text-abyssal-black border-fel-green font-bold shadow-[0_0_15px_rgba(74,222,128,0.3)]' 
                          : isAvailable 
                            ? 'bg-abyssal-black/40 border-fel-green/20 text-bone/80 hover:border-fel-green/60' 
                            : 'bg-transparent border-bone/5 text-bone/20 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <span>{skill}</span>
                    {isSelected && <ChevronRight size={16} />}
                  </button>
                );
              })}
            </div>

            {formData.proficiencies.length === maxChoices && (
              <div className="pt-8 flex justify-center animate-in zoom-in">
                <button
                  onClick={nextStep}
                  className="bg-fel-green text-abyssal-black px-10 py-3 rounded-full font-bold uppercase tracking-widest hover:bg-white transition-all shadow-lg cursor-pointer"
                >
                  Confirm Proficiencies <ChevronRight className="inline-block ml-2" />
                </button>
              </div>
            )}
          </div>
        );
      }
      case 'Features': {
        const hasFeatRequirement = selectedRaceData?.data?.feats?.some((f: any) => f.any || f.anyFromCategory);
        
        const extractDesc = (entry: any): string => {
          if (typeof entry === 'string') return cleanText(entry);
          if (entry.entries) return entry.entries.map(extractDesc).join(' ');
          return '';
        };

        const racialTraits = selectedRaceData?.data?.entries?.filter((e: any) => e.name && e.entries).map((e: any) => ({
          name: cleanText(e.name),
          desc: extractDesc(e)
        })) || [];
        
        const selectedClassData = classes?.find(c => c.name === formData.class);
        const classFeatureData = selectedClassData?.data?.fullData?.classFeature || [];
        const subclassFeatureData = selectedClassData?.data?.fullData?.subclassFeature || [];
        
        let _selectedSubclassData: any = null;
        if (formData.subclass && selectedClassData?.data?.fullData?.subclass) {
            _selectedSubclassData = selectedClassData.data.fullData.subclass.find((sc: any) => sc.name === formData.subclass);
        }

        let rawClassFeatures = classFeatureData
          .filter((f: any) => f.level <= formData.level)
          .map((f: any) => ({
            name: cleanText(f.name),
            desc: extractDesc(f)
          }));

        if (_selectedSubclassData?.shortName) {
            const scFeatures = subclassFeatureData
              .filter((f: any) => f.level <= formData.level && f.subclassShortName === _selectedSubclassData.shortName)
              .map((f: any) => ({
                  name: cleanText(f.name),
                  desc: extractDesc(f)
              }));
            rawClassFeatures.push(...scFeatures);
        }

        const asiCount = rawClassFeatures.filter((f: any) => f.name === 'Ability Score Improvement').length;

        // Deduplicate
        const seenNames = new Set<string>();
        const classFeatures: any[] = [];
        for (const f of rawClassFeatures) {
          if (!seenNames.has(f.name)) {
            seenNames.add(f.name);
            classFeatures.push(f);
          }
        }

        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center border-b-2 border-fel-green mb-6 pb-2">
              <h2 className="text-3xl text-fel-green">Features & Traits</h2>
              <div className="text-xs font-bold text-bone/40 uppercase tracking-widest">
                Class & Race Abilities
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-necrotic-purple border-b border-necrotic-purple/30 pb-2">Racial Traits</h3>
                {racialTraits.length > 0 ? racialTraits.map((trait: any, idx: number) => (
                   <details key={idx} className="p-3 bg-necrotic-purple/10 border-l-2 border-necrotic-purple group cursor-pointer">
                      <summary className="text-bone font-bold text-sm outline-none">{trait.name}</summary>
                      <div className="mt-2 text-bone/70 text-xs italic leading-relaxed">
                        {trait.desc}
                      </div>
                   </details>
                )) : <div className="text-sm italic text-bone/40">No notable racial traits at level 1.</div>}

                {hasFeatRequirement && (
                  <div className="mt-6 p-4 bg-dnd-gold/10 border border-dnd-gold/30 rounded-lg">
                    <h4 className="text-dnd-gold font-bold uppercase text-xs mb-2">Bonus Feat Selection</h4>
                    <p className="text-xs text-bone/60 mb-4 italic">Your lineage grants you a bonus feat of your choice.</p>
                    <select
                      className="w-full bg-abyssal-black border border-dnd-gold/50 p-3 font-sans text-sm text-bone focus:outline-none focus:border-dnd-gold"
                      value={typeof formData.feats?.[0] === 'string' ? formData.feats[0] : formData.feats?.[0]?.name || ''}
                      onChange={(e) => {
                        const featObj = featsList?.find(f => f.name === e.target.value);
                        if (featObj) {
                          const newFeats = [...(formData.feats || [])];
                          newFeats[0] = { name: featObj.name, desc: extractDesc(featObj.data) };
                          setFormData({ ...formData, feats: newFeats });
                        }
                      }}
                    >
                      <option value="">Select a Feat...</option>
                      {featsList?.sort((a,b) => a.name.localeCompare(b.name)).map(f => (
                        <option key={f.id} value={f.name}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {asiCount > 0 && Array.from({ length: asiCount }).map((_, i) => {
                  const featIndex = hasFeatRequirement ? i + 1 : i;
                  return (
                    <div key={`asi-${i}`} className="mt-4 p-4 bg-dnd-gold/10 border border-dnd-gold/30 rounded-lg">
                      <h4 className="text-dnd-gold font-bold uppercase text-xs mb-2">Ability Score Improvement / Feat {i + 1}</h4>
                      <p className="text-xs text-bone/60 mb-4 italic">Choose a feat for this ASI level.</p>
                      <select
                        className="w-full bg-abyssal-black border border-dnd-gold/50 p-3 font-sans text-sm text-bone focus:outline-none focus:border-dnd-gold"
                        value={typeof formData.feats?.[featIndex] === 'string' ? formData.feats[featIndex] : formData.feats?.[featIndex]?.name || ''}
                        onChange={(e) => {
                          const featObj = featsList?.find(f => f.name === e.target.value);
                          if (featObj) {
                            const newFeats = [...(formData.feats || [])];
                            newFeats[featIndex] = { name: featObj.name, desc: extractDesc(featObj.data) };
                            setFormData({ ...formData, feats: newFeats });
                          }
                        }}
                      >
                        <option value="">Select a Feat...</option>
                        {featsList?.sort((a,b) => a.name.localeCompare(b.name)).map(f => (
                          <option key={f.id} value={f.name}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}

                {racialTraits.some((t: any) => t.name === 'Variable Trait') && (
                  <div className="mt-6 p-4 bg-dnd-gold/10 border border-dnd-gold/30 rounded-lg">
                    <h4 className="text-dnd-gold font-bold uppercase text-xs mb-2">Variable Trait</h4>
                    <p className="text-xs text-bone/60 mb-4 italic">Choose between darkvision or a skill proficiency.</p>
                    <select
                      className="w-full bg-abyssal-black border border-dnd-gold/50 p-3 font-sans text-sm text-bone focus:outline-none focus:border-dnd-gold"
                      value={formData.resources.variableTrait || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        resources: { ...formData.resources, variableTrait: e.target.value } 
                      })}
                    >
                      <option value="">Select an option...</option>
                      <option value="Darkvision (60 ft.)">Darkvision (60 feet)</option>
                      {ALL_SKILLS.map(s => <option key={s} value={`Skill: ${s}`}>Proficiency: {s}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-bold text-fel-green border-b border-fel-green/30 pb-2">Class Features</h3>
                {classFeatures.length > 0 ? classFeatures.map((feat: any, idx: number) => (
                   <details key={idx} className="p-3 bg-fel-green/10 border-l-2 border-fel-green group cursor-pointer">
                      <summary className="text-bone font-bold text-sm outline-none">{feat.name}</summary>
                      <div className="mt-2 text-bone/70 text-xs italic leading-relaxed">
                        {feat.desc}
                      </div>
                   </details>
                )) : <div className="text-sm italic text-bone/40">No notable class features at level 1.</div>}
              </div>
            </div>

            <div className="pt-8 flex justify-center">
              <button
                disabled={hasFeatRequirement && (!formData.feats || formData.feats.length === 0)}
                onClick={() => {
                  let finalTraits = [...racialTraits, ...classFeatures];
                  let finalProfs = [...formData.proficiencies];

                  if (formData.resources.variableTrait) {
                    if (formData.resources.variableTrait.startsWith('Skill: ')) {
                      const skill = formData.resources.variableTrait.replace('Skill: ', '');
                      if (!finalProfs.includes(skill)) finalProfs.push(skill);
                    } else {
                      // It's darkvision, replace the placeholder trait or just push it
                      finalTraits = finalTraits.map(t => 
                        t.name === 'Variable Trait' 
                          ? { name: 'Darkvision', desc: 'You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.' }
                          : t
                      );
                    }
                  }

                  setFormData({ ...formData, traits: finalTraits, proficiencies: finalProfs });
                  nextStep();
                }}
                className="bg-fel-green text-abyssal-black px-10 py-3 rounded-full font-bold uppercase tracking-widest hover:bg-white transition-all shadow-lg cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
              >
                Continue to Equipment <ChevronRight className="inline-block ml-2" />
              </button>
            </div>
          </div>
        );
      }
      case 'Equipment': {
        const selectedClassData = classes?.find(c => c.name === formData.class);
        const classDetails = selectedClassData?.data?.fullData?.class?.find((c: any) => c.name === formData.class);
        
        if (!classDetails) {
          if (selectedClassData?.data?.filename && !selectedClassData?.data?.fullData) {
              fetchClassDetails(formData.class, selectedClassData.data.filename);
          }

          return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-12 h-12 border-4 border-fel-green border-t-transparent rounded-full animate-spin"></div>
              <p className="text-fel-green font-bold animate-pulse">Consulting the Grimoires...</p>
            </div>
          );
        }

        const equipmentOptions = classDetails?.startingEquipment?.default || [];
        const equipmentData = classDetails?.startingEquipment?.defaultData || [];

        const toggleEquipment = (index: number, choice: 'a' | 'b') => {
          const newEquipment = { ...formData.resources.equipmentChoices, [index]: choice };
          setFormData({ 
            ...formData, 
            resources: { ...formData.resources, equipmentChoices: newEquipment } 
          });
        };

        const renderSpecifics = (idx: number, choiceKey: 'a' | 'b') => {
          const currentChoice = formData.resources.equipmentChoices?.[idx];
          if (currentChoice !== choiceKey) return null;
          
          const dataArray = equipmentData[idx]?.[choiceKey] || [];
          
          return dataArray.map((itemObj: any, itemIdx: number) => {
            if (itemObj.equipmentType) {
               const options = WEAPONS[itemObj.equipmentType] || WEAPONS.weaponSimple;
               const qty = itemObj.quantity || 1;
               return Array.from({length: qty}).map((_, qIdx) => (
                 <div key={`${itemIdx}-${qIdx}`} className="mt-2 text-abyssal-black" onClick={e => e.stopPropagation()}>
                   <select 
                     className="w-full bg-parchment-base border border-fel-green/30 p-2 font-sans text-xs focus:outline-none"
                     value={formData.resources.equipmentSpecifics?.[idx]?.[choiceKey]?.[`${itemIdx}-${qIdx}`] || ''}
                     onChange={(e) => {
                       const newSpecifics = { ...(formData.resources.equipmentSpecifics || {}) };
                       if (!newSpecifics[idx]) newSpecifics[idx] = {};
                       if (!newSpecifics[idx][choiceKey]) newSpecifics[idx][choiceKey] = {};
                       newSpecifics[idx][choiceKey][`${itemIdx}-${qIdx}`] = e.target.value;
                       setFormData({ ...formData, resources: { ...formData.resources, equipmentSpecifics: newSpecifics }});
                     }}
                   >
                      <option value="">Select a specific weapon...</option>
                      {options.map(o => <option key={o} value={o}>{o}</option>)}
                   </select>
                 </div>
               ));
            }
            return null;
          });
        };

        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center border-b-2 border-fel-green mb-6 pb-2">
              <h2 className="text-3xl text-fel-green">Starting Equipment</h2>
              <div className="text-xs font-bold text-bone/40 uppercase tracking-widest">
                Choose your gear
              </div>
            </div>

            <div className="space-y-8">
              {equipmentOptions.map((opt: string, idx: number) => {
                const isAutomatic = equipmentData[idx] && equipmentData[idx]['_'];
                
                if (isAutomatic || opt.split(' or ').length < 2) {
                  return (
                    <div key={idx} className="p-4 bg-abyssal-black/30 border border-fel-green/10 text-bone/60 italic text-sm">
                      {cleanText(opt)}
                    </div>
                  );
                }

                const currentChoice = formData.resources.equipmentChoices?.[idx] || 'a';
                const availableKeys = equipmentData[idx] 
                   ? Object.keys(equipmentData[idx]).filter(k => k !== '_') 
                   : ['a', 'b'];

                const parts = opt.split(' or ');
                
                return (
                  <div key={idx} className="flex flex-col gap-4 relative border border-fel-green/10 p-4 bg-abyssal-black/20">
                    <div className="text-xs text-bone/40 italic mb-2">{cleanText(opt)}</div>
                    <div className={`grid grid-cols-1 ${availableKeys.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 relative`}>
                      {availableKeys.map((key) => {
                        // Extract option text roughly if possible
                        let choiceText = cleanText(parts[0] || opt);
                        if (key === 'a') choiceText = cleanText(parts[0]?.replace('(a) ', '') || opt);
                        if (key === 'b') choiceText = cleanText(parts[1]?.replace('(b) ', '') || opt);
                        if (key === 'c') choiceText = cleanText(parts[2]?.replace('(c) ', '') || opt);

                        return (
                          <button
                            key={key}
                            onClick={() => toggleEquipment(idx, key as 'a' | 'b')}
                            className={`p-4 border text-left transition-all cursor-pointer relative overflow-hidden group ${
                              currentChoice === key
                                ? 'bg-fel-green/20 border-fel-green text-bone shadow-[0_0_15px_rgba(74,222,128,0.2)]'
                                : 'bg-abyssal-black/40 border-fel-green/10 text-bone/40 hover:border-fel-green/40'
                            }`}
                          >
                            <div className="text-[10px] font-black uppercase mb-1 opacity-30">Option {key.toUpperCase()}</div>
                            <div className="text-sm leading-relaxed">{choiceText}</div>
                            {currentChoice === key && <div className="absolute top-0 right-0 bg-fel-green text-abyssal-black px-2 py-0.5 text-[8px] font-bold">Selected</div>}
                            {renderSpecifics(idx, key as 'a' | 'b')}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-8 flex justify-center">
              <button
                disabled={Object.keys(formData.resources.equipmentChoices || {}).length < equipmentOptions.filter((o: string) => o.includes(' or ')).length}
                onClick={nextStep}
                className="bg-fel-green text-abyssal-black px-12 py-4 rounded-full font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
              >
                Review Hero <ChevronRight className="inline-block ml-2" />
              </button>
            </div>
          </div>
        );
      }
      case 'Review':
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="border-b-2 border-fel-green pb-2">
              <h2 className="text-3xl text-fel-green">Review Your Hero</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="p-4 bg-abyssal-black/40 border border-fel-green/20">
                  <label className="text-[10px] font-bold uppercase text-fel-green/40 block">Identity</label>
                  <div className="text-2xl font-bold text-bone">{formData.name}</div>
                  <div className="text-sm text-fel-green italic">Level {formData.level} {formData.race} {formData.class}</div>
                </div>

                <div className="p-4 bg-abyssal-black/40 border border-fel-green/20">
                  <label className="text-[10px] font-bold uppercase text-fel-green/40 block mb-2">Proficiencies</label>
                  <div className="flex flex-wrap gap-2">
                    {formData.proficiencies.map((p: string) => (
                      <span key={p} className="px-2 py-1 bg-fel-green/10 border border-fel-green/30 text-fel-green text-[10px] font-bold uppercase rounded">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>

                {formData.feats && formData.feats.length > 0 && (
                  <div className="p-4 bg-necrotic-purple/10 border border-necrotic-purple/30">
                    <label className="text-[10px] font-bold uppercase text-necrotic-purple/60 block mb-2">Bonus Feat</label>
                    <div className="text-sm font-bold text-bone">{typeof formData.feats[0] === 'string' ? formData.feats[0] : formData.feats[0].name}</div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-abyssal-black/40 border border-fel-green/20">
                  <label className="text-[10px] font-bold uppercase text-fel-green/40 block mb-2">Features</label>
                  <div className="space-y-1">
                    {formData.traits?.length > 0 ? formData.traits.map((trait: any, i: number) => (
                      <div key={i} className="text-xs text-bone/80 border-b border-bone/5 pb-1">
                        {typeof trait === 'string' ? trait : trait.name}
                      </div>
                    )) : <div className="text-xs italic text-bone/20">No features mapped.</div>}
                  </div>
                </div>

                <div className="p-4 bg-abyssal-black/40 border border-fel-green/20">
                  <label className="text-[10px] font-bold uppercase text-fel-green/40 block mb-2">Inventory</label>
                  <div className="space-y-1">
                    {formData.inventory.length > 0 ? formData.inventory.map((item: string, i: number) => (
                      <div key={i} className="text-xs text-bone/60 border-b border-bone/5 pb-1 flex justify-between">
                        <span>{item}</span>
                        <span className="opacity-30 italic">x1</span>
                      </div>
                    )) : <div className="text-xs italic text-bone/20">No items selected yet.</div>}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-12 flex flex-col items-center space-y-4 border-t border-fel-green/20">
              <p className="text-sm italic text-bone/40 text-center max-w-md">
                "Your legend begins here. Is your resolve absolute, or do you wish to refine your path?"
              </p>
              <button
                onClick={saveCharacter}
                className="bg-fel-green text-abyssal-black px-16 py-5 rounded-full font-black uppercase tracking-[0.2em] hover:bg-white hover:scale-105 transition-all shadow-[0_0_30px_rgba(74,222,128,0.5)] cursor-pointer group"
              >
                Finalize Hero <Save className="inline-block ml-2 group-hover:rotate-12 transition-transform" />
              </button>
            </div>
          </div>
        );
      default:
        return (
          <div className="text-center py-20 italic text-bone/30">
            {STEPS[currentStep]} implementation in progress...
          </div>
        );
    }
  };

  return (
    <div className="max-w-4xl w-full bg-[#1a0f2e] p-8 md:p-12 book-shadow bone-border relative">
      <header className="border-b-2 border-fel-green pb-4 mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl uppercase tracking-tighter text-fel-green">Character Creator</h1>
          <p className="text-sm italic text-bone underline decoration-necrotic-purple underline-offset-4">
            Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep]}
          </p>
        </div>
        <div className="flex gap-2">
          {STEPS.map((step, i) => (
            <button 
              key={i} 
              disabled={!editingCharacter && i > currentStep}
              onClick={() => setCurrentStep(i)}
              className={`h-2 w-8 rounded-full transition-all ${i <= currentStep ? 'bg-fel-green' : 'bg-necrotic-purple/30'} ${editingCharacter || i <= currentStep ? 'cursor-pointer hover:bg-fel-green/60' : 'cursor-not-allowed'}`}
              title={step}
            />
          ))}
        </div>
      </header>

      <div className="min-h-[400px]">
        {renderStep()}
      </div>

      <footer className="mt-12 pt-8 border-t-2 border-necrotic-purple flex justify-between">
        <button
          onClick={prevStep}
          disabled={currentStep === 0}
          className="flex items-center gap-2 font-bold uppercase text-bone/50 disabled:opacity-30 cursor-pointer hover:text-bone"
        >
          <ChevronLeft /> Back
        </button>
        
        {currentStep < STEPS.length - 1 ? (
          <button
            onClick={nextStep}
            disabled={!canProgress()}
            className={`px-8 py-3 rounded-full font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer shadow-lg disabled:cursor-not-allowed ${
                canProgress() 
                  ? 'bg-fel-green text-abyssal-black hover:scale-105 shadow-[0_0_20px_rgba(74,222,128,0.4)]' 
                  : 'bg-necrotic-purple/20 text-bone/20 border border-necrotic-purple/30'
            }`}
          >
            Continue <ChevronRight />
          </button>
        ) : (
          <button
            onClick={saveCharacter}
            disabled={!canProgress()}
            className={`px-8 py-3 rounded-full font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer shadow-lg disabled:cursor-not-allowed ${
                canProgress() 
                  ? 'bg-fel-green text-abyssal-black hover:scale-105 shadow-[0_0_20px_rgba(74,222,128,0.4)]' 
                  : 'bg-necrotic-purple/20 text-bone/20 border border-necrotic-purple/30'
            }`}
          >
            Save Character <Save />
          </button>
        )}
      </footer>
    </div>
  );
}
