// Leonida Legend — GTA VI trophy guide & tracker: the hand-in program.
//
// The entry itself is the app/ folder beside this file: plain static
// files (index.html, style.css, two ES modules and the JSON data) that a
// browser opens offline. This program hands it in: it copies app/ and
// screenshots/ into the output directory and writes dossier.json there
// with the vendored make.fun library, byte for byte as the scorer's own
// copy writes it. Node 22, standard library only.
//
// Run it the way the grader does, with MAKEFUN_OUTPUT_DIR naming /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the guide locally instead with: node serve.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The guide and its screenshots, copied exactly as they sit in the repo.
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The dossier, under the scorer's own caps (reference/gate.json): the
// text cap shapes the bytes; the rest refuse anything the scorer would
// refuse — over 4 screenshots or one over 256 KiB, over 993 files and
// directories in app/, or over 48 MiB of app files.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
  }),
);
