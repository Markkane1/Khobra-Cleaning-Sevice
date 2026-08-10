import { z } from 'zod'

export const DriverExpenseCategorySchema = z.enum(['petrol', 'repair', 'maintenance', 'toll', 'parking', 'other'])

export const CreateBusinessExpenseSchema = z.object({
  category: z.enum(['cleaning_material', 'salary', 'other']),
  description: z.string().trim().min(2, 'Description must contain at least 2 characters').max(200),
  amount: z.coerce.number().positive('Expense amount must be greater than zero').max(100_000_000),
  currency: z.string().trim().length(3).optional(),
  expenseDate: z.coerce.date(),
  notes: z.string().trim().max(1000).optional(),
})

export const CreateDriverExpenseSchema = z.object({
  driverId: z.string().optional(),
  tripId: z.string().optional(),
  category: DriverExpenseCategorySchema,
  typeDetail: z.string().trim().max(120).optional(),
  amount: z.coerce.number().positive('Expense amount must be greater than zero').max(1_000_000),
  currency: z.string().trim().length(3).optional(),
  expenseDate: z.coerce.date(),
  notes: z.string().trim().max(1000).optional(),
  receiptUrl: z.string().url().optional(),
})

export const DecideDriverExpenseSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(['approved', 'rejected']),
  remarks: z.string().trim().max(1000).optional(),
})

export type CreateDriverExpenseDTO = z.infer<typeof CreateDriverExpenseSchema>
export type CreateBusinessExpenseDTO = z.infer<typeof CreateBusinessExpenseSchema>
