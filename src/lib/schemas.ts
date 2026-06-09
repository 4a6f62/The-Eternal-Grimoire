import { z } from 'zod';

export const AbilityScoreSchema = z.number().int().min(1).max(30);

export const CharacterSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  level: z.number().int().min(1).max(20),
  race: z.string(),
  class: z.string(),
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
  inventory: z.array(z.any()),
  spells: z.array(z.any()),
  resources: z.record(z.string(), z.any()),
  lastModified: z.number(),
});

export type CharacterType = z.infer<typeof CharacterSchema>;
