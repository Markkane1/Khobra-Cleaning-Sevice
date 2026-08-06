import assert from 'node:assert/strict'
import test from 'node:test'
import { uploadToCloudinary } from './cloudinary.ts'

test('Cloudinary upload contract sends authenticated multipart data and validates the response', async () => {
  let request
  const uploaded = await uploadToCloudinary(
    { cloudName: 'test-cloud', apiKey: 'key', apiSecret: 'secret', folder: 'khobra/tenant/service-hero' },
    { name: 'hero.png', type: 'image/png', bytes: new Uint8Array([1, 2, 3]) },
    async (url, init) => {
      request = { url, init }
      return new Response(JSON.stringify({ secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/hero.png', public_id: 'khobra/tenant/service-hero/hero' }), { status: 200 })
    },
  )

  assert.equal(request.url, 'https://api.cloudinary.com/v1_1/test-cloud/auto/upload')
  assert.equal(request.init.method, 'POST')
  assert.equal(request.init.headers.Authorization, `Basic ${Buffer.from('key:secret').toString('base64')}`)
  assert.equal(request.init.body.get('folder'), 'khobra/tenant/service-hero')
  assert.equal(request.init.body.get('file').name, 'hero.png')
  assert.deepEqual(uploaded, { url: 'https://res.cloudinary.com/test-cloud/image/upload/hero.png', publicId: 'khobra/tenant/service-hero/hero' })

  await assert.rejects(
    uploadToCloudinary(
      { cloudName: 'test-cloud', apiKey: 'key', apiSecret: 'secret', folder: 'khobra/tenant/service-hero' },
      { name: 'hero.png', type: 'image/png', bytes: new Uint8Array([1]) },
      async () => new Response(JSON.stringify({ error: { message: 'Invalid credentials' } }), { status: 401 }),
    ),
    /Invalid credentials/,
  )
})
