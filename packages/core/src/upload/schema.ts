import { z } from 'zod';

export const UploadConfig = {
  ALLOWED_TYPES: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
  ],
  MAX_SIZE: 5 * 1024 * 1024,
  MAX_SIZE_LABEL: '5MB',
};

export const FileValidationSchema = z.object({
  name: z.string().min(1, "File name is required"),
  type: z.string().refine((val) => UploadConfig.ALLOWED_TYPES.includes(val), {
    message: "File type not allowed. Use images or PDF.",
  }),
  size: z.number().max(UploadConfig.MAX_SIZE, {
    message: "File too large. Max 5MB.",
  }),
});

export const UploadResponseSchema = z.object({
  url: z.string(),
  name: z.string(),
  size: z.number(),
  type: z.string(),
});

export type FileValidationDTO = z.infer<typeof FileValidationSchema>;
export type UploadResponseDTO = z.infer<typeof UploadResponseSchema>;
