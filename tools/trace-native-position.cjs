// 只记录与宠物定位相关的设置，不记录聊天、账号或其他应用数据。
const fs = require('fs');
const path = require('path');
const os = require('os');
const file = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), '.codex-global-state.json');
const folder = path.resolve(__dirname, '../runtime'); fs.mkdirSync(folder, { recursive: true });
const out = path.join(folder, 'native-position-trace.jsonl');
let previous = '';
const started = Date.now();
const duration = Math.min(300, Math.max(10, Number(process.argv[2]) || 120)) * 1000;
function sample() {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const b = data['electron-avatar-overlay-bounds'] || {};
    const snapshot = { open: data['electron-avatar-overlay-open'], x: b.x, y: b.y,
      placement: b.placement, freelyPositioned: b.isFreelyPositioned, snapPosition: b.snapPosition,
      displayBounds: b.displayBounds,
      dock: data['electron-persisted-atom-state']?.['unified-floating-composer-dock-position-v1'] };
    const text = JSON.stringify(snapshot);
    if (text !== previous) {
      previous = text;
      const row = JSON.stringify({ at: new Date().toISOString(), ...snapshot });
      fs.appendFileSync(out, row + '\n'); console.log(row);
    }
  } catch { /* 设置文件正在写入时，在下一次采样重试。 */ }
  if (Date.now() - started >= duration) { clearInterval(timer); console.log('TRACE_COMPLETE'); }
}
fs.writeFileSync(out, '');
const timer = setInterval(sample, 100);
sample();
