import { NextRequest, NextResponse } from 'next/server'
import { FileValidationSchema, UploadConfig } from '@repo/core'
import { requireAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('response' in auth) return auth.response

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Cloudinary is not configured on the server.' }, { status: 503 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
    }

    const purpose = String(formData.get('folder') || 'general').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'general'
    const validation = FileValidationSchema.safeParse({ name: file.name, type: file.type, size: file.size })
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message || 'Invalid file.' }, { status: 400 })
    }
    if (purpose === 'payment-proofs') {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
      const bytes = new Uint8Array(await file.arrayBuffer())
      const validSignature =
        (file.type === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
        (file.type === 'image/png' && bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) ||
        (file.type === 'image/webp' && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') ||
        (file.type === 'application/pdf' && new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-')
      if (!allowed.includes(file.type) || !validSignature) return NextResponse.json({ error: 'Payment proof must be a genuine JPG, PNG, WEBP, or PDF file.' }, { status: 400 })
    }

    const folder = `${process.env.CLOUDINARY_FOLDER || 'khobra'}/${auth.session.tenantId}/${purpose}`
    const upload = new FormData()
    upload.append('file', file)
    upload.append('folder', folder)

    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/auto/upload`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}` },
      body: upload,
    })
    const result = await response.json()
    if (!response.ok || !result.secure_url) {
      return NextResponse.json({ error: result.error?.message || 'Cloudinary upload failed.' }, { status: 502 })
    }

    return NextResponse.json({ url: result.secure_url, name: file.name, size: file.size, type: file.type }, { status: 201 })
  } catch (error) {
    console.error('Cloudinary upload error:', error)
    return NextResponse.json({ error: 'Cloudinary upload failed.' }, { status: 502 })
  }
}

export function GET() {
  return NextResponse.json({
    allowedTypes: UploadConfig.ALLOWED_TYPES,
    maxFileSize: UploadConfig.MAX_SIZE,
    maxSizeLabel: UploadConfig.MAX_SIZE_LABEL,
    provider: 'cloudinary',
    configured: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
  })
}
