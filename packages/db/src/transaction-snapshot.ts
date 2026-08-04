export async function createTransactionSnapshot(tx: any, tenantId: string, paymentId: string) {
  const existing = await tx.transactionSnapshot.findUnique({ where: { paymentId } })
  if (existing) return existing
  const payment = await tx.payment.findFirst({
    where: { id: paymentId, tenantId },
    include: { invoice: { include: { customer: { include: { user: true } }, booking: { include: { service: true, items: { include: { service: true } }, materials: true, assignments: true } } } } },
  })
  if (!payment) throw new Error('Payment not found for transaction snapshot')
  const invoice = payment.invoice
  const booking = invoice.booking
  const services = booking?.items?.length
    ? booking.items.map((item: any) => ({ name: item.service.name, hourlyRate: item.hourlyRate, employeeCount: item.employeeCount, hours: item.hours, amount: item.totalAmount }))
    : booking ? [{ name: booking.service?.name || 'Service', hourlyRate: booking.hourlyRate, employeeCount: booking.employeeCount, hours: booking.duration, amount: booking.hourlyRate * booking.employeeCount * booking.duration }] : []
  const serviceAmount = services.reduce((sum: number, item: any) => sum + Number(item.amount), 0)
  const materials = booking?.materials?.reduce((sum: number, item: any) => sum + Number(item.totalAmount), 0) || Number(booking?.materialsCost || 0)
  const snapshotData = {
    transactionNo: payment.transactionNo,
    bookingReference: booking?.bookingNo || null,
    customerName: invoice.customer.user.name,
    currency: payment.companyBankAccountSnapshot ? JSON.parse(payment.companyBankAccountSnapshot).currency || 'AED' : 'AED',
    services,
    serviceAmount,
    materials,
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.taxAmount),
    discount: Number(invoice.discount),
    invoiceTotal: Number(invoice.totalAmount),
    amountReceived: Number(payment.amount),
  }
  return tx.transactionSnapshot.create({ data: {
    tenantId,
    paymentId,
    bookingNo: booking?.bookingNo || '',
    customerName: invoice.customer.user.name,
    serviceName: services.map((item: any) => item.name).join(', ') || 'Service',
    hourlyRate: Number(booking?.hourlyRate || 0),
    duration: Number(booking?.duration || 0),
    employeeCount: Number(booking?.employeeCount || 0),
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.taxAmount),
    discount: Number(invoice.discount),
    totalAmount: Number(payment.amount),
    snapshotData,
  } })
}
