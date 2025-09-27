import { cp, mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');

const normalizeScriptPath = (filePath) =>
  filePath.startsWith('dist/') ? filePath.slice(5) : filePath;

const writeManifest = async () => {
  const manifestPath = path.join(rootDir, 'manifest.json');
  const targetPath = path.join(distDir, 'manifest.json');
  const source = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(source);

  if (manifest.background?.service_worker) {
    manifest.background.service_worker = normalizeScriptPath(manifest.background.service_worker);
    manifest.background.type = 'module';
  }

  if (Array.isArray(manifest.content_scripts)) {
    manifest.content_scripts = manifest.content_scripts.map((script) => {
      if (Array.isArray(script.js)) {
        return { ...script, js: script.js.map((entry) => normalizeScriptPath(entry)) };
      }
      return script;
    });
  }

  await writeFile(targetPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log('Manifest copied to dist/manifest.json');
};

const copyStaticAssets = async () => {
  const staticFiles = ['options.html', 'options.css'];
  for (const filename of staticFiles) {
    const source = path.join(rootDir, filename);
    const target = path.join(distDir, filename);
    await cp(source, target, { force: true });
    console.log('Copied ' + filename);
  }

  await cp(path.join(rootDir, 'config'), path.join(distDir, 'config'), { recursive: true, force: true });
  console.log('Copied config directory');
};

const adjustOptionsHtml = async () => {
  const target = path.join(distDir, 'options.html');
  const html = await readFile(target, 'utf8');
  const replaced = html.replace('dist/options/index.js', 'options/index.js');
  await writeFile(target, replaced, 'utf8');
};

const run = async () => {
  await mkdir(distDir, { recursive: true });
  await writeManifest();
  await copyStaticAssets();
  await adjustOptionsHtml();
};

run().catch((error) => {
  console.error('Post-build step failed', error);
  process.exitCode = 1;
});

