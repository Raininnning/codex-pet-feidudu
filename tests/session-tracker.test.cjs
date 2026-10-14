const test = require('node:test');
const assert = require('node:assert/strict');
const { SessionTracker } = require('../session-tracker.js');
const event = type => JSON.stringify({ type: 'event_msg', payload: { type } }) + '\n';
test('一段会话结束时仍保留另一段正在工作的会话', () => {
  const tracker = new SessionTracker();
  tracker.feed('a', event('task_started')); tracker.feed('b', event('task_started'));
  tracker.feed('a', event('task_complete'));
  assert.equal(tracker.activeCount, 1);
  tracker.feed('b', event('turn_aborted'));
  assert.equal(tracker.activeCount, 0);
});
test('分段写入的 JSON 行只在完整之后改变状态', () => {
  const tracker = new SessionTracker(); const line = event('task_started');
  tracker.feed('a', line.slice(0, 12)); assert.equal(tracker.activeCount, 0);
  tracker.feed('a', line.slice(12)); assert.equal(tracker.activeCount, 1);
});
test('聊天正文含事件名也不会误触发', () => {
  const tracker = new SessionTracker();
  tracker.feed('a', JSON.stringify({ type: 'response_item', payload: { type: 'task_started' } }) + '\n');
  assert.equal(tracker.activeCount, 0);
});
