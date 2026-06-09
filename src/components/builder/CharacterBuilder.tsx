import { useState, useEffect } from 'react';
import { db } from '../../lib/db';
import { CharacterSchema } from '../../lib/schemas';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { fetchAndCache5eData } from '../../lib/dataFetcher';

type Step = 'Basics' | 'Abilities' | 'Proficiencies' | 'Equipment' | 'Review';

const STEPS: Step[] = ['Basics', 'Abilities', 'Proficiencies', 'Equipment', 'Review'];

export function CharacterBuilder({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [formData, setFormData] = useState<any>({
    name: '',
    level: 1,
    race: '',
    class: '',
    stats: {
      strength: 8,
      dexterity: 8,
      constitution: 8,
      intelligence: 8,
      wisdom: 8,
      charisma: 8,
    },
    hp: { current: 10, max: 10, temp: 0 },
    inventory: [],
    spells: [],
    resources: {},
  });

  const races = useLiveQuery(() => db.fiveetools.where('type').equals('race').toArray());
  const classes = useLiveQuery(() => db.fiveetools.where('type').equals('class').toArray());

  const selectedRaceData = races?.find(r => r.name === formData.race);

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
  }, []);

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const saveCharacter = async () => {
    try {
      const validated = CharacterSchema.parse({
        ...formData,
        lastModified: Date.now(),
      });
      await db.characters.add(validated);
      onComplete();
    } catch (err) {
      console.error('Validation failed', err);
      alert('Please check your data. Some fields are missing or invalid.');
    }
  };

  const renderStep = () => {
    switch (STEPS[currentStep]) {
      case 'Basics':
        return (
          <div className="space-y-6">
            <h2 className="text-3xl border-b-2 border-dnd-gold mb-6 pb-2 text-dnd-red">Character Identity</h2>
            <div className="grid grid-cols-1 gap-6">
              <div className="flex flex-col">
                <label className="text-xs font-bold uppercase text-dnd-gold mb-1">Character Name</label>
                <input
                  type="text"
                  className="bg-parchment-base border border-border-sepia p-3 font-serif text-xl text-ink focus:outline-none focus:border-dnd-red shadow-inner"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Tordek"
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col">
                  <label className="text-xs font-bold uppercase text-dnd-gold mb-1">Race</label>
                  <select
                    className="bg-parchment-base border border-border-sepia p-3 font-serif text-lg text-ink focus:outline-none focus:border-dnd-red"
                    value={formData.race}
                    onChange={(e) => setFormData({ ...formData, race: e.target.value })}
                  >
                    <option value="">Choose Race...</option>
                    {races?.map(r => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold uppercase text-dnd-gold mb-1">Class</label>
                  <select
                    className="bg-parchment-base border border-border-sepia p-3 font-serif text-lg text-ink focus:outline-none focus:border-dnd-red"
                    value={formData.class}
                    onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                  >
                    <option value="">Choose Class...</option>
                    {classes?.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        );
      case 'Abilities':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b-2 border-dnd-gold mb-6 pb-2">
              <h2 className="text-3xl text-dnd-red">Ability Scores</h2>
              <div className={`px-4 py-1 rounded-full border-2 font-bold ${pointsRemaining < 0 ? 'border-red-600 text-red-600 bg-red-50' : 'border-dnd-gold text-dnd-gold bg-parchment-light'}`}>
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
                  <div key={stat} className="p-4 bg-parchment-base border border-border-sepia flex items-center justify-between shadow-sm">
                    <div className="flex-1">
                      <label className="text-xs font-bold uppercase text-dnd-gold block">{stat}</label>
                      <div className="text-4xl font-bold text-ink">
                        {total} <span className="text-lg text-dnd-red ml-1">({modifier >= 0 ? `+${modifier}` : modifier})</span>
                      </div>
                      {racialBonus > 0 && <div className="text-[10px] text-dnd-red font-bold italic tracking-wide">+{racialBonus} from {formData.race}</div>}
                    </div>
                    
                    <div className="flex items-center gap-3 bg-parchment-light p-2 border border-border-sepia rounded-lg shadow-inner">
                      <button 
                        onClick={() => updateStat(statKey, -1)}
                        className="w-8 h-8 flex items-center justify-center font-bold text-xl text-dnd-red hover:bg-dnd-red hover:text-white transition-all rounded-full border border-dnd-red/30 cursor-pointer"
                      >
                        -
                      </button>
                      <div className="text-xl font-bold w-6 text-center text-ink">{baseScore}</div>
                      <button 
                        onClick={() => updateStat(statKey, 1)}
                        className="w-8 h-8 flex items-center justify-center font-bold text-xl text-dnd-red hover:bg-dnd-red hover:text-white transition-all rounded-full border border-dnd-red/30 cursor-pointer"
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
          {STEPS.map((_, i) => (
            <div 
              key={i} 
              className={`h-2 w-8 rounded-full ${i <= currentStep ? 'bg-fel-green' : 'bg-necrotic-purple/30'}`} 
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
            className="bg-necrotic-purple text-bone px-6 py-2 rounded-sm font-bold uppercase flex items-center gap-2 hover:bg-fel-green hover:text-abyssal-black transition-all cursor-pointer border border-fel-green/30"
          >
            Continue <ChevronRight />
          </button>
        ) : (
          <button
            onClick={saveCharacter}
            className="bg-fel-green text-abyssal-black px-6 py-2 rounded-sm font-bold uppercase flex items-center gap-2 hover:bg-white transition-all cursor-pointer border-2 border-necrotic-purple"
          >
            Save Character <Save />
          </button>
        )}
      </footer>
    </div>
  );
}
