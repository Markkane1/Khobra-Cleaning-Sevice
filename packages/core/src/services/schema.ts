import { z } from 'zod';

const CloudinaryImageSchema = z.string().url().refine(
  (url) => url.startsWith('https://res.cloudinary.com/'),
  'Images must be uploaded through Cloudinary',
);
export const ServiceMaterialSchema = z.object({
  inventoryItemId: z.string().min(1, 'Select an inventory item'),
  quantityPerCleanerHour: z.coerce.number().positive('Material quantity must be greater than zero'),
  unit: z.string().trim().min(1).max(30).optional(),
});

export const CreateServiceSchema = z.object({
  name: z.string().trim().min(1, 'Service name is required'),
  description: z.string().optional(),
  baseRate: z.coerce.number().positive('Base rate must be greater than zero'),
  withMaterialsRate: z.coerce.number().positive('With-materials rate must be greater than zero'),
  minDuration: z.coerce.number().positive('Minimum duration must be greater than zero').optional(),
  category: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  skills: z.string().optional(),
  materials: z.array(ServiceMaterialSchema).max(50).optional(),
  galleryImages: z.array(CloudinaryImageSchema).optional(),
  heroImages: z.array(CloudinaryImageSchema).optional(),
});

export const UpdateServiceSchema = CreateServiceSchema.partial().extend({
  id: z.string().min(1, 'Service ID is required'),
});

export type CreateServiceDTO = z.infer<typeof CreateServiceSchema>;
export type UpdateServiceDTO = z.infer<typeof UpdateServiceSchema>;
