import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadLocalEnv } from '../local-server/env.mjs';

test('environment loading supports .env and preserves local/process precedence', t => {
  const root = mkdtempSync(join(tmpdir(), 'onseafog-env-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const target = {};
  loadLocalEnv(root, target);
  assert.deepEqual(target, {});
  writeFileSync(join(root, '.env'), 'KMA_API_KEY="example-test-key"\nPORT=4173\n');
  loadLocalEnv(root, target);
  assert.equal(target.KMA_API_KEY, 'example-test-key');
  writeFileSync(join(root, '.env.local'), 'KMA_API_KEY=local-test-key\nPORT=4174\n');
  const withProcess = { PORT: '5000' };
  loadLocalEnv(root, withProcess);
  assert.deepEqual(withProcess, { KMA_API_KEY: 'local-test-key', PORT: '5000' });
});
