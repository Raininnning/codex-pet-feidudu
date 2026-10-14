// 安装已验证的肥嘟嘟原生宠物；不修改客户端程序，不上传账户数据。
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

function install({ root = path.resolve(__dirname, '..'), home = process.env.CODEX_HOME || path.join(os.homedir(), '.codex') } = {}) {
  const source = path.join(root, 'native-pets', 'feidudu');
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'pet.json'), 'utf8'));
  const validation = JSON.parse(fs.readFileSync(path.join(source, 'validation.json'), 'utf8'));
  const image = fs.readFileSync(path.join(source, 'spritesheet.png'));
  const sha256 = crypto.createHash('sha256').update(image).digest('hex');
  if (manifest.displayName !== '肥嘟嘟' || manifest.spriteVersionNumber !== 2 || manifest.spritesheetPath !== 'spritesheet.png') throw new Error('宠物描述与发布格式不符');
  if (!validation.ok || validation.sha256 !== sha256) throw new Error('精灵图校验报告缺失或内容已改变，停止安装');
  const pets = path.resolve(home, 'pets'), target = path.join(pets, 'feidudu');
  fs.mkdirSync(pets, { recursive: true });
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error('拒绝覆盖符号链接');
  const files = ['pet.json', 'spritesheet.png'];
  const identical = files.every(file => fs.existsSync(path.join(target, file)) && fs.readFileSync(path.join(target, file)).equals(fs.readFileSync(path.join(source, file))));
  if (!identical) {
    if (fs.existsSync(target)) {
      const backup = path.resolve(home, 'pet-backups', 'feidudu-' + Date.now());
      fs.mkdirSync(backup, { recursive: true });
      for (const file of files) if (fs.existsSync(path.join(target, file))) fs.copyFileSync(path.join(target, file), path.join(backup, file));
    }
    fs.mkdirSync(target, { recursive: true });
    for (const file of files) {
      const temporary = path.join(target, file + '.' + process.pid + '.tmp');
      fs.copyFileSync(path.join(source, file), temporary);
      fs.renameSync(temporary, path.join(target, file));
    }
  }
  for (const file of files) if (!fs.readFileSync(path.join(target, file)).equals(fs.readFileSync(path.join(source, file)))) throw new Error('安装读回不一致');
  return { name: manifest.displayName, petId: 'custom:feidudu', target, sha256, changed: !identical };
}
module.exports = { install };
if (require.main === module) {
  try { console.log(JSON.stringify(install(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
