const fs = require('node:fs');
const path = require('node:path');

const sharp = require('sharp');

const repoRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(repoRoot, 'assets');
const sourcePath = path.join(assetsDir, 'tray-icon.svg');

async function renderPng(svg, size, outputFile) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(assetsDir, outputFile));

  console.log(`Generated ${outputFile} at ${size}x${size}`);
}

const sourceSvg = fs.readFileSync(sourcePath, 'utf8');

if (!sourceSvg.includes('currentColor')) {
  throw new Error('Expected tray-icon.svg to use currentColor for monochrome variant generation.');
}

const blackSvg = sourceSvg.replace(/currentColor/g, '#000000');
const whiteSvg = sourceSvg.replace(/currentColor/g, '#FFFFFF');

async function main() {
  for (const [name, svg] of [
    ['tray-iconTemplate', blackSvg],
    ['tray-icon-light', blackSvg],
    ['tray-icon-dark', whiteSvg],
  ]) {
    await renderPng(svg, 18, `${name}.png`);
    await renderPng(svg, 36, `${name}@2x.png`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
