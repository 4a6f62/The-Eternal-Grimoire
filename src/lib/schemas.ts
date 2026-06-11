import { z } from 'zod';

export const AbilityScoreSchema = z.number().int().min(1).max(30);

export const CharacterSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  portraitUrl: z.string().optional(),
  tokenUrl: z.string().optional(),
  creator: z.string().optional(),
  race: z.string().min(1),
  background: z.string().optional(),
  ruleset: z.enum(['2014', '2024']).default('2014'),
  classes: z.array(z.object({
    name: z.string().min(1),
    level: z.number().int().min(1),
    subclass: z.string().optional(),
  })).min(1),
  class: z.string().optional(),
  level: z.number().int().min(1).max(20).optional(),
  subclass: z.string().optional(),
  size: z.string().default('Medium'),
  alignment: z.string().default('True Neutral'),
  languages: z.array(z.string()).default(['Common']),
  hp: z.object({
    current: z.number().int(),
    max: z.number().int().min(1),
    temp: z.number().int().default(0),
  }),
  stats: z.object({
    strength: AbilityScoreSchema,
    dexterity: AbilityScoreSchema,
    constitution: AbilityScoreSchema,
    intelligence: AbilityScoreSchema,
    wisdom: AbilityScoreSchema,
    charisma: AbilityScoreSchema,
  }),
  proficiencies: z.array(z.string()).default([]),
  traits: z.array(z.any()).default([]),
  feats: z.array(z.any()).default([]),
  inventory: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    quantity: z.number().default(1),
    weight: z.number().optional(),
    type: z.string().optional(),
    data: z.any().optional(),
  })).default([]),
  spells: z.array(z.any()).default([]),
  resources: z.object({
    variableTrait: z.string().optional(),
    fightingStyle: z.string().optional(),
    pactBoon: z.string().optional(),
    warlockInvocations: z.array(z.string()).optional(),
    metamagic: z.array(z.string()).optional(),
    maneuvers: z.array(z.string()).optional(),
    baseStats: z.any().optional(),
    languageChoices: z.array(z.string()).optional(),
    equipmentChoices: z.record(z.string(), z.string()).optional(),
    equipmentSpecifics: z.record(z.string(), z.any()).optional(),
    asiChoices: z.array(z.object({
      type: z.enum(['asi', 'feat']),
      featName: z.string().optional(),
      stats: z.object({
        strength: z.number().default(0),
        dexterity: z.number().default(0),
        constitution: z.number().default(0),
        intelligence: z.number().default(0),
        wisdom: z.number().default(0),
        charisma: z.number().default(0),
      }).optional(),
    })).optional(),
  }).catchall(z.any()),
  lastModified: z.number(),
});

export type CharacterType = z.infer<typeof CharacterSchema>;
