import { z } from 'zod';

const CloudinaryImageSchema = z.string().url().refine(
  (url) => url.startsWith('https://res.cloudinary.com/'),
  'Images must be uploaded through Cloudinary',
);

export const CreateServiceSchema = z.object({
  name: z.string().trim().min(1, 'Service name is required'),
  description: z.string().optional(),
  baseRate: z.coerce.number().positive('Base rate must be greater than zero'),
  minDuration: z.coerce.number().positive('Minimum duration must be greater than zero').optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  requiresMaterials: z.boolean().optional(),
  skills: z.string().optional(),
  galleryImages: z.array(CloudinaryImageSchema).optional(),
  heroImages: z.array(CloudinaryImageSchema).optional(),
});

export const UpdateServiceSchema = CreateServiceSchema.partial().extend({
  id: z.string().min(1, 'Service ID is required'),
});

export type CreateServiceDTO = z.infer<typeof CreateServiceSchema>;
export type UpdateServiceDTO = z.infer<typeof UpdateServiceSchema>;
