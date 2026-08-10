export const notificationTarget = (type: string) =>
  ['booking_status', 'dispatch', 'pickup_alert_high'].includes(type) ? 'bookings' as const : 'notifications' as const
