// Renders the source images that `npm run assets` (@capacitor/assets) turns
// into every iOS/Android icon and splash size. Source of truth is the logo in
// ../public/favicon.svg: eight dots around a centre dot. Re-run after a logo
// change:  node scripts/make-asset-sources.mjs && npm run assets
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "assets");
mkdirSync(out, { recursive: true });

const ICON_BG = "#f5f0e8"; // favicon background
const SPLASH_BG = "#fdf6ea"; // --background in ../../src/styles.css
const DOT = "#b85042";

// Logo geometry from favicon.svg (32×32 box): ring radius 10, dots r=1.8, centre r=3.
function dots(size, scale) {
  const c = size / 2;
  const k = (size * scale) / 20; // ring diameter (20 units) → size*scale px
  const ring = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    return `<circle cx="${c + Math.cos(a) * 10 * k}" cy="${c + Math.sin(a) * 10 * k}" r="${1.8 * k}"/>`;
  }).join("");
  return `<g fill="${DOT}">${ring}<circle cx="${c}" cy="${c}" r="${3 * k}"/></g>`;
}

const svg = (size, body, bg) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      (bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : "") +
      body +
      `</svg>`,
  );

const jobs = [
  // iOS + legacy Android icon: full-bleed square (iOS applies its own mask).
  ["icon-only.png", 1024, dots(1024, 0.6), ICON_BG],
  // Android adaptive icon: the launcher crops to the inner ~66%, keep dots inside.
  ["icon-foreground.png", 1024, dots(1024, 0.62), null],
  ["icon-background.png", 1024, "", ICON_BG],
  // Splash: logo small and centred; the 2732² canvas is cropped to the screen.
  ["splash.png", 2732, dots(2732, 0.2), SPLASH_BG],
  ["splash-dark.png", 2732, dots(2732, 0.2), SPLASH_BG],
];

for (const [name, size, body, bg] of jobs) {
  await sharp(svg(size, body, bg)).png().toFile(join(out, name));
  console.log("wrote", name);
}
