// Build wrapper: injects VITE_BUILD_HASH (short git SHA) and runs `vite build`.
// GDD 5.6: every SessionLog carries the build hash; an issue without it is not reproducible.
import { $ } from 'bun';

async function gitShortSha(): Promise<string> {
  try {
    const out = await $`git rev-parse --short HEAD`.quiet().text();
    return out.trim() || 'nogit';
  } catch {
    return 'nogit';
  }
}

const hash = process.env['VITE_BUILD_HASH'] ?? (await gitShortSha());
const phase = process.env['VITE_PHASE'] ?? 'm1';
console.log(`build hash ${hash}, phase ${phase}`);
await $`vite build`.env({ ...process.env, VITE_BUILD_HASH: hash, VITE_PHASE: phase });
