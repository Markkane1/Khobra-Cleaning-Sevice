import { NextRequest, NextResponse } from 'next/server';
import { db } from '@repo/db';
import { PrismaBookingRepository } from '@repo/db';
import { RateBookingEmployeesSchema } from '@repo/core';
import { requireAuth } from '@/lib/auth';

const bookingRepo = new PrismaBookingRepository(db as any);

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['customer', 'admin', 'manager'])
    if ('response' in auth) return auth.response
    const body = await req.json();
    const parsed = RateBookingEmployeesSchema.parse(body);
    const booking = await db.booking.findUnique({ where: { id: parsed.bookingId }, include: { customer: true } });
    if (!booking || booking.tenantId !== auth.session.tenantId) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    if (auth.session.role === 'customer' && booking.customer.userId !== auth.session.userId) {
      return NextResponse.json({ error: 'You may only rate cleaners from your own booking' }, { status: 403 });
    }

    const updated = await bookingRepo.rateBookingEmployees(parsed.bookingId, parsed.ratings);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to submit cleaner ratings' },
      { status: 400 }
    );
  }
}
