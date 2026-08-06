import { CreateBookingDTO, UpdateBookingDTO, RateEmployeeInput } from '@repo/core';

export interface Booking {
  id: string;
  tenantId: string;
  bookingNo: string;
  customerId: string;
  driverId?: string | null;
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

export type BookingActor = { userId: string; role: 'admin' | 'driver' | 'customer' | 'cleaner'; name: string };

export interface IBookingRepository {
  findManyByTenant(tenantId: string): Promise<Booking[]>;
  findById(tenantId: string, id: string): Promise<Booking | null>;
  create(tenantId: string, data: CreateBookingDTO): Promise<Booking>;
  update(tenantId: string, id: string, data: UpdateBookingDTO, actor?: BookingActor, requiredDriverId?: string, requiredEmployeeId?: string): Promise<Booking>;
  assignEmployees(tenantId: string, bookingId: string, employeeIds: string[], autoAssign?: boolean, actor?: BookingActor): Promise<Booking>;
  rateBookingEmployees(tenantId: string, bookingId: string, customerId: string, ratings: RateEmployeeInput[], overallRating: number, overallComment?: string): Promise<Booking>;
  delete(tenantId: string, id: string): Promise<void>;
}
