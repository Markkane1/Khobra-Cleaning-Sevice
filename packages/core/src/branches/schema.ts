import { z } from 'zod';

export const CreateBranchSchema = z.object({
  name: z.string().trim().min(1, 'Branch name is required'),
  address: z.string().optional(),
  phone: z.string().optional(),
  status: z.string().default('active'),
});

export type CreateBranchDTO = z.infer<typeof CreateBranchSchema>;

export const UpdateBranchSchema = z.object({
  id: z.string().min(1, 'Branch ID is required'),
  name: z.string().trim().min(1, 'Branch name is required').optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  status: z.string().optional(),
});

export type UpdateBranchDTO = z.infer<typeof UpdateBranchSchema>;
