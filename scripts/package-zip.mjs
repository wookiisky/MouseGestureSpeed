import { createWriteStream } from 'fs';
import { access, mkdir, readFile, rm } from 'fs/promises';
import path from 'path';
import archiver from 'archiver';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const releaseDir = path.join(rootDir, 'release');

// Ensure a directory exists
async function ensureDir(dirPath) { // single-line comment
  try {
    await access(dirPath);
  } catch {
    await mkdir(dirPath, { recursive: true });
  }
}

// Read manifest name and version
async function getManifestMeta() { // single-line comment
  const manifestPath = path.join(rootDir, 'manifest.json');
  const raw = await readFile(manifestPath, 'utf8');
  const json = JSON.parse(raw);
  if (!json.name || !json.version) {
    throw new Error('manifest.json must include name and version');
  }
  return { name: json.name, version: json.version };
}

// Create zip from dist content
async function createZip(zipPath) { // single-line comment
  console.log('[pack] Creating zip -> ' + zipPath);

  const output = createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  const closePromise = new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
  });

  archive.on('warning', (err) => {
    console.warn('[pack] Warning:', err.message);
  });

  archive.on('error', (err) => {
    console.error('[pack] Archiver error:', err);
    throw err;
  });

  archive.pipe(output);

  // Add dist content at the root of the archive (no top-level folder)
  archive.directory(distDir + '/', false);

  await archive.finalize();
  await closePromise;

  console.log('[pack] Zip created, size(bytes): ' + archive.pointer());
}

async function run() { // single-line comment
  console.log('[pack] Start packaging');

  // Validate dist exists
  try {
    await access(distDir);
  } catch {
    console.error('[pack] Missing dist directory. Run "npm run build" first.');
    process.exitCode = 1;
    return;
  }

  await ensureDir(releaseDir);

  const { name, version } = await getManifestMeta();
  console.log('[pack] Using manifest name: ' + name);
  console.log('[pack] Using manifest version: ' + version);
  const base = `${name}-${version}`;
  const zipPath = path.join(releaseDir, `${base}.zip`);

  // Remove existing zip if present
  try {
    await rm(zipPath, { force: true });
  } catch {
    // ignore
  }

  console.log('[pack] Using dist: ' + distDir);
  console.log('[pack] Output file: ' + zipPath);

  await createZip(zipPath);

  console.log('[pack] Done');
}

run().catch((err) => {
  console.error('[pack] Failed:', err);
  process.exitCode = 1;
});
