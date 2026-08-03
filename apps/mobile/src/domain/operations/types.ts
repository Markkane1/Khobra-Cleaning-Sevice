export type OperationModule =
  | 'services'
  | 'customers'
  | 'employees'
  | 'attendance'
  | 'invoices'
  | 'inventory'
  | 'complaints'
  | 'notifications'

export interface OperationRecord {
  id: string
  [key: string]: unknown
}

export const operationModules: ReadonlyArray<{ id: OperationModule; label: string }> = [
  { id: 'services', label: 'Services' },
  { id: 'customers', label: 'Customers' },
  { id: 'employees', label: 'Cleaners' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'complaints', label: 'Complaints' },
  { id: 'notifications', label: 'Notifications' },
]
