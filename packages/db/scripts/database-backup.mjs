import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

for (const line of readFileSync(resolve('.env'), 'utf8').split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (match) process.env[match[1]] ||= match[2].replace(/^"|"$/g, '');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

const url = new URL(process.env.DATABASE_URL);
const connection = ['-h', url.hostname, '-p', url.port || '5432', '-U', decodeURIComponent(url.username)];
const childEnv = { ...process.env, PGPASSWORD: decodeURIComponent(url.password) };
const database = decodeURIComponent(url.pathname.slice(1));
const windowsBin = 'C:\\Program Files\\PostgreSQL\\18\\bin';
const executable = name => process.platform === 'win32' && existsSync(join(windowsBin, `${name}.exe`)) ? join(windowsBin, `${name}.exe`) : name;
const run = (name, args, capture = false) => {
  const result = spawnSync(executable(name), args, { env: childEnv, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.status !== 0) throw new Error(`${name} failed${result.stderr ? `: ${result.stderr.trim()}` : ''}`);
  return result.stdout?.trim();
};

const rehearsal = process.argv.includes('--rehearse');
const backupFile = rehearsal
  ? join(tmpdir(), `khobra-backup-${Date.now()}.dump`)
  : join(resolve(process.env.BACKUP_DIR || 'backups'), `khobra-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`);
mkdirSync(dirname(backupFile), { recursive: true });

try {
  run('pg_dump', [...connection, '-d', database, '--format=custom', '--no-owner', '--no-privileges', '--file', backupFile]);
  if (!rehearsal) {
    console.log(`Database backup created: ${backupFile}`);
  } else {
    const restoreDatabase = `khobra_restore_${randomBytes(6).toString('hex')}`;
    if (!/^khobra_restore_[a-f0-9]{12}$/.test(restoreDatabase)) throw new Error('Unsafe restore database name');
    try {
      run('createdb', [...connection, restoreDatabase]);
      run('pg_restore', [...connection, '-d', restoreDatabase, '--no-owner', '--no-privileges', backupFile]);
      const count = db => run('psql', [...connection, '-d', db, '-Atc', "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"], true);
      const sourceTables = count(database);
      const restoredTables = count(restoreDatabase);
      if (!sourceTables || sourceTables !== restoredTables) throw new Error(`Restore table-count mismatch: ${sourceTables} != ${restoredTables}`);
      console.log(`Backup restore rehearsal passed: ${sourceTables} public tables restored.`);
    } finally {
      run('dropdb', [...connection, '--if-exists', restoreDatabase]);
    }
  }
} finally {
  if (rehearsal) rmSync(backupFile, { force: true });
}
