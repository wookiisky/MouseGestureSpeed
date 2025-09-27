#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

// Resize icon with given size
async function resizeIcon(srcPath, size) { // (srcPath, size)
  const dst = path.join(process.cwd(), `icon${size}.png`);
  console.log(`[icons] Generating ${dst} from ${path.basename(srcPath)}...`);
  await sharp(srcPath)
    .resize(size, size, { fit: "cover", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(dst);
  console.log(`[icons] Wrote ${dst}`);
}

async function main() {
  console.log("[icons] Start generating icons...");

  const src = path.join(process.cwd(), "icon128.png");
  if (!fs.existsSync(src)) {
    console.error(`[icons] Source file not found: ${src}`);
    process.exit(1);
  }

  const sizes = [16, 24, 32, 48];
  for (const s of sizes) {
    // Generate one size at a time
    await resizeIcon(src, s);
  }

  console.log("[icons] All requested icons generated successfully.");
}

main().catch((err) => {
  console.error("[icons] Failed to generate icons:", err);
  process.exit(1);
});

