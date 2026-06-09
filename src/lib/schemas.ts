import { z } from 'zod';

export const AbilityScoreSchema = z.number().int().min(1).max(30);

export const CharacterSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  race: z.string().min(1),
  ruleset: z.enum(['2014', '2024']).default('2014'),
  classes: z.array(z.object({
    name: z.string(),
    level: z.number().int().min(1),
    subclass: z.string().optional(),
  })).min(1),
  class: z.string().min(1).optional(),
  level: z.number().int().min(1).max(20).optional(),
  subclass: z.string().optional(),
  size: z.string().default('Medium'),
  alignment: z.string().default('True Neutral'),
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
  inventory: z.array(z.any()),
  spells: z.array(z.any()),
  resources: z.record(z.string(), z.any()),
  lastModified: z.number(),
});

export type CharacterType = z.infer<typeof CharacterSchema>;
