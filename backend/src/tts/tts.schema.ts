import { z } from 'zod';

export const SpeakSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

export type SpeakDto = z.infer<typeof SpeakSchema>;
