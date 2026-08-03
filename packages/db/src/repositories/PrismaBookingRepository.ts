import { Prisma, PrismaClient } from '@prisma/client';
import { IBookingRepository, Booking } from '@repo/application';
import { CreateBookingDTO, UpdateBookingDTO, RateEmployeeInput, calculateDurationHours, calculateEndTimeFromDuration, calculateMultiServicePricing, parseTimeToMinutes, isTimeSlotOverlapping, generateBookingOccurrenceDates, isValidStatusTransition, isValidRating, validateBookingConfirmationDTO, validateBookingHours, employeeHasRequiredSkills, getRequiredSkills } from '@repo/core';

async function notifyStatusChange(db: any, bookingId: string, status: string) {
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
  const userIds = [...new Set([booking.customer.userId, ...booking.assignments.map((a: any) => a.employee.userId)].filter(Boolean))] as string[];
  if (!userIds.length) return;
  const label = status.split('_').map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ');
  await db.notification.createMany({
    data: userIds.map(userId => ({
      tenantId: booking.tenantId,
      userId,
      title: `Booking ${label}`,
      message: `${booking.bookingNo} is now ${label}.`,
      type: 'booking_status',
    })),
  });
}

export class PrismaBookingRepository implements IBookingRepository {
  constructor(private readonly db: PrismaClient) {}

  async findManyByTenant(tenantId: string): Promise<Booking[]> {
    return this.db.booking.findMany({
      where: { tenantId },
      include: {
        customer: { include: { user: { select: { name: true } } } },
        service: { select: { id: true, name: true, baseRate: true } },
        items: { include: { service: { select: { id: true, name: true, baseRate: true } } } },
        materials: { include: { inventoryItem: true } },
        assignments: { include: { employee: { include: { user: { select: { name: true } } } } } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { scheduledDate: 'desc' },
    }) as unknown as Booking[];
  }

  async findById(id: string): Promise<Booking | null> {
    return this.db.booking.findUnique({
      where: { id },
      include: {
        customer: { include: { user: { select: { name: true } } } },
        service: { select: { id: true, name: true, baseRate: true } },
        items: { include: { service: { select: { id: true, name: true, baseRate: true } } } },
        materials: { include: { inventoryItem: true } },
        assignments: { include: { employee: { include: { user: { select: { name: true } } } } } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      }
    }) as unknown as Booking | null;
  }

  async create(tenantId: string, data: CreateBookingDTO): Promise<Booking> {
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
      where: { tenantId, id: { in: serviceIds } },
    });

    if (services.length !== serviceIds.length) {
      throw new Error('Selected service(s) not found');
    }

    const inactiveService = services.find(s => s.status === 'inactive');
    if (inactiveService) {
      throw new Error(`Selected service '${inactiveService.name}' is currently unavailable/unbookable`);
    }

    // 2. Resolve duration and time
    const duration = calculateDurationHours(data.startTime, data.endTime);
    const endTime = data.endTime;

    if (duration <= 0) {
      throw new Error('To time must be later than From time');
    }
    const minimumDuration = 2;
    if (duration < minimumDuration) {
      throw new Error('Bookings require at least 2 hours');
    }

    const employeeCount = Math.max(1, data.employeeCount || 1);
    const preferredEmployeeIds = data.preferredEmployeeIds?.length
      ? data.preferredEmployeeIds
      : data.preferredEmployeeId ? [data.preferredEmployeeId] : [];
    const discount = data.discount || 0;
    const taxRate = data.taxRate ?? tenant?.taxRate ?? 0;

    // 3. Authoritative Pricing Engine Calculation
    const pricing = calculateMultiServicePricing(
      services,
      employeeCount,
      duration,
      [],
      discount,
      taxRate
    );

    const primaryServiceId = services[0]?.id;
    const primaryHourlyRate = services[0]?.baseRate || 0;

    // Prompt 10: Occurrence Dates Generation
    const occurrenceDates = generateBookingOccurrenceDates({
      scheduledDate: data.scheduledDate,
      bookingType: data.bookingType,
      selectedDates: data.selectedDates,
      startDate: data.startDate,
      endDate: data.endDate,
      selectedWeekdays: data.selectedWeekdays,
    });

    const isRecurring = data.bookingType !== 'one_time';
    const recurringGroupId = isRecurring ? `RG-${Date.now()}-${Math.floor(Math.random() * 1000)}` : undefined;

    const createdBookings: Booking[] = [];

    const {
      serviceId: _a,
      serviceIds: _b,
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

    for (let index = 0; index < occurrenceDates.length; index++) {
      const scheduledDate = occurrenceDates[index]!;
      // 4. Preferred Employee Availability Recheck FOR THIS SPECIFIC OCCURRENCE DATE (Prompt 10 & 11 Rules)
      let isPreferredAssignedForThisDate = false;
      if (preferredEmployeeIds.length) {
        const dateStart = new Date(scheduledDate);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(scheduledDate);
        dateEnd.setHours(23, 59, 59, 999);
        const preferredEmployees = await this.db.employee.findMany({ where: { id: { in: preferredEmployeeIds }, tenantId, status: 'active' } });
        if (preferredEmployees.length !== preferredEmployeeIds.length || preferredEmployees.some(employee => !employeeHasRequiredSkills(employee.skills, services))) {
          throw new Error('Selected cleaners are unavailable for the requested services');
        }
        const onLeave = await this.db.leaveRecord.findFirst({ where: { employeeId: { in: preferredEmployeeIds }, status: 'approved', startDate: { lte: dateEnd }, endDate: { gte: dateStart } } });
        if (onLeave) throw new Error('Selected cleaner is unavailable for the requested slot');
        const assignments = await this.db.assignment.findMany({
          where: { employeeId: { in: preferredEmployeeIds }, booking: { scheduledDate: { gte: dateStart, lte: dateEnd }, status: { notIn: ['cancelled', 'completed', 'no_show'] } } },
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
        const preferredEmp = await this.db.employee.findUnique({
          where: { id: data.preferredEmployeeId },
        });

        if (preferredEmp && preferredEmp.tenantId === tenantId && preferredEmp.status === 'active' && employeeHasRequiredSkills(preferredEmp.skills, services)) {
          const dateStart = new Date(scheduledDate);
          dateStart.setHours(0, 0, 0, 0);
          const dateEnd = new Date(scheduledDate);
          dateEnd.setHours(23, 59, 59, 999);

          // Check approved leave for this specific date
          const onLeave = await this.db.leaveRecord.findFirst({
            where: {
              employeeId: data.preferredEmployeeId,
              status: 'approved',
              startDate: { lte: dateEnd },
              endDate: { gte: dateStart },
            },
          });

          if (!onLeave) {
            // Check overlapping bookings for this specific date
            const existingAssignments = await this.db.assignment.findMany({
              where: {
                employeeId: data.preferredEmployeeId,
                booking: {
                  scheduledDate: { gte: dateStart, lte: dateEnd },
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

      // A direct preferred assignment is assigned; confirmation moves it to scheduled.
      const initialStatus = isPreferredAssignedForThisDate ? 'assigned' : 'pending_assignment';

      const bookingObj = await this.db.$transaction(async tx => {
        // ponytail: tenant-wide booking lock; use a database sequence for booking numbers if booking throughput grows.
        await tx.$queryRaw(Prisma.sql`SELECT id FROM "Tenant" WHERE id = ${tenantId} FOR UPDATE`);
        const count = await tx.booking.count({ where: { tenantId } });
        const bookingNo = `BK-${String(1000 + count).padStart(5, '0')}`;
        if (preferredEmployeeIds.length) {
          for (const employeeId of [...preferredEmployeeIds].sort()) {
            await tx.$queryRaw(Prisma.sql`SELECT id FROM "Employee" WHERE id = ${employeeId} FOR UPDATE`);
          }
          const dayStart = new Date(scheduledDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(scheduledDate);
          dayEnd.setHours(23, 59, 59, 999);
          const assignments = await tx.assignment.findMany({
            where: {
              employeeId: { in: preferredEmployeeIds },
              booking: {
                scheduledDate: { gte: dayStart, lte: dayEnd },
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
          scheduledDate,
          items: {
            create: pricing.items.map(it => ({
              serviceId: it.serviceId,
              hourlyRate: it.hourlyRate,
              employeeCount: it.employeeCount,
              hours: it.hours,
              totalAmount: it.totalAmount,
            })),
          },
          ...(isPreferredAssignedForThisDate && preferredEmployeeIds.length
            ? {
                assignments: {
                  create: preferredEmployeeIds.map(employeeId => ({
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
          service: { select: { id: true, name: true, baseRate: true } },
          items: { include: { service: { select: { id: true, name: true, baseRate: true } } } },
          materials: { include: { inventoryItem: true } },
          assignments: { include: { employee: { include: { user: { select: { name: true } } } } } },
          statusHistory: { orderBy: { createdAt: 'asc' } },
        },
        }) as unknown as Booking;

        await tx.bookingStatusHistory.create({
        data: {
          bookingId: created.id,
          previousStatus: 'none',
          newStatus: initialStatus,
          changedBy: data.createdBy || 'customer',
          reason: 'Initial booking creation',
        },
        });
        return created;
      });

      createdBookings.push(bookingObj);
    }

    return createdBookings[0]!;
  }

  async update(id: string, data: UpdateBookingDTO): Promise<Booking> {
    return this.db.$transaction(tx => this.updateWithDb(tx, id, data));
  }

  private async updateWithDb(db: any, id: string, data: UpdateBookingDTO): Promise<Booking> {
    const existing = await db.booking.findUnique({
      where: { id },
      include: { items: true, materials: true, assignments: { include: { employee: { include: { user: { select: { name: true } } } } } } },
    });
    if (!existing) throw new Error('Booking not found');

    const { id: _id, ...rest } = data;
    const updateData: any = { ...rest };

    if (rest.status && rest.status !== existing.status) {
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

      if (['on_the_way', 'in_progress', 'completed', 'cancelled', 'no_show'].includes(rest.status)) {
        await db.assignment.updateMany({
          where: { bookingId: id },
          data: {
            status: rest.status,
            ...(rest.status === 'in_progress' ? { startedAt: new Date() } : {}),
            ...(rest.status === 'completed' ? { completedAt: new Date() } : {}),
          },
        });
      }

      // Append Audit Log History (Prompt 12 Requirement)
      await db.bookingStatusHistory.create({
        data: {
          bookingId: id,
          previousStatus: existing.status,
          newStatus: rest.status,
          changedBy: rest.cancelledBy || rest.noShowParty || 'user',
          reason: rest.cancellationReason || rest.noShowReason || 'Status update',
        },
      });
    }

    const scheduledDate = rest.scheduledDate ? new Date(rest.scheduledDate) : new Date(existing.scheduledDate);
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

    if (duration <= 0) {
      throw new Error('To time must be later than From time');
    }

    updateData.duration = duration;
    if (endTime) updateData.endTime = endTime;

    // Prompt 18: Operational Booking Hours Validation on Edit/Reschedule
    const tenantObj = await db.tenant.findUnique({ where: { id: existing.tenantId } });
    const firstBookingTime = tenantObj?.firstBookingTime || '08:00';
    const lastWorkingTime = tenantObj?.lastWorkingTime || '20:00';

    const calculatedEndTime = endTime || calculateEndTimeFromDuration(startTime, duration);
    const hoursCheck = validateBookingHours(startTime, calculatedEndTime, firstBookingTime, lastWorkingTime);
    if (!hoursCheck.isValid) {
      throw new Error(hoursCheck.error);
    }

    // Rescheduling Availability Validation (Prompt 09 Trigger 8 & 9)
    if ((rest.scheduledDate || rest.startTime || rest.endTime) && existing.assignments && existing.assignments.length > 0) {
      await db.$queryRaw(Prisma.sql`SELECT id FROM "Employee" WHERE id IN (${Prisma.join(existing.assignments.map(assignment => assignment.employeeId).sort())}) FOR UPDATE`);
      const dateStart = new Date(scheduledDate);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(scheduledDate);
      dateEnd.setHours(23, 59, 59, 999);

      const reqStartMins = parseTimeToMinutes(startTime);
      const reqEndMins = endTime ? parseTimeToMinutes(endTime) : reqStartMins + Math.round(duration * 60);

      for (const assign of existing.assignments) {
        const empId = assign.employeeId;

        // Check leave
        const onLeave = await db.leaveRecord.findFirst({
          where: {
            employeeId: empId,
            status: 'approved',
            startDate: { lte: dateEnd },
            endDate: { gte: dateStart },
          },
        });
        if (onLeave) {
          throw new Error(`Assigned cleaner ${assign.employee?.user?.name || assign.employee?.employeeCode} is on approved leave for the rescheduled date`);
        }

        // Check overlapping bookings
        const overlapping = await db.assignment.findMany({
          where: {
            employeeId: empId,
            bookingId: { not: id },
            booking: {
              scheduledDate: { gte: dateStart, lte: dateEnd },
              status: { notIn: ['cancelled', 'completed', 'no_show'] },
            },
          },
          include: { booking: { select: { startTime: true, endTime: true, duration: true } } },
        });

        const hasConflict = overlapping.some(a => {
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
      serviceIds = existing.items.map(i => i.serviceId);
    } else if (existing.serviceId) {
      serviceIds = [existing.serviceId];
    }

    if (serviceIds.length > 0) {
      const services = await db.service.findMany({
        where: { tenantId: existing.tenantId, id: { in: serviceIds } },
      });
      if (services.length !== serviceIds.length || services.some(service => service.status === 'inactive')) {
        throw new Error('Selected service(s) are unavailable');
      }

      // Service Skill Eligibility Revalidation (Prompt 15 Requirement 3)
      if ((rest.serviceIds || rest.serviceId) && existing.assignments && existing.assignments.length > 0) {
        const requiredSkillsList = getRequiredSkills(services);
        if (requiredSkillsList.length > 0) {
          for (const assign of existing.assignments) {
            const emp = await db.employee.findUnique({
              where: { id: assign.employeeId },
              include: { user: { select: { name: true } } },
            });

            if (!employeeHasRequiredSkills(emp?.skills, services)) {
              throw new Error(`Assigned cleaner ${emp?.user?.name || emp?.employeeCode || assign.employeeId} is not qualified for updated services (required: ${requiredSkillsList.join(', ')})`);
            }
          }
        }
      }

      const employeeCount = rest.employeeCount !== undefined ? rest.employeeCount : existing.employeeCount;
      const materialsInput = existing.materials.map(material => ({
        inventoryItemId: material.inventoryItemId || undefined,
        name: material.name,
        unit: material.unit,
        quantity: material.quantity,
        unitPrice: material.unitPrice,
      }));
      const discount = rest.discount !== undefined ? rest.discount : existing.discount;
      const taxRate = rest.taxRate !== undefined ? rest.taxRate : tenantObj?.taxRate || 0;

      const pricing = calculateMultiServicePricing(
        services,
        employeeCount,
        duration,
        materialsInput,
        discount,
        taxRate
      );

      updateData.serviceId = services[0]?.id || existing.serviceId;
      updateData.employeeCount = employeeCount;
      updateData.materialsCost = existing.materialsCost;
      updateData.hourlyRate = services[0]?.baseRate || existing.hourlyRate;
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
        })),
      });

    }

    const updated = await db.booking.update({
      where: { id },
      data: updateData,
      include: {
        customer: { include: { user: { select: { name: true } } } },
        service: { select: { id: true, name: true, baseRate: true } },
        items: { include: { service: { select: { id: true, name: true, baseRate: true } } } },
        materials: { include: { inventoryItem: true } },
        assignments: { include: { employee: { include: { user: { select: { name: true } } } } } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    }) as unknown as Booking;
    if (rest.status && rest.status !== existing.status) await notifyStatusChange(db, id, rest.status);
    return updated;
  }

  async assignEmployees(bookingId: string, employeeIds: string[], autoAssign: boolean = false): Promise<Booking> {
    const existing = await this.db.booking.findUnique({
      where: { id: bookingId },
      include: {
        items: { include: { service: true } },
        service: true,
        materials: true,
        assignments: true,
      },
    });

    if (!existing) throw new Error('Booking not found');

    const tenantHours = await this.db.tenant.findUnique({ where: { id: existing.tenantId }, select: { firstBookingTime: true, lastWorkingTime: true } });
    const assignmentHoursCheck = validateBookingHours(
      existing.startTime,
      existing.endTime || calculateEndTimeFromDuration(existing.startTime, existing.duration),
      tenantHours?.firstBookingTime,
      tenantHours?.lastWorkingTime,
    );
    if (!assignmentHoursCheck.isValid) throw new Error(assignmentHoursCheck.error);

    const scheduledDate = new Date(existing.scheduledDate);
    const dateStart = new Date(scheduledDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(scheduledDate);
    dateEnd.setHours(23, 59, 59, 999);

    const startMins = parseTimeToMinutes(existing.startTime);
    const endMins = existing.endTime ? parseTimeToMinutes(existing.endTime) : startMins + Math.round(existing.duration * 60);

    let targetEmpIds: string[] = [];

    if (autoAssign) {
      // 1. Resolve required service skills
      const serviceList = existing.items && existing.items.length > 0
        ? existing.items.map(i => i.service)
        : existing.service ? [existing.service] : [];

      const requiredSkillsList = getRequiredSkills(serviceList);

      // 2. Fetch active employees with metrics
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

      // 3. Exclude staff on approved leave
      const leaves = await this.db.leaveRecord.findMany({
        where: {
          status: 'approved',
          startDate: { lte: dateEnd },
          endDate: { gte: dateStart },
        },
      });
      const leaveEmpIds = new Set(leaves.map(l => l.employeeId));

      // 4. Exclude staff with overlapping bookings
      const dayBookings = await this.db.booking.findMany({
        where: {
          scheduledDate: { gte: dateStart, lte: dateEnd },
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

      // 5. Compute candidate score & multi-tiered sort
      const availableCandidates = employees
        .filter(emp => !leaveEmpIds.has(emp.id) && !busyEmpIds.has(emp.id) && employeeHasRequiredSkills(emp.skills, serviceList))
        .map(emp => {
          const ratings = emp.assignments.map(a => a.customerRating).filter((r): r is number => typeof r === 'number' && r > 0);
          const averageRating = ratings.length > 0 ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10 : 4.8;
          const completedCount = emp.assignments.filter(a => a.status === 'completed').length;
          const currentWorkload = emp.assignments.filter(a => a.booking && a.booking.scheduledDate >= dateStart && a.booking.scheduledDate <= dateEnd && !['cancelled', 'no_show'].includes(a.status)).length;

          return {
            id: emp.id,
            name: emp.user?.name || emp.employeeCode,
            averageRating,
            currentWorkload,
            completedCount,
          };
        })
        .sort((a, b) => {
          if (a.currentWorkload !== b.currentWorkload) return a.currentWorkload - b.currentWorkload;
          if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
          return b.completedCount - a.completedCount;
        });

      const neededCount = Math.max(1, existing.employeeCount || 1);
      targetEmpIds = availableCandidates.slice(0, neededCount).map(e => e.id);

      if (targetEmpIds.length < neededCount) {
        throw new Error(`Only ${targetEmpIds.length} eligible cleaner(s) are available; ${neededCount} are required. Booking remains in Pending Assignment.`);
      }
    } else {
      if (!employeeIds || employeeIds.length === 0) {
        throw new Error('A booking cannot transition to Assigned or Scheduled with zero assigned cleaners');
      }
      if (employeeIds.length !== existing.employeeCount) {
        throw new Error(`Assign exactly ${existing.employeeCount} cleaner(s), or update the requested cleaner count first`);
      }

      // Revalidate manually selected employees
      for (const empId of employeeIds) {
        const emp = await this.db.employee.findUnique({
          where: { id: empId },
          include: { user: { select: { name: true } } },
        });

        if (!emp || emp.tenantId !== existing.tenantId || emp.status !== 'active') {
          throw new Error(`Employee ${emp?.user?.name || empId} is inactive or unavailable`);
        }
        if (!employeeHasRequiredSkills(emp.skills, existing.items.length > 0 ? existing.items.map(item => item.service as any) : existing.service ? [existing.service] : [])) {
          throw new Error(`Cleaner ${emp.user?.name || emp.employeeCode} is not qualified for this booking's services`);
        }

        const onLeave = await this.db.leaveRecord.findFirst({
          where: {
            employeeId: empId,
            status: 'approved',
            startDate: { lte: dateEnd },
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
              scheduledDate: { gte: dateStart, lte: dateEnd },
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

      targetEmpIds = employeeIds;
    }

    return this.db.$transaction(async tx => {
    // Lock the selected employees before the final check so concurrent assignments serialize.
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Employee" WHERE id IN (${Prisma.join([...new Set(targetEmpIds)])}) FOR UPDATE`);

    // Atomic Race Condition Revalidation
    for (const empId of targetEmpIds) {
      const raceConflict = await tx.assignment.findFirst({
        where: {
          employeeId: empId,
          bookingId: { not: bookingId },
          booking: {
            scheduledDate: { gte: dateStart, lte: dateEnd },
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
          unitPrice: m.unitPrice,
          unit: m.unit,
          inventoryItemId: m.inventoryItemId || undefined,
        }))
      : existing.materialsCost || 0;
    const tenant = await tx.tenant.findUnique({ where: { id: existing.tenantId }, select: { taxRate: true } });

    const pricing = calculateMultiServicePricing(
      services,
      newEmployeeCount,
      existing.duration,
      mappedMaterials,
      existing.discount || 0,
      tenant?.taxRate || 0
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

    // Append Audit Log History
    await tx.bookingStatusHistory.create({
      data: {
        bookingId,
        previousStatus: existing.status,
        newStatus: 'assigned',
        changedBy: 'admin',
        reason: `Assigned ${targetEmpIds.length} staff member(s)`,
      },
    });

    await notifyStatusChange(tx, bookingId, 'assigned');

    return tx.booking.update({
      where: { id: bookingId },
      data: {
        employeeCount: newEmployeeCount,
        materialsCost: pricing.materialsSubtotal,
        totalAmount: pricing.totalAmount,
        netAmount: pricing.netAmount,
        status: 'assigned',
      },
      include: {
        customer: { include: { user: { select: { name: true } } } },
        service: { select: { id: true, name: true, baseRate: true } },
        items: { include: { service: { select: { id: true, name: true, baseRate: true } } } },
        materials: { include: { inventoryItem: true } },
        assignments: { include: { employee: { include: { user: { select: { name: true } } } } } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    }) as unknown as Booking;
    });
  }

  async rateBookingEmployees(bookingId: string, ratings: RateEmployeeInput[]): Promise<Booking> {
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
      include: { assignments: true },
    });

    if (!booking) throw new Error('Booking not found');
    if (booking.status !== 'completed') {
      throw new Error('Customer rating can only be submitted for completed bookings');
    }

    for (const r of ratings) {
      if (!isValidRating(r.rating)) {
        throw new Error(`Invalid rating ${r.rating}. Ratings must be between 1.0 and 5.0 in 0.5 step increments.`);
      }

      const targetAssignment = booking.assignments.find(a => a.employeeId === r.employeeId || a.id === r.assignmentId);
      if (!targetAssignment) throw new Error('Ratings may only be submitted for cleaners assigned to this booking');
      await this.db.assignment.update({
        where: { id: targetAssignment.id },
        data: {
          customerRating: r.rating,
          ratingNotes: r.notes || null,
        },
      });
    }

    return this.findById(bookingId) as Promise<Booking>;
  }

  async delete(id: string): Promise<void> {
    await this.db.bookingStatusHistory.deleteMany({ where: { bookingId: id } });
    await this.db.bookingItem.deleteMany({ where: { bookingId: id } });
    await this.db.bookingMaterial.deleteMany({ where: { bookingId: id } });
    await this.db.complaint.deleteMany({ where: { bookingId: id } });
    await this.db.assignment.deleteMany({ where: { bookingId: id } });
    await this.db.invoice.updateMany({ where: { bookingId: id }, data: { bookingId: null } });
    await this.db.booking.delete({ where: { id } });
  }
}
