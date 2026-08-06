import { NextRequest, NextResponse } from 'next/server';
import { db } from '@repo/db';
import { PrismaBookingRepository } from '@repo/db';
import { RateBookingEmployeesSchema } from '@repo/core';
import { requireAuth } from '@/lib/auth';

const bookingRepo = new PrismaBookingRepository(db as any);

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['admin', 'cleaner'])
  if ('response' in auth) return auth.response
  if (auth.session.role === 'cleaner') {
    const cleaner = await db.employee.findFirst({ where: { tenantId: auth.session.tenantId, userId: auth.session.userId } })
    if (!cleaner) return NextResponse.json([])
    const assignments = await db.assignment.findMany({
      where: { tenantId: auth.session.tenantId, employeeId: cleaner.id, customerRating: { not: null } },
      select: { customerRating: true, ratingNotes: true, booking: { select: { bookingNo: true, rating: { select: { submittedAt: true } } } } },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json(assignments.map(assignment => ({ bookingReference: assignment.booking.bookingNo, rating: assignment.customerRating, comment: assignment.ratingNotes, submittedAt: assignment.booking.rating?.submittedAt || null })))
  }

  const submissions = await db.bookingRating.findMany({
    where: { tenantId: auth.session.tenantId },
    include: { booking: { select: { bookingNo: true, assignments: { where: { customerRating: { not: null } }, select: { employeeId: true, customerRating: true, ratingNotes: true, employee: { select: { user: { select: { name: true } } } } } } } } },
    orderBy: { submittedAt: 'desc' },
  })
  return NextResponse.json(submissions.map(submission => ({
    id: submission.id,
    bookingId: submission.bookingId,
    bookingReference: submission.booking.bookingNo,
    overallRating: submission.overallRating,
    comment: submission.comment,
    submittedAt: submission.submittedAt,
    cleanerRatings: submission.booking.assignments.map(assignment => ({ employeeId: assignment.employeeId, cleanerName: assignment.employee.user.name, rating: assignment.customerRating, comment: assignment.ratingNotes })),
  })))
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['customer'])
    if ('response' in auth) return auth.response
    const body = await req.json();
    const parsed = RateBookingEmployeesSchema.parse(body);
    const booking = await db.booking.findUnique({ where: { id: parsed.bookingId }, include: { customer: true } });
    if (!booking || booking.tenantId !== auth.session.tenantId) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    if (booking.customer.userId !== auth.session.userId) {
      return NextResponse.json({ error: 'You may only rate cleaners from your own booking' }, { status: 403 });
    }

    const updated = await bookingRepo.rateBookingEmployees(auth.session.tenantId, parsed.bookingId, booking.customerId, parsed.ratings, parsed.overallRating, parsed.overallComment);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to submit cleaner ratings' },
      { status: 400 }
    );
  }
}
