const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

function resetPosition(state) {
  const next = { ...state };
  delete next['electron-avatar-overlay-bounds'];
  next['electron-persisted-atom-state'] = {
    ...state['electron-persisted-atom-state'],
    'unified-floating-composer-dock-position-v1': 'bottom-right'
  };
  return next;
}
module.exports = { resetPosition };

if (require.main === module) {
  try {
    const file = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), '.codex-global-state.json');
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (process.argv.includes('--dry-run')) {
      console.log('验证通过：仅清理宠物历史位置，并将停靠点设为右下角；未修改文件。');
    } else {
      const count = execFileSync('powershell.exe', ['-NoProfile', '-Command',
        "@(Get-Process ChatGPT -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*OpenAI.Codex*' }).Count"], { encoding: 'utf8', windowsHide: true }).trim();
      if (Number(count) > 0) throw new Error('请先完全退出 Codex，再运行位置修复，避免旧坐标被写回。');
      const next = resetPosition(state);
      const folder = path.resolve(__dirname, '../runtime'); fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(folder, 'native-position-backup.json'), JSON.stringify({
        bounds: state['electron-avatar-overlay-bounds'],
        dock: state['electron-persisted-atom-state']?.['unified-floating-composer-dock-position-v1']
      }, null, 2));
      const temp = file + '.kangaroo-position-tmp';
      fs.writeFileSync(temp, JSON.stringify(next, null, 2)); fs.renameSync(temp, file);
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (saved['electron-avatar-overlay-bounds'] !== undefined ||
          saved['electron-persisted-atom-state']['unified-floating-composer-dock-position-v1'] !== 'bottom-right') {
        throw new Error('位置设置写入验证失败');
      }
      console.log('已备份并重置宠物位置。重新打开 Codex 后，默认停靠右下角。');
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
