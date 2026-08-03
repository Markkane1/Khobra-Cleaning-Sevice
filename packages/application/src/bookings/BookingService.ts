import { CreateBookingDTO, UpdateBookingDTO } from '@repo/core';
import { IBookingRepository, Booking } from './IBookingRepository';

export class BookingService {
  constructor(private readonly bookingRepository: IBookingRepository) {}

  async getBookings(tenantId: string): Promise<Booking[]> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.bookingRepository.findManyByTenant(tenantId);
  }

  async createBooking(tenantId: string, data: CreateBookingDTO): Promise<Booking> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.bookingRepository.create(tenantId, data);
  }

  async updateBooking(data: UpdateBookingDTO): Promise<Booking> {
    const existing = await this.bookingRepository.findById(data.id);
    if (!existing) throw new Error('Booking not found');
    return this.bookingRepository.update(data.id, data);
  }

  async assignEmployees(bookingId: string, employeeIds: string[], autoAssign?: boolean): Promise<Booking> {
    const existing = await this.bookingRepository.findById(bookingId);
    if (!existing) throw new Error('Booking not found');
    return this.bookingRepository.assignEmployees(bookingId, employeeIds, autoAssign);
  }

  async deleteBooking(id: string): Promise<void> {
    const existing = await this.bookingRepository.findById(id);
    if (!existing) throw new Error('Booking not found');
    return this.bookingRepository.delete(id);
  }
}
