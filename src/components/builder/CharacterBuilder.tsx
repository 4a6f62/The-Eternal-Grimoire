import { useState } from 'react';
import { db } from '../../lib/db';
import { CharacterSchema } from '../../lib/schemas';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';

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
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    hp: { current: 10, max: 10, temp: 0 },
    inventory: [],
    spells: [],
    resources: {},
  });

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 0, 0));

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
          <div className="space-y-4">
            <h2 className="text-3xl border-b border-gold/50 mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col">
                <label className="text-sm font-bold uppercase text-gold">Character Name</label>
                <input
                  type="text"
                  className="bg-parchment border-2 border-dnd-red p-2 font-serif text-lg focus:outline-none focus:ring-2 focus:ring-gold"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Tordek"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="text-sm font-bold uppercase text-gold">Race</label>
                  <input
                    type="text"
                    className="bg-parchment border-2 border-dnd-red p-2 font-serif text-lg"
                    value={formData.race}
                    onChange={(e) => setFormData({ ...formData, race: e.target.value })}
                    placeholder="e.g. Hill Dwarf"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-bold uppercase text-gold">Class</label>
                  <input
                    type="text"
                    className="bg-parchment border-2 border-dnd-red p-2 font-serif text-lg"
                    value={formData.class}
                    onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                    placeholder="e.g. Fighter"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      case 'Abilities':
        return (
          <div className="space-y-4">
            <h2 className="text-3xl border-b border-gold/50 mb-4">Ability Scores</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.keys(formData.stats).map((stat) => (
                <div key={stat} className="border-2 border-dnd-red p-4 bg-parchment text-center">
                  <label className="text-sm font-bold uppercase text-gold block mb-1">{stat}</label>
                  <input
                    type="number"
                    className="bg-transparent text-3xl font-bold w-full text-center focus:outline-none"
                    value={formData.stats[stat]}
                    onChange={(e) => setFormData({
                      ...formData,
                      stats: { ...formData.stats, [stat]: parseInt(e.target.value) || 10 }
                    })}
                  />
                  <div className="text-sm italic opacity-60">Modifier: {Math.floor((formData.stats[stat] - 10) / 2)}</div>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return (
          <div className="text-center py-20 italic opacity-50">
            Step {STEPS[currentStep]} implementation coming soon...
          </div>
        );
    }
  };

  return (
    <div className="max-w-4xl w-full bg-parchment-dark p-8 md:p-12 book-shadow gold-border relative">
      <header className="border-b-2 border-dnd-red pb-4 mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl uppercase tracking-tighter">New Character</h1>
          <p className="text-sm italic opacity-80 underline decoration-gold underline-offset-4">
            Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep]}
          </p>
        </div>
        <div className="flex gap-2">
          {STEPS.map((_, i) => (
            <div 
              key={i} 
              className={`h-2 w-8 rounded-full ${i <= currentStep ? 'bg-dnd-red' : 'bg-gold/30'}`} 
            />
          ))}
        </div>
      </header>

      <div className="min-h-[400px]">
        {renderStep()}
      </div>

      <footer className="mt-12 pt-8 border-t-2 border-dnd-red flex justify-between">
        <button
          onClick={prevStep}
          disabled={currentStep === 0}
          className="flex items-center gap-2 font-bold uppercase text-dnd-red disabled:opacity-30 cursor-pointer"
        >
          <ChevronLeft /> Back
        </button>
        
        {currentStep < STEPS.length - 1 ? (
          <button
            onClick={nextStep}
            className="bg-dnd-red text-parchment px-6 py-2 rounded-sm font-bold uppercase flex items-center gap-2 hover:bg-deep-brown transition-colors cursor-pointer"
          >
            Continue <ChevronRight />
          </button>
        ) : (
          <button
            onClick={saveCharacter}
            className="bg-gold text-deep-brown px-6 py-2 rounded-sm font-bold uppercase flex items-center gap-2 hover:bg-parchment transition-colors cursor-pointer border-2 border-dnd-red"
          >
            Save Character <Save />
          </button>
        )}
      </footer>
    </div>
  );
}
