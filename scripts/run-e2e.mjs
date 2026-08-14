import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const port = '3100'
const env = { ...process.env, PLAYWRIGHT_EXTERNAL_SERVER: '1', PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${port}` }
const server = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'start', resolve('apps/web'), '-p', port], {
  stdio: 'inherit',
  env,
})
const exited = child => new Promise(resolveExit => child.once('exit', code => resolveExit(code ?? 1)))

try {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (server.exitCode !== null) throw new Error(`Web server exited with code ${server.exitCode}`)
    try {
      if ((await fetch(env.PLAYWRIGHT_BASE_URL)).ok) break
    } catch {}
    if (attempt === 39) throw new Error('Web server did not become ready')
    await new Promise(resolveWait => setTimeout(resolveWait, 250))
  }

  const test = spawn(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test'], { stdio: 'inherit', env })
  process.exitCode = await exited(test)
} finally {
  server.kill()
  await Promise.race([exited(server), new Promise(resolveWait => setTimeout(resolveWait, 5_000))])
}
