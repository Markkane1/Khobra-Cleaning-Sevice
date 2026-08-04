import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const server = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'start', '-p', '3000'], {
  cwd: resolve('apps/web'), stdio: 'inherit', env: process.env,
});

const exitCode = child => new Promise(resolveExit => child.once('exit', code => resolveExit(code ?? 1)));
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (server.exitCode !== null) throw new Error(`Web server exited with code ${server.exitCode}`);
    try {
      if ((await fetch('http://localhost:3000/api/khobra-cleaning/public/services')).ok) break;
    } catch {}
    if (attempt === 49) throw new Error('Web server did not become ready');
    await new Promise(resolveWait => setTimeout(resolveWait, 200));
  }
  const test = spawn(process.execPath, ['--experimental-strip-types', '--test', 'apps/web/src/lib/complete-workflow.integration.test.mjs'], { stdio: 'inherit', env: process.env });
  process.exitCode = await exitCode(test);
} finally {
  server.kill();
  await Promise.race([exitCode(server), new Promise(resolveWait => setTimeout(resolveWait, 5_000))]);
}
