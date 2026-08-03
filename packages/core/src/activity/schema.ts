import { z } from 'zod';

export const ActivityResponseSchema = z.array(
  z.object({
    type: z.string(),
    label: z.string(),
    detail: z.string(),
    time: z.string(),
    icon: z.string(),
  })
);

export type ActivityDTO = z.infer<typeof ActivityResponseSchema>[number];
