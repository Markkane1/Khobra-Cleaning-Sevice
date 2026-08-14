import { NextRequest, NextResponse } from 'next/server'
import { db } from '@repo/db'
import { parseTimeToMinutes, calculateDurationHours, calculateEndTimeFromDuration, isTimeSlotOverlapping, validateBookingHours, calendarDayRange } from '@repo/core'
import { requireAuth } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/api-error'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'customer'])
    if ('response' in auth) return auth.response
    const tenantId = auth.session.tenantId

    const { searchParams } = new URL(req.url)
    const dateStr = searchParams.get('date')
    const startTime = searchParams.get('startTime') || searchParams.get('fromTime')
    const endTime = searchParams.get('endTime') || searchParams.get('toTime')
    const durationParam = searchParams.get('duration')

    if (!dateStr || !startTime) {
      return NextResponse.json({ error: 'Date and From time are required' }, { status: 400 })
    }

    let startMins = parseTimeToMinutes(startTime)
    let endMins = 0
    let duration = 0

    if (endTime) {
      endMins = parseTimeToMinutes(endTime)
      duration = calculateDurationHours(startTime, endTime)
    } else if (durationParam) {
      duration = parseFloat(durationParam)
      endMins = startMins + Math.round(duration * 60)
    }

    if (!Number.isFinite(startMins) || !Number.isFinite(endMins) || endMins <= startMins || duration <= 0) {
      return NextResponse.json({ error: 'To time must be later than From time' }, { status: 400 })
    }

    const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    const hoursCheck = validateBookingHours(startTime, endTime || calculateEndTimeFromDuration(startTime, duration), tenant.firstBookingTime, tenant.lastWorkingTime)
    if (!hoursCheck.isValid) return NextResponse.json({ error: hoursCheck.error }, { status: 400 })

    const { start: startOfDay, end: endOfDay } = calendarDayRange(dateStr, tenant.timezone || 'UTC')

    // 1. Fetch active employees with assignment metrics
    const employees = await db.employee.findMany({
      where: { tenantId, status: 'active' },
      include: {
        user: { select: { name: true, email: true } },
        assignments: {
          select: {
            id: true,
            status: true,
            customerRating: true,
            booking: { select: { scheduledDate: true } },
          },
        },
      },
    })

    // 2. Fetch approved leaves for date
    const leaves = await db.leaveRecord.findMany({
      where: {
        tenantId,
        status: 'approved',
        startDate: { lt: endOfDay },
        endDate: { gte: startOfDay },
      },
    })
    const leaveEmpIds = new Set(leaves.map(l => l.employeeId))

    // 3. Fetch active bookings on date
    const dayBookings = await db.booking.findMany({
      where: {
        tenantId,
        scheduledDate: { gte: startOfDay, lt: endOfDay },
        status: { notIn: ['cancelled', 'completed', 'no_show'] },
      },
      include: {
        assignments: true,
      },
    })

    // 4. Identify employees with overlapping bookings
    const busyEmpIds = new Set<string>()
    dayBookings.forEach(b => {
      const bStart = parseTimeToMinutes(b.startTime)
      let bEnd = b.endTime ? parseTimeToMinutes(b.endTime) : bStart + Math.round(b.duration * 60)

      if (isTimeSlotOverlapping(bStart, bEnd, startMins, endMins)) {
        b.assignments.forEach(a => busyEmpIds.add(a.employeeId))
      }
    })

    const availableEmployees: any[] = []
    const busyEmployees: any[] = []
    const onLeaveEmployees: any[] = []

    const allEmployeesStatus = employees.map(emp => {
      const isLeave = leaveEmpIds.has(emp.id)
      const isBusy = busyEmpIds.has(emp.id)
      const isAvailable = !isLeave && !isBusy
      const reason = isLeave ? 'On Approved Leave' : isBusy ? 'Scheduled in Overlapping Slot' : 'Available'

      // Metrics calculation
      const ratings = emp.assignments
        .map(a => a.customerRating)
        .filter((r): r is number => typeof r === 'number' && r > 0)
      const averageRating = ratings.length > 0
        ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
        : 0
      const completedCount = emp.assignments.filter(a => a.status === 'completed').length
      const currentWorkload = emp.assignments.filter(a =>
        a.booking &&
        a.booking.scheduledDate >= startOfDay &&
        a.booking.scheduledDate < endOfDay &&
        a.status !== 'cancelled'
      ).length

      const item = {
        id: emp.id,
        employeeCode: emp.employeeCode,
        name: emp.user?.name || emp.employeeCode,
        skills: emp.skills,
        isAvailable,
        isLeave,
        isBusy,
        reason,
        eligibility: {
          sameTenant: true,
          active: true,
          notOnLeave: !isLeave,
          noScheduleConflict: !isBusy,
        },
        averageRating,
        ratingCount: ratings.length,
        ratingFormatted: ratings.length ? `${averageRating.toFixed(1)} ★` : 'New · No ratings',
        completedCount,
        currentWorkload,
        displayText: `${emp.user?.name || emp.employeeCode} — ${ratings.length ? `${averageRating.toFixed(1)} ★` : 'New · No ratings'}`,
        detailText: `${ratings.length ? `${averageRating.toFixed(1)} ★ from ${ratings.length} rating(s)` : 'No customer ratings yet'} · ${completedCount} jobs completed · Workload: ${currentWorkload}`,
      }

      if (isAvailable) availableEmployees.push(item)
      else if (isLeave) onLeaveEmployees.push(item)
      else if (isBusy) busyEmployees.push(item)

      return item
    })

    const suggestedAlternatives = [...availableEmployees].sort((a, b) => b.averageRating - a.averageRating || a.currentWorkload - b.currentWorkload || a.name.localeCompare(b.name))

    if (auth.session.role === 'customer') {
      const publicEmployees = availableEmployees.map(({ id, employeeCode, name, skills, isAvailable, averageRating, ratingCount, ratingFormatted, displayText }) => ({
        id, employeeCode, name, skills, isAvailable, averageRating, ratingCount, ratingFormatted, displayText,
      }))
      return NextResponse.json({
        date: dateStr,
        startTime,
        endTime: endTime || calculateEndTimeFromDuration(startTime, duration),
        duration,
        totalEmployees: publicEmployees.length,
        availableCount: publicEmployees.length,
        availableEmployees: publicEmployees,
        busyEmployees: [],
        onLeaveEmployees: [],
        allEmployeesStatus: publicEmployees,
        suggestedAlternatives: publicEmployees,
      })
    }

    return NextResponse.json({
      date: dateStr,
      startTime,
      endTime: endTime || calculateEndTimeFromDuration(startTime, duration),
      duration,
      totalEmployees: employees.length,
      availableCount: availableEmployees.length,
      availableEmployees,
      busyEmployees,
      onLeaveEmployees,
      allEmployeesStatus,
      suggestedAlternatives,
    })
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to calculate availability' })
  }
}
