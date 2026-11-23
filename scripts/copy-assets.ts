import { cp, mkdir, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = process.cwd();
const TARGET_FONTS = resolve(ROOT, "public/fonts");

const CANDIDATE_FONT_DIRS = [
  resolve(ROOT, "node_modules/@excalidraw/excalidraw/dist/prod/fonts"),
  resolve(ROOT, "node_modules/@excalidraw/excalidraw/dist/dev/fonts"),
  resolve(ROOT, "node_modules/@excalidraw/excalidraw/dist/excalidraw-assets"),
];

async function dirExists(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isDirectory();
  } catch {
    return false;
  }
}

async function copyFonts(): Promise<void> {
  for (const src of CANDIDATE_FONT_DIRS) {
    if (await dirExists(src)) {
      await rm(TARGET_FONTS, { recursive: true, force: true });
      await mkdir(TARGET_FONTS, { recursive: true });
      await cp(src, TARGET_FONTS, { recursive: true });
      console.log(
        `[copy-assets] Font Excalidraw disalin dari ${src} -> ${TARGET_FONTS}`,
      );
      return;
    }
  }
  console.warn("[copy-assets] Direktori font Excalidraw belum ditemukan.");
}

await copyFonts();
