import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
async function main() {
const bookings = await db.booking.findMany({ select: { id: true, bookingNo: true, scheduledDate: true, tenant: { select: { timezone: true } } } });
const misaligned = bookings.filter(booking => booking.scheduledDate.toISOString().slice(11) !== '00:00:00.000Z');
console.log(`${misaligned.length}/${bookings.length} booking dates contain an unexpected clock component.`);
if (misaligned.length) console.log(misaligned.map(({ bookingNo, scheduledDate, tenant }) => ({ bookingNo, scheduledDate, timezone: tenant.timezone })));
}
main().finally(() => db.$disconnect());
