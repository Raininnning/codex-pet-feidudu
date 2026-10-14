const test = require('node:test');
const assert = require('node:assert/strict');
const { PetController } = require('../pet-controller.js');
const config = require('../assets/pets/pets.json');
const fs = require('node:fs');
const path = require('node:path');

test('肥嘟嘟只保留坐姿待机，站姿已移除', () => {
  const pet = new PetController(config);
  assert.equal(pet.asset, 'kangaroo-idle-sitting.svg');
  assert.equal(config.name, '肥嘟嘟');
  assert.deepEqual(config.idleOptions.map(p => p.id), ['sitting']);
  assert.throws(() => pet.setPose('standing'));
  assert.throws(() => pet.setPose('unknown'));
});

test('工具栏悬停覆盖思考，移开后恢复思考', () => {
  const pet = new PetController(config);
  pet.setWorking(true);
  pet.setHovered(true);
  assert.equal(pet.asset, 'kangaroo-hover.svg');
  pet.setHovered(false);
  assert.equal(pet.asset, 'kangaroo-thinking.svg');
});

test('悬停期间工作结束，移开后恢复所选待机姿势', () => {
  const pet = new PetController(config);
  pet.setPose('sitting');
  pet.setWorking(true);
  pet.setHovered(true);
  pet.setWorking(false);
  assert.equal(pet.asset, 'kangaroo-hover.svg');
  pet.setHovered(false);
  assert.equal(pet.asset, 'kangaroo-idle-sitting.svg');
});

test('待机每 800ms 循环，最后 200ms 闭眼', () => {
  let time = 0; const pet = new PetController(config, () => time);
  assert.match(pet.frame(), /-open\.png$/);
  time = 599; assert.match(pet.frame(), /-open\.png$/);
  time = 600; assert.match(pet.frame(), /-closed\.png$/);
  time = 799; assert.match(pet.frame(), /-closed\.png$/);
  time = 800; assert.match(pet.frame(), /-open\.png$/);
});

test('思考问号每 1000ms 切换', () => {
  let time = 0; const pet = new PetController(config, () => time); pet.setWorking(true);
  time = 999; assert.equal(pet.frame(), 'kangaroo-thinking-question.png');
  time = 1000; assert.equal(pet.frame(), 'kangaroo-thinking-plain.png');
  time = 2000; assert.equal(pet.frame(), 'kangaroo-thinking-question.png');
});

test('悬停依次播放六帧起身跳跃挥手，移开后恢复待机', () => {
  let time = 0; const pet = new PetController(config, () => time);
  pet.setHovered(true);
  assert.equal(config.hover.frames.length, 6);
  let elapsed = 0;
  for (let i = 0; i < 6; i++) {
    time = elapsed;
    assert.equal(pet.frame(), `kangaroo-hover-${i + 1}.png`);
    elapsed += config.hover.frameDurationsMs[i];
  }
  time = elapsed;
  assert.equal(pet.frame(), 'kangaroo-hover-1.png');
  pet.setHovered(false);
  assert.equal(pet.frame(), 'kangaroo-idle-sitting-open.png');
});

test('互动第一帧仍指定原始睁眼坐姿作为素材源', () => {
  const assets = path.resolve(__dirname, '../assets/pets');
  assert.equal(config.hover.firstFrameSource, 'kangaroo-idle-sitting-open.png');
  assert(fs.existsSync(path.join(assets, config.hover.firstFrameSource)));
});
