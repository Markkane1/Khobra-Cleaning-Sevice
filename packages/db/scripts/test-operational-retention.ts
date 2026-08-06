import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PrismaBookingRepository } from '../src/repositories/PrismaBookingRepository';
import { PrismaComplaintRepository } from '../src/repositories/PrismaComplaintRepository';
import { PrismaServiceRepository } from '../src/repositories/PrismaServiceRepository';
import { PrismaTripRepository } from '../src/repositories/PrismaTripRepository';

const db = new PrismaClient();
const rollback = new Error('rollback retention test');

async function main() {
 try {
  await db.$transaction(async tx => {
    const tenant = await tx.tenant.findFirst({
      where: { customers: { some: {} }, drivers: { some: {} } },
      include: { customers: { take: 1 }, drivers: { take: 1 } },
    });
    assert(tenant, 'Seeded tenant with a customer and driver is required');
    const suffix = Date.now().toString(36);
    const service = await tx.service.create({ data: { tenantId: tenant.id, name: `Retention ${suffix}`, baseRate: 10 } });
    const booking = await tx.booking.create({
      data: {
        tenantId: tenant.id, bookingNo: `RET-${suffix}`, customerId: tenant.customers[0].id,
        serviceId: service.id, scheduledDate: new Date(), startTime: '09:00', endTime: '11:00',
        duration: 2, hourlyRate: 10, totalAmount: 20, netAmount: 20,
      },
    });
    await tx.bookingStatusHistory.create({ data: { bookingId: booking.id, previousStatus: 'pending', newStatus: 'scheduled' } });
    const complaint = await tx.complaint.create({ data: { tenantId: tenant.id, complaintNo: `RET-C-${suffix}`, bookingId: booking.id, description: 'Retention test' } });
    const trip = await tx.trip.create({ data: { tenantId: tenant.id, driverId: tenant.drivers[0].id, date: new Date(), stops: { create: { type: 'pickup' } } } });
    const foreignTenant = await tx.tenant.create({ data: { name: `Foreign ${suffix}`, slug: `foreign-${suffix}` } });
    const client = tx as unknown as PrismaClient;

    assert.equal(await new PrismaBookingRepository(client).findById(foreignTenant.id, booking.id), null);
    await assert.rejects(new PrismaBookingRepository(client).delete(foreignTenant.id, booking.id));
    assert.equal((await tx.booking.findUniqueOrThrow({ where: { id: booking.id } })).deletedAt, null);

    await new PrismaComplaintRepository(client).delete(tenant.id, complaint.id);
    await new PrismaTripRepository(client).delete(tenant.id, trip.id);
    await new PrismaBookingRepository(client).delete(tenant.id, booking.id);
    await new PrismaServiceRepository(client).delete(tenant.id, service.id);

    assert.equal(await new PrismaComplaintRepository(client).findById(tenant.id, complaint.id), null);
    assert.equal(await new PrismaTripRepository(client).findById(tenant.id, trip.id), null);
    assert.equal(await new PrismaBookingRepository(client).findById(tenant.id, booking.id), null);
    assert.equal(await new PrismaServiceRepository(client).findById(tenant.id, service.id), null);
    assert((await tx.complaint.findUnique({ where: { id: complaint.id } }))?.deletedAt);
    assert((await tx.trip.findUnique({ where: { id: trip.id }, include: { stops: true } }))?.stops.length === 1);
    assert((await tx.booking.findUnique({ where: { id: booking.id }, include: { statusHistory: true } }))?.statusHistory.length === 1);
    assert((await tx.service.findUnique({ where: { id: service.id } }))?.deletedAt);
    throw rollback;
  });
  } catch (error) {
  if (error !== rollback) throw error;
  } finally {
  await db.$disconnect();
  }
}

main()
  .then(() => console.log('Operational records are tenant-isolated and hidden after deletion while relational history is retained.'))
  .catch(error => { console.error(error); process.exitCode = 1; });
