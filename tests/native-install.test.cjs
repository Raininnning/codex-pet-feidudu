const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

test('原生安装器可在隔离目录安装、读回并重复执行', () => {
  const { install } = require('../tools/install-native-pets.cjs');
  assert.equal(typeof install, 'function');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'feidudu-install-'));
  const result = install({ home });
  assert.equal(result.name, '肥嘟嘟');
  assert.equal(result.petId, 'custom:feidudu');
  const bytes = fs.readFileSync(path.join(result.target, 'spritesheet.png'));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), result.sha256);
  assert.equal(install({ home }).changed, false);
});

test('校验失败时不得写入目标宠物目录', () => {
  const { install } = require('../tools/install-native-pets.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feidudu-invalid-'));
  const home = path.join(root, 'home'), source = path.join(root, 'native-pets/feidudu');
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, 'pet.json'), JSON.stringify({ displayName: '肥嘟嘟', spriteVersionNumber: 2, spritesheetPath: 'spritesheet.png' }));
  fs.writeFileSync(path.join(source, 'validation.json'), JSON.stringify({ ok: false, sha256: 'invalid' }));
  fs.writeFileSync(path.join(source, 'spritesheet.png'), 'invalid');
  assert.throws(() => install({ root, home }), /校验/);
  assert.equal(fs.existsSync(path.join(home, 'pets')), false);
});
