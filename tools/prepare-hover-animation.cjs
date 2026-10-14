// 将生成的单张六帧图拆分、统一画布并封装为 SVG 动画。
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
const root = path.resolve(__dirname, '..');

async function main() {
  const source = process.argv[2];
  if (!source) throw new Error('需要已检查的透明六帧源图路径');
  const folder = path.join(root, 'assets/pets');
  const browser = await chromium.launch({ headless: true });
  let frames;
  try {
    const page = await browser.newPage();
    await page.addScriptTag({ path: path.join(__dirname, 'frame-alignment.js') });
    frames = await page.evaluate(async ({ src, original }) => {
      const image = new Image(); image.src = src; await image.decode();
      if (image.width % 3 || image.height % 2) throw new Error('源图必须为等分的三列两行');
      const w = image.width / 3, h = image.height / 2, cells = [], bounds = [];
      for (let i = 0; i < 6; i++) {
        const cell = document.createElement('canvas'); cell.width = w; cell.height = h;
        const ctx = cell.getContext('2d'); ctx.drawImage(image, -(i % 3) * w, -Math.floor(i / 3) * h);
        const pixels = ctx.getImageData(0, 0, w, h), data = pixels.data;
        // 透明背景编码中可能留下 alpha=1 的无形噪点，仅清零这些像素。
        for (let p = 0; p < data.length; p += 4) {
          if (data[p + 3] <= 3) data[p] = data[p + 1] = data[p + 2] = data[p + 3] = 0;
        }
        ctx.putImageData(pixels, 0, 0);
        let left = w, top = h, right = -1, bottom = -1;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] <= 128) continue;
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
        if (right < left || left < 2 || top < 2 || right >= w - 2 || bottom >= h - 2) throw new Error(`帧 ${i + 1} 内容为空或触及边界`);
        // 禁止把生成器的半透明背景当作透明角色交付。
        for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) {
          if (data[(y * w + x) * 4 + 3] !== 0) throw new Error(`帧 ${i + 1} 背景未清理`);
        }
        cells.push(cell); bounds.push({ left, top, right, bottom });
      }
      const originalImage = new Image(); originalImage.src = original; await originalImage.decode();
      const originalCell = document.createElement('canvas');
      originalCell.width = originalImage.width; originalCell.height = originalImage.height;
      originalCell.getContext('2d').drawImage(originalImage, 0, 0);
      cells[0] = originalCell;
      return cells.map((cell, i) => {
        const metrics = PetFrameAlignment.measure(cell.getContext('2d').getImageData(0, 0, cell.width, cell.height).data, cell.width, cell.height);
        const alignment = PetFrameAlignment.fit(metrics, { height: 1100, centerX: 631.5, centerY: 670 });
        const canvas = document.createElement('canvas'); canvas.width = 1263; canvas.height = 1246;
        const ctx = canvas.getContext('2d'); ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(cell, alignment.x, alignment.y, cell.width * alignment.scale, cell.height * alignment.scale);
        return canvas.toDataURL('image/png').split(',')[1];
      });
    }, { src: 'data:image/png;base64,' + fs.readFileSync(source).toString('base64'),
      original: 'data:image/png;base64,' + fs.readFileSync(path.join(folder, 'kangaroo-idle-sitting-open.png')).toString('base64') });
  } finally { await browser.close(); }
  // 第一帧来自原图；只统一缩放与定位，不使用生成器重画这一帧。
  const backup = path.join(root, 'runtime/hover-before-20261014');
  fs.mkdirSync(backup, { recursive: true });
  for (const name of ['kangaroo-hover.png', 'kangaroo-hover.svg']) {
    if (!fs.existsSync(path.join(backup, name))) fs.copyFileSync(path.join(folder, name), path.join(backup, name));
  }
  fs.copyFileSync(source, path.join(folder, 'kangaroo-hover-sheet.png'));
  frames.forEach((data, i) => fs.writeFileSync(path.join(folder, `kangaroo-hover-${i + 1}.png`), Buffer.from(data, 'base64')));
  fs.copyFileSync(path.join(folder, 'kangaroo-hover-4.png'), path.join(folder, 'kangaroo-hover.png'));
  const config = JSON.parse(fs.readFileSync(path.join(folder, 'pets.json'))).hover;
  const keyTimes = [0];
  config.frameDurationsMs.forEach(ms => keyTimes.push(keyTimes.at(-1) + ms / config.cycleMs));
  const images = frames.map((data, i) => {
    const values = Array.from({ length: 6 }, (_, n) => n === i ? 1 : 0); values.push(i === 0 ? 1 : 0);
    return `<image width="1263" height="1246" href="data:image/png;base64,${data}" opacity="${i === 0 ? 1 : 0}"><animate attributeName="opacity" values="${values.join(';')}" keyTimes="${keyTimes.map(t => t.toFixed(8)).join(';')}" dur="${config.cycleMs}ms" calcMode="discrete" repeatCount="indefinite"/></image>`;
  });
  fs.writeFileSync(path.join(folder, 'kangaroo-hover.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="1263" height="1246" viewBox="0 0 1263 1246"><title>袋鼠起身轻跳挥手，六帧动画</title>${images.join('')}</svg>`);
  console.log('已生成六帧透明 PNG 和 1400ms SVG 动画');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
