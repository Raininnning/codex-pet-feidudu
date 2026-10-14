const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { StringDecoder } = require('string_decoder');
const { PetController } = require('./pet-controller');
const { SessionTracker } = require('./session-tracker');
const folder = __dirname;
const runtime = path.join(folder, 'runtime');
fs.mkdirSync(runtime, { recursive: true });
const config = JSON.parse(fs.readFileSync(path.join(folder, 'assets/pets/pets.json'), 'utf8'));
const pet = new PetController(config);
const tracker = new SessionTracker();
const offsets = new Map();
let connected = false;
const prefsPath = path.join(runtime, 'preferences.json');
try { pet.setPose(JSON.parse(fs.readFileSync(prefsPath, 'utf8')).pose); } catch {}
const sessionsRoot = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'sessions');
function scan() {
  try {
    connected = fs.existsSync(sessionsRoot);
    const cutoff = Date.now() - 48 * 3600000;
    const files = fs.readdirSync(sessionsRoot, { recursive: true }).filter(p => p.endsWith('.jsonl'));
    for (const name of files) {
      const file = path.join(sessionsRoot, name); const stat = fs.statSync(file);
      if (stat.mtimeMs < cutoff) { if (tracker.sessions.has(file)) tracker.sessions.delete(file); continue; }
      let cursor = offsets.get(file);
      if (!cursor || cursor.offset > stat.size) {
        cursor = { offset: 0, decoder: new StringDecoder('utf8') };
        offsets.set(file, cursor); tracker.sessions.delete(file);
      }
      if (cursor.offset === stat.size) continue;
      const fd = fs.openSync(file, 'r');
      try {
        while (cursor.offset < stat.size) {
          const buffer = Buffer.alloc(Math.min(256 * 1024, stat.size - cursor.offset));
          const count = fs.readSync(fd, buffer, 0, buffer.length, cursor.offset);
          if (!count) break;
          cursor.offset += count; tracker.feed(file, cursor.decoder.write(buffer.subarray(0, count)));
        }
      } finally { fs.closeSync(fd); }
    }
    pet.setWorking(tracker.activeCount > 0);
  } catch { connected = false; }
}
if (!process.argv.includes('--test')) { scan(); setInterval(scan, 1000).unref(); }
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET' && req.url === '/state') {
    res.end(JSON.stringify({ state: pet.state, pose: pet.pose, frame: pet.frame(), working: pet.working,
      connected, activeCount: tracker.activeCount })); return;
  }
  if (req.method !== 'POST' || req.url !== '/control') { res.writeHead(404); res.end('{}'); return; }
  let data = ''; req.on('data', chunk => { data += chunk; if (data.length > 2048) req.destroy(); });
  req.on('end', () => {
    try {
      const command = JSON.parse(data);
      if (typeof command.hovered === 'boolean') pet.setHovered(command.hovered);
      if (command.reset === true) {
        for (const session of tracker.sessions.values()) session.active = false;
        pet.setWorking(false);
      }
      if (command.pose) {
        pet.setPose(command.pose); fs.writeFileSync(prefsPath, JSON.stringify({ pose: pet.pose }));
      }
      if (process.argv.includes('--test') && typeof command.working === 'boolean') pet.setWorking(command.working);
      res.end('{}');
    } catch { res.writeHead(400); res.end('{"error":"invalid control"}'); }
  });
});
server.listen(0, '127.0.0.1', () => {
  const info = JSON.stringify({ url: `http://127.0.0.1:${server.address().port}`, pid: process.pid });
  fs.writeFileSync(path.join(runtime, 'connection.json'), info);
  console.log(info);
});
