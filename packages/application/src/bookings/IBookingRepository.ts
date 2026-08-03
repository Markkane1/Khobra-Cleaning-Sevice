import { CreateBookingDTO, UpdateBookingDTO, RateEmployeeInput } from '@repo/core';

export interface Booking {
  id: string;
  tenantId: string;
  bookingNo: string;
  customerId: string;
  serviceId?: string;
  preferredEmployeeId?: string;
  employeeCount?: number;
  materialsCost?: number;
  status: string;
  scheduledDate: Date;
  startTime: string;
  endTime?: string;
  duration: number;
  hourlyRate: number;
  totalAmount: number;
  discount: number;
  netAmount: number;
  isRecurring?: boolean;
  recurringRule?: string;
  recurringGroupId?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  noShowReason?: string;
  noShowParty?: string;
  service?: any;
  items?: any[];
  materials?: any[];
  assignments?: any[];
}

export interface IBookingRepository {
  findManyByTenant(tenantId: string): Promise<Booking[]>;
  findById(id: string): Promise<Booking | null>;
  create(tenantId: string, data: CreateBookingDTO): Promise<Booking>;
  update(id: string, data: UpdateBookingDTO): Promise<Booking>;
  assignEmployees(bookingId: string, employeeIds: string[], autoAssign?: boolean): Promise<Booking>;
  rateBookingEmployees(bookingId: string, ratings: RateEmployeeInput[]): Promise<Booking>;
  delete(id: string): Promise<void>;
}
