// 将现有 PNG 帧排成当前 Codex 桌面客户端支持的 v2 精灵图。
const fs = require('fs');
const path = require('path');
const os = require('os');
const root = path.resolve(__dirname, '..');
const runtimeModules = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(runtimeModules, 'playwright'))); }

async function build() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.addScriptTag({ path: path.join(__dirname, 'frame-alignment.js') });
    for (const pose of ['sitting']) {
      const names = {
        open: `kangaroo-idle-${pose}-open.png`,
        closed: `kangaroo-idle-${pose}-closed.png`,
        question: 'kangaroo-thinking-question.png',
        plain: 'kangaroo-thinking-plain.png',
        ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`hover${i + 1}`, `kangaroo-hover-${i + 1}.png`])),
        hover1: 'kangaroo-idle-sitting-open.png'
      };
      const images = Object.fromEntries(Object.entries(names).map(([key, file]) => [key,
        'data:image/png;base64,' + fs.readFileSync(path.join(root, 'assets/pets', file)).toString('base64')]));
      const png = await page.evaluate(async images => {
        const bitmaps = {};
        for (const [key, src] of Object.entries(images)) {
          const image = new Image(); image.src = src; await image.decode(); bitmaps[key] = image;
        }
        const idle = ['open', 'closed', 'open', 'open', 'open', 'open', 'open', 'open'];
        const working = ['question', 'question', 'question', 'plain', 'plain', 'plain', 'question', 'plain'];
        // 原生行序：idle、right、left、waving、jumping、failed、waiting、running、review、两行 look。
        const rows = [idle, Array(8).fill('open'), Array(8).fill('open'), ['hover1', 'hover3', 'hover5', 'hover6'],
          ['hover1', 'hover2', 'hover3', 'hover4', 'hover5'], Array(8).fill('open'), idle, working, idle,
          Array(8).fill('open'), Array(8).fill('open')];
        const requiredFrames = [6, 8, 8, 4, 5, 8, 6, 6, 6, 8, 8];
        const canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 2288;
        const context = canvas.getContext('2d'); context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
        const cells = {};
        // 互动帧按透明度加权视觉重心对齐，不能用随手臂和尾巴变化的包围盒中心。
        for (const [name, bitmap] of Object.entries(bitmaps)) {
          const cell = document.createElement('canvas'); cell.width = 192; cell.height = 208;
          const painter = cell.getContext('2d'); painter.imageSmoothingQuality = 'high';
          const source = document.createElement('canvas'); source.width = bitmap.width; source.height = bitmap.height;
          const reader = source.getContext('2d'); reader.drawImage(bitmap, 0, 0);
          const pixels = reader.getImageData(0, 0, source.width, source.height).data;
          let left = source.width, top = source.height, right = -1, bottom = -1;
          for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
            if (pixels[(y * source.width + x) * 4 + 3] <= 128) continue;
            left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
          }
          if (right < left) throw new Error('宠物帧没有可见内容');
          if (name === 'hover1' && images.open === images.hover1) { cells[name] = cells.open; continue; }
          const isHover = name.startsWith('hover');
          let scale, x, y;
          if (isHover) {
            const openCell = cells.open;
            const anchor = PetFrameAlignment.measure(openCell.getContext('2d').getImageData(0, 0, 192, 208).data, 192, 208);
            const metrics = PetFrameAlignment.measure(pixels, bitmap.width, bitmap.height);
            const placement = PetFrameAlignment.fit(metrics, { height: 164, centerX: anchor.centerX, centerY: anchor.centerY });
            ({ scale, x, y } = placement);
          } else {
            scale = Math.min(180 / (right - left + 1), 164 / (bottom - top + 1));
            x = 96 - (left + right + 1) / 2 * scale;
            y = 193 - (bottom + 1) * scale;
          }
          painter.drawImage(bitmap, x, y, bitmap.width * scale, bitmap.height * scale);
          cells[name] = cell;
        }
        rows.forEach((frames, row) => frames.forEach((name, col) => {
          if (col >= requiredFrames[row]) return;
          context.drawImage(cells[name], col * 192, row * 208);
        }));
        return canvas.toDataURL('image/png').split(',')[1];
      }, images);
      const folder = path.join(root, 'native-pets', 'feidudu');
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(folder, 'spritesheet.png'), Buffer.from(png, 'base64'));
      fs.writeFileSync(path.join(folder, 'pet.json'), JSON.stringify({
        displayName: '肥嘟嘟',
        description: '圆肚子黄色袋鼠：坐姿待机眨眼、托腮思考、起身轻跳挥手互动。',
        spriteVersionNumber: 2,
        spritesheetPath: 'spritesheet.png'
      }, null, 2) + '\n');
      console.log('built ' + path.join(folder, 'spritesheet.png'));
    }
  } finally { await browser.close(); }
}
build().catch(error => { console.error(error); process.exitCode = 1; });
