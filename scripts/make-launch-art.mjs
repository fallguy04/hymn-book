#!/usr/bin/env node
/**
 * Launcher icons and iOS startup images, from the original icon art.
 *
 * The source art is not in the working tree — it is 4MB and was trimmed from
 * the deploy long ago — but it is still in git history, so this recovers it
 * from the object store rather than asking anyone to find a file. Re-running
 * the script is always safe: same input, same output.
 *
 * Two problems this exists to fix:
 *  - Android draws its splash icon at up to ~288dp. On a 3× screen that is
 *    864px, upscaled from our 512px icon — the "blurry large logo". The
 *    1024px maskable icon gives it real pixels.
 *  - iOS shows a plain white sheet on PWA launch unless it is given
 *    apple-touch-startup-image PNGs, one per device class, matched by media
 *    query. These are generated on the art's own background colour (sampled
 *    from its corner pixel) so the tile sits on a seamless field.
 *
 * PNGs are palette-quantised: the art is flat colour, and this takes the
 * 1024px icon from 1.3MB (raw sips output) to well under 200KB.
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

/** public/icons/maskable-icon.png as first committed, before the size trim. */
const SOURCE_BLOB = "8acb0ae87cad394d9178d47e94c598ed96c1d53c";

const art = execSync(`git cat-file blob ${SOURCE_BLOB}`, { maxBuffer: 32 * 1024 * 1024 });

const png = (img) => img.png({ palette: true, quality: 90, compressionLevel: 9 });

/** iPhone classes still in common use; device points × pixel ratio. */
const SPLASHES = [
  [750, 1334, "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)"],
  [828, 1792, "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)"],
  [1125, 2436, "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)"],
  [1170, 2532, "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)"],
  [1179, 2556, "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)"],
  [1206, 2622, "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3)"],
  [1290, 2796, "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)"],
  [1320, 2868, "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3)"],
];

const icons = async () => {
  for (const [size, name] of [
    [1024, "maskable-1024.png"],
    [512, "maskable-512.png"],
    [1024, "icon-1024.png"],
    [512, "icon-512.png"],
    [192, "icon-192.png"],
    [180, "apple-touch-icon.png"],
  ]) {
    const out = await png(sharp(art).resize(size, size)).toBuffer();
    writeFileSync(`public/icons/${name}`, out);
    console.log(`  icons/${name}`.padEnd(30), `${Math.round(out.length / 1024)}KB`);
  }
};

/**
 * The art is a blue tile floating on its own pale field, and that field does
 * not run to the file's edge at one flat colour — composited whole onto any
 * canvas it shows as a faint square. So find the tile, crop to it, and paint
 * the canvas in the colour sampled right beside the tile, where its soft
 * edge actually blends.
 */
const findTile = async () => {
  const { data, info } = await sharp(art).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let left = width, right = 0, top = height, bottom = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const [r, , b] = [data[i], data[i + 1], data[i + 2]];
      // The tile is the only saturated thing in the image.
      if (b > r + 24 && b > 96) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  // A little air so the tile's soft edge survives the crop.
  const pad = Math.round((right - left) * 0.02);
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad);
  bottom = Math.min(height - 1, bottom + pad);

  const sampleX = Math.max(0, left - 3 * pad);
  const sampleY = Math.round((top + bottom) / 2);
  const i = (sampleY * width + sampleX) * channels;
  return {
    region: { left, top, width: right - left + 1, height: bottom - top + 1 },
    field: { r: data[i], g: data[i + 1], b: data[i + 2] },
  };
};

const splashes = async () => {
  mkdirSync("public/splash", { recursive: true });

  const { region, field } = await findTile();
  console.log(
    `  tile ${region.width}×${region.height} at (${region.left}, ${region.top}), field rgb(${field.r}, ${field.g}, ${field.b})`,
  );

  for (const [w, h, media] of SPLASHES) {
    // Tile at 40% of screen width, a touch above optical centre — where the
    // OS itself puts a launch icon.
    const tileWidth = Math.round(w * 0.4);
    const tile = await sharp(art).extract(region).resize(tileWidth, tileWidth).png().toBuffer();
    const out = await png(
      sharp({ create: { width: w, height: h, channels: 3, background: field } }).composite([
        { input: tile, left: Math.round((w - tileWidth) / 2), top: Math.round(h * 0.42 - tileWidth / 2) },
      ]),
    ).toBuffer();
    writeFileSync(`public/splash/${w}x${h}.png`, out);
    console.log(`  splash/${w}x${h}.png`.padEnd(30), `${Math.round(out.length / 1024)}KB  ${media}`);
  }
};

/**
 * The tile alone, for the in-app launch curtain.
 *
 * Two things the raw detection box gets wrong. It is not square — the book's
 * shadow reads as tile a little further down than up, so 1084×1114 forced
 * into a square squashed the art by 3%, just enough for the book to look
 * subtly wrong. And the tile's own rounded corners leave the field colour in
 * the PNG's corners, which no amount of over-scaling in CSS cleanly hides.
 * So: square the box around its centre first, then bake the corners away
 * with a rounded-rectangle alpha mask drawn slightly inside the tile edge.
 */
const tile = async () => {
  const { region } = await findTile();
  const meta = await sharp(art).metadata();

  const side = Math.max(region.width, region.height);
  const cx = region.left + region.width / 2;
  const cy = region.top + region.height / 2;
  const square = {
    left: Math.max(0, Math.min(meta.width - side, Math.round(cx - side / 2))),
    top: Math.max(0, Math.min(meta.height - side, Math.round(cy - side / 2))),
    width: side,
    height: side,
  };

  const SIZE = 256;
  const inset = Math.round(SIZE * 0.02);
  const radius = Math.round(SIZE * 0.21);
  const mask = Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}"><rect x="${inset}" y="${inset}" width="${SIZE - 2 * inset}" height="${SIZE - 2 * inset}" rx="${radius}" fill="#fff"/></svg>`,
  );

  const out = await png(
    sharp(await sharp(art).extract(square).resize(SIZE, SIZE).png().toBuffer()).composite([
      { input: mask, blend: "dest-in" },
    ]),
  ).toBuffer();
  writeFileSync("public/icons/tile-256.png", out);
  console.log(`  icons/tile-256.png`.padEnd(30), `${Math.round(out.length / 1024)}KB`);
};

await icons();
await splashes();
await tile();
console.log("done");
