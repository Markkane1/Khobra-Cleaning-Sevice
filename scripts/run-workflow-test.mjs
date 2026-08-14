import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const port = '3101';
const env = { ...process.env, WORKFLOW_API_BASE: `http://127.0.0.1:${port}/api/khobra-cleaning` };
const server = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'start', '-p', port], {
  cwd: resolve('apps/web'), stdio: 'inherit', env,
});

const exitCode = child => new Promise(resolveExit => child.once('exit', code => resolveExit(code ?? 1)));
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (server.exitCode !== null) throw new Error(`Web server exited with code ${server.exitCode}`);
    try {
      if ((await fetch(`${env.WORKFLOW_API_BASE}/public/services`)).ok) break;
    } catch {}
    if (attempt === 49) throw new Error('Web server did not become ready');
    await new Promise(resolveWait => setTimeout(resolveWait, 200));
  }
  const test = spawn(process.execPath, ['--experimental-strip-types', '--test', 'apps/web/src/lib/complete-workflow.integration.test.mjs'], { stdio: 'inherit', env });
  process.exitCode = await exitCode(test);
} finally {
  server.kill();
  await Promise.race([exitCode(server), new Promise(resolveWait => setTimeout(resolveWait, 5_000))]);
}
