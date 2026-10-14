const test = require('node:test');
const assert = require('node:assert/strict');
const { resetPosition } = require('../tools/reset-native-position.cjs');
test('只重置宠物位置缓存与停靠点，保留其他设置和宠物选择', () => {
  const input = { 'electron-avatar-overlay-bounds': { x: 500, byDisplayId: { old: {} } },
    'electron-avatar-overlay-open': true, 'electron-persisted-atom-state': {
      'unified-floating-composer-dock-position-v1': 'bottom-center',
      'selected-pet': 'custom:kangaroo-sitting', untouched: { value: 12 } }, other: [1, 2] };
  const result = resetPosition(input);
  assert.equal(result['electron-avatar-overlay-bounds'], undefined);
  assert.equal(result['electron-persisted-atom-state']['unified-floating-composer-dock-position-v1'], 'bottom-right');
  assert.equal(result['electron-persisted-atom-state']['selected-pet'], 'custom:kangaroo-sitting');
  assert.deepEqual(result.other, input.other);
  assert.deepEqual(result['electron-persisted-atom-state'].untouched, { value: 12 });
});
