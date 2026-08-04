import { NextRequest, NextResponse } from 'next/server'
import { FileValidationSchema, UploadConfig } from '@repo/core'
import { requireAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { db } from '@repo/db'

// ponytail: magic byte validator function
function isValidSignature(type: string, bytes: Uint8Array): boolean {
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (type === 'image/png') return bytes.slice(0, 8).every((b, i) => b === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][i])
  if (type === 'image/webp') return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  if (type === 'application/pdf') return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-'
  return false
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ('response' in auth) return auth.response
  if (!(await checkRateLimit(`upload:${auth.session.userId}`, 30, 60_000)).allowed) return NextResponse.json({ error: 'Too many uploads. Please wait and try again.' }, { status: 429 })

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

    // SEC-014: Explicitly reject SVG or XML files for safety
    if (file.type.includes('svg') || file.name.toLowerCase().endsWith('.svg') || file.type.includes('xml')) {
      return NextResponse.json({ error: 'SVG and XML uploads are not permitted for security reasons.' }, { status: 400 })
    }

    const purpose = String(formData.get('folder') || 'general').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'general'
    
    const allowedPurposes = auth.session.role === 'admin'
      ? ['general', 'service-gallery', 'service-hero', 'inventory', 'payment-proofs']
      : auth.session.role === 'customer' ? ['general', 'payment-proofs'] : ['general']
    if (!allowedPurposes.includes(purpose)) return NextResponse.json({ error: 'Forbidden. Role cannot upload to this folder.' }, { status: 403 })

    const validation = FileValidationSchema.safeParse({ name: file.name, type: file.type, size: file.size })
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message || 'Invalid file.' }, { status: 400 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!isValidSignature(file.type, bytes)) {
      return NextResponse.json({ error: 'File magic bytes do not match declared type.' }, { status: 400 })
    }

    const folder = `${process.env.CLOUDINARY_FOLDER || 'khobra'}/${auth.session.tenantId}/${purpose}`
    const upload = new FormData()
    const blob = new Blob([bytes], { type: file.type })
    upload.append('file', blob, file.name)
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

    const asset = await db.uploadAsset.create({ data: { tenantId: auth.session.tenantId, userId: auth.session.userId, url: result.secure_url, publicId: result.public_id, purpose, mimeType: file.type, size: file.size } })
    return NextResponse.json({ url: asset.url, name: file.name, size: file.size, type: file.type }, { status: 201 })
  } catch (error) {
    console.error('Cloudinary upload error:', error)
    return NextResponse.json({ error: 'Cloudinary upload failed.' }, { status: 502 })
  }
}

export function GET() {
  return NextResponse.json({
    allowedTypes: UploadConfig.ALLOWED_TYPES.filter(t => !t.includes('svg')),
    maxFileSize: UploadConfig.MAX_SIZE,
    maxSizeLabel: UploadConfig.MAX_SIZE_LABEL,
    provider: 'cloudinary',
    configured: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
  })
}
