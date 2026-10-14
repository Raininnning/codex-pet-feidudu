class SessionTracker {
  constructor() { this.sessions = new Map(); }
  feed(key, chunk) {
    const session = this.sessions.get(key) || { pending: '', active: false };
    const lines = (session.pending + chunk).split('\n'); session.pending = lines.pop();
    for (const line of lines) {
      if (!line.includes('event_msg')) continue;
      try {
        const event = JSON.parse(line);
        if (event.type !== 'event_msg') continue;
        const type = event.payload?.type;
        if (type === 'task_started') session.active = true;
        if (['task_complete', 'turn_aborted', 'task_aborted', 'session_end'].includes(type)) session.active = false;
      } catch { /* 尚未形成有效事件的记录不改变状态。 */ }
    }
    this.sessions.set(key, session);
  }
  get activeCount() { return [...this.sessions.values()].filter(s => s.active).length; }
}
module.exports = { SessionTracker };
