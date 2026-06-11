import { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { CharacterSchema } from '../../lib/schemas';
import { ChevronLeft, ChevronRight, Save, Sun, Moon } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { fetchAndCache5eData, fetchClassDetails } from '../../lib/dataFetcher';
import { CharacterImage } from './CharacterImage';
import { session, encryptData, bufToHex } from '../../lib/security';

type Step = 'Ruleset' | 'Basics' | 'Background' | 'Abilities' | 'Proficiencies' | 'Features' | 'Spells' | 'Equipment' | 'Review';

const STEPS: Step[] = ['Ruleset', 'Basics', 'Background', 'Abilities', 'Proficiencies', 'Features', 'Spells', 'Equipment', 'Review'];

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

const isSource2024 = (source?: string): boolean => {
  if (!source) return false;
  return source === 'XPHB' || source === 'XDMG' || source === 'XMM' || source.endsWith('24');
};

export function CharacterBuilder({ onComplete, editingCharacter }: { onComplete: () => void, editingCharacter?: any }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || saved === null;
  });
  const toggleTheme = () => {
    const val = document.body.classList.toggle('dark');
    localStorage.setItem('theme', val ? 'dark' : 'light');
    setIsDark(val);
  };

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [activeSpellTab, setActiveSpellTab] = useState<string>('');
  const [spellSearchQuery, setSpellSearchQuery] = useState('');
  
  const initialData = editingCharacter ? {
      ...editingCharacter,
      portraitUrl: editingCharacter.portraitUrl || '',
      tokenUrl: editingCharacter.tokenUrl || '',
      stats: editingCharacter.resources?.baseStats || editingCharacter.stats,
      classes: editingCharacter.classes || [{ name: editingCharacter.class || '', level: editingCharacter.level || 1, subclass: editingCharacter.subclass || '' }]
  } : {
    name: '',
    portraitUrl: '',
    tokenUrl: '',
    ruleset: '2014',
    race: '',
    background: '',
    classes: [{ name: '', level: 1, subclass: '' }],
    size: 'Medium',
    alignment: 'True Neutral',
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
    languages: ['Common'],
    traits: [],
    feats: [],
    inventory: [],
    spells: [],
    resources: {},
  };

  const [formData, setFormData] = useState<any>(initialData);
  const [portraitBlob, setPortraitBlob] = useState<Blob | null>(null);
  const [tokenBlob, setTokenBlob] = useState<Blob | null>(null);
  const [sessionUrls, setSessionUrls] = useState<string[]>([]);

  useEffect(() => {
    return () => {
      sessionUrls.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [sessionUrls]);

  const races = useLiveQuery(async () => {
    const data = await db.fiveetools.where('type').equals('race').toArray();
    const seen = new Set<string>();
    return data.filter(r => {
      const key = `${r.name}-${r.data?.source}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
  const classes = useLiveQuery(() => db.fiveetools.where('type').equals('class').toArray());
  const featsList = useLiveQuery(async () => {
    const data = await db.fiveetools.where('type').equals('feat').toArray();
    const seen = new Set<string>();
    return data.filter(f => {
      const key = `${f.name}-${f.data?.source}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
  const backgrounds = useLiveQuery(async () => {
    const data = await db.fiveetools.where('type').equals('background').toArray();
    const seen = new Set<string>();
    return data.filter(b => {
      const key = `${b.name}-${b.data?.source}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
  const spellsList = useLiveQuery(async () => {
    const data = await db.fiveetools.where('type').equals('spell').toArray();
    const seen = new Set<string>();
    return data.filter(s => {
      const key = `${s.name}-${s.data?.source}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

  const selectedRaceData = races?.find(r => r.name === formData.race);

  const getRacialChoices = () => {
    if (!selectedRaceData?.data?.ability) return [];
    const choices: any[] = [];
    
    const abList = Array.isArray(selectedRaceData.data.ability) 
      ? selectedRaceData.data.ability 
      : [selectedRaceData.data.ability];

    abList.forEach((ab: any, idx: number) => {
      if (ab && ab.choose) {
        const chooseList = Array.isArray(ab.choose) ? ab.choose : [ab.choose];
        chooseList.forEach((c: any, cIdx: number) => {
          choices.push({
            id: `choice-${idx}-${cIdx}`,
            count: c.count || 1,
            amount: c.amount || 1,
            from: c.from || ['str', 'dex', 'con', 'int', 'wis', 'cha']
          });
        });
      }
    });
    return choices;
  };

  const computeRacialChoiceBonuses = (selections: Record<string, string[]>, choices: any[]) => {
    const bonuses: Record<string, number> = {};
    choices.forEach(c => {
      const selectedStats = selections[c.id] || [];
      selectedStats.forEach(stat => {
        const fullNameMapping: Record<string, string> = {
          str: 'strength', dex: 'dexterity', con: 'constitution',
          int: 'intelligence', wis: 'wisdom', cha: 'charisma',
          strength: 'strength', dexterity: 'dexterity', constitution: 'constitution',
          intelligence: 'intelligence', wisdom: 'wisdom', charisma: 'charisma'
        };
        const key = fullNameMapping[stat.toLowerCase()] || stat.toLowerCase();
        bonuses[key] = (bonuses[key] || 0) + c.amount;
      });
    });
    return bonuses;
  };

  const cleanText = (text: string) => {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\{@\w+ ([^|}]+)(?:\|[^}]*)?\}/g, '$1') // Handle {@tag text|optional}
      .replace(/\{@\w+ ([^}]+)\}/g, '$1') // Handle simple {@tag text}
      .trim();
  };

  const extractDesc = (entry: any): string => {
    if (typeof entry === 'string') return cleanText(entry);
    if (entry.entries) return entry.entries.map(extractDesc).join(' ');
    return '';
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

    const source = selectedRaceData.data.source ? ` [Source: ${selectedRaceData.data.source}]` : '';
    return (cleanText(description) || 'A unique lineage with diverse abilities.') + source;
  };

  const getClassDescription = (className: string) => {
    const classData = classes?.find(c => c.name === className);
    const source = classData?.data?.fullData?.class?.[0]?.source ? ` [Source: ${classData.data.fullData.class[0].source}]` : '';
    
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
    return cleanText(descriptions[className] || 'A hero with specialized skills and powerful potential.') + source;
  };

  const getRacialBonus = (statName: string) => {
    if (!selectedRaceData?.data?.ability) return 0;
    const key = statName.toLowerCase().substring(0, 3);
    let bonus = 0;
    
    const abList = Array.isArray(selectedRaceData.data.ability) 
      ? selectedRaceData.data.ability 
      : [selectedRaceData.data.ability];

    abList.forEach((ab: any) => {
      if (ab && ab[key] && typeof ab[key] === 'number') {
        bonus += ab[key];
      }
    });

    const fullStatName = statName.toLowerCase();
    const chosenBonus = formData.resources.racialAbilityChoice?.[fullStatName] || 0;
    bonus += chosenBonus;

    return bonus;
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
    fetchAndCache5eData('backgrounds');
    fetchAndCache5eData('spells');
  }, []);

  // Fetch full class data if editing an existing character
  useEffect(() => {
    if (formData.classes && classes) {
      formData.classes.forEach((cls: any) => {
        if (!cls.name) return;
        const classData = classes.find(c => c.name === cls.name);
        if (classData?.data?.filename && !classData.data.fullData) {
          fetchClassDetails(cls.name, classData.data.filename).catch(console.error);
        }
      });
    }
  }, [formData.classes, classes]);

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const saveCharacter = async () => {
    try {
      setValidationErrors([]);
      const racialProfs = (selectedRaceData?.data?.skillProficiencies?.[0] 
        ? Object.keys(selectedRaceData.data.skillProficiencies[0]).map(s => s.charAt(0).toUpperCase() + s.slice(1))
        : []).filter(s => ALL_SKILLS.includes(s));

      const allProficiencies = Array.from(new Set([...formData.proficiencies, ...racialProfs]));

      // Calculate base stats and apply ASI and racial bonuses
      const finalStats = { ...formData.stats };
      Object.keys(finalStats).forEach(stat => {
        finalStats[stat] = (finalStats[stat] || 0) + getRacialBonus(stat);
      });
      const newResources = { ...formData.resources, baseStats: formData.stats };
      const appliedFeats: any[] = []; // Regenerate from scratch

      if (formData.resources.asiChoices) {
        formData.resources.asiChoices.forEach((choice: any) => {
          if (choice.type === 'asi' && choice.stats) {
            Object.keys(choice.stats).forEach(stat => {
              finalStats[stat] = (finalStats[stat] || 0) + (choice.stats[stat] || 0);
            });
          } else if (choice.type === 'feat' && choice.featName) {
            const featObj = featsList?.find(f => f.name === choice.featName);
            if (featObj) {
              appliedFeats.push({ name: featObj.name, desc: extractDesc(featObj.data) });
            } else {
              appliedFeats.push({ name: choice.featName, desc: '' });
            }
          }
        });
      }

      if (formData.resources.bonusFeat) {
        const featObj = featsList?.find(f => f.name === formData.resources.bonusFeat);
        if (featObj) {
          appliedFeats.push({ name: featObj.name, desc: extractDesc(featObj.data) });
        } else {
          appliedFeats.push({ name: formData.resources.bonusFeat, desc: '' });
        }
      }

      const racialTraits = selectedRaceData?.data?.entries?.filter((e: any) => e.name && e.entries).map((e: any) => ({
        name: cleanText(e.name),
        desc: extractDesc(e),
        source: e.source || selectedRaceData.data.source
      })) || [];

      const rawClassFeatures: any[] = [];
      let totalMaxHp = 0;
      const conMod = Math.floor((finalStats.constitution - 10) / 2);

      // Extract equipment and compute HP/Features from all classes
      const inventory: any[] = formData.inventory?.length > 0 ? [...formData.inventory] : []; // Preserve existing inventory if it exists
      
      formData.classes.forEach((cls: any, index: number) => {
        const selectedClassData = classes?.find(c => c.name === cls.name);
        const classDetails = selectedClassData?.data?.fullData?.class?.find((c: any) => c.name === cls.name);
        
        // HP Calculation
        if (classDetails && classDetails.hd && classDetails.hd.faces) {
          const hitDie = Array.isArray(classDetails.hd.faces) ? classDetails.hd.faces[0] : classDetails.hd.faces;
          const isFirstClass = index === 0;
          if (isFirstClass) {
             totalMaxHp += hitDie + conMod; // Max HD at level 1
             if (cls.level > 1) {
                totalMaxHp += Math.floor((hitDie / 2 + 1) + conMod) * (cls.level - 1);
             }
          } else {
             totalMaxHp += Math.floor((hitDie / 2 + 1) + conMod) * cls.level;
          }
        }

        // Features Calculation
        const classFeatureData = selectedClassData?.data?.fullData?.classFeature || [];
        const subclassFeatureData = selectedClassData?.data?.fullData?.subclassFeature || [];
        
        let selectedSubclassData: any = null;
        if (cls.subclass && selectedClassData?.data?.fullData?.subclass) {
            const matchingSubclasses = selectedClassData.data.fullData.subclass.filter((sc: any) => sc.name === cls.subclass);
            selectedSubclassData = matchingSubclasses.find((sc: any) => {
                const is2024 = isSource2024(sc.source);
                if (formData.ruleset === '2014') {
                    return !is2024;
                } else {
                    if (is2024) return true;
                    const has2024Version = matchingSubclasses.some((other: any) => isSource2024(other.source));
                    return !has2024Version;
                }
            });
            if (!selectedSubclassData) {
                selectedSubclassData = matchingSubclasses[0];
            }
        }

        const classFeatures = classFeatureData
          .filter((f: any) => {
            if (f.level > cls.level) return false;
            const is2024 = isSource2024(f.source);
            return formData.ruleset === '2024' ? is2024 : !is2024;
          })
          .map((f: any) => ({
            name: cleanText(f.name),
            desc: extractDesc(f),
            level: f.level,
            className: cls.name,
            source: f.source
          }));
        
        rawClassFeatures.push(...classFeatures);

        if (selectedSubclassData?.shortName) {
            const scFeatures = subclassFeatureData
              .filter((f: any) => {
                if (f.level > cls.level) return false;
                if (f.subclassShortName !== selectedSubclassData.shortName) return false;
                return f.subclassSource === selectedSubclassData.source;
              })
              .map((f: any) => ({
                  name: cleanText(f.name),
                  desc: extractDesc(f),
                  level: f.level,
                  className: cls.name,
                  subclass: cls.subclass,
                  source: f.source
              }));
            rawClassFeatures.push(...scFeatures);
        }

        const equipmentOptions = classDetails?.startingEquipment?.default || [];
        const equipmentData = classDetails?.startingEquipment?.defaultData || [];
        
        // Generate starting equipment if not already added
        equipmentOptions.forEach((opt: string, idx: number) => {
            const isAutomatic = equipmentData[idx] && equipmentData[idx]['_'];
            const choiceKey = isAutomatic ? '_' : (formData.resources.equipmentChoices?.[`${cls.name}-${idx}`] || 'a');
            
            if (equipmentData.length > 0 && equipmentData[idx] && equipmentData[idx][choiceKey]) {
                equipmentData[idx][choiceKey].forEach((itemObj: any, itemIdx: number) => {
                  if (typeof itemObj === 'string') {
                    const name = cleanText(itemObj.split('|')[0]);
                    if (!inventory.some(i => i.name === name)) {
                        inventory.push({ name, quantity: 1 });
                    }
                  } else if (itemObj.item) {
                      const name = cleanText(itemObj.item.split('|')[0]);
                      if (!inventory.some(i => i.name === name)) {
                        inventory.push({ name, quantity: itemObj.quantity || 1 });
                      }
                  } else if (itemObj.equipmentType) {
                      const qty = itemObj.quantity || 1;
                      for (let qIdx = 0; qIdx < qty; qIdx++) {
                          const spec = formData.resources.equipmentSpecifics?.[`${cls.name}-${idx}`]?.[choiceKey]?.[`${itemIdx}-${qIdx}`];
                          const defaultWep = (WEAPONS[itemObj.equipmentType] || WEAPONS.weaponSimple)[0];
                          const name = cleanText(spec || defaultWep);
                          if (!inventory.some(i => i.name === name)) {
                              inventory.push({ name, quantity: 1 });
                          }
                      }
                  }
                });
            } else if (!isAutomatic && opt.split(' or ').length < 2) {
                opt.split(/ and /i).forEach(s => {
                  const name = cleanText(s.replace(/^[Aa]n? /, '').trim());
                  if (!inventory.some(i => i.name === name)) {
                    inventory.push({ name, quantity: 1 });
                  }
                });
            }
        });
      });

      // Deduplicate features by name (except ASI)
      const seenNames = new Set<string>();
      const finalClassFeatures: any[] = [];
      for (const f of rawClassFeatures) {
        if (f.name === 'Ability Score Improvement' || f.name === 'Ability Score Improvement (2024)') continue;
        if (!seenNames.has(f.name)) {
          seenNames.add(f.name);
          finalClassFeatures.push(f);
        }
      }

      let finalTraits = [...racialTraits, ...finalClassFeatures];

      // Variable Trait
      if (formData.resources.variableTrait && !formData.resources.variableTrait.startsWith('Skill: ')) {
        finalTraits = finalTraits.map(t => 
          t.name === 'Variable Trait' 
            ? { name: 'Darkvision', desc: 'You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.', source: t.source }
            : t
        );
      }

      // Add background trait if present
      if (formData.background) {
        const bg = backgrounds?.find(b => b.name === formData.background);
        if (bg) {
           finalTraits.push({ name: bg.name, desc: extractDesc(bg.data), source: bg.data.source });
        }
      }

      if (newResources.fightingStyle) {
        finalTraits.push({
          name: `Fighting Style: ${newResources.fightingStyle}`,
          desc: 'Your chosen fighting style specialty.',
          source: 'Class Feature'
        });
      }

      if (newResources.pactBoon) {
        finalTraits.push({
          name: `Pact Boon: ${newResources.pactBoon}`,
          desc: 'A gift from your otherworldly patron.',
          source: 'Class Feature'
        });
      }

      if (newResources.warlockInvocations?.length > 0) {
        finalTraits.push({
          name: 'Eldritch Invocations',
          desc: newResources.warlockInvocations.join(', '),
          source: 'Class Feature'
        });
      }

      if (newResources.metamagic?.length > 0) {
        finalTraits.push({
          name: 'Metamagic Options',
          desc: newResources.metamagic.join(', '),
          source: 'Class Feature'
        });
      }

      if (newResources.maneuvers?.length > 0) {
        finalTraits.push({
          name: 'Combat Maneuvers',
          desc: newResources.maneuvers.join(', '),
          source: 'Class Feature'
        });
      }

      const validClasses = formData.classes.filter((c: any) => c.name.trim() !== '');

      // Compute Subclass Spells to ensure they are saved
      const subclassSpells = new Map<string, string>(); // spellName -> className
      validClasses.forEach((cls: any) => {
        const selectedClassData = classes?.find(c => c.name === cls.name);
        const subclassFeatureData = selectedClassData?.data?.fullData?.subclassFeature || [];
        
        let selectedSubclassData: any = null;
        if (cls.subclass && selectedClassData?.data?.fullData?.subclass) {
            const matchingSubclasses = selectedClassData.data.fullData.subclass.filter((sc: any) => sc.name === cls.subclass);
            selectedSubclassData = matchingSubclasses.find((sc: any) => {
                const is2024 = isSource2024(sc.source);
                if (formData.ruleset === '2014') {
                    return !is2024;
                } else {
                    if (is2024) return true;
                    const has2024Version = matchingSubclasses.some((other: any) => isSource2024(other.source));
                    return !has2024Version;
                }
            });
            if (!selectedSubclassData) {
                selectedSubclassData = matchingSubclasses[0];
            }
        }

        const features = subclassFeatureData.filter((f: any) => 
            f.level <= cls.level && 
            selectedSubclassData && 
            f.subclassShortName === selectedSubclassData.shortName &&
            f.subclassSource === selectedSubclassData.source
        );
        
        features.forEach((f: any) => {
           if ((f.name.toLowerCase().includes('spells') || f.name.toLowerCase().includes('magic') || f.name.toLowerCase().includes('expanded')) && f.entries) {
               const table = f.entries.find((e: any) => e.type === 'table');
               if (table && table.rows) {
                   table.rows.forEach((row: any) => {
                      const lvlStr = row[0]?.toString().toLowerCase() || "";
                      const featureLvl = parseInt(lvlStr.replace(/\D/g, ''));
                      
                      if (!featureLvl || cls.level >= featureLvl) {
                          const spellMatch = row[1]?.match(/\{@spell ([^|}]+)/g);
                          if (spellMatch) {
                              spellMatch.forEach((m: string) => {
                                  const name = m.replace(/\{@spell /, '').replace(/\}/, '').split('|')[0].trim().toLowerCase();
                                  subclassSpells.set(name, cls.name);
                              });
                          }
                      }
                   });
               }
           }
        });
      });

      const finalSpells = [...(formData.spells || [])];
      subclassSpells.forEach((className, scSpellName) => {
          if (!finalSpells.some((s: any) => s.name.toLowerCase() === scSpellName)) {
              const spellData = spellsList?.find(s => s.name.toLowerCase() === scSpellName);
              if (spellData) {
                  finalSpells.push({ 
                      name: spellData.name, 
                      level: spellData.data.level, 
                      desc: extractDesc(spellData.data), 
                      source: spellData.data.source, 
                      isAlwaysPrepared: true,
                      class: className
                  });
              }
          } else {
              const idx = finalSpells.findIndex((s: any) => s.name.toLowerCase() === scSpellName);
              if (idx !== -1) {
                  finalSpells[idx] = {
                      ...finalSpells[idx],
                      isAlwaysPrepared: true,
                      class: className
                  };
              }
          }
      });

      const validated = CharacterSchema.parse({
        ...formData,
        classes: validClasses,
        resources: newResources,
        hp: { current: Math.max(1, totalMaxHp), max: Math.max(1, totalMaxHp), temp: 0 },
        stats: finalStats,
        traits: finalTraits,
        feats: appliedFeats,
        proficiencies: allProficiencies,
        languages: [...formData.languages, ...(formData.resources.languageChoices || [])],
        spells: finalSpells,
        inventory: inventory, // Preserved or generated
        creator: formData.creator || session.username || 'Local Player',
        lastModified: Date.now(),
      });
      
      let charId = formData.id;
      const savePortrait = portraitBlob && formData.portraitUrl?.startsWith('blob:');
      const saveToken = tokenBlob && formData.tokenUrl?.startsWith('blob:');

      const encryptBlob = async (blob: Blob, imgId: string, user: string, key: CryptoKey) => {
        const arrayBuffer = await blob.arrayBuffer();
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await window.crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          arrayBuffer
        );
        await db.encrypted_images.put({
          id: imgId,
          username: user,
          ciphertextHex: bufToHex(encrypted),
          ivHex: bufToHex(iv.buffer)
        });
      };

      const encryptAndSaveCharacter = async (charData: any, cId: number | undefined, user: string, key: CryptoKey) => {
        const plainText = JSON.stringify(charData);
        const { ciphertextHex, ivHex } = await encryptData(plainText, key);
        if (cId) {
          await db.encrypted_characters.put({
            id: cId,
            username: user,
            ciphertextHex,
            ivHex,
            lastModified: Date.now()
          });
          return cId;
        } else {
          const newId = await db.encrypted_characters.add({
            username: user,
            ciphertextHex,
            ivHex,
            lastModified: Date.now()
          });
          return newId;
        }
      };

      if (session.key && session.username) {
        if (charId) {
          if (savePortrait) {
            await encryptBlob(portraitBlob!, `portrait-${charId}`, session.username, session.key);
            validated.portraitUrl = `local:portrait-${charId}`;
          } else if (!validated.portraitUrl || !validated.portraitUrl.startsWith('local:')) {
            await db.encrypted_images.delete(`portrait-${charId}`);
          }

          if (saveToken) {
            await encryptBlob(tokenBlob!, `token-${charId}`, session.username, session.key);
            validated.tokenUrl = `local:token-${charId}`;
          } else if (!validated.tokenUrl || !validated.tokenUrl.startsWith('local:')) {
            await db.encrypted_images.delete(`token-${charId}`);
          }

          await encryptAndSaveCharacter(validated, charId, session.username, session.key);
        } else {
          charId = await encryptAndSaveCharacter(validated, undefined, session.username, session.key);
          let needsUpdate = false;

          if (savePortrait) {
            await encryptBlob(portraitBlob!, `portrait-${charId}`, session.username, session.key);
            validated.portraitUrl = `local:portrait-${charId}`;
            needsUpdate = true;
          }
          if (saveToken) {
            await encryptBlob(tokenBlob!, `token-${charId}`, session.username, session.key);
            validated.tokenUrl = `local:token-${charId}`;
            needsUpdate = true;
          }

          if (needsUpdate) {
            await encryptAndSaveCharacter(validated, charId, session.username, session.key);
          }
        }
      } else {
        if (charId) {
          if (savePortrait) {
            await db.images.put({ id: `portrait-${charId}`, blob: portraitBlob! });
            validated.portraitUrl = `local:portrait-${charId}`;
          } else if (!validated.portraitUrl || !validated.portraitUrl.startsWith('local:')) {
            await db.images.delete(`portrait-${charId}`);
          }

          if (saveToken) {
            await db.images.put({ id: `token-${charId}`, blob: tokenBlob! });
            validated.tokenUrl = `local:token-${charId}`;
          } else if (!validated.tokenUrl || !validated.tokenUrl.startsWith('local:')) {
            await db.images.delete(`token-${charId}`);
          }

          await db.characters.put(validated);
        } else {
          charId = await db.characters.add(validated);
          let needsUpdate = false;

          if (savePortrait) {
            await db.images.put({ id: `portrait-${charId}`, blob: portraitBlob! });
            validated.portraitUrl = `local:portrait-${charId}`;
            needsUpdate = true;
          }
          if (saveToken) {
            await db.images.put({ id: `token-${charId}`, blob: tokenBlob! });
            validated.tokenUrl = `local:token-${charId}`;
            needsUpdate = true;
          }

          if (needsUpdate) {
            await db.characters.put({ ...validated, id: charId });
          }
        }
      }
      onComplete();
    } catch (err: any) {
      if (err.name === 'ZodError') {
        setValidationErrors(err.issues || err.errors || [err]);
      } else {
        console.error('Validation failed', err);
        alert('Please check your data. Some fields are missing or invalid.');
      }
    }
  };

  const canProgress = () => {
    const primaryClass = formData.classes?.[0];
    switch (STEPS[currentStep]) {
      case 'Basics':
        return formData.name && formData.race && primaryClass?.name;
      case 'Background':
        return formData.background;
      case 'Abilities': {
        const racialChoices = getRacialChoices();
        const choicesCompleted = racialChoices.every(c => {
          const selected = formData.resources.racialAbilityChoiceSelections?.[c.id] || [];
          return selected.length === c.count;
        });
        return pointsRemaining === 0 && choicesCompleted;
      }
      case 'Proficiencies': {
        const selectedClassData = classes?.find(c => c.name === primaryClass?.name);
        const classDetails = selectedClassData?.data?.fullData?.class?.find((c: any) => c.name === primaryClass?.name);
        const skillChoices = classDetails?.startingProficiencies?.skills?.[0]?.choose;
        const maxChoices = skillChoices?.count || 0;
        return formData.proficiencies.length >= maxChoices;
      }
      case 'Features': {
        const hasFeatRequirement = selectedRaceData?.data?.feats?.some((f: any) => f.any || f.anyFromCategory);
        // ASI count is already calculated in renderStep, but let's be safe
        // For now, allow progress if bonus feat is selected if required
        if (hasFeatRequirement && !formData.resources.bonusFeat) return false;
        
        // We'll trust the user has filled in ASI choices for now to avoid complex double-calculation here
        // or we could re-calculate asiCount here.
        return true;
      }
      case 'Spells':
        return true;
      case 'Equipment': {
        const selectedClassData = classes?.find(c => c.name === primaryClass?.name);
        const classDetails = selectedClassData?.data?.fullData?.class?.find((c: any) => c.name === primaryClass?.name);
        const equipmentOptions = classDetails?.startingEquipment?.default || [];
        const requiredChoices = equipmentOptions.filter((o: string) => o.includes(' or ')).length;
        
        // Check equipment choices for ALL classes? 
        // For simplicity, let's just check if primary class choices are done
        const primaryChoices = Object.keys(formData.resources.equipmentChoices || {})
          .filter(k => k.startsWith(`${primaryClass?.name}-`)).length;
        return primaryChoices >= requiredChoices;
      }
      default:
        return true;
    }
  };

  const renderStep = () => {
    const primaryClass = formData.classes?.[0];
    switch (STEPS[currentStep]) {
      case 'Ruleset':
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
             <h2 className="text-4xl text-fel-green tracking-tighter">Choose Ruleset</h2>
             <div className="grid grid-cols-2 gap-8">
                {['2014', '2024'].map(r => (
                  <button 
                    key={r}
                    onClick={() => setFormData({...formData, ruleset: r})}
                    className={`p-8 border-2 font-black uppercase text-2xl ${formData.ruleset === r ? 'bg-fel-green text-abyssal-black border-fel-green' : 'bg-abyssal-black/50 border-bone/20 text-bone'}`}
                  >
                    5e {r}
                  </button>
                ))}
             </div>
          </div>
        );
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
                  <label className="text-xs font-bold uppercase text-bone/60 mb-2 tracking-widest">Total Level</label>
                  <div className="p-4 bg-abyssal-black/50 border border-fel-green/30 text-2xl text-bone text-center font-bold">
                      {formData.classes.reduce((acc: number, c: any) => acc + (c.level || 0), 0)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col space-y-4">
                  <div className="flex flex-col">
                    <label className="text-xs font-bold uppercase text-bone/60 mb-2 tracking-widest">Race</label>
                    <select
                      className="bg-abyssal-black/50 border border-fel-green/30 p-4 font-serif text-lg text-bone focus:outline-none focus:border-fel-green appearance-none cursor-pointer"
                      value={formData.race}
                      onChange={(e) => {
                        const raceName = e.target.value;
                        const raceData = races?.find(r => r.name === raceName)?.data;
                        
                        // Default size and languages
                        let size = 'Medium';
                        if (raceData?.size) {
                          size = raceData.size.includes('M') ? 'Medium' : raceData.size.includes('S') ? 'Small' : 'Medium';
                        }
                        
                        let languages = ['Common'];
                        if (raceData?.languageProficiencies?.[0]) {
                          languages = Object.keys(raceData.languageProficiencies[0]).map(l => l.charAt(0).toUpperCase() + l.slice(1)).filter(l => l !== 'AnyStandard');
                        }

                        setFormData({ 
                          ...formData, 
                          race: raceName,
                          size: size,
                          languages: languages,
                          resources: {
                            ...formData.resources,
                            languageChoices: []
                          }
                        });
                      }}
                    >
                      <option value="">Choose Race...</option>
                      {races?.sort((a,b) => a.name.localeCompare(b.name)).map(r => (
                        <option key={r.id} value={r.name} className="bg-abyssal-black text-bone">
                          {r.name} {r.data?.source ? `(${r.data.source})` : ''}
                        </option>
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
                  <label className="text-xs font-bold uppercase text-bone/60 mb-2 tracking-widest">Classes</label>
                  {formData.classes.map((cls: any, idx: number) => {
                    const selectedClassData = classes?.find(c => c.name === cls.name);
                    const rawSubclasses = selectedClassData?.data?.fullData?.subclass || [];
                    const subclassTitle = selectedClassData?.data?.fullData?.class?.[0]?.subclassTitle || 'Subclass';

                    // Filter and deduplicate subclasses by ruleset and name
                    const seenSubclasses = new Set<string>();
                    const subclasses = rawSubclasses.filter((sc: any) => {
                      const is2024 = isSource2024(sc.source);
                      if (formData.ruleset === '2014') {
                        if (is2024) return false;
                      } else {
                        if (!is2024) {
                          const has2024Version = rawSubclasses.some((other: any) => 
                            other.name === sc.name && isSource2024(other.source)
                          );
                          if (has2024Version) return false;
                        }
                      }
                      if (seenSubclasses.has(sc.name)) return false;
                      seenSubclasses.add(sc.name);
                      return true;
                    });

                    return (
                        <div key={idx} className="space-y-2 mb-4 p-4 border border-fel-green/20 bg-abyssal-black/30">
                            <div className="flex gap-2">
                                <select
                                  className="flex-grow bg-abyssal-black/50 border border-fel-green/30 p-4 font-serif text-lg text-bone focus:outline-none focus:border-fel-green appearance-none cursor-pointer"
                                  value={cls.name}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const newClasses = [...formData.classes];
                                    newClasses[idx] = { name: val, level: 1, subclass: '' };
                                    setFormData({ ...formData, classes: newClasses });
                                    
                                    const classData = classes?.find(c => c.name === val);
                                    if (classData?.data?.filename) {
                                        setTimeout(() => {
                                            fetchClassDetails(val, classData.data.filename).catch(console.error);
                                        }, 0);
                                    }
                                  }}
                                >
                                  <option value="">Choose Class...</option>
                                  {classes?.sort((a,b) => a.name.localeCompare(b.name)).map(c => (
                                    <option key={c.id} value={c.name} className="bg-abyssal-black text-bone">
                                      {c.name} {c.data?.fullData?.class?.[0]?.source ? `(${c.data.fullData.class[0].source})` : ''}
                                    </option>
                                  ))}
                                </select>
                                <input
                                    type="number"
                                    className="w-16 bg-abyssal-black/50 border border-fel-green/30 p-4 text-center text-bone"
                                    value={cls.level}
                                    onChange={(e) => {
                                        const newClasses = [...formData.classes];
                                        newClasses[idx].level = parseInt(e.target.value) || 1;
                                        setFormData({ ...formData, classes: newClasses });
                                    }}
                                />
                            </div>
                            
                            {subclasses.length > 0 && (
                                <select
                                  className="w-full bg-abyssal-black/50 border border-necrotic-purple/30 p-2 font-serif text-md text-bone focus:outline-none focus:border-necrotic-purple appearance-none cursor-pointer"
                                  value={cls.subclass || ''}
                                  onChange={(e) => {
                                    const newClasses = [...formData.classes];
                                    newClasses[idx].subclass = e.target.value;
                                    setFormData({ ...formData, classes: newClasses });
                                  }}
                                >
                                  <option value="">Choose {subclassTitle}...</option>
                                  {subclasses.map((sc: any) => (
                                    <option key={`${sc.name}-${sc.source || 'base'}`} value={sc.name} className="bg-abyssal-black text-bone">
                                      {sc.name} {sc.source ? `(${sc.source})` : ''}
                                    </option>
                                  ))}
                                </select>
                            )}

                            {cls.name && (
                                <p className="text-bone/70 text-xs italic mt-2">
                                    {getClassDescription(cls.name)}
                                </p>
                            )}
                        </div>
                    );
                  })}
                  <button 
                    onClick={() => setFormData({...formData, classes: [...formData.classes, {name: '', level: 1, subclass: ''}]})}
                    className="text-fel-green text-sm font-bold uppercase"
                  >+ Add Class</button>
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

              {/* Language Selection */}
              {formData.race && (() => {
                const raceData = races?.find(r => r.name === formData.race)?.data;
                const anyStandard = raceData?.languageProficiencies?.[0]?.anyStandard || 0;
                const STANDARD_LANGUAGES = ['Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc', 'Abyssal', 'Celestial', 'Draconic', 'Deep Speech', 'Infernal', 'Primordial', 'Sylvan', 'Undercommon'];

                if (anyStandard > 0) {
                  return (
                    <div className="flex flex-col p-4 border border-necrotic-purple/20 bg-abyssal-black/30">
                      <label className="text-xs font-bold uppercase text-bone/60 mb-4 tracking-widest">Bonus Languages ({anyStandard})</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {STANDARD_LANGUAGES.map(lang => {
                          const isBase = formData.languages?.includes(lang);
                          const isSelected = formData.resources.languageChoices?.includes(lang);
                          return (
                            <button
                              key={lang}
                              disabled={isBase}
                              onClick={() => {
                                let newChoices = [...(formData.resources.languageChoices || [])];
                                if (isSelected) {
                                  newChoices = newChoices.filter(c => c !== lang);
                                } else if (newChoices.length < anyStandard) {
                                  newChoices.push(lang);
                                }
                                setFormData({
                                  ...formData,
                                  resources: { ...formData.resources, languageChoices: newChoices }
                                });
                              }}
                              className={`p-2 text-[10px] font-bold uppercase border transition-all ${
                                isBase ? 'opacity-20 cursor-not-allowed border-none' :
                                isSelected ? 'bg-necrotic-purple text-bone border-necrotic-purple shadow-sm' :
                                'bg-abyssal-black/50 border-necrotic-purple/30 text-bone/40 hover:border-necrotic-purple/60 cursor-pointer'
                              }`}
                            >
                              {lang}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Portrait & Token Section */}
              <div className="p-4 border border-fel-green/20 bg-abyssal-black/30 rounded space-y-4">
                <label className="text-xs font-bold uppercase text-bone/60 mb-2 tracking-widest block">Character Portrait & Token Art</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Portrait Input */}
                  <div className="flex flex-col space-y-2">
                    <span className="text-[10px] uppercase font-bold text-bone/40 tracking-wider">Portrait Image</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="flex-grow bg-abyssal-black/50 border border-fel-green/30 p-3 text-xs text-bone focus:outline-none focus:border-fel-green transition-all disabled:opacity-50"
                        value={formData.portraitUrl && (formData.portraitUrl.startsWith('blob:') || formData.portraitUrl.startsWith('local:')) ? 'Local Image File' : (formData.portraitUrl || '')}
                        disabled={!!(formData.portraitUrl && (formData.portraitUrl.startsWith('blob:') || formData.portraitUrl.startsWith('local:')))}
                        onChange={(e) => setFormData({ ...formData, portraitUrl: e.target.value })}
                        placeholder="https://example.com/portrait.jpg"
                      />
                      <label className="bg-fel-green/10 border border-fel-green/30 text-fel-green px-3 py-3 rounded text-xs font-bold uppercase tracking-wider hover:bg-fel-green hover:text-abyssal-black transition-all cursor-pointer flex items-center gap-1 shrink-0">
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const objectUrl = URL.createObjectURL(file);
                              setPortraitBlob(file);
                              setFormData({ ...formData, portraitUrl: objectUrl });
                              setSessionUrls(prev => [...prev, objectUrl]);
                            }
                          }}
                        />
                      </label>
                      {formData.portraitUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, portraitUrl: '' });
                            setPortraitBlob(null);
                          }}
                          className="bg-dnd-red/10 border border-dnd-red/30 text-dnd-red px-3 py-3 rounded text-xs font-bold uppercase hover:bg-dnd-red hover:text-white transition-all cursor-pointer shrink-0"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {formData.portraitUrl && (
                      <div className="h-40 w-32 border border-fel-green/20 overflow-hidden relative self-center bg-abyssal-black/50 rounded shadow-md mt-2">
                        <CharacterImage 
                          src={formData.portraitUrl} 
                          alt="Portrait Preview" 
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  {/* Token Input */}
                  <div className="flex flex-col space-y-2">
                    <span className="text-[10px] uppercase font-bold text-bone/40 tracking-wider">Token Image</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="flex-grow bg-abyssal-black/50 border border-fel-green/30 p-3 text-xs text-bone focus:outline-none focus:border-fel-green transition-all disabled:opacity-50"
                        value={formData.tokenUrl && (formData.tokenUrl.startsWith('blob:') || formData.tokenUrl.startsWith('local:')) ? 'Local Image File' : (formData.tokenUrl || '')}
                        disabled={!!(formData.tokenUrl && (formData.tokenUrl.startsWith('blob:') || formData.tokenUrl.startsWith('local:')))}
                        onChange={(e) => setFormData({ ...formData, tokenUrl: e.target.value })}
                        placeholder="https://example.com/token.png"
                      />
                      <label className="bg-fel-green/10 border border-fel-green/30 text-fel-green px-3 py-3 rounded text-xs font-bold uppercase tracking-wider hover:bg-fel-green hover:text-abyssal-black transition-all cursor-pointer flex items-center gap-1 shrink-0">
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const objectUrl = URL.createObjectURL(file);
                              setTokenBlob(file);
                              setFormData({ ...formData, tokenUrl: objectUrl });
                              setSessionUrls(prev => [...prev, objectUrl]);
                            }
                          }}
                        />
                      </label>
                      {formData.tokenUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, tokenUrl: '' });
                            setTokenBlob(null);
                          }}
                          className="bg-dnd-red/10 border border-dnd-red/30 text-dnd-red px-3 py-3 rounded text-xs font-bold uppercase hover:bg-dnd-red hover:text-white transition-all cursor-pointer shrink-0"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {formData.tokenUrl && (
                      <div className="h-32 w-32 rounded-full border-2 border-fel-green/40 overflow-hidden relative self-center bg-abyssal-black/50 shadow-md flex items-center justify-center mt-2">
                        <CharacterImage 
                          src={formData.tokenUrl} 
                          alt="Token Preview" 
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Preset Avatars */}
                <div className="space-y-2 pt-2">
                  <span className="text-[9px] uppercase font-bold text-bone/40 tracking-wider block">Or select a preset avatar:</span>
                  <div className="flex gap-4">
                    {[
                      { name: 'Knight', url: 'https://images.unsplash.com/photo-1618336753974-aae8e04506aa?auto=format&fit=crop&w=300&q=80' },
                      { name: 'Wizard', url: 'https://images.unsplash.com/photo-1519074002996-a69e7ac46a42?auto=format&fit=crop&w=300&q=80' },
                      { name: 'Rogue', url: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=300&q=80' },
                      { name: 'Cleric', url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=300&q=80' }
                    ].map(preset => {
                      const isCurrent = formData.portraitUrl === preset.url;
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => setFormData({ ...formData, portraitUrl: preset.url, tokenUrl: preset.url })}
                          className={`flex-1 p-2 border text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            isCurrent
                              ? 'bg-fel-green/20 border-fel-green text-fel-green shadow-sm'
                              : 'bg-abyssal-black/40 border-fel-green/10 text-bone/60 hover:border-fel-green/40'
                          }`}
                        >
                          <div className="h-6 w-6 rounded-full overflow-hidden flex-shrink-0 bg-abyssal-black">
                            <img src={preset.url} alt={preset.name} className="h-full w-full object-cover" />
                          </div>
                          {preset.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {formData.name && formData.race && primaryClass?.name && (
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
      case 'Background':
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center border-b-2 border-fel-green mb-6 pb-2">
              <h2 className="text-3xl text-fel-green">Background</h2>
              <div className="text-xs font-bold text-bone/40 uppercase tracking-widest">
                Your Life Before Adventure
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-4">
                  <label className="text-xs font-bold uppercase text-bone/60 tracking-widest block">Select Background</label>
                  <select
                    className="w-full bg-abyssal-black border border-fel-green/30 p-4 font-serif text-lg text-bone focus:outline-none focus:border-fel-green appearance-none cursor-pointer"
                    value={formData.background}
                    onChange={(e) => setFormData({ ...formData, background: e.target.value })}
                  >
                    <option value="">Choose Background...</option>
                    {backgrounds?.sort((a,b) => a.name.localeCompare(b.name)).map(b => (
                      <option key={b.id} value={b.name}>
                        {b.name} {b.data?.source ? `(${b.data.source})` : ''}
                      </option>
                    ))}
                  </select>

                  {formData.background && (() => {
                    const bg = backgrounds?.find(b => b.name === formData.background);
                    if (!bg) return null;
                    return (
                      <div className="p-4 bg-fel-green/5 border border-fel-green/20 rounded">
                        <h3 className="text-fel-green font-bold mb-2">Benefits</h3>
                        <div className="text-xs text-bone/70 space-y-2">
                          <p><strong>Proficiencies:</strong> {bg.data.skillProficiencies ? Object.keys(bg.data.skillProficiencies[0]).join(', ') : 'None'}</p>
                          <p className="leading-relaxed">{extractDesc(bg.data)}</p>
                        </div>
                      </div>
                    );
                  })()}
               </div>

               <div className="hidden md:block">
                  <div className="p-8 border-2 border-dashed border-bone/10 flex flex-col items-center justify-center h-full text-center">
                    <div className="text-4xl text-bone/10 mb-4 opacity-20">📜</div>
                    <p className="text-bone/30 italic text-sm">"Your background shapes your identity and provides you with essential skills for your journey."</p>
                  </div>
               </div>
            </div>

            {formData.background && (
               <div className="pt-8 flex justify-center">
                 <button
                   onClick={nextStep}
                   className="bg-fel-green text-abyssal-black px-10 py-3 rounded-full font-bold uppercase tracking-widest hover:bg-white transition-all shadow-lg cursor-pointer"
                 >
                   Confirm Background <ChevronRight className="inline-block ml-2" />
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

            {/* Racial Choices Section */}
            {getRacialChoices().length > 0 && (
              <div className="p-4 bg-abyssal-black/40 border border-fel-green/20 rounded space-y-4 animate-in slide-in-from-bottom duration-300">
                <h3 className="text-sm font-bold uppercase text-fel-green tracking-wider border-b border-fel-green/10 pb-1">
                  Racial Ability Adjustments
                </h3>
                <p className="text-[10px] text-bone/60 italic leading-relaxed">
                  Your chosen race ({formData.race}) allows you to choose which abilities receive bonuses.
                </p>
                <div className="space-y-4">
                  {getRacialChoices().map((choice) => {
                    const selected = formData.resources.racialAbilityChoiceSelections?.[choice.id] || [];
                    
                    const statNameMapping: Record<string, string> = {
                      str: 'Strength', dex: 'Dexterity', con: 'Constitution',
                      int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
                      strength: 'Strength', dexterity: 'Dexterity', constitution: 'Constitution',
                      intelligence: 'Intelligence', wisdom: 'Wisdom', charisma: 'Charisma'
                    };

                    const handleSelectStat = (stat: string, checked: boolean) => {
                      const currentSelections = formData.resources.racialAbilityChoiceSelections?.[choice.id] || [];
                      let newSelections = [...currentSelections];
                      
                      if (choice.count === 1) {
                        newSelections = checked ? [stat] : [];
                      } else {
                        if (checked) {
                          if (newSelections.length >= choice.count) return;
                          newSelections.push(stat);
                        } else {
                          newSelections = newSelections.filter(s => s !== stat);
                        }
                      }
                      
                      const allSelections = {
                        ...formData.resources.racialAbilityChoiceSelections,
                        [choice.id]: newSelections
                      };
                      const allChoices = getRacialChoices();
                      const bonuses = computeRacialChoiceBonuses(allSelections, allChoices);
                      
                      setFormData({
                        ...formData,
                        resources: {
                          ...formData.resources,
                          racialAbilityChoiceSelections: allSelections,
                          racialAbilityChoice: bonuses
                        }
                      });
                    };

                    return (
                      <div key={choice.id} className="space-y-2">
                        <div className="text-xs font-bold text-dnd-gold">
                          Select {choice.count} ability score{choice.count > 1 ? 's' : ''} to receive a +{choice.amount} bonus:
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {choice.from.map((abbr: string) => {
                            const fullName = statNameMapping[abbr.toLowerCase()] || abbr;
                            const isChecked = selected.includes(abbr);
                            const isDisabled = !isChecked && selected.length >= choice.count;

                            return (
                              <label
                                key={abbr}
                                className={`flex items-center gap-2 px-3 py-1.5 border text-xs cursor-pointer transition-all ${
                                  isChecked
                                    ? 'bg-fel-green/20 border-fel-green text-fel-green shadow-sm'
                                    : isDisabled
                                      ? 'bg-abyssal-black/20 border-fel-green/5 text-bone/20 cursor-not-allowed opacity-40'
                                      : 'bg-abyssal-black/40 border-fel-green/10 text-bone hover:border-fel-green/40 hover:bg-abyssal-black/60'
                                }`}
                              >
                                <input
                                  type={choice.count === 1 ? "radio" : "checkbox"}
                                  name={choice.id}
                                  checked={isChecked}
                                  disabled={isDisabled}
                                  onChange={(e) => handleSelectStat(abbr, e.target.checked)}
                                  className="hidden"
                                />
                                <span>{fullName} (+{choice.amount})</span>
                              </label>
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
        );
      case 'Proficiencies': {
        const selectedClassData = classes?.find(c => c.name === primaryClass?.name);
        const classDetails = selectedClassData?.data?.fullData?.class?.find((c: any) => c.name === primaryClass?.name);
        
        if (!classDetails) {
          if (selectedClassData?.data?.filename && !selectedClassData?.data?.fullData) {
              fetchClassDetails(primaryClass?.name, selectedClassData.data.filename);
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
              Choose {maxChoices} skills from your class: {primaryClass?.name}
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
        
        const racialTraits = selectedRaceData?.data?.entries?.filter((e: any) => e.name && e.entries).map((e: any) => ({
          name: cleanText(e.name),
          desc: extractDesc(e),
          source: e.source || selectedRaceData.data.source
        })) || [];
        
        const rawClassFeatures: any[] = [];
        
        formData.classes.forEach((cls: any) => {
            const selectedClassData = classes?.find(c => c.name === cls.name);
            const classFeatureData = selectedClassData?.data?.fullData?.classFeature || [];
            const subclassFeatureData = selectedClassData?.data?.fullData?.subclassFeature || [];
            
            let selectedSubclassData: any = null;
            if (cls.subclass && selectedClassData?.data?.fullData?.subclass) {
                const matchingSubclasses = selectedClassData.data.fullData.subclass.filter((sc: any) => sc.name === cls.subclass);
                selectedSubclassData = matchingSubclasses.find((sc: any) => {
                    const is2024 = isSource2024(sc.source);
                    if (formData.ruleset === '2014') {
                        return !is2024;
                    } else {
                        if (is2024) return true;
                        const has2024Version = matchingSubclasses.some((other: any) => isSource2024(other.source));
                        return !has2024Version;
                    }
                });
                if (!selectedSubclassData) {
                    selectedSubclassData = matchingSubclasses[0];
                }
            }

            const classFeatures = classFeatureData
              .filter((f: any) => {
                if (f.level > cls.level) return false;
                const is2024 = isSource2024(f.source);
                return formData.ruleset === '2024' ? is2024 : !is2024;
              })
              .map((f: any) => ({
                name: cleanText(f.name),
                desc: extractDesc(f),
                level: f.level,
                className: cls.name,
                source: f.source
              }));
            
            rawClassFeatures.push(...classFeatures);

            if (selectedSubclassData?.shortName) {
                const scFeatures = subclassFeatureData
                  .filter((f: any) => {
                    if (f.level > cls.level) return false;
                    if (f.subclassShortName !== selectedSubclassData.shortName) return false;
                    return f.subclassSource === selectedSubclassData.source;
                  })
                  .map((f: any) => ({
                      name: cleanText(f.name),
                      desc: extractDesc(f),
                      level: f.level,
                      className: cls.name,
                      subclass: cls.subclass,
                      source: f.source
                  }));
                rawClassFeatures.push(...scFeatures);
            }
        });

        // Filter for ASI points - only count ONE per level per class
        const asiLevels: Array<{className: string, level: number}> = [];
        rawClassFeatures.forEach(f => {
            if (f.name === 'Ability Score Improvement' || f.name === 'Ability Score Improvement (2024)') {
                if (!asiLevels.find(l => l.className === f.className && l.level === f.level)) {
                    asiLevels.push({ className: f.className, level: f.level });
                }
            }
        });
        const asiCount = asiLevels.length;

        // Deduplicate features by name (except ASI)
        const seenNames = new Set<string>();
        const classFeatures: any[] = [];
        for (const f of rawClassFeatures) {
          if (f.name === 'Ability Score Improvement' || f.name === 'Ability Score Improvement (2024)') continue;
          if (!seenNames.has(f.name)) {
            seenNames.add(f.name);
            classFeatures.push(f);
          }
        }

        const updateAsiChoice = (index: number, choice: any) => {
          const newAsiChoices = [...(formData.resources.asiChoices || [])];
          newAsiChoices[index] = { ...newAsiChoices[index], ...choice };
          setFormData({
            ...formData,
            resources: { ...formData.resources, asiChoices: newAsiChoices }
          });
        };

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
                      <summary className="text-bone font-bold text-sm outline-none flex justify-between items-center">
                        <span>{trait.name}</span>
                        {trait.source && <span className="text-[8px] opacity-30 font-normal uppercase tracking-widest">{trait.source}</span>}
                      </summary>
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
                      value={formData.resources.bonusFeat || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        resources: { ...formData.resources, bonusFeat: e.target.value } 
                      })}
                    >
                      <option value="">Select a Feat...</option>
                      {featsList?.sort((a,b) => a.name.localeCompare(b.name)).map(f => (
                        <option key={f.id} value={f.name}>
                          {f.name} {f.data?.source ? `(${f.data.source})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {asiCount > 0 && asiLevels.map((lvl, i) => {
                  const choice = formData.resources.asiChoices?.[i] || { type: 'asi', stats: { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0 } };
                  return (
                    <div key={`asi-${i}`} className="mt-4 p-4 bg-dnd-gold/10 border border-dnd-gold/30 rounded-lg">
                      <h4 className="text-dnd-gold font-bold uppercase text-xs mb-1">ASI / Feat ({lvl.className} {lvl.level})</h4>
                      <div className="flex gap-4 mb-4">
                        <label className="flex items-center gap-2 text-[10px] text-bone cursor-pointer">
                          <input 
                            type="radio" 
                            name={`asi-type-${i}`} 
                            checked={choice.type === 'asi'} 
                            onChange={() => updateAsiChoice(i, { type: 'asi' })}
                          /> Ability Scores
                        </label>
                        <label className="flex items-center gap-2 text-[10px] text-bone cursor-pointer">
                          <input 
                            type="radio" 
                            name={`asi-type-${i}`} 
                            checked={choice.type === 'feat'} 
                            onChange={() => updateAsiChoice(i, { type: 'feat' })}
                          /> Feat
                        </label>
                      </div>

                      {choice.type === 'feat' ? (
                        <select
                          className="w-full bg-abyssal-black border border-dnd-gold/50 p-2 font-sans text-xs text-bone focus:outline-none focus:border-dnd-gold"
                          value={choice.featName || ''}
                          onChange={(e) => updateAsiChoice(i, { featName: e.target.value })}
                        >
                          <option value="">Select a Feat...</option>
                          {featsList?.sort((a,b) => a.name.localeCompare(b.name)).map(f => (
                            <option key={f.id} value={f.name}>
                              {f.name} {f.data?.source ? `(${f.data.source})` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].map(stat => (
                            <div key={stat} className="flex flex-col">
                              <label className="text-[8px] uppercase text-bone/40">{stat.slice(0,3)}</label>
                              <select 
                                className="bg-abyssal-black border border-dnd-gold/30 p-1 text-xs text-bone"
                                value={choice.stats?.[stat] || 0}
                                onChange={(e) => {
                                  const newStats = { ...(choice.stats || {}) };
                                  newStats[stat] = parseInt(e.target.value);
                                  updateAsiChoice(i, { stats: newStats });
                                }}
                              >
                                <option value="0">0</option>
                                <option value="1">+1</option>
                                <option value="2">+2</option>
                              </select>
                            </div>
                          ))}
                        </div>
                      )}
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
                      <summary className="text-bone font-bold text-sm outline-none flex justify-between items-center">
                        <span>{feat.name}</span>
                        {feat.source && <span className="text-[8px] opacity-30 font-normal uppercase tracking-widest">{feat.source}</span>}
                      </summary>
                      <div className="mt-2 text-bone/70 text-xs italic leading-relaxed">
                        {feat.desc}
                      </div>
                   </details>
                )) : <div className="text-sm italic text-bone/40">No notable class features selected.</div>}

                {classFeatures.some((f: any) => f.name.includes('Fighting Style')) && (
                  <div className="p-4 bg-dnd-gold/10 border border-dnd-gold/30 rounded-lg mt-4">
                    <h4 className="text-dnd-gold font-bold uppercase text-xs mb-2">Fighting Style</h4>
                    <p className="text-xs text-bone/60 mb-4 italic">Choose your martial specialty.</p>
                    <select
                      className="w-full bg-abyssal-black border border-dnd-gold/50 p-3 font-sans text-sm text-bone focus:outline-none focus:border-dnd-gold"
                      value={formData.resources.fightingStyle || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        resources: { ...formData.resources, fightingStyle: e.target.value } 
                      })}
                    >
                      <option value="">Select a Fighting Style...</option>
                      {['Archery', 'Blind Fighting', 'Defense', 'Dueling', 'Great Weapon Fighting', 'Interception', 'Protection', 'Superior Technique', 'Thrown Weapon Fighting', 'Two-Weapon Fighting', 'Unarmed Fighting', 'Blessed Warrior', 'Druidic Warrior'].map(fs => (
                        <option key={fs} value={fs}>{fs}</option>
                      ))}
                    </select>
                  </div>
                )}

                {classFeatures.some((f: any) => f.name.includes('Pact Boon')) && (
                  <div className="p-4 bg-necrotic-purple/10 border border-necrotic-purple/30 rounded-lg mt-4">
                    <h4 className="text-necrotic-purple font-bold uppercase text-xs mb-2">Pact Boon</h4>
                    <p className="text-xs text-bone/60 mb-4 italic">Your otherworldly patron bestows a gift upon you.</p>
                    <select
                      className="w-full bg-abyssal-black border border-necrotic-purple/50 p-3 font-sans text-sm text-bone focus:outline-none focus:border-necrotic-purple"
                      value={formData.resources.pactBoon || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        resources: { ...formData.resources, pactBoon: e.target.value } 
                      })}
                    >
                      <option value="">Select a Pact Boon...</option>
                      {['Pact of the Blade', 'Pact of the Chain', 'Pact of the Tome', 'Pact of the Talisman'].map(fs => (
                        <option key={fs} value={fs}>{fs}</option>
                      ))}
                    </select>
                  </div>
                )}

                {classFeatures.some((f: any) => f.name.includes('Eldritch Invocations')) && (
                  <div className="p-4 bg-necrotic-purple/10 border border-necrotic-purple/30 rounded-lg mt-4">
                    <h4 className="text-necrotic-purple font-bold uppercase text-xs mb-2">Eldritch Invocations</h4>
                    <p className="text-xs text-bone/60 mb-4 italic">Select your invocations (manage total count manually).</p>
                    <div className="grid grid-cols-2 gap-2">
                      {['Agonizing Blast', 'Armor of Shadows', 'Ascendant Step', 'Beast Speech', 'Beguiling Influence', 'Bewitching Whispers', 'Book of Ancient Secrets', 'Chains of Carceri', 'Devil\'s Sight', 'Eldritch Mind', 'Eldritch Sight', 'Eldritch Spear', 'Eyes of the Rune Keeper', 'Fiendish Vigor', 'Gaze of Two Minds', 'Lifedrinker', 'Mask of Many Faces', 'Master of Myriad Forms', 'Minions of Chaos', 'Mire the Mind', 'One with Shadows', 'Repelling Blast', 'Sculptor of Flesh', 'Sign of Ill Omen', 'Thief of Five Fates', 'Thirsting Blade', 'Tomb of Levistus', 'Visions of Distant Realms', 'Voice of the Chain Master', 'Whispers of the Grave'].map(inv => {
                         const isSelected = formData.resources.warlockInvocations?.includes(inv);
                         return (
                           <button
                             key={inv}
                             onClick={() => {
                               let invs = [...(formData.resources.warlockInvocations || [])];
                               if (isSelected) invs = invs.filter(i => i !== inv);
                               else invs.push(inv);
                               setFormData({ ...formData, resources: { ...formData.resources, warlockInvocations: invs } });
                             }}
                             className={`text-[10px] p-2 border transition-all text-left ${isSelected ? 'bg-necrotic-purple text-bone border-necrotic-purple' : 'bg-abyssal-black border-necrotic-purple/30 text-bone/60 hover:border-necrotic-purple/60'}`}
                           >
                             {inv}
                           </button>
                         );
                      })}
                    </div>
                  </div>
                )}

                {classFeatures.some((f: any) => f.name.includes('Metamagic')) && (
                  <div className="p-4 bg-dnd-red/10 border border-dnd-red/30 rounded-lg mt-4">
                    <h4 className="text-dnd-red font-bold uppercase text-xs mb-2">Metamagic Options</h4>
                    <p className="text-xs text-bone/60 mb-4 italic">Select your metamagic choices.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {['Careful Spell', 'Distant Spell', 'Empowered Spell', 'Extended Spell', 'Heightened Spell', 'Quickened Spell', 'Seeking Spell', 'Subtle Spell', 'Transmuted Spell', 'Twinned Spell'].map(mm => {
                         const isSelected = formData.resources.metamagic?.includes(mm);
                         return (
                           <button
                             key={mm}
                             onClick={() => {
                               let mms = [...(formData.resources.metamagic || [])];
                               if (isSelected) mms = mms.filter(m => m !== mm);
                               else mms.push(mm);
                               setFormData({ ...formData, resources: { ...formData.resources, metamagic: mms } });
                             }}
                             className={`text-[10px] p-2 border transition-all text-left ${isSelected ? 'bg-dnd-red text-bone border-dnd-red' : 'bg-abyssal-black border-dnd-red/30 text-bone/60 hover:border-dnd-red/60'}`}
                           >
                             {mm}
                           </button>
                         );
                      })}
                    </div>
                  </div>
                )}

                {classFeatures.some((f: any) => f.name.includes('Combat Superiority')) && (
                  <div className="p-4 bg-dnd-gold/10 border border-dnd-gold/30 rounded-lg mt-4">
                    <h4 className="text-dnd-gold font-bold uppercase text-xs mb-2">Battle Maneuvers</h4>
                    <p className="text-xs text-bone/60 mb-4 italic">Select your martial maneuvers.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {['Ambush', 'Bait and Switch', 'Brace', 'Commander\'s Strike', 'Commanding Presence', 'Disarming Attack', 'Distracting Strike', 'Evasive Footwork', 'Feinting Attack', 'Goading Attack', 'Grappling Strike', 'Lunging Attack', 'Maneuvering Attack', 'Menacing Attack', 'Parry', 'Precision Attack', 'Pushing Attack', 'Quick Toss', 'Rally', 'Riposte', 'Sweeping Attack', 'Tactical Assessment', 'Trip Attack'].map(man => {
                         const isSelected = formData.resources.maneuvers?.includes(man);
                         return (
                           <button
                             key={man}
                             onClick={() => {
                               let mans = [...(formData.resources.maneuvers || [])];
                               if (isSelected) mans = mans.filter(m => m !== man);
                               else mans.push(man);
                               setFormData({ ...formData, resources: { ...formData.resources, maneuvers: mans } });
                             }}
                             className={`text-[10px] p-2 border transition-all text-left ${isSelected ? 'bg-dnd-gold text-abyssal-black font-bold border-dnd-gold' : 'bg-abyssal-black border-dnd-gold/30 text-bone/60 hover:border-dnd-gold/60'}`}
                           >
                             {man}
                           </button>
                         );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-8 flex justify-center">
              <button
                disabled={hasFeatRequirement && !formData.resources.bonusFeat}
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
                Continue to Spells <ChevronRight className="inline-block ml-2" />
              </button>
            </div>
          </div>
        );
      }
      case 'Spells': {
        const isSpellOnClassList = (spell: any, className: string) => {
          const classesObj = spell.data?.classes || {};
          const fromClassList = classesObj.fromClassList || [];
          const classList = classesObj.class || [];
          return fromClassList.some((c: any) => c.name.toLowerCase() === className.toLowerCase()) ||
                 classList.some((c: any) => c.name.toLowerCase() === className.toLowerCase());
        };

        const getStatTotal = (statName: string) => {
          const statKey = statName.toLowerCase();
          let total = formData.stats[statKey] || 10;
          total += getRacialBonus(statName);
          
          if (formData.resources.asiChoices) {
            formData.resources.asiChoices.forEach((choice: any) => {
              if (choice.type === 'asi' && choice.stats?.[statKey]) {
                total += choice.stats[statKey];
              }
            });
          }
          return total;
        };

        const getStatModifier = (statName: string) => {
          const total = getStatTotal(statName);
          return Math.floor((total - 10) / 2);
        };

        const isSpellcasterClass = (className: string, subclass?: string) => {
          const name = className.toLowerCase();
          if (['cleric', 'paladin', 'sorcerer', 'warlock', 'wizard', 'druid', 'bard', 'ranger', 'artificer'].includes(name)) return true;
          if (name === 'fighter' && subclass?.toLowerCase() === 'eldritch knight') return true;
          if (name === 'rogue' && subclass?.toLowerCase() === 'arcane trickster') return true;
          return false;
        };

        const getClassSpellLimits = (className: string, level: number, subclass?: string) => {
          const name = className.toLowerCase();
          let maxSpellLevel = 0;
          let cantripsKnown = 0;
          let spellsKnownOrPrepared = 0;
          let isPrepared = false;
          
          if (name === 'cleric') {
            isPrepared = true;
            maxSpellLevel = Math.ceil(level / 2);
            cantripsKnown = level <= 3 ? 3 : level <= 9 ? 4 : 5;
            const wisMod = getStatModifier('Wisdom');
            spellsKnownOrPrepared = Math.max(1, level + wisMod);
          } 
          else if (name === 'druid') {
            isPrepared = true;
            maxSpellLevel = Math.ceil(level / 2);
            cantripsKnown = level <= 3 ? 2 : level <= 9 ? 3 : 4;
            const wisMod = getStatModifier('Wisdom');
            spellsKnownOrPrepared = Math.max(1, level + wisMod);
          }
          else if (name === 'wizard') {
            isPrepared = true;
            maxSpellLevel = Math.ceil(level / 2);
            cantripsKnown = level <= 3 ? 3 : level <= 9 ? 4 : 5;
            const intMod = getStatModifier('Intelligence');
            spellsKnownOrPrepared = Math.max(1, level + intMod);
          }
          else if (name === 'paladin') {
            isPrepared = true;
            maxSpellLevel = level >= 2 ? Math.ceil(level / 4) : 0;
            cantripsKnown = 0;
            const chaMod = getStatModifier('Charisma');
            spellsKnownOrPrepared = level >= 2 ? Math.max(1, Math.floor(level / 2) + chaMod) : 0;
          }
          else if (name === 'artificer') {
            isPrepared = true;
            maxSpellLevel = Math.ceil(level / 4);
            cantripsKnown = level <= 2 ? 2 : level <= 9 ? 3 : 4;
            const intMod = getStatModifier('Intelligence');
            spellsKnownOrPrepared = Math.max(1, Math.floor(level / 2) + intMod);
          }
          else if (name === 'sorcerer') {
            isPrepared = false;
            maxSpellLevel = Math.ceil(level / 2);
            cantripsKnown = level <= 3 ? 4 : level <= 9 ? 5 : 6;
            const sorcSpellsKnownTable = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15];
            spellsKnownOrPrepared = sorcSpellsKnownTable[Math.min(20, level)];
          }
          else if (name === 'warlock') {
            isPrepared = false;
            if (level <= 2) maxSpellLevel = 1;
            else if (level <= 4) maxSpellLevel = 2;
            else if (level <= 6) maxSpellLevel = 3;
            else if (level <= 8) maxSpellLevel = 4;
            else if (level <= 10) maxSpellLevel = 5;
            else if (level <= 12) maxSpellLevel = 6;
            else if (level <= 14) maxSpellLevel = 7;
            else if (level <= 16) maxSpellLevel = 8;
            else maxSpellLevel = 9;
            
            cantripsKnown = level <= 3 ? 2 : level <= 9 ? 3 : 4;
            const warlockSpellsKnownTable = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15];
            spellsKnownOrPrepared = warlockSpellsKnownTable[Math.min(20, level)];
          }
          else if (name === 'bard') {
            isPrepared = false;
            maxSpellLevel = Math.ceil(level / 2);
            cantripsKnown = level <= 3 ? 2 : level <= 9 ? 3 : 4;
            const bardSpellsKnownTable = [0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22];
            spellsKnownOrPrepared = bardSpellsKnownTable[Math.min(20, level)];
          }
          else if (name === 'ranger') {
            isPrepared = false;
            maxSpellLevel = level >= 2 ? Math.ceil(level / 4) : 0;
            cantripsKnown = 0;
            const rangerSpellsKnownTable = [0, 0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11];
            spellsKnownOrPrepared = level >= 2 ? rangerSpellsKnownTable[Math.min(20, level)] : 0;
          }
          else if (name === 'fighter' && subclass?.toLowerCase() === 'eldritch knight') {
            isPrepared = false;
            maxSpellLevel = level >= 3 ? Math.ceil(level / 6) : 0;
            cantripsKnown = level <= 9 ? 2 : 3;
            const ekSpellsKnownTable = [0, 0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 10, 11, 11, 12, 13];
            spellsKnownOrPrepared = level >= 3 ? ekSpellsKnownTable[Math.min(20, level)] : 0;
          }
          else if (name === 'rogue' && subclass?.toLowerCase() === 'arcane trickster') {
            isPrepared = false;
            maxSpellLevel = level >= 3 ? Math.ceil(level / 6) : 0;
            cantripsKnown = level <= 9 ? 2 : 3;
            const atSpellsKnownTable = [0, 0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 10, 11, 11, 12, 13];
            spellsKnownOrPrepared = level >= 3 ? atSpellsKnownTable[Math.min(20, level)] : 0;
          }
          return { maxSpellLevel, cantripsKnown, spellsKnownOrPrepared, isPrepared };
        };

        const activeSpellcastingClasses = formData.classes.filter((c: any) => c.name && isSpellcasterClass(c.name, c.subclass));
        
        if (activeSpellcastingClasses.length === 0) {
          return (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex justify-between items-center border-b-2 border-fel-green mb-6 pb-2">
                <h2 className="text-3xl text-fel-green">Spellbook</h2>
              </div>
              <div className="p-8 bg-abyssal-black border border-fel-green/20 rounded text-center">
                <p className="text-bone/80 mb-4">Your hero does not currently have any spellcasting classes.</p>
                <p className="text-xs text-bone/40 italic">Go back to the "Basics" step to select a class with spellcasting capabilities (such as Cleric, Sorcerer, Warlock, or Paladin).</p>
              </div>
              <div className="pt-8 flex justify-center">
                <button
                  onClick={nextStep}
                  className="bg-fel-green text-abyssal-black px-12 py-4 rounded-full font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg cursor-pointer"
                >
                  Proceed to Equipment <ChevronRight className="inline-block ml-2" />
                </button>
              </div>
            </div>
          );
        }

        const activeTabKey = activeSpellTab || `${activeSpellcastingClasses[0].name}-${formData.classes.indexOf(activeSpellcastingClasses[0])}`;
        const activeTabParts = activeTabKey.split('-');
        const activeClassName = activeTabParts[0];
        const activeClassIdx = parseInt(activeTabParts[1]);
        const activeClassObj = formData.classes[activeClassIdx];

        const { maxSpellLevel, cantripsKnown, spellsKnownOrPrepared, isPrepared } = getClassSpellLimits(
          activeClassObj.name,
          activeClassObj.level,
          activeClassObj.subclass
        );

        // Subclass spells for this specific class tab
        const getSubclassSpellsForClass = (cls: any) => {
          const scSpells = new Set<string>();
          const selectedClassData = classes?.find(c => c.name === cls.name);
          const subclassFeatureData = selectedClassData?.data?.fullData?.subclassFeature || [];
          
          let selectedSubclassData: any = null;
          if (cls.subclass && selectedClassData?.data?.fullData?.subclass) {
              const matchingSubclasses = selectedClassData.data.fullData.subclass.filter((sc: any) => sc.name === cls.subclass);
              selectedSubclassData = matchingSubclasses.find((sc: any) => {
                  const is2024 = isSource2024(sc.source);
                  if (formData.ruleset === '2014') {
                      return !is2024;
                  } else {
                      if (is2024) return true;
                      const has2024Version = matchingSubclasses.some((other: any) => isSource2024(other.source));
                      return !has2024Version;
                  }
              });
              if (!selectedSubclassData) {
                  selectedSubclassData = matchingSubclasses[0];
              }
          }

          const features = subclassFeatureData.filter((f: any) => 
              f.level <= cls.level && 
              selectedSubclassData && 
              f.subclassShortName === selectedSubclassData.shortName &&
              f.subclassSource === selectedSubclassData.source
          );
          
          features.forEach((f: any) => {
             if ((f.name.toLowerCase().includes('spells') || f.name.toLowerCase().includes('magic') || f.name.toLowerCase().includes('expanded')) && f.entries) {
                 const table = f.entries.find((e: any) => e.type === 'table');
                 if (table && table.rows) {
                     table.rows.forEach((row: any) => {
                        const lvlStr = row[0]?.toString().toLowerCase() || "";
                        const featureLvl = parseInt(lvlStr.replace(/\D/g, ''));
                        
                        if (featureLvl && cls.level >= featureLvl) {
                            const spellMatch = row[1]?.match(/\{@spell ([^|}]+)/g);
                            if (spellMatch) {
                                spellMatch.forEach((m: string) => {
                                    const name = m.replace(/\{@spell /, '').replace(/\}/, '').split('|')[0].trim().toLowerCase();
                                    scSpells.add(name);
                                });
                            }
                        }
                     });
                 }
             }
          });
          return scSpells;
        };

        const activeSubclassSpells = getSubclassSpellsForClass(activeClassObj);

        // Get spells selected for the active class tab
        const getSpellsForClassTab = (className: string, classIdx: number) => {
          return formData.spells.filter((s: any) => {
            if (s.class) {
              return s.class.toLowerCase() === className.toLowerCase();
            }
            const { maxSpellLevel: limitMax } = getClassSpellLimits(className, formData.classes[classIdx]?.level, formData.classes[classIdx]?.subclass);
            const isOnList = isSpellOnClassList(s, className);
            const isLevelValid = s.level === 0 || s.level <= limitMax;
            return isOnList && isLevelValid;
          });
        };

        const selectedClassSpells = getSpellsForClassTab(activeClassName, activeClassIdx);
        const selectedCantrips = selectedClassSpells.filter((s: any) => s.level === 0);
        const selectedNormalSpells = selectedClassSpells.filter((s: any) => s.level > 0 && !activeSubclassSpells.has(s.name.toLowerCase()));

        // Toggle spell handler
        const toggleSpell = (spell: any, forceRemove: boolean = false) => {
          const isSelected = formData.spells.some((s: any) => s.name === spell.name && s.class?.toLowerCase() === activeClassName.toLowerCase());
          
          if (isSelected || forceRemove) {
            const newSpells = formData.spells.filter((s: any) => !(s.name === spell.name && s.class?.toLowerCase() === activeClassName.toLowerCase()));
            setFormData({ ...formData, spells: newSpells });
          } else {
            const isCantrip = spell.level === 0;
            if (isCantrip) {
              if (selectedCantrips.length >= cantripsKnown) {
                alert(`You have already chosen the maximum of ${cantripsKnown} cantrips for ${activeClassName}.`);
                return;
              }
            } else {
              if (selectedNormalSpells.length >= spellsKnownOrPrepared) {
                alert(`You have already chosen/prepared the maximum of ${spellsKnownOrPrepared} spells for ${activeClassName}.`);
                return;
              }
            }

            const newSpells = [
              ...formData.spells,
              {
                name: spell.name,
                level: spell.level,
                desc: extractDesc(spell),
                source: spell.source,
                class: activeClassName
              }
            ];
            setFormData({ ...formData, spells: newSpells });
          }
        };

        // Filter available spells in the DB for this class
        const availableSpells = spellsList?.filter(s => {
          const spellLvl = Number(s.data.level);
          if (isNaN(spellLvl)) return false;
          if (maxSpellLevel === 0) return false;
          if (spellLvl > maxSpellLevel) return false;
          
          const isOnList = isSpellOnClassList(s, activeClassName);
          const isSubclass = activeSubclassSpells.has(s.name.toLowerCase());
          
          if (!isOnList && !isSubclass) return false;

          if (spellSearchQuery.trim() !== '') {
            const query = spellSearchQuery.toLowerCase();
            const matchesName = s.name.toLowerCase().includes(query);
            const matchesDesc = s.data.entries ? extractDesc(s.data).toLowerCase().includes(query) : false;
            return matchesName || matchesDesc;
          }
          
          return true;
        }) || [];

        // Compute subclass spells to add dynamically for display (without setting state during render)
        const displaySpells = [...selectedClassSpells];
        activeSubclassSpells.forEach(scSpellName => {
            const alreadyInDisplay = displaySpells.some(
              (s: any) => s.name.toLowerCase() === scSpellName
            );
            if (!alreadyInDisplay) {
                const spellData = spellsList?.find(s => s.name.toLowerCase() === scSpellName);
                if (spellData) {
                    displaySpells.push({
                      name: spellData.name,
                      level: spellData.data.level,
                      desc: extractDesc(spellData.data),
                      source: spellData.data.source,
                      isAlwaysPrepared: true,
                      class: activeClassName
                    });
                }
            }
        });

        const spellsByLevel: Record<number, any[]> = {};
        availableSpells.forEach(s => {
          const lvl = s.data.level;
          if (!spellsByLevel[lvl]) spellsByLevel[lvl] = [];
          spellsByLevel[lvl].push(s);
        });

        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center border-b-2 border-fel-green mb-6 pb-2">
              <h2 className="text-3xl text-fel-green">Spellbook</h2>
              <div className="text-xs font-bold text-bone/40 uppercase tracking-widest">
                Class: {activeClassName}
              </div>
            </div>

            {/* Multiclass Class Tabs */}
            {activeSpellcastingClasses.length > 1 && (
              <div className="flex border-b border-fel-green/20 gap-2 mb-4 overflow-x-auto">
                {activeSpellcastingClasses.map((c: any) => {
                  const idx = formData.classes.indexOf(c);
                  const key = `${c.name}-${idx}`;
                  const isCurrent = key === activeTabKey;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setActiveSpellTab(key);
                        setSpellSearchQuery('');
                      }}
                      className={`px-4 py-2 text-sm font-bold uppercase tracking-wider border-t-2 border-x transition-all duration-300 ${
                        isCurrent
                          ? 'border-t-fel-green border-x-fel-green/20 bg-abyssal-black text-fel-green'
                          : 'border-t-transparent border-x-transparent hover:text-bone text-bone/50 hover:bg-abyssal-black/20'
                      }`}
                    >
                      {c.name} (Lvl {c.level})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Quota Indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-abyssal-black/50 p-4 border border-fel-green/10 rounded-lg">
              <div>
                <span className="text-[10px] font-bold uppercase text-bone/40 tracking-wider block">Cantrips Known</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-bone">{selectedCantrips.length} / {cantripsKnown}</span>
                  <div className="flex-1 bg-abyssal-black border border-fel-green/10 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-fel-green h-full transition-all duration-500" 
                      style={{ width: `${cantripsKnown > 0 ? (selectedCantrips.length / cantripsKnown) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-bone/40 tracking-wider block">
                  {isPrepared ? 'Spells Prepared' : 'Spells Learned'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-bone">{selectedNormalSpells.length} / {spellsKnownOrPrepared}</span>
                  <div className="flex-1 bg-abyssal-black border border-fel-green/10 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-fel-green h-full transition-all duration-500" 
                      style={{ width: `${spellsKnownOrPrepared > 0 ? (selectedNormalSpells.length / spellsKnownOrPrepared) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Search query */}
            <div className="w-full">
              <input
                type="text"
                value={spellSearchQuery}
                onChange={(e) => setSpellSearchQuery(e.target.value)}
                placeholder={`Search ${activeClassName} spells...`}
                className="w-full bg-abyssal-black border border-fel-green/20 rounded px-4 py-2 text-sm text-bone focus:outline-none focus:border-fel-green/60"
              />
            </div>

            {/* main spell editor view */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Spells Selection List */}
              <div className="md:col-span-3 space-y-4">
                <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar space-y-6">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => {
                     if (level > maxSpellLevel && level !== 0) return null;

                     const levelSpells = spellsByLevel[level];
                     if (!levelSpells || levelSpells.length === 0) return null;

                     return (
                        <div key={level} className="space-y-2">
                          <h3 className="text-dnd-gold font-bold uppercase text-xs border-b border-dnd-gold/30 pb-1 sticky top-0 bg-[#1a0f2e] z-10">
                            {level === 0 ? 'Cantrips' : `Level ${level}`}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {levelSpells.sort((a,b) => a.name.localeCompare(b.name)).map(s => {
                              const isSelected = formData.spells.some(
                                (fs: any) => fs.name === s.name && fs.class?.toLowerCase() === activeClassName.toLowerCase()
                              );
                              const isLocked = activeSubclassSpells.has(s.name.toLowerCase());

                              return (
                                <div 
                                  key={s.id} 
                                  onClick={() => !isLocked && toggleSpell(s.data)}
                                  className={`p-3 border transition-all flex justify-between items-start group ${
                                    isLocked ? 'bg-necrotic-purple/20 border-necrotic-purple cursor-not-allowed opacity-80' :
                                    isSelected 
                                      ? 'bg-fel-green/20 border-fel-green shadow-sm cursor-pointer' 
                                      : 'bg-abyssal-black/40 border-fel-green/10 hover:border-fel-green/40 cursor-pointer'
                                  }`}
                                >
                                  <div className="flex-grow">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className={`text-sm font-bold ${isLocked ? 'text-necrotic-purple' : isSelected ? 'text-fel-green' : 'text-bone'}`}>
                                        {s.name} <span className="text-[8px] opacity-40 font-normal">({s.data.source})</span>
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-bone/40 line-clamp-2 leading-tight group-hover:line-clamp-none transition-all">
                                      {cleanText(extractDesc(s.data).substring(0, 100))}...
                                    </p>
                                  </div>
                                  {isSelected && <div className={`ml-2 ${isLocked ? 'text-necrotic-purple' : 'text-fel-green'}`}>
                                    {isLocked ? '🔒' : '●'}
                                  </div>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                     );
                  })}
                </div>
              </div>

              {/* Selected Spells Sidebar */}
              <div className="space-y-4">
                <div className="p-4 bg-abyssal-black border border-fel-green/20 min-h-[200px] rounded">
                  <h4 className="text-[10px] font-black uppercase text-fel-green/60 mb-2 tracking-widest">
                    {activeClassName} Spells
                  </h4>
                  {isPrepared && (
                    <div className="text-[8px] italic text-dnd-gold mb-4 leading-tight">
                      As a prepared caster, select spells you have prepared for the day. Subclass spells (🔒) are always prepared.
                    </div>
                  )}
                  {!isPrepared && (
                    <div className="text-[8px] italic text-dnd-gold mb-4 leading-tight">
                      As a known caster, select the spells you have learned. Subclass spells (🔒) are always known.
                    </div>
                  )}
                  {displaySpells.length > 0 ? (
                    <div className="space-y-2">
                      {displaySpells.sort((a: any, b: any) => a.level - b.level || a.name.localeCompare(b.name)).map((s: any) => {
                        const isLocked = activeSubclassSpells.has(s.name.toLowerCase());
                        return (
                          <div key={s.name} className="flex justify-between items-center text-[10px] border-b border-bone/5 pb-1">
                            <span className={isLocked ? 'text-necrotic-purple' : 'text-bone/80'}>
                              {s.name} <span className="opacity-30 italic ml-1">Lvl {s.level}</span>
                              <span className="text-[7px] text-fel-green/60 uppercase font-black ml-1.5 tracking-wider">
                                {isLocked ? 'Always Prepared 🔒' : s.level === 0 ? 'Cantrip' : isPrepared ? 'Prepared' : 'Learned'}
                              </span>
                            </span>
                            {!isLocked && (
                              <button 
                                onClick={() => toggleSpell(s, true)}
                                className="text-dnd-red hover:text-white"
                              >×</button>
                            )}
                            {isLocked && <span className="opacity-50 text-[8px]">🔒</span>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[10px] italic text-bone/20 text-center py-10">No spells chosen.</div>
                  )}
                </div>

                {/* All other spells summary */}
                {activeSpellcastingClasses.length > 1 && (
                  <div className="p-4 bg-abyssal-black/40 border border-fel-green/10 rounded">
                    <h4 className="text-[10px] font-black uppercase text-bone/40 mb-2 tracking-widest">
                      Other Classes' Spells
                    </h4>
                    {formData.spells.filter((s: any) => s.class?.toLowerCase() !== activeClassName.toLowerCase()).length > 0 ? (
                      <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar">
                        {formData.spells
                          .filter((s: any) => s.class?.toLowerCase() !== activeClassName.toLowerCase())
                          .sort((a: any, b: any) => a.class?.localeCompare(b.class) || a.level - b.level)
                          .map((s: any) => (
                            <div key={`${s.class}-${s.name}`} className="flex justify-between items-center text-[9px] text-bone/60 border-b border-bone/5 pb-0.5">
                              <span>{s.name} <span className="opacity-40 italic">Lvl {s.level}</span></span>
                              <span className="text-fel-green/40 text-[8px] uppercase font-bold">{s.class}</span>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-[9px] italic text-bone/20 text-center py-4">No spells in other classes.</div>
                    )}
                  </div>
                )}
                
                <p className="text-[10px] text-bone/40 italic leading-relaxed">
                  "A spell is a discrete magical effect, a single shaping of the magical energies that suffuse the multiverse into a specific, limited expression."
                </p>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="pt-8 flex justify-center">
              <button
                onClick={nextStep}
                className="bg-fel-green text-abyssal-black px-12 py-4 rounded-full font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg cursor-pointer"
              >
                Proceed to Equipment <ChevronRight className="inline-block ml-2" />
              </button>
            </div>
          </div>
        );
      }
      case 'Equipment': {
        const selectedClassData = classes?.find(c => c.name === primaryClass?.name);
        const classDetails = selectedClassData?.data?.fullData?.class?.find((c: any) => c.name === primaryClass?.name);
        
        if (!classDetails) {
          if (selectedClassData?.data?.filename && !selectedClassData?.data?.fullData) {
              fetchClassDetails(primaryClass?.name, selectedClassData.data.filename);
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

        const toggleEquipment = (index: string, choice: 'a' | 'b') => {
          const newEquipment = { ...formData.resources.equipmentChoices, [index]: choice };
          setFormData({ 
            ...formData, 
            resources: { ...formData.resources, equipmentChoices: newEquipment } 
          });
        };

        const renderSpecifics = (idx: number, choiceKey: 'a' | 'b') => {
          const currentChoice = formData.resources.equipmentChoices?.[`${primaryClass?.name}-${idx}`];
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
                     value={formData.resources.equipmentSpecifics?.[`${primaryClass?.name}-${idx}`]?.[choiceKey]?.[`${itemIdx}-${qIdx}`] || ''}
                     onChange={(e) => {
                       const newSpecifics = { ...(formData.resources.equipmentSpecifics || {}) };
                       if (!newSpecifics[`${primaryClass?.name}-${idx}`]) newSpecifics[`${primaryClass?.name}-${idx}`] = {};
                       if (!newSpecifics[`${primaryClass?.name}-${idx}`][choiceKey]) newSpecifics[`${primaryClass?.name}-${idx}`][choiceKey] = {};
                       newSpecifics[`${primaryClass?.name}-${idx}`][choiceKey][`${itemIdx}-${qIdx}`] = e.target.value;
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

                const currentChoice = formData.resources.equipmentChoices?.[`${primaryClass?.name}-${idx}`] || 'a';
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
                            onClick={() => toggleEquipment(`${primaryClass?.name}-${idx}`, key as 'a' | 'b')}
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

            <div className="pt-6 border-t border-fel-green/20">
              <h3 className="text-xl text-fel-green mb-4">Additional Inventory</h3>
              <div className="flex gap-2 mb-4">
                <input 
                  type="text" 
                  placeholder="Item name..." 
                  className="flex-grow bg-abyssal-black border border-fel-green/30 p-2 text-bone focus:border-fel-green focus:outline-none"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                />
                <input 
                  type="number" 
                  min="1"
                  className="w-20 bg-abyssal-black border border-fel-green/30 p-2 text-bone focus:border-fel-green focus:outline-none text-center"
                  value={newItemQty}
                  onChange={e => setNewItemQty(parseInt(e.target.value) || 1)}
                />
                <button
                  onClick={() => {
                    if (newItemName.trim()) {
                      const newInv = [...(formData.inventory || []), { name: newItemName.trim(), quantity: newItemQty }];
                      setFormData({ ...formData, inventory: newInv });
                      setNewItemName('');
                      setNewItemQty(1);
                    }
                  }}
                  className="bg-fel-green text-abyssal-black font-bold uppercase px-4 hover:bg-white transition-colors"
                >
                  Add
                </button>
              </div>

              {formData.inventory?.length > 0 && (
                <div className="space-y-1 bg-abyssal-black/40 border border-fel-green/10 p-4">
                  {formData.inventory.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between items-center text-xs text-bone/80 border-b border-bone/5 pb-1">
                      <span>{item.name} <span className="opacity-40 italic ml-2">x{item.quantity || 1}</span></span>
                      <button 
                        onClick={() => {
                          const newInv = [...formData.inventory];
                          newInv.splice(i, 1);
                          setFormData({ ...formData, inventory: newInv });
                        }}
                        className="text-dnd-red hover:text-white"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-8 flex justify-center">
              <button
                disabled={Object.keys(formData.resources.equipmentChoices || {}).filter(k => k.startsWith(`${primaryClass?.name}-`)).length < equipmentOptions.filter((o: string) => o.includes(' or ')).length}
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
                  <div className="text-sm text-fel-green italic">Level {formData.classes.reduce((acc: number, c: any) => acc + (c.level || 0), 0)} {formData.race} {primaryClass?.name}</div>
                  {formData.background && (
                    <div className="text-xs text-bone/60 mt-1 uppercase tracking-tighter flex justify-between">
                      <span>Background: {formData.background}</span>
                      {(() => {
                        const bg = backgrounds?.find(b => b.name === formData.background);
                        return bg?.data?.source ? <span className="opacity-30">{bg.data.source}</span> : null;
                      })()}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-abyssal-black/40 border border-fel-green/20">
                  <label className="text-[10px] font-bold uppercase text-fel-green/40 block mb-2">Spells</label>
                  <div className="space-y-1">
                    {formData.spells?.length > 0 ? formData.spells.map((s: any, i: number) => {
                      const isPreparedClass = s.class ? ['cleric', 'paladin', 'wizard', 'druid', 'artificer'].includes(s.class.toLowerCase()) : false;
                      const badgeText = s.isAlwaysPrepared 
                        ? 'always prepared' 
                        : s.level === 0 
                          ? 'cantrip' 
                          : isPreparedClass 
                            ? 'prepared' 
                            : 'learned';
                      return (
                        <div key={i} className="text-xs text-bone/80 border-b border-bone/5 pb-1 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span>{s.name}</span>
                            {s.class && <span className="text-[8px] text-dnd-gold font-normal tracking-wide lowercase">({s.class})</span>}
                            <span className="text-[8px] opacity-20 uppercase">({s.source})</span>
                            <span className={`text-[6px] font-bold uppercase tracking-wider px-1 py-0.5 rounded border ${
                              s.isAlwaysPrepared 
                                ? 'bg-[#e9d5ff] text-[#6b21a8] border-[#c084fc]/30' 
                                : badgeText === 'prepared' 
                                  ? 'bg-[#dcfce7] text-[#166534] border-[#86efac]/30' 
                                  : 'bg-[#fef9c3] text-[#854d0e] border-[#fde047]/30'
                            }`}>
                              {badgeText}
                            </span>
                          </div>
                          <span className="opacity-30 italic">Lvl {s.level}</span>
                        </div>
                      );
                    }) : <div className="text-xs italic text-bone/20">No spells selected.</div>}
                  </div>
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
                    {(() => {
                      // Compute traits for display in review
                      const racialTraits = selectedRaceData?.data?.entries?.filter((e: any) => e.name && e.entries).map((e: any) => ({
                        name: cleanText(e.name),
                        desc: extractDesc(e),
                        source: e.source || selectedRaceData.data.source
                      })) || [];

                      const rawClassFeatures: any[] = [];
                      formData.classes.forEach((cls: any) => {
                        const selectedClassData = classes?.find(c => c.name === cls.name);
                        const classFeatureData = selectedClassData?.data?.fullData?.classFeature || [];
                        const subclassFeatureData = selectedClassData?.data?.fullData?.subclassFeature || [];
                        
                        let selectedSubclassData: any = null;
                        if (cls.subclass && selectedClassData?.data?.fullData?.subclass) {
                            const matchingSubclasses = selectedClassData.data.fullData.subclass.filter((sc: any) => sc.name === cls.subclass);
                            selectedSubclassData = matchingSubclasses.find((sc: any) => {
                                const is2024 = isSource2024(sc.source);
                                if (formData.ruleset === '2014') {
                                    return !is2024;
                                } else {
                                    if (is2024) return true;
                                    const has2024Version = matchingSubclasses.some((other: any) => isSource2024(other.source));
                                    return !has2024Version;
                                }
                            });
                            if (!selectedSubclassData) {
                                selectedSubclassData = matchingSubclasses[0];
                            }
                        }

                        const classFeatures = classFeatureData
                          .filter((f: any) => {
                            if (f.level > cls.level) return false;
                            const is2024 = isSource2024(f.source);
                            return formData.ruleset === '2024' ? is2024 : !is2024;
                          })
                          .map((f: any) => ({
                            name: cleanText(f.name),
                            desc: extractDesc(f),
                            level: f.level,
                            className: cls.name,
                            source: f.source
                          }));
                        
                        rawClassFeatures.push(...classFeatures);

                        if (selectedSubclassData?.shortName) {
                            const scFeatures = subclassFeatureData
                              .filter((f: any) => {
                                if (f.level > cls.level) return false;
                                if (f.subclassShortName !== selectedSubclassData.shortName) return false;
                                return f.subclassSource === selectedSubclassData.source;
                              })
                              .map((f: any) => ({
                                  name: cleanText(f.name),
                                  desc: extractDesc(f),
                                  level: f.level,
                                  className: cls.name,
                                  subclass: cls.subclass,
                                  source: f.source
                              }));
                            rawClassFeatures.push(...scFeatures);
                        }
                      });

                      const seenNames = new Set<string>();
                      const finalClassFeatures: any[] = [];
                      for (const f of rawClassFeatures) {
                        if (f.name === 'Ability Score Improvement' || f.name === 'Ability Score Improvement (2024)') continue;
                        if (!seenNames.has(f.name)) {
                          seenNames.add(f.name);
                          finalClassFeatures.push(f);
                        }
                      }

                      let displayTraits = [...racialTraits, ...finalClassFeatures];
                      if (formData.resources.variableTrait && !formData.resources.variableTrait.startsWith('Skill: ')) {
                        displayTraits = displayTraits.map(t => 
                          t.name === 'Variable Trait' 
                            ? { name: 'Darkvision', desc: 'You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.', source: t.source }
                            : t
                        );
                      }
                      if (formData.background) {
                        const bg = backgrounds?.find(b => b.name === formData.background);
                        if (bg) {
                           displayTraits.push({ name: bg.name, desc: extractDesc(bg.data), source: bg.data.source });
                        }
                      }

                      if (formData.resources.fightingStyle) {
                        displayTraits.push({
                          name: `Fighting Style: ${formData.resources.fightingStyle}`,
                          source: 'Class Feature'
                        });
                      }

                      if (formData.resources.pactBoon) {
                        displayTraits.push({
                          name: `Pact Boon: ${formData.resources.pactBoon}`,
                          source: 'Class Feature'
                        });
                      }

                      if (formData.resources.warlockInvocations?.length > 0) {
                        displayTraits.push({
                          name: 'Eldritch Invocations',
                          source: 'Class Feature'
                        });
                      }

                      if (formData.resources.metamagic?.length > 0) {
                        displayTraits.push({
                          name: 'Metamagic Options',
                          source: 'Class Feature'
                        });
                      }

                      if (formData.resources.maneuvers?.length > 0) {
                        displayTraits.push({
                          name: 'Combat Maneuvers',
                          source: 'Class Feature'
                        });
                      }

                      return displayTraits.length > 0 ? displayTraits.map((trait: any, i: number) => (
                        <div key={i} className="text-xs text-bone/80 border-b border-bone/5 pb-1 flex justify-between">
                          <span>{typeof trait === 'string' ? trait : trait.name}</span>
                          {trait.source && <span className="opacity-30">{trait.source}</span>}
                        </div>
                      )) : <div className="text-xs italic text-bone/20">No features mapped.</div>;
                    })()}
                  </div>
                </div>

                <div className="p-4 bg-abyssal-black/40 border border-fel-green/20">
                  <label className="text-[10px] font-bold uppercase text-fel-green/40 block mb-2">Inventory</label>
                  <div className="space-y-1">
                    {(() => {
                      // Note: Final generation happens on save, but custom items are in formData.inventory
                      const displayInv = formData.inventory || [];
                      return displayInv.length > 0 ? displayInv.map((item: any, i: number) => (
                        <div key={i} className="text-xs text-bone/60 border-b border-bone/5 pb-1 flex justify-between group">
                          <span>{item.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="opacity-30 italic">x{item.quantity || 1}</span>
                          </div>
                        </div>
                      )) : <div className="text-xs italic text-bone/20">Starting equipment will be generated on save. You can also add custom items in the Equipment tab.</div>;
                    })()}
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
        <div className="flex gap-4 items-center">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 border border-fel-green/30 rounded-full hover:bg-fel-green hover:text-abyssal-black text-fel-green transition-all cursor-pointer flex items-center justify-center"
            title="Toggle Theme"
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
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
        </div>
      </header>

      <div className="min-h-[400px]">
        {renderStep()}
      </div>

      {validationErrors?.length > 0 && (
        <div className="mt-8 p-4 bg-dnd-red/20 border-l-4 border-dnd-red animate-in fade-in slide-in-from-top-4">
          <h4 className="text-dnd-red font-bold uppercase text-xs mb-2 tracking-widest">Validation Errors</h4>
          <ul className="space-y-1">
            {validationErrors.map((err, i) => (
              <li key={i} className="text-bone/80 text-[10px] italic leading-tight flex items-center gap-2">
                <span className="w-1 h-1 bg-dnd-red rounded-full"></span>
                <span className="font-bold text-dnd-red/60 uppercase">{err.path?.join('.')}</span>: {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

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
