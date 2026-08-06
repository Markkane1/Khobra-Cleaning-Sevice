import { db, deliverPushNotifications } from '@repo/db'

export async function deliverPickupAlert(alert: any, driverUserId: string, tenantId: string) {
  try {
    const notice = {
      tenantId,
      userId: driverUserId,
      deliveryKey: `pickup:${alert.id}`,
      pickupAlertId: alert.id,
      title: `HIGH PRIORITY: Pickup for ${alert.booking.bookingNo}`,
      message: `Prepare or proceed for pickup. Booking: ${alert.booking.bookingNo}. Customer location: ${alert.customerLocation}. Scheduled end time: ${alert.scheduledEndTime || 'Not specified'}. Current time: ${alert.generatedAt.toISOString()}. Assigned cleaners: ${alert.assignedCleanerNames}.`,
      type: 'pickup_alert_high',
    }
    await db.notification.createMany({
      skipDuplicates: true,
      data: [{ ...notice,
        channel: 'in_app',
        deliveryStatus: 'sent',
        deliveryAttemptedAt: new Date(),
      }],
    })
    await deliverPushNotifications(db, [notice])
  } catch (error) {
    console.error(`Pickup alert ${alert.id} notification delivery failed`, error)
  }
}
