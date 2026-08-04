export type DriverExpenseCategory = 'petrol' | 'repair' | 'maintenance' | 'toll' | 'parking' | 'other'

export interface DriverExpense {
  id: string
  category: DriverExpenseCategory
  typeDetail?: string | null
  amount: number
  currency: string
  expenseDate: string
  notes?: string | null
  status: 'pending' | 'approved' | 'rejected'
  decisionRemarks?: string | null
}

export interface CreateDriverExpenseInput {
  category: DriverExpenseCategory
  typeDetail?: string
  amount: number
  expenseDate: string
  notes?: string
}
