import { readFile } from 'node:fs/promises';
import { createPreset, compareSchedules } from '../scheduling.mjs';
try {
  const input = process.argv[2] ? JSON.parse(await readFile(process.argv[2], 'utf8')) : { jobs: createPreset() };
  console.log(JSON.stringify(compareSchedules(input.jobs), null, 2));
} catch (error) {
  console.error(`Cannot solve this input: ${error.message}`);
  process.exitCode = 1;
}
