import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function resultPath(job, env = process.env) {
  return env.GATE_RESULT || `reports/quality/results/${job}.json`;
}

export function writeGateResult(job, result, env = process.env) {
  const path = resultPath(job, env);
  mkdirSync(dirname(path), { recursive: true });
  const payload = { job, ...result };
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  return path;
}

export function finishGate(job, result, env = process.env) {
  const path = writeGateResult(job, result, env);
  console.log(`${job}: ${result.status}`);
  if (result.value) console.log(result.value);
  if (result.floor) console.log(`floor: ${result.floor}`);
  console.log(`wrote ${path}`);
  return result.status === 'PASS' ? 0 : 1;
}
