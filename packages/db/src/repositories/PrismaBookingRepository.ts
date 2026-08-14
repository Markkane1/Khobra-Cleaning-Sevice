import { Prisma, PrismaClient } from '@prisma/client';
import { IBookingRepository, Booking, BookingActor } from '@repo/application';
import { CreateBookingDTO, UpdateBookingDTO, RateEmployeeInput, calculateDurationHours, calculateEndTimeFromDuration, calculateMultiServicePricing, parseTimeToMinutes, isTimeSlotOverlapping, generateBookingOccurrenceDates, isValidStatusTransition, validateBookingConfirmationDTO, validateBookingHours, calendarDayRange, MIN_BOOKING_DURATION_HOURS, fillCleanerSlots, canCustomerEditBooking, canEditFinalizedBooking, invoiceAmountsFromBooking } from '@repo/core';
import { deliverPushNotifications } from '../push-notifications';
import { nextReference } from '../reference-sequence';

type StatusTransition = { id: string; previousStatus: string; newStatus: string; createdAt: Date };
type BookingDb = PrismaClient | Prisma.TransactionClient;
const AUTO_TRIP_NOTE = 'Automatically created from booking assignments';

async function assertDriverAvailable(db: BookingDb, input: { tenantId: string; driverId: string; bookingId: string; scheduledDate: Date; startTime: string; endTime?: string | null; duration: number; timezone: string }) {
  await db.$queryRaw(Prisma.sql`SELECT id FROM "Driver" WHERE id = ${input.driverId} FOR UPDATE`);
  const driver = await db.driver.findFirst({ where: { id: input.driverId, tenantId: input.tenantId, status: { in: ['active', 'AVAILABLE'] } }, include: { user: { select: { name: true } } } });
  if (!driver) throw new Error('Select an active driver from this tenant');

  const { start, end } = calendarDayRange(input.scheduledDate, input.timezone);
  const requestedStart = parseTimeToMinutes(input.startTime);
  const requestedEnd = input.endTime ? parseTimeToMinutes(input.endTime) : requestedStart + Math.round(input.duration * 60);
  const bookings = await db.booking.findMany({
    where: { tenantId: input.tenantId, driverId: input.driverId, id: { not: input.bookingId }, scheduledDate: { gte: start, lt: end }, status: { notIn: ['cancelled', 'completed', 'no_show'] }, deletedAt: null },
    select: { bookingNo: true, startTime: true, endTime: true, duration: true },
  });
  const conflict = bookings.find(booking => {
    const bookingStart = parseTimeToMinutes(booking.startTime);
    const bookingEnd = booking.endTime ? parseTimeToMinutes(booking.endTime) : bookingStart + Math.round(booking.duration * 60);
    return isTimeSlotOverlapping(bookingStart, bookingEnd, requestedStart, requestedEnd);
  });
  if (conflict) throw new Error(`${driver.user.name} is already assigned to booking ${conflict.bookingNo} during this time`);
  return driver;
}

async function syncBookingTripStop(db: BookingDb, booking: any, timezone: string) {
  const existingStop = await db.tripStop.findUnique({ where: { bookingId: booking.id }, include: { trip: true } });
  const inactive = !booking.driverId || ['cancelled', 'no_show'].includes(booking.status);

  if (inactive) {
    if (!existingStop) return;
    if (existingStop.trip.status === 'planned') await db.tripStop.delete({ where: { id: existingStop.id } });
    else await db.tripStop.update({ where: { id: existingStop.id }, data: { status: 'cancelled' } });
    if (existingStop.trip.notes === AUTO_TRIP_NOTE && !await db.tripStop.count({ where: { tripId: existingStop.tripId } })) {
      await db.trip.update({ where: { id: existingStop.tripId }, data: { status: 'cancelled', deletedAt: new Date() } });
    }
    return;
  }

  const { start, end } = calendarDayRange(booking.scheduledDate, timezone);
  const currentTripMatches = existingStop && existingStop.trip.driverId === booking.driverId && existingStop.trip.date >= start && existingStop.trip.date < end && existingStop.trip.deletedAt === null;
  const address = [booking.address, booking.area, booking.city].filter(Boolean).join(', ');
  if (currentTripMatches) {
    await db.tripStop.update({ where: { id: existingStop.id }, data: { address, contactPhone: booking.customer?.phone || null } });
    return;
  }
  if (existingStop) {
    if (existingStop.trip.status !== 'planned') throw new Error('This booking belongs to a trip already in progress and cannot be reassigned');
    await db.tripStop.delete({ where: { id: existingStop.id } });
    if (existingStop.trip.notes === AUTO_TRIP_NOTE && !await db.tripStop.count({ where: { tripId: existingStop.tripId } })) {
      await db.trip.update({ where: { id: existingStop.tripId }, data: { status: 'cancelled', deletedAt: new Date() } });
    }
  }

  let trip = await db.trip.findFirst({ where: { tenantId: booking.tenantId, driverId: booking.driverId, date: { gte: start, lt: end }, status: 'planned', deletedAt: null }, orderBy: { createdAt: 'asc' } });
  trip ||= await db.trip.create({ data: { tenantId: booking.tenantId, driverId: booking.driverId, date: booking.scheduledDate, notes: AUTO_TRIP_NOTE } });
  await db.tripStop.create({ data: { tripId: trip.id, bookingId: booking.id, type: 'service', address, contactPhone: booking.customer?.phone || null } });
}

async function syncMaterialReservations(db: BookingDb, bookingId: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { items: { include: { service: { include: { materials: { include: { inventoryItem: true } } } } } } } });
  if (!booking || booking.pricingMode === 'legacy_addon') return;
  if (['cancelled', 'no_show'].includes(booking.status)) {
    await db.bookingMaterialReservation.updateMany({ where: { bookingId, status: 'reserved' }, data: { status: 'released', releasedAt: new Date() } });
    return;
  }
  if (booking.status !== 'scheduled') return;
  const required = new Map<string, { quantity: number; unitCost: number }>();
  booking.items.filter(item => item.includesMaterials).forEach(item => item.service.materials.forEach(material => {
    const previous = required.get(material.inventoryItemId) || { quantity: 0, unitCost: Number(material.inventoryItem.costPrice) };
    required.set(material.inventoryItemId, { quantity: previous.quantity + material.quantityPerCleanerHour * item.hours * item.employeeCount, unitCost: previous.unitCost });
  }));
  await db.bookingMaterialReservation.deleteMany({ where: { bookingId, status: 'reserved' } });
  if (required.size) await db.bookingMaterialReservation.createMany({ data: [...required.entries()].map(([inventoryItemId, value]) => ({ bookingId, inventoryItemId, requiredQuantity: value.quantity, unitCost: value.unitCost, status: 'reserved' })) });
  // Reservations deliberately permit shortages. Alert operations with the exact over-reserved amount.
  const admins = await db.user.findMany({ where: { tenantId: booking.tenantId, role: 'admin', status: 'active' }, select: { id: true } });
  for (const [inventoryItemId] of required) {
    const [item, totals] = await Promise.all([
      db.inventoryItem.findUnique({ where: { id: inventoryItemId }, select: { name: true, unit: true, currentStock: true } }),
      db.bookingMaterialReservation.aggregate({ where: { inventoryItemId, status: 'reserved' }, _sum: { requiredQuantity: true } }),
    ]);
    const shortage = Math.max(0, Number(totals._sum.requiredQuantity || 0) - Number(item?.currentStock || 0));
    if (shortage > 0 && item) await db.notification.createMany({ skipDuplicates: true, data: admins.map(admin => ({ tenantId: booking.tenantId, userId: admin.id, deliveryKey: `material-shortage:${bookingId}:${inventoryItemId}`, title: 'Material stock shortage', message: `${item.name} is over-reserved by ${shortage} ${item.unit} for booking ${booking.bookingNo}.`, type: 'warning', channel: 'in_app', deliveryStatus: 'sent', deliveryAttemptedAt: new Date() })) });
  }
}

async function consumeMaterialReservations(db: BookingDb, bookingId: string) {
  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, select: { tenantId: true } });
  const reservations = await db.bookingMaterialReservation.findMany({ where: { bookingId, status: 'reserved' } });
  for (const reservation of reservations) {
    const changed = await db.inventoryItem.updateMany({ where: { id: reservation.inventoryItemId, tenantId: booking.tenantId, currentStock: { gte: reservation.requiredQuantity } }, data: { currentStock: { decrement: reservation.requiredQuantity } } });
    if (!changed.count) throw new Error('Insufficient material stock to start this booking');
    await db.stockMovement.create({ data: { tenantId: booking.tenantId, itemId: reservation.inventoryItemId, type: 'booking_consumption', quantity: -reservation.requiredQuantity, unitCost: reservation.unitCost, reference: bookingId } });
  }
  await db.bookingMaterialReservation.updateMany({ where: { bookingId, status: 'reserved' }, data: { status: 'consumed', consumedAt: new Date() } });
}

async function notifyDriverAssignment(db: PrismaClient, bookingId: string, previousDriverId?: string | null) {
  try {
    const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { driver: { include: { user: true } } } });
    if (!booking) return;
    const notices: Array<{ tenantId: string; userId: string; deliveryKey: string; title: string; message: string; type: string }> = [];
    if (booking.driver) notices.push({ tenantId: booking.tenantId, userId: booking.driver.userId, deliveryKey: `booking-driver:${booking.id}:${booking.driverId}:${booking.updatedAt.getTime()}`, title: `Booking ${booking.bookingNo} assigned`, message: `You are assigned to booking ${booking.bookingNo} on ${booking.scheduledDate.toISOString().slice(0, 10)} at ${booking.startTime}.`, type: 'dispatch' });
    if (previousDriverId && previousDriverId !== booking.driverId) {
      const previous = await db.driver.findUnique({ where: { id: previousDriverId }, select: { userId: true } });
      if (previous) notices.push({ tenantId: booking.tenantId, userId: previous.userId, deliveryKey: `booking-driver-removed:${booking.id}:${previousDriverId}:${booking.updatedAt.getTime()}`, title: `Booking ${booking.bookingNo} reassigned`, message: `Booking ${booking.bookingNo} is no longer assigned to you.`, type: 'dispatch' });
    }
    if (!notices.length) return;
    await db.notification.createMany({ skipDuplicates: true, data: notices.map(notice => ({ ...notice, channel: 'in_app', deliveryStatus: 'sent', deliveryAttemptedAt: new Date() })) });
    await deliverPushNotifications(db, notices);
  } catch (error) {
    console.error(`Booking ${bookingId} driver notification failed`, error);
  }
}

export async function notifyBookingStatusChange(db: PrismaClient, bookingId: string, transition?: StatusTransition) {
  if (!transition) return;
  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: {
        tenantId: true,
        bookingNo: true,
        customer: { select: { userId: true } },
        assignments: { select: { employee: { select: { userId: true } } } },
      },
    });
    if (!booking) return;
    const recipients = new Map<string, 'customer' | 'cleaner'>();
    if (booking.customer.userId) recipients.set(booking.customer.userId, 'customer');
    booking.assignments.forEach(assignment => {
      if (assignment.employee.userId && !recipients.has(assignment.employee.userId)) recipients.set(assignment.employee.userId, 'cleaner');
    });
    const label = (status: string) => status.split('_').map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ');
    const previousLabel = label(transition.previousStatus);
    const newLabel = label(transition.newStatus);
    const changedAt = transition.createdAt.toISOString();
    const customerExplanation: Record<string, string> = {
      scheduled: `Your booking ${booking.bookingNo} is scheduled.`,
      on_the_way: 'Your service team is now on the way.',
      in_progress: `Work has started for booking ${booking.bookingNo}.`,
      completed: `Your service for booking ${booking.bookingNo} has been completed.`,
      cancelled: `Booking ${booking.bookingNo} has been cancelled.`,
    };
    const noticeData = [...recipients].map(([userId, audience]) => ({
      tenantId: booking.tenantId,
      userId,
      deliveryKey: `booking:${transition.id}`,
      statusHistoryId: transition.id,
      title: `Booking ${booking.bookingNo}: ${newLabel}`,
      message: `${audience === 'customer' ? customerExplanation[transition.newStatus] || `Booking ${booking.bookingNo} is now ${newLabel}.` : `Booking ${booking.bookingNo} has been marked ${newLabel}.`} Previous status: ${previousLabel}. New status: ${newLabel}. Changed at: ${changedAt}.`,
      type: 'booking_status',
    }));
    await db.notification.createMany({
      skipDuplicates: true,
      data: noticeData.map(notice => ({
        ...notice,
        channel: 'in_app',
        deliveryStatus: 'sent',
        deliveryAttemptedAt: new Date(),
      })),
    });
    await deliverPushNotifications(db, noticeData);
  } catch (error) {
    console.error(`Booking ${bookingId} notification delivery failed`, error);
  }
}

export class PrismaBookingRepository implements IBookingRepository {
  constructor(private readonly db: PrismaClient) {}

  async findManyByTenant(tenantId: string): Promise<Booking[]> {
    return this.db.booking.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        customer: { include: { user: { select: { name: true } } } },
        driver: { include: { user: { select: { name: true } } } },
        service: { select: { id: true, name: true, baseRate: true } },
        items: { include: { service: { select: { id: true, name: true, baseRate: true } } } },
        materials: { include: { inventoryItem: true } },
        materialReservations: { include: { inventoryItem: { select: { name: true, unit: true, currentStock: true } } } },
        assignments: { include: { employee: { include: { user: { select: { name: true } } } } } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        completionTimingResponses: { include: { employee: { include: { user: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' } },
        pickupAlerts: { orderBy: { generatedAt: 'desc' } },
        invoices: { include: { payments: { orderBy: { createdAt: 'desc' } } } },
        rating: true,
      },
      orderBy: { scheduledDate: 'desc' },
    }) as unknown as Booking[];
  }

  async findById(tenantId: string, id: string): Promise<Booking | null> {
    return this.db.booking.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        customer: { include: { user: { select: { name: true } } } },
        driver: { include: { user: { select: { name: true } } } },
        service: { select: { id: true, name: true, baseRate: true } },
        items: { include: { service: { select: { id: true, name: true, baseRate: true } } } },
        materials: { include: { inventoryItem: true } },
        materialReservations: { include: { inventoryItem: { select: { name: true, unit: true, currentStock: true } } } },
        assignments: { include: { employee: { include: { user: { select: { name: true } } } } } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        completionTimingResponses: { include: { employee: { include: { user: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' } },
        pickupAlerts: { orderBy: { generatedAt: 'desc' } },
        invoices: { include: { payments: { orderBy: { createdAt: 'desc' } } } },
        rating: true,
      }
    }) as unknown as Booking | null;
  }

  async create(tenantId: string, data: CreateBookingDTO, actor?: BookingActor): Promise<Booking> {
    // Prompt 16: Final Booking Confirmation Validation Pipeline
    const valResult = validateBookingConfirmationDTO(data);
    if (!valResult.isValid) {
      throw new Error(valResult.errors.join('; '));
    }

    // Prompt 18: Admin-Configurable Daily Booking Hours Enforcement
    const tenant = await this.db.tenant.findUnique({ where: { id: tenantId } });
    const firstBookingTime = tenant?.firstBookingTime || '08:00';
    const lastWorkingTime = tenant?.lastWorkingTime || '20:00';

    const hoursCheck = validateBookingHours(data.startTime, data.endTime, firstBookingTime, lastWorkingTime);
    if (!hoursCheck.isValid) {
      throw new Error(hoursCheck.error);
    }

    // 1. Resolve requested service IDs
    let serviceIds: string[] = [];
    if (data.serviceIds && data.serviceIds.length > 0) {
      serviceIds = data.serviceIds;
    } else if (data.serviceId) {
      serviceIds = [data.serviceId];
    }

    if (serviceIds.length === 0) {
      throw new Error('At least one service is required');
    }

    const services = await this.db.service.findMany({
      where: { tenantId, id: { in: serviceIds }, deletedAt: null },
    });

    if (services.length !== serviceIds.length) {
      throw new Error('Selected service(s) not found');
    }

    const inactiveService = services.find(s => s.status !== 'active');
    if (inactiveService) {
      throw new Error(`Selected service '${inactiveService.name}' is currently unavailable/unbookable`);
    }

    // 2. Resolve duration and time
    const duration = calculateDurationHours(data.startTime, data.endTime);
    const endTime = data.endTime;

    if (duration <= 0) {
      throw new Error('To time must be later than From time');
    }
    if (duration < MIN_BOOKING_DURATION_HOURS) {
      throw new Error(`Bookings require at least ${MIN_BOOKING_DURATION_HOURS} hours`);
    }

    const employeeCount = Math.max(1, data.employeeCount || 1);
    const preferredEmployeeIds = data.preferredEmployeeIds?.length
      ? data.preferredEmployeeIds
      : data.preferredEmployeeId ? [data.preferredEmployeeId] : [];
    if (preferredEmployeeIds.length > employeeCount) {
      throw new Error('Selected cleaners cannot exceed the assigned staff count');
    }
    const discount = data.discount || 0;
    const taxRate = data.taxRate ?? Number(tenant?.taxRate ?? 0);

    // 3. Authoritative Pricing Engine Calculation
    const serviceOptions = new Map((data.serviceOptions || []).map(option => [option.serviceId, option.withMaterials]));
    const pricedServices = services.map(service => {
      const includesMaterials = serviceOptions.get(service.id) || false;
      return { ...service, includesMaterials, baseRate: Number(includesMaterials ? service.withMaterialsRate : service.baseRate) };
    });
    const pricing = calculateMultiServicePricing(
      pricedServices,
      employeeCount,
      duration,
      [],
      discount,
      taxRate
    );

    const primaryServiceId = services[0]?.id;
    const primaryHourlyRate = Number(pricedServices[0]?.baseRate || 0);

    // Prompt 10: Occurrence Dates Generation
    const occurrenceDates = generateBookingOccurrenceDates({
      scheduledDate: data.scheduledDate,
      bookingType: data.bookingType,
      selectedDates: data.selectedDates ? data.selectedDates.filter((d): d is string | Date => Boolean(d)) : undefined,
      startDate: data.startDate,
      endDate: data.endDate,
      selectedWeekdays: data.selectedWeekdays,
    });

    const isRecurring = data.bookingType !== 'one_time';
    const recurringGroupId = isRecurring ? `RG-${Date.now()}-${Math.floor(Math.random() * 1000)}` : undefined;

    const {
      serviceId: _a,
      serviceIds: _b,
      serviceOptions: _serviceOptions,
      duration: _c,
      endTime: _d,
      discount: _e,
      employeeCount: _f,
      taxRate: _g,
      preferredEmployeeId: _h,
      preferredEmployeeIds: _i,
      bookingType: _j,
      selectedDates: _k,
      startDate: _l,
      endDate: _m,
      selectedWeekdays: _n,
      scheduledDate: _o,
      isRecurring: _p,
      totalAmount: _q,
      netAmount: _r,
      hourlyRate: _s,
      hasPreferredEmployee: _t,
      ...rest
    } = data as any;

    const results = await this.db.$transaction(async tx => {
      const createdBookings: Array<{ booking: Booking; transition: StatusTransition }> = [];
      for (let index = 0; index < occurrenceDates.length; index++) {
      const occurrenceDate = occurrenceDates[index]!;
      const requestedDate = `${occurrenceDate.getFullYear()}-${String(occurrenceDate.getMonth() + 1).padStart(2, '0')}-${String(occurrenceDate.getDate()).padStart(2, '0')}`;
      const { start: scheduledDate, end: dateEnd } = calendarDayRange(requestedDate, tenant?.timezone || 'UTC');
      const dateStart = scheduledDate;
      // 4. Preferred Employee Availability Recheck FOR THIS SPECIFIC OCCURRENCE DATE (Prompt 10 & 11 Rules)
      let isPreferredAssignedForThisDate = false;
      if (preferredEmployeeIds.length) {
        const preferredEmployees = await tx.employee.findMany({ where: { id: { in: preferredEmployeeIds }, tenantId, status: 'active' } });
        if (preferredEmployees.length !== preferredEmployeeIds.length) throw new Error('Selected cleaner is inactive or unavailable');
        const onLeave = await tx.leaveRecord.findFirst({ where: { employeeId: { in: preferredEmployeeIds }, status: 'approved', startDate: { lt: dateEnd }, endDate: { gte: dateStart } } });
        if (onLeave) throw new Error('Selected cleaner is unavailable for the requested slot');
        const assignments = await tx.assignment.findMany({
          where: { employeeId: { in: preferredEmployeeIds }, booking: { scheduledDate: { gte: dateStart, lt: dateEnd }, status: { notIn: ['cancelled', 'completed', 'no_show'] } } },
          include: { booking: { select: { startTime: true, endTime: true, duration: true } } },
        });
        const newStartMins = parseTimeToMinutes(data.startTime);
        const newEndMins = endTime ? parseTimeToMinutes(endTime) : newStartMins + Math.round(duration * 60);
        if (assignments.some(assignment => isTimeSlotOverlapping(parseTimeToMinutes(assignment.booking.startTime), assignment.booking.endTime ? parseTimeToMinutes(assignment.booking.endTime) : parseTimeToMinutes(assignment.booking.startTime) + Math.round(assignment.booking.duration * 60), newStartMins, newEndMins))) {
          throw new Error('Selected cleaner is unavailable for the requested slot');
        }
        isPreferredAssignedForThisDate = true;
      }
      if (data.preferredEmployeeId) {
        const preferredEmp = await tx.employee.findUnique({
          where: { id: data.preferredEmployeeId },
        });

        if (preferredEmp && preferredEmp.tenantId === tenantId && preferredEmp.status === 'active') {
          // Check approved leave for this specific date
          const onLeave = await tx.leaveRecord.findFirst({
            where: {
              employeeId: data.preferredEmployeeId,
              status: 'approved',
              startDate: { lt: dateEnd },
              endDate: { gte: dateStart },
            },
          });

          if (!onLeave) {
            // Check overlapping bookings for this specific date
            const existingAssignments = await tx.assignment.findMany({
              where: {
                employeeId: data.preferredEmployeeId,
                booking: {
                  scheduledDate: { gte: dateStart, lt: dateEnd },
                  status: { notIn: ['cancelled', 'completed', 'no_show'] },
                },
              },
              include: { booking: { select: { startTime: true, endTime: true, duration: true } } },
            });

            const newStartMins = parseTimeToMinutes(data.startTime);
            const newEndMins = endTime ? parseTimeToMinutes(endTime) : newStartMins + Math.round(duration * 60);

            const hasConflict = existingAssignments.some(a => {
              const b = a.booking;
              const bStartMins = parseTimeToMinutes(b.startTime);
              const bEndMins = b.endTime ? parseTimeToMinutes(b.endTime) : bStartMins + Math.round(b.duration * 60);
              return isTimeSlotOverlapping(bStartMins, bEndMins, newStartMins, newEndMins);
            });

            if (!hasConflict) {
              isPreferredAssignedForThisDate = true;
            }
          }
        }

        if (!isPreferredAssignedForThisDate) {
          throw new Error('Selected preferred cleaner is unavailable for the requested slot');
        }
      }

      let assignedEmployeeIds = [...preferredEmployeeIds];
      if (assignedEmployeeIds.length < employeeCount) {
        const candidates = await tx.employee.findMany({
          where: { tenantId, status: 'active', id: { notIn: assignedEmployeeIds } },
          select: { id: true },
          orderBy: { employeeCode: 'asc' },
        });
        const candidateIds = candidates.map(candidate => candidate.id);
        const leaves = candidateIds.length ? await tx.leaveRecord.findMany({
          where: { employeeId: { in: candidateIds }, status: 'approved', startDate: { lt: dateEnd }, endDate: { gte: dateStart } },
          select: { employeeId: true },
        }) : [];
        const unavailableIds = new Set(leaves.map(leave => leave.employeeId));
        const candidateAssignments = candidateIds.length ? await tx.assignment.findMany({
          where: { employeeId: { in: candidateIds }, booking: { scheduledDate: { gte: dateStart, lt: dateEnd }, status: { notIn: ['cancelled', 'completed', 'no_show'] } } },
          include: { booking: { select: { startTime: true, endTime: true, duration: true } } },
        }) : [];
        const requestedStart = parseTimeToMinutes(data.startTime);
        const requestedEnd = parseTimeToMinutes(endTime);
        candidateAssignments.forEach(assignment => {
          const existingStart = parseTimeToMinutes(assignment.booking.startTime);
          const existingEnd = assignment.booking.endTime ? parseTimeToMinutes(assignment.booking.endTime) : existingStart + Math.round(assignment.booking.duration * 60);
          if (isTimeSlotOverlapping(existingStart, existingEnd, requestedStart, requestedEnd)) unavailableIds.add(assignment.employeeId);
        });
        assignedEmployeeIds = fillCleanerSlots(assignedEmployeeIds, candidates.filter(candidate => !unavailableIds.has(candidate.id)).map(candidate => candidate.id), employeeCount);
      }
      if (assignedEmployeeIds.length !== employeeCount) {
        throw new Error(`Only ${assignedEmployeeIds.length} cleaner(s) are available; ${employeeCount} are required`);
      }

      // A direct preferred assignment is assigned; confirmation moves it to scheduled.
      // A preferred cleaner is only a preference until an available driver is assigned.
      const initialStatus = 'pending_assignment';

        const bookingNo = await nextReference(tx, tenantId, 'booking', 'BK', 5, 999);
        if (assignedEmployeeIds.length) {
          for (const employeeId of [...assignedEmployeeIds].sort()) {
            await tx.$queryRaw(Prisma.sql`SELECT id FROM "Employee" WHERE id = ${employeeId} FOR UPDATE`);
          }
          const assignments = await tx.assignment.findMany({
            where: {
              employeeId: { in: assignedEmployeeIds },
              booking: {
                scheduledDate: { gte: dateStart, lt: dateEnd },
                status: { notIn: ['cancelled', 'completed', 'no_show'] },
              },
            },
            include: { booking: { select: { startTime: true, endTime: true, duration: true } } },
          });
          const hasConflict = assignments.some(assignment => isTimeSlotOverlapping(
            parseTimeToMinutes(assignment.booking.startTime),
            assignment.booking.endTime ? parseTimeToMinutes(assignment.booking.endTime) : parseTimeToMinutes(assignment.booking.startTime) + Math.round(assignment.booking.duration * 60),
            parseTimeToMinutes(data.startTime),
            parseTimeToMinutes(endTime),
          ));
          if (hasConflict) throw new Error('Selected preferred cleaner is unavailable for the requested slot');
        }

        const created = await tx.booking.create({
        data: {
          tenantId,
          bookingNo,
          serviceId: primaryServiceId,
          employeeCount,
          materialsCost: 0,
          hourlyRate: primaryHourlyRate,
          totalAmount: pricing.totalAmount,
          discount: pricing.discount,
          netAmount: pricing.netAmount,
          duration,
          endTime,
          isRecurring,
          recurringGroupId,
          status: initialStatus,
          ...rest,
          createdBy: actor?.userId,
          scheduledDate,
          items: {
            create: pricing.items.map(it => ({
              serviceId: it.serviceId,
              hourlyRate: it.hourlyRate,
              employeeCount: it.employeeCount,
              hours: it.hours,
              totalAmount: it.totalAmount,
              includesMaterials: it.includesMaterials || false,
            })),
          },
          ...(assignedEmployeeIds.length
            ? {
                assignments: {
                  create: assignedEmployeeIds.map(employeeId => ({
                      tenantId,
                      employeeId,
                      status: 'assigned',
                    })),
                },
              }
            : {}),
        },
        include: {
          customer: { include: { user: { select: { name: true } } } },
          driver: { include: { user: { select: { name: true } } } },
          service: { select: { id: true, name: true, baseRate: true } },
          items: { include: { service: { select: { id: true, name: true, baseRate: true } } } },
          materials: { include: { inventoryItem: true } },
          assignments: { include: { employee: { include: { user: { select: { name: true } } } } } },
          statusHistory: { orderBy: { createdAt: 'asc' } },
          completionTimingResponses: { include: { employee: { include: { user: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' } },
          pickupAlerts: { orderBy: { generatedAt: 'desc' } },
          invoices: { include: { payments: { orderBy: { createdAt: 'desc' } } } },
        },
        }) as unknown as Booking;

        const transition = await tx.bookingStatusHistory.create({
        data: {
          bookingId: created.id,
          previousStatus: 'none',
          newStatus: initialStatus,
          changedBy: actor?.name || 'Customer',
          changedByUserId: actor?.userId,
          changedByRole: actor?.role || 'customer',
          reason: 'Initial booking creation',
        },
        });
        createdBookings.push({ booking: created, transition });
      }
      return createdBookings;
    });

    for (const result of results) await notifyBookingStatusChange(this.db, result.booking.id, result.transition);
    return results[0]!.booking;
  }

  async update(tenantId: string, id: string, data: UpdateBookingDTO, actor?: BookingActor, requiredDriverId?: string, requiredEmployeeId?: string): Promise<Booking> {
    const result = await this.db.$transaction(tx => this.updateWithDb(tx, tenantId, id, data, actor, requiredDriverId, requiredEmployeeId));
    await notifyBookingStatusChange(this.db, id, result.transition);
    if (result.driverChanged) await notifyDriverAssignment(this.db, id, result.previousDriverId);
    return result.booking;
  }

  private async updateWithDb(db: Prisma.TransactionClient, tenantId: string, id: string, data: UpdateBookingDTO, actor?: BookingActor, requiredDriverId?: string, requiredEmployeeId?: string): Promise<{ booking: Booking; transition?: StatusTransition; driverChanged: boolean; previousDriverId: string | null }> {
    await db.$queryRaw(Prisma.sql`SELECT id FROM "Booking" WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE`);
    const existing = await db.booking.findFirst({
      where: { id, tenantId },
      include: { items: true, materials: true, assignments: { include: { employee: { include: { user: { select: { name: true } } } } } } },
    });
    if (!existing) throw new Error('Booking not found');
    if (requiredDriverId && existing.driverId !== requiredDriverId) throw new Error('Only the driver assigned to this booking may update its status');
    if (requiredEmployeeId && !existing.assignments.some((assignment: any) => assignment.employeeId === requiredEmployeeId)) throw new Error('Only a cleaner assigned to this booking may update its status');

    const { id: _id, ...rest } = data;
    if (!canEditFinalizedBooking(existing.status, Object.keys(rest))) {
      throw new Error(`The commercial details of a ${existing.status} booking cannot be edited`);
    }
    const tenantObj = await db.tenant.findUnique({ where: { id: existing.tenantId } });
    if (actor?.role === 'customer' && rest.status !== 'cancelled') {
      const timezone = tenantObj?.timezone || 'UTC';
      if (!canCustomerEditBooking(existing.scheduledDate, existing.startTime, timezone)) throw new Error('Booking details can only be edited at least 6 hours before the booking time');
      if (!canCustomerEditBooking(rest.scheduledDate || existing.scheduledDate, rest.startTime || existing.startTime, timezone)) throw new Error('The updated booking date and time must be at least 6 hours from now');
    }
    const customerCrewChanged = actor?.role === 'customer' && rest.employeeCount !== undefined && rest.employeeCount !== existing.employeeCount;
    const driverChanged = rest.driverId !== undefined && rest.driverId !== existing.driverId || customerCrewChanged && Boolean(existing.driverId);
    const targetDriverId = customerCrewChanged ? null : rest.driverId !== undefined ? rest.driverId : existing.driverId;
    if (driverChanged && ['on_the_way', 'in_progress', 'completed', 'cancelled', 'no_show'].includes(existing.status)) throw new Error(`Driver cannot be reassigned while booking is ${existing.status}`);
    const updateData: any = { ...rest };
    delete updateData.serviceOptions;
    if (rest.status === 'cancelled') updateData.cancelledBy = actor?.userId;
    let transition: StatusTransition | undefined;

    if (customerCrewChanged && (existing.assignments.length || existing.driverId)) {
      await db.assignment.deleteMany({ where: { bookingId: id } });
      updateData.status = 'pending_assignment';
      updateData.driverId = null;
      transition = await db.bookingStatusHistory.create({
        data: {
          bookingId: id,
          previousStatus: existing.status,
          newStatus: 'pending_assignment',
          changedBy: `${actor.role}: ${actor.name}`,
          changedByUserId: actor.userId,
          changedByRole: actor.role,
          reason: `Customer changed requested cleaner count to ${rest.employeeCount}; team reassignment required`,
        },
      });
    }

    if (rest.status && rest.status !== existing.status) {
      const statusChangedAt = new Date();
      if (!isValidStatusTransition(existing.status, rest.status)) {
        throw new Error(`Invalid status transition from '${existing.status}' to '${rest.status}'`);
      }

      // Operational Guard 1: Zero-Employee Guard
      if (rest.status === 'assigned' && (!existing.assignments || existing.assignments.length === 0)) {
        throw new Error('A booking cannot transition to Assigned with zero cleaners');
      }
      if (['scheduled', 'on_the_way', 'in_progress'].includes(rest.status) && (!existing.assignments || existing.assignments.length < existing.employeeCount)) {
        throw new Error(`A booking cannot transition to '${rest.status}' until all ${existing.employeeCount} required cleaners are assigned`);
      }
      if (rest.status === 'scheduled' && !targetDriverId) throw new Error('Assign a driver before scheduling this booking');

      if (['on_the_way', 'in_progress', 'completed', 'cancelled', 'no_show'].includes(rest.status)) {
        await db.assignment.updateMany({
          where: { bookingId: id },
          data: {
            status: rest.status,
            ...(rest.status === 'completed' ? { completedAt: new Date() } : {}),
          },
        });
        if (rest.status === 'in_progress' && requiredEmployeeId) {
          await db.assignment.updateMany({ where: { bookingId: id }, data: { startedAt: statusChangedAt } });
        }
        if (rest.status === 'completed') {
          const existingInvoice = await db.invoice.findFirst({ where: { bookingId: id } });
          if (!existingInvoice) {
            const invoiceNo = `INV-${existing.bookingNo}`;
            await db.invoice.create({
              data: {
                tenantId: existing.tenantId,
                invoiceNo,
                bookingId: id,
                customerId: existing.customerId,
                status: 'issued',
                issuedAt: new Date(),
                ...invoiceAmountsFromBooking(existing),
                paidAmount: 0,
              },
            });
          }
        }
      }

      // Append Audit Log History (Prompt 12 Requirement)
      const history = await db.bookingStatusHistory.create({
        data: {
          bookingId: id,
          previousStatus: existing.status,
          newStatus: rest.status,
          changedBy: actor ? `${actor.role}: ${actor.name}` : rest.noShowParty || 'system',
          changedByUserId: actor?.userId,
          changedByRole: actor?.role || 'system',
          reason: rest.cancellationReason || rest.noShowReason || (rest.status === 'in_progress' ? 'Work started' : 'Status update'),
          createdAt: statusChangedAt,
        },
      });
      transition = history;
    }

    const scheduledDate = rest.scheduledDate
      ? calendarDayRange(String(rest.scheduledDate).slice(0, 10), tenantObj?.timezone || 'UTC').start
      : new Date(existing.scheduledDate);
    if (rest.scheduledDate) {
      updateData.scheduledDate = scheduledDate;
    }

    const startTime = rest.startTime || existing.startTime;
    const endTime = rest.endTime !== undefined ? rest.endTime : existing.endTime;
    let duration = rest.duration !== undefined ? rest.duration : existing.duration;

    if (rest.startTime || rest.endTime) {
      if (endTime) {
        duration = calculateDurationHours(startTime, endTime);
      }
    }

    if (duration < MIN_BOOKING_DURATION_HOURS) {
      throw new Error(`Bookings require at least ${MIN_BOOKING_DURATION_HOURS} hours`);
    }

    updateData.duration = duration;
    if (endTime) updateData.endTime = endTime;

    // Prompt 18: Operational Booking Hours Validation on Edit/Reschedule
    const firstBookingTime = tenantObj?.firstBookingTime || '08:00';
    const lastWorkingTime = tenantObj?.lastWorkingTime || '20:00';

    const calculatedEndTime = endTime || calculateEndTimeFromDuration(startTime, duration);
    const hoursCheck = validateBookingHours(startTime, calculatedEndTime, firstBookingTime, lastWorkingTime);
    if (!hoursCheck.isValid) {
      throw new Error(hoursCheck.error);
    }

    if (targetDriverId && (driverChanged || rest.scheduledDate || rest.startTime || rest.endTime || rest.duration)) {
      await assertDriverAvailable(db, { tenantId, driverId: targetDriverId, bookingId: id, scheduledDate, startTime, endTime, duration, timezone: tenantObj?.timezone || 'UTC' });
    }

    // Rescheduling Availability Validation (Prompt 09 Trigger 8 & 9)
    if (!customerCrewChanged && (rest.scheduledDate || rest.startTime || rest.endTime) && existing.assignments && existing.assignments.length > 0) {
      await db.$queryRaw(Prisma.sql`SELECT id FROM "Employee" WHERE id IN (${Prisma.join(existing.assignments.map((assignment: { employeeId: string }) => assignment.employeeId).sort())}) FOR UPDATE`);
      const { start: dateStart, end: dateEnd } = calendarDayRange(rest.scheduledDate ? String(rest.scheduledDate).slice(0, 10) : scheduledDate, tenantObj?.timezone || 'UTC');

      const reqStartMins = parseTimeToMinutes(startTime);
      const reqEndMins = endTime ? parseTimeToMinutes(endTime) : reqStartMins + Math.round(duration * 60);

      for (const assign of existing.assignments) {
        const empId = assign.employeeId;

        // Check leave
        const onLeave = await db.leaveRecord.findFirst({
          where: {
            tenantId: existing.tenantId,
            employeeId: empId,
            status: 'approved',
            startDate: { lt: dateEnd },
            endDate: { gte: dateStart },
          },
        });
        if (onLeave) {
          throw new Error(`Assigned cleaner ${assign.employee?.user?.name || assign.employee?.employeeCode} is on approved leave for the rescheduled date`);
        }

        // Check overlapping bookings
        const overlapping = await db.assignment.findMany({
          where: {
            tenantId: existing.tenantId,
            employeeId: empId,
            bookingId: { not: id },
            booking: {
              tenantId: existing.tenantId,
              scheduledDate: { gte: dateStart, lt: dateEnd },
              status: { notIn: ['cancelled', 'completed', 'no_show'] },
            },
          },
          include: { booking: { select: { startTime: true, endTime: true, duration: true } } },
        });

        const hasConflict = overlapping.some((a: { booking: { startTime: string; endTime: string | null; duration: number } }) => {
          const b = a.booking;
          const bStart = parseTimeToMinutes(b.startTime);
          const bEnd = b.endTime ? parseTimeToMinutes(b.endTime) : bStart + Math.round(b.duration * 60);
          return isTimeSlotOverlapping(bStart, bEnd, reqStartMins, reqEndMins);
        });

        if (hasConflict) {
          throw new Error(`Assigned cleaner ${assign.employee?.user?.name || assign.employee?.employeeCode} has an overlapping booking in the rescheduled time slot`);
        }
      }
    }

    // Resolve service IDs
    let serviceIds: string[] = [];
    if (rest.serviceIds && rest.serviceIds.length > 0) {
      serviceIds = rest.serviceIds;
    } else if (rest.serviceId) {
      serviceIds = [rest.serviceId];
    } else if (existing.items && existing.items.length > 0) {
      serviceIds = existing.items.map((i: { serviceId: string }) => i.serviceId);
    } else if (existing.serviceId) {
      serviceIds = [existing.serviceId];
    }

    if (serviceIds.length > 0) {
      const services = await db.service.findMany({
        where: { tenantId: existing.tenantId, id: { in: serviceIds }, deletedAt: null },
      });
      if (services.length !== serviceIds.length || services.some((service: { status: string }) => service.status !== 'active')) {
        throw new Error('Selected service(s) are unavailable');
      }

      const employeeCount = rest.employeeCount !== undefined ? rest.employeeCount : existing.employeeCount;
      const materialsInput = existing.materials.map((material: { inventoryItemId: string | null; name: string; unit: string; quantity: number; unitPrice: Prisma.Decimal }) => ({
        inventoryItemId: material.inventoryItemId || undefined,
        name: material.name,
        unit: material.unit,
        quantity: material.quantity,
        unitPrice: Number(material.unitPrice),
      }));
      const discount = rest.discount !== undefined ? rest.discount : existing.discount;
      const taxRate = rest.taxRate !== undefined ? rest.taxRate : tenantObj?.taxRate || 0;

      const requestedOptions = new Map((rest.serviceOptions || []).map(option => [option.serviceId, option.withMaterials]));
      const existingOptions = new Map(existing.items.map((item: { serviceId: string; includesMaterials: boolean }) => [item.serviceId, item.includesMaterials]));
      const pricedServices = services.map(service => {
        const includesMaterials = requestedOptions.has(service.id) ? requestedOptions.get(service.id)! : existingOptions.get(service.id) || false;
        return { ...service, includesMaterials, baseRate: Number(includesMaterials ? service.withMaterialsRate : service.baseRate) };
      });
      const pricing = calculateMultiServicePricing(
        pricedServices,
        employeeCount,
        duration,
        materialsInput,
        Number(discount),
        Number(taxRate)
      );

      updateData.serviceId = services[0]?.id || existing.serviceId;
      updateData.employeeCount = employeeCount;
      updateData.materialsCost = existing.materialsCost;
      updateData.hourlyRate = pricedServices[0]?.baseRate || existing.hourlyRate;
      updateData.totalAmount = pricing.totalAmount;
      updateData.discount = pricing.discount;
      updateData.netAmount = pricing.netAmount;

      // Recreate service line items; historical materials are read-only.
      await db.bookingItem.deleteMany({ where: { bookingId: id } });

      await db.bookingItem.createMany({
        data: pricing.items.map(it => ({
          bookingId: id,
          serviceId: it.serviceId,
          hourlyRate: it.hourlyRate,
          employeeCount: it.employeeCount,
          hours: it.hours,
          totalAmount: it.totalAmount,
          includesMaterials: it.includesMaterials || false,
        })),
      });

    }

    if (driverChanged) {
      const previousDriver = existing.driverId ? await db.driver.findUnique({ where: { id: existing.driverId }, include: { user: { select: { name: true } } } }) : null;
      const nextDriver = targetDriverId ? await db.driver.findUnique({ where: { id: targetDriverId }, include: { user: { select: { name: true } } } }) : null;
      await db.bookingStatusHistory.create({ data: { bookingId: id, previousStatus: existing.status, newStatus: existing.status, changedBy: actor ? `${actor.role}: ${actor.name}` : 'system', changedByUserId: actor?.userId, changedByRole: actor?.role || 'system', reason: nextDriver ? `Driver assigned: ${nextDriver.user.name}${previousDriver ? ` (replacing ${previousDriver.user.name})` : ''}` : `Driver removed${previousDriver ? `: ${previousDriver.user.name}` : ''}` } });
    }

    const updated = await db.booking.update({
      where: { id, tenantId },
      data: updateData,
      include: {
        customer: { include: { user: { select: { name: true } } } },
        driver: { include: { user: { select: { name: true } } } },
        service: { select: { id: true, name: true, baseRate: true } },
        items: { include: { service: { select: { id: true, name: true, baseRate: true } } } },
        materials: { include: { inventoryItem: true } },
        assignments: { include: { employee: { include: { user: { select: { name: true } } } } } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        completionTimingResponses: { include: { employee: { include: { user: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' } },
        pickupAlerts: { orderBy: { generatedAt: 'desc' } },
        invoices: { include: { payments: { orderBy: { createdAt: 'desc' } } } },
      },
    }) as unknown as Booking;
    await syncBookingTripStop(db, updated, tenantObj?.timezone || 'UTC');
    await syncMaterialReservations(db, updated.id);
    if (updated.status === 'in_progress' && existing.status !== 'in_progress') await consumeMaterialReservations(db, updated.id);
    return { booking: updated, transition, driverChanged, previousDriverId: existing.driverId };
  }

  async assignEmployees(tenantId: string, bookingId: string, employeeIds: string[], autoAssign: boolean = false, actor?: BookingActor, driverId?: string): Promise<Booking> {
    const existing = await this.db.booking.findFirst({
      where: { id: bookingId, tenantId },
      include: {
        items: { include: { service: true } },
        service: true,
        materials: true,
        assignments: true,
      },
    });

    if (!existing) throw new Error('Booking not found');
    if (['on_the_way', 'in_progress', 'completed', 'cancelled', 'no_show'].includes(existing.status)) throw new Error(`Cleaners cannot be reassigned while booking is ${existing.status}`);

    const tenantHours = await this.db.tenant.findUnique({ where: { id: existing.tenantId }, select: { firstBookingTime: true, lastWorkingTime: true, timezone: true } });
    const assignmentHoursCheck = validateBookingHours(
      existing.startTime,
      existing.endTime || calculateEndTimeFromDuration(existing.startTime, existing.duration),
      tenantHours?.firstBookingTime,
      tenantHours?.lastWorkingTime,
    );
    if (!assignmentHoursCheck.isValid) throw new Error(assignmentHoursCheck.error);

    const { start: dateStart, end: dateEnd } = calendarDayRange(existing.scheduledDate, tenantHours?.timezone || 'UTC');

    const startMins = parseTimeToMinutes(existing.startTime);
    const endMins = existing.endTime ? parseTimeToMinutes(existing.endTime) : startMins + Math.round(existing.duration * 60);

    const neededCount = Math.max(1, existing.employeeCount || 1);
    if (employeeIds.length > neededCount) {
      throw new Error(`Assign exactly ${neededCount} cleaner(s), or update the requested cleaner count first`);
    }

    let targetEmpIds: string[] = [];

    if (autoAssign) {
      // 1. Fetch active employees with metrics
      const employees = await this.db.employee.findMany({
        where: { tenantId: existing.tenantId, status: 'active' },
        include: {
          user: { select: { name: true } },
          assignments: {
            select: {
              id: true,
              status: true,
              customerRating: true,
              booking: { select: { scheduledDate: true } },
            },
          },
        },
      });

      // 2. Exclude staff on approved leave
      const leaves = await this.db.leaveRecord.findMany({
        where: {
          tenantId: existing.tenantId,
          status: 'approved',
          startDate: { lt: dateEnd },
          endDate: { gte: dateStart },
        },
      });
      const leaveEmpIds = new Set(leaves.map(l => l.employeeId));

      // 3. Exclude staff with overlapping bookings
      const dayBookings = await this.db.booking.findMany({
        where: {
          tenantId: existing.tenantId,
          scheduledDate: { gte: dateStart, lt: dateEnd },
          status: { notIn: ['cancelled', 'completed', 'no_show'] },
          id: { not: bookingId },
        },
        include: { assignments: true },
      });

      const busyEmpIds = new Set<string>();
      dayBookings.forEach(b => {
        const bStart = parseTimeToMinutes(b.startTime);
        const bEnd = b.endTime ? parseTimeToMinutes(b.endTime) : bStart + Math.round(b.duration * 60);
        if (isTimeSlotOverlapping(bStart, bEnd, startMins, endMins)) {
          b.assignments.forEach(a => busyEmpIds.add(a.employeeId));
        }
      });

      // 4. Compute candidate score & multi-tiered sort
      const availableCandidates = employees
        .filter(emp => !leaveEmpIds.has(emp.id) && !busyEmpIds.has(emp.id))
        .map(emp => {
          const ratings = emp.assignments.map(a => a.customerRating).filter((r): r is number => typeof r === 'number' && r > 0);
          const averageRating = ratings.length > 0 ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10 : 0;
          const completedCount = emp.assignments.filter(a => a.status === 'completed').length;
          const currentWorkload = emp.assignments.filter(a => a.booking && a.booking.scheduledDate >= dateStart && a.booking.scheduledDate < dateEnd && !['cancelled', 'no_show'].includes(a.status)).length;

          return {
            id: emp.id,
            name: emp.user?.name || emp.employeeCode,
            averageRating,
            currentWorkload,
            completedCount,
          };
        })
        .sort((a, b) => {
          if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
          if (a.currentWorkload !== b.currentWorkload) return a.currentWorkload - b.currentWorkload;
          return b.completedCount - a.completedCount;
        });

      targetEmpIds = fillCleanerSlots(employeeIds, availableCandidates.map(candidate => candidate.id), neededCount);

      if (targetEmpIds.length < neededCount) {
        throw new Error(`Only ${targetEmpIds.length} eligible cleaner(s) are available; ${neededCount} are required. Booking remains in Pending Assignment.`);
      }
    } else {
      if (!employeeIds || employeeIds.length === 0) {
        throw new Error('A booking cannot transition to Assigned or Scheduled with zero assigned cleaners');
      }
      if (employeeIds.length !== neededCount) {
        throw new Error(`Assign exactly ${neededCount} cleaner(s), or update the requested cleaner count first`);
      }
    }

    // Revalidate manually selected employees, including those retained during auto-assignment.
    for (const empId of employeeIds) {
      const emp = await this.db.employee.findUnique({
        where: { id: empId },
        include: { user: { select: { name: true } } },
      });

      if (!emp || emp.tenantId !== existing.tenantId || emp.status !== 'active') {
        throw new Error(`Employee ${emp?.user?.name || empId} is inactive or unavailable`);
      }
      const onLeave = await this.db.leaveRecord.findFirst({
        where: {
          employeeId: empId,
          status: 'approved',
          startDate: { lt: dateEnd },
          endDate: { gte: dateStart },
        },
      });

      if (onLeave) {
        throw new Error(`Cleaner ${emp.user?.name || emp.employeeCode} is on approved leave for this date`);
      }

      const overlappingAssignments = await this.db.assignment.findMany({
        where: {
          employeeId: empId,
          bookingId: { not: bookingId },
          booking: {
            scheduledDate: { gte: dateStart, lt: dateEnd },
            status: { notIn: ['cancelled', 'completed', 'no_show'] },
          },
        },
        include: { booking: { select: { startTime: true, endTime: true, duration: true } } },
      });

      const hasConflict = overlappingAssignments.some(a => {
        const b = a.booking;
        const bStart = parseTimeToMinutes(b.startTime);
        const bEnd = b.endTime ? parseTimeToMinutes(b.endTime) : bStart + Math.round(b.duration * 60);
        return isTimeSlotOverlapping(bStart, bEnd, startMins, endMins);
      });

      if (hasConflict) {
        throw new Error(`Cleaner ${emp.user?.name || emp.employeeCode} has an overlapping booking in this time slot`);
      }
    }

    if (!autoAssign) {
      targetEmpIds = employeeIds;
    }

    const result = await this.db.$transaction(async tx => {
    // Lock the selected employees before the final check so concurrent assignments serialize.
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Employee" WHERE id IN (${Prisma.join([...new Set(targetEmpIds)])}) FOR UPDATE`);
    if (!driverId) throw new Error('Select a driver to complete the assignment');
    await assertDriverAvailable(tx, { tenantId, driverId, bookingId, scheduledDate: existing.scheduledDate, startTime: existing.startTime, endTime: existing.endTime, duration: existing.duration, timezone: tenantHours?.timezone || 'UTC' });

    // Atomic Race Condition Revalidation
    for (const empId of targetEmpIds) {
      const raceConflict = await tx.assignment.findFirst({
        where: {
          employeeId: empId,
          bookingId: { not: bookingId },
          booking: {
            scheduledDate: { gte: dateStart, lt: dateEnd },
            status: { notIn: ['cancelled', 'completed', 'no_show'] },
          },
        },
        include: { booking: true },
      });
      if (raceConflict && raceConflict.booking) {
        const bStart = parseTimeToMinutes(raceConflict.booking.startTime);
        const bEnd = raceConflict.booking.endTime ? parseTimeToMinutes(raceConflict.booking.endTime) : bStart + Math.round(raceConflict.booking.duration * 60);
        if (isTimeSlotOverlapping(bStart, bEnd, startMins, endMins)) {
          throw new Error('Slot availability changed during assignment. Please retry assignment.');
        }
      }
    }

    // Authoritative Recalculation based on assigned employee count
    const newEmployeeCount = targetEmpIds.length;

    let serviceIds: string[] = [];
    if (existing.items && existing.items.length > 0) {
      serviceIds = existing.items.map(i => i.serviceId);
    } else if (existing.serviceId) {
      serviceIds = [existing.serviceId];
    }

    const services = await tx.service.findMany({
      where: { tenantId: existing.tenantId, id: { in: serviceIds } },
    });

    const mappedMaterials = existing.materials && existing.materials.length > 0
      ? existing.materials.map(m => ({
          name: m.name,
          quantity: m.quantity,
          unitPrice: Number(m.unitPrice),
          unit: m.unit,
          inventoryItemId: m.inventoryItemId || undefined,
        }))
      : Number(existing.materialsCost || 0);
    const tenant = await tx.tenant.findUnique({ where: { id: existing.tenantId }, select: { taxRate: true } });

    const existingOptions = new Map(existing.items.map((item: { serviceId: string; includesMaterials: boolean }) => [item.serviceId, item.includesMaterials]));
    const pricing = calculateMultiServicePricing(
      services.map(service => {
        const includesMaterials = existingOptions.get(service.id) || false;
        return { ...service, includesMaterials, baseRate: Number(includesMaterials ? service.withMaterialsRate : service.baseRate) };
      }),
      newEmployeeCount,
      existing.duration,
      mappedMaterials,
      Number(existing.discount || 0),
      Number(tenant?.taxRate || 0)
    );

    // Delete existing assignments & line items, re-create updated line items & new assignments
    await tx.assignment.deleteMany({ where: { bookingId } });
    await tx.bookingItem.deleteMany({ where: { bookingId } });

    await tx.bookingItem.createMany({
      data: pricing.items.map(it => ({
        bookingId,
        serviceId: it.serviceId,
        hourlyRate: it.hourlyRate,
        employeeCount: it.employeeCount,
        hours: it.hours,
        totalAmount: it.totalAmount,
        includesMaterials: it.includesMaterials || false,
      })),
    });

    await tx.assignment.createMany({
      data: targetEmpIds.map(empId => ({
        tenantId: existing.tenantId,
        bookingId,
        employeeId: empId,
        status: 'assigned',
      })),
    });

    // Append Audit Log History only when assignment changes the booking status.
    const transition = existing.status === 'assigned' ? undefined : await tx.bookingStatusHistory.create({
      data: {
        bookingId,
        previousStatus: existing.status,
        newStatus: 'assigned',
        changedBy: actor ? `${actor.role}: ${actor.name}` : 'system',
        changedByUserId: actor?.userId,
        changedByRole: actor?.role || 'system',
        reason: `Assigned ${targetEmpIds.length} staff member(s)`,
      },
    });

    const booking = await tx.booking.update({
      where: { id: bookingId, tenantId },
      data: {
        driverId,
        employeeCount: newEmployeeCount,
        materialsCost: pricing.materialsSubtotal,
        totalAmount: pricing.totalAmount,
        netAmount: pricing.netAmount,
        status: 'assigned',
      },
      include: {
        customer: { include: { user: { select: { name: true } } } },
        driver: { include: { user: { select: { name: true } } } },
        service: { select: { id: true, name: true, baseRate: true } },
        items: { include: { service: { select: { id: true, name: true, baseRate: true } } } },
        materials: { include: { inventoryItem: true } },
        assignments: { include: { employee: { include: { user: { select: { name: true } } } } } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        completionTimingResponses: { include: { employee: { include: { user: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' } },
        pickupAlerts: { orderBy: { generatedAt: 'desc' } },
      },
    }) as unknown as Booking;
    if (existing.driverId !== driverId) {
      const previousDriver = existing.driverId ? await tx.driver.findUnique({ where: { id: existing.driverId }, include: { user: { select: { name: true } } } }) : null;
      const nextDriver = await tx.driver.findUnique({ where: { id: driverId }, include: { user: { select: { name: true } } } });
      await tx.bookingStatusHistory.create({ data: { bookingId, previousStatus: existing.status, newStatus: 'assigned', changedBy: actor ? `${actor.role}: ${actor.name}` : 'system', changedByUserId: actor?.userId, changedByRole: actor?.role || 'system', reason: `Driver assigned: ${nextDriver?.user.name || driverId}${previousDriver ? ` (replacing ${previousDriver.user.name})` : ''}` } });
    }
    await syncBookingTripStop(tx, booking, tenantHours?.timezone || 'UTC');
    return { booking, transition, driverChanged: existing.driverId !== driverId, previousDriverId: existing.driverId };
    });
    await notifyBookingStatusChange(this.db, bookingId, result.transition);
    if (result.driverChanged) await notifyDriverAssignment(this.db, bookingId, result.previousDriverId);
    return result.booking;
  }

  async rateBookingEmployees(tenantId: string, bookingId: string, customerId: string, ratings: RateEmployeeInput[], overallRating: number, overallComment?: string): Promise<Booking> {
    await this.db.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Booking" WHERE id = ${bookingId} AND "tenantId" = ${tenantId} FOR UPDATE`);
      const booking = await tx.booking.findFirst({ where: { id: bookingId, tenantId }, include: { assignments: true, rating: true } });
      if (!booking) throw new Error('Booking not found');
      if (booking.customerId !== customerId) throw new Error('You may only rate your own booking');
      if (booking.status !== 'completed') throw new Error('Customer rating can only be submitted for completed bookings');
      if (booking.rating) throw new Error('Rating has already been submitted for this booking');
      if (ratings.length !== booking.assignments.length || !booking.assignments.every(assignment => ratings.some(rating => rating.employeeId === assignment.employeeId))) {
        throw new Error('Submit one rating for every cleaner assigned to this booking');
      }

      await Promise.all(booking.assignments.map(assignment => {
        const rating = ratings.find(item => item.employeeId === assignment.employeeId)!;
        return tx.assignment.update({ where: { id: assignment.id }, data: { customerRating: rating.rating, ratingNotes: rating.notes || null } });
      }));
      await tx.bookingRating.create({
        data: { tenantId: booking.tenantId, bookingId, customerId, overallRating, comment: overallComment || null },
      });
    });
    return this.findById(tenantId, bookingId) as Promise<Booking>;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.db.booking.update({
      where: { id, tenantId },
      data: { status: 'cancelled', cancellationReason: 'Archived by administrator', deletedAt: new Date() },
    });
  }
}
