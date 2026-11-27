import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

// Existing process variables win, followed by .env.local, then .env.
export function loadLocalEnv(root, target = process.env) {
  for (const name of ['.env.local', '.env']) {
    let values;
    try { values = parseEnv(readFileSync(resolve(root, name), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const [key, value] of Object.entries(values)) {
      if (!Object.hasOwn(target, key)) target[key] = value;
    }
  }
}
