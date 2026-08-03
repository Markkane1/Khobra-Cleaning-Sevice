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

    const validation = FileValidationSchema.safeParse({ name: file.name, type: file.type, size: file.size })
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message || 'Invalid file.' }, { status: 400 })
    }

    const purpose = String(formData.get('folder') || 'general').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'general'
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
