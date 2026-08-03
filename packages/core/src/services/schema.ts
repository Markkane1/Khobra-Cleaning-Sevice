import { z } from 'zod';

const CloudinaryImageSchema = z.string().url().refine(
  (url) => url.startsWith('https://res.cloudinary.com/'),
  'Images must be uploaded through Cloudinary',
);

export const CreateServiceSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  baseRate: z.number().or(z.string().transform(Number)),
  minDuration: z.number().or(z.string().transform(Number)).optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  requiresMaterials: z.boolean().optional(),
  skills: z.string().optional(),
  galleryImages: z.array(CloudinaryImageSchema).optional(),
  heroImages: z.array(CloudinaryImageSchema).optional(),
});

export const UpdateServiceSchema = CreateServiceSchema.partial().extend({
  id: z.string(),
});

export type CreateServiceDTO = z.infer<typeof CreateServiceSchema>;
export type UpdateServiceDTO = z.infer<typeof UpdateServiceSchema>;
