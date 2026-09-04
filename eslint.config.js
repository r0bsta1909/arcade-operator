// ESLint flat config. CLAUDE.md rule 1: no wall-clock or unseeded randomness
// inside the simulation (src/arcade, src/human, src/session).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// `no-restricted-globals` only catches bare identifiers (e.g. `performance`).
// `Math.random()` / `Date.now()` / `performance.now()` are member accesses,
// so `no-restricted-properties` is needed as well.
const forbiddenClock = [
  { object: 'Math', property: 'random', message: 'Use Rng (seeded) — CLAUDE.md rule 1.' },
  { object: 'Date', property: 'now', message: 'Simulation must be frame-based — CLAUDE.md rule 1.' },
  { object: 'performance', property: 'now', message: 'Simulation must be frame-based — CLAUDE.md rule 1.' },
];

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/arcade/**', 'src/human/**', 'src/session/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'performance', message: 'Simulation must be frame-based — CLAUDE.md rule 1.' },
        { name: 'requestAnimationFrame', message: 'Only core/GameLoop may schedule frames.' },
      ],
      'no-restricted-properties': ['error', ...forbiddenClock],
    },
  },
);
