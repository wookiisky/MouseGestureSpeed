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

  // Normalize icons and action.default_icon in case they contain 'dist/'
  if (manifest.icons && typeof manifest.icons === 'object') {
    for (const k of Object.keys(manifest.icons)) {
      const v = manifest.icons[k];
      if (typeof v === 'string') {
        manifest.icons[k] = normalizeScriptPath(v);
      }
    }
  }
  if (manifest.action && manifest.action.default_icon && typeof manifest.action.default_icon === 'object') {
    for (const k of Object.keys(manifest.action.default_icon)) {
      const v = manifest.action.default_icon[k];
      if (typeof v === 'string') {
        manifest.action.default_icon[k] = normalizeScriptPath(v);
      }
    }
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

// Copy icon files to dist root
const copyIcons = async () => { // single-line comment
  const icons = ['icon16.png', 'icon24.png', 'icon32.png', 'icon48.png', 'icon128.png'];
  for (const icon of icons) {
    const source = path.join(rootDir, icon);
    const target = path.join(distDir, icon);
    try {
      await cp(source, target, { force: true });
      console.log('Copied icon ' + icon);
    } catch (err) {
      console.warn('Skip missing icon ' + icon);
    }
  }
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
  await copyIcons();
  await adjustOptionsHtml();
};

run().catch((error) => {
  console.error('Post-build step failed', error);
  process.exitCode = 1;
});
