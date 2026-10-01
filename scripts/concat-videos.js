#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Resolve paths relative to project root (one level up from scripts/)
const projectRoot = path.resolve(__dirname, '..');
const resultsDir = path.join(projectRoot, 'test-results');
const outputFile = path.join(projectRoot, 'demo.webm');

// ── 1. Collect all .webm files recursively ──────────────────────────
function findWebm(dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(findWebm(full));
    } else if (entry.name.endsWith('.webm')) {
      files.push(full);
    }
  }
  return files;
}

const videos = findWebm(resultsDir);

if (videos.length === 0) {
  console.error('⚠️  No .webm videos found in', resultsDir);
  console.error('   Run  npx playwright test  first (with video recording enabled in playwright.config.ts).');
  process.exit(1);
}

console.log(`Found ${videos.length} video(s):`);
videos.forEach((v, i) => console.log(`  ${i + 1}. ${path.relative(projectRoot, v)}`));

// ── 2. Write ffmpeg concat list ─────────────────────────────────────
const listPath = path.join(resultsDir, '_concat_list.txt');
const listContent = videos
  .map(v => `file '${v.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`)
  .join('\n');
fs.writeFileSync(listPath, listContent, 'utf-8');

// ── 3. Run ffmpeg via ffmpeg-static ─────────────────────────────────
let ffmpegPath;
try {
  ffmpegPath = require('ffmpeg-static');
} catch {
  // Fallback: assume ffmpeg is on PATH
  ffmpegPath = 'ffmpeg';
  console.log('ℹ️  ffmpeg-static not found, falling back to system ffmpeg.');
}

const { execFileSync } = require('child_process');

try {
  execFileSync(ffmpegPath, [
    '-y',               // overwrite output
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    outputFile,
  ], { stdio: 'inherit' });

  console.log(`\n✅ Combined video saved to ${outputFile}`);
} catch (err) {
  console.error('❌ ffmpeg failed:', err.message);
  process.exit(1);
} finally {
  // Clean up the temp list file
  if (fs.existsSync(listPath)) fs.unlinkSync(listPath);
}
