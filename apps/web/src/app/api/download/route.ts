import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const filePathParam = searchParams.get('file')

    if (!filePathParam) {
      return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 })
    }

    // Sanitize path to prevent directory traversal
    const safeFilename = path.basename(filePathParam)
    const publicUploadsDir = path.join(process.cwd(), 'public', 'uploads')
    const fullPath = path.join(publicUploadsDir, safeFilename)

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const fileBuffer = fs.readFileSync(fullPath)
    const ext = path.extname(safeFilename).toLowerCase()
    
    let contentType = 'application/octet-stream'
    if (ext === '.pdf') contentType = 'application/pdf'
    else if (ext === '.png') contentType = 'image/png'
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'
    else if (ext === '.csv') contentType = 'text/csv'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Download error' }, { status: 500 })
  }
}
