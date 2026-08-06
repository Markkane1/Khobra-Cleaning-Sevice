export async function uploadToCloudinary(
  config: { cloudName: string; apiKey: string; apiSecret: string; folder: string },
  file: { name: string; type: string; bytes: Uint8Array },
  fetcher: typeof fetch = fetch,
) {
  const body = new FormData()
  body.append('file', new Blob([file.bytes as BlobPart], { type: file.type }), file.name)
  body.append('folder', config.folder)
  const response = await fetcher(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/auto/upload`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}` },
    body,
  })
  const result = await response.json()
  if (!response.ok || !result.secure_url || !result.public_id) throw new Error(result.error?.message || 'Cloudinary upload failed.')
  return { url: String(result.secure_url), publicId: String(result.public_id) }
}
