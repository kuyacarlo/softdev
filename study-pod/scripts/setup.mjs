import { existsSync, copyFileSync } from 'node:fs';

if (!existsSync('.dev.vars')) {
  copyFileSync('.dev.vars.example', '.dev.vars');
  console.log('Created .dev.vars from .dev.vars.example (AUTH_MODE=dev).');
} else {
  console.log('.dev.vars already exists — leaving it untouched.');
}
