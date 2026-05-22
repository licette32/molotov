// Generates the Molotov PWA / favicon set from an inline SVG.
// Run with: pnpm --filter @molotov/web icons:gen
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

const BG = "#000000"; // molotov bg
const FG = "#F5F4ED"; // molotov off-white (molotov-overrides §2)

// Editorial serif "M". Fraunces is the intended display face; on the build
// machine it falls back to Georgia / Times serif, which is Fraunces' own
// fallback chain. The glyph fills ~60% of the square, centered.
function svg(size) {
  const fontSize = Math.round(size * 0.72);
  // Nudge the baseline so the cap-height M sits optically centered.
  const y = Math.round(size * 0.5 + fontSize * 0.35);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <text x="50%" y="${y}" text-anchor="middle"
        font-family="Fraunces, Georgia, 'Times New Roman', serif"
        font-weight="500" font-size="${fontSize}" fill="${FG}">M</text>
</svg>`;
}

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "favicon-32.png", size: 32 },
  { name: "favicon-16.png", size: 16 },
];

await mkdir(publicDir, { recursive: true });

for (const { name, size } of targets) {
  const out = join(publicDir, name);
  await sharp(Buffer.from(svg(size)))
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log("✓", name, `(${size}x${size})`);
}
