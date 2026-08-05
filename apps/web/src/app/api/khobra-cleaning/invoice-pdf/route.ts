import { db, PrismaInvoicePdfRepository } from '@repo/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

const invoicePdfRepository = new PrismaInvoicePdfRepository(db)

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin', 'customer'])
    if ('response' in auth) return auth.response
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 })

    const tenant = await db.tenant.findUnique({ where: { id: auth.session.tenantId } })
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const invoice = await invoicePdfRepository.getInvoiceForPdf(tenant.id, id)
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (auth.session.role === 'customer' && invoice.customer.userId !== auth.session.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const w = doc.internal.pageSize.getWidth()
    const margin = 20
    const contentW = w - margin * 2
    let y = margin

    // === Header ===
    doc.setFillColor(5, 150, 105) // emerald-600
    doc.rect(0, 0, w, 42, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('INVOICE', margin, 22)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(tenant.name, margin, 30)
    doc.text(`Phone: ${tenant.slug || 'N/A'}`, margin, 36)

    // Invoice number & date (right side of header)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(invoice.invoiceNo, w - margin, 16, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const issued = invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString('en-AE') : 'N/A'
    const due = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-AE') : 'N/A'
    doc.text(`Issued: ${issued}`, w - margin, 24, { align: 'right' })
    doc.text(`Due: ${due}`, w - margin, 30, { align: 'right' })
    doc.text(`Status: ${invoice.status.toUpperCase()}`, w - margin, 36, { align: 'right' })

    // === Status badge ===
    y = 50
    const statusColor: Record<string, [number, number, number]> = {
      draft: [107, 114, 128],
      issued: [13, 148, 136],
      paid: [5, 150, 105],
      partially_paid: [245, 158, 11],
      overdue: [239, 68, 68],
      cancelled: [107, 114, 128],
    }
    const sc = statusColor[invoice.status] || [107, 114, 128]
    doc.setFillColor(sc[0], sc[1], sc[2])
    doc.roundedRect(margin, y - 4, 32, 7, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(invoice.status.replace(/_/g, ' ').toUpperCase(), margin + 16, y + 0.5, { align: 'center' })
    doc.setTextColor(0, 0, 0)

    // === Bill To / Service Info ===
    y = 62
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(107, 114, 128)
    doc.text('BILL TO', margin, y)
    doc.text('SERVICE', w / 2 + 10, y)

    y += 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(0, 0, 0)
    doc.text(invoice.customer?.user?.name || 'Unknown', margin, y)
    doc.text(invoice.booking?.service?.name || 'N/A', w / 2 + 10, y)

    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(75, 85, 99)
    const phone = invoice.customer?.user?.phone || ''
    const email = invoice.customer?.user?.email || ''
    if (phone) doc.text(`Phone: ${phone}`, margin, y)
    if (email) doc.text(`Email: ${email}`, margin, y + 5)

    const city = invoice.booking ? (invoice.booking.city || invoice.booking.area || '') : ''
    if (city) doc.text(`Location: ${city}`, w / 2 + 10, y)
    const bookingNo = invoice.booking?.bookingNo || ''
    if (bookingNo) doc.text(`Booking: ${bookingNo}`, w / 2 + 10, y + 5)

    // === Divider ===
    y = 96
    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(0.5)
    doc.line(margin, y, w - margin, y)

    // === Amount Table ===
    y += 10
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'plain',
      headStyles: {
        fillColor: [243, 244, 246],
        textColor: [107, 114, 128],
        fontSize: 8,
        fontStyle: 'bold',
        cellPadding: 4,
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 5,
        textColor: [31, 41, 55],
      },
      columnStyles: {
        description: { cellWidth: 'auto' },
        amount: { halign: 'right', cellWidth: 45 },
      },
      body: [
        ['Subtotal', `${tenant.currency} ${invoice.subtotal.toLocaleString()}`],
        ...(invoice.discount > 0 ? [['Discount', `-${tenant.currency} ${invoice.discount.toLocaleString()}`]] : []),
        ...(invoice.taxAmount > 0 ? [['Tax', `${tenant.currency} ${invoice.taxAmount.toLocaleString()}`]] : []),
      ],
    })

    // === Total ===
    const finalY = (doc as any).lastAutoTable.finalY + 4
    doc.setFillColor(5, 150, 105)
    doc.roundedRect(w - margin - 80, finalY - 2, 80, 12, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL', w - margin - 74, finalY + 5)
    doc.text(`${tenant.currency} ${invoice.totalAmount.toLocaleString()}`, w - margin - 4, finalY + 5, { align: 'right' })

    // === Payment Summary ===
    let payY = finalY + 20
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Payment Summary', margin, payY)

    payY += 8
    const balance = invoice.totalAmount - invoice.paidAmount
    autoTable(doc, {
      startY: payY,
      margin: { left: margin, right: margin },
      theme: 'plain',
      headStyles: {
        fillColor: [243, 244, 246],
        textColor: [107, 114, 128],
        fontSize: 8,
        fontStyle: 'bold',
        cellPadding: 4,
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 5,
        textColor: [31, 41, 55],
      },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
      },
      head: [['Description', 'Amount', 'Date']],
      body: [
        ['Paid Amount', `${tenant.currency} ${invoice.paidAmount.toLocaleString()}`, ''],
        ['Balance Due', `${tenant.currency} ${balance.toLocaleString()}`, ''],
      ],
    })

    // === Payment History ===
    if (invoice.payments.length > 0) {
      const histY = (doc as any).lastAutoTable.finalY + 10
      doc.setFont('helvetica', 'bold')
      doc.text('Payment History', margin, histY)

      autoTable(doc, {
        startY: histY + 4,
        margin: { left: margin, right: margin },
        theme: 'grid',
        headStyles: {
          fillColor: [5, 150, 105],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          cellPadding: 4,
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 4,
          textColor: [31, 41, 55],
        },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'center' },
        },
        head: [['Date', 'Amount', 'Method', 'Reference']],
        body: invoice.payments.map((p: any) => [
          p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-AE') : '',
          `${tenant.currency} ${p.amount.toLocaleString()}`,
          p.method || '',
          p.referenceNo || '-',
        ]),
      })
    }

    // === Footer ===
    const pageH = doc.internal.pageSize.getHeight()
    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(0.3)
    doc.line(margin, pageH - 28, w - margin, pageH - 28)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(156, 163, 175)
    doc.text('Thank you for your business!', margin, pageH - 20)
    doc.text(`Generated by Khobra Cleaning | ${new Date().toLocaleDateString('en-AE')}`, w - margin, pageH - 20, { align: 'right' })

    // === Watermark for drafts ===
    if (invoice.status === 'draft') {
      doc.setTextColor(200, 200, 200)
      doc.setFontSize(48)
      doc.setFont('helvetica', 'bold')
      doc.text('DRAFT', w / 2, pageH / 2, {
        align: 'center',
        angle: 45,
      })
    }

    const pdfBuffer = doc.output('arraybuffer')
    return new NextResponse(pdfBuffer, {
      headers : {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoiceNo}.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}


