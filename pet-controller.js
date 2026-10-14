(function (root) {
  class PetController {
    constructor(config, now = () => Date.now()) {
      this.config = config; this.now = now; this.pose = config.defaultIdle;
      this.working = false; this.hovered = false; this.since = now();
    }
    get state() { return this.hovered ? 'hover' : this.working ? 'thinking' : this.pose; }
    get definition() { return this.config[this.state] || this.config.idleOptions.find(p => p.id === this.pose); }
    get asset() { return this.definition.svg; }
    update(change) { const before = this.state; change(); if (before !== this.state) this.since = this.now(); }
    setPose(pose) {
      if (!this.config.idleOptions.some(p => p.id === pose)) throw new Error('未知待机姿势');
      this.update(() => { this.pose = pose; });
    }
    setWorking(value) { this.update(() => { this.working = Boolean(value); }); }
    setHovered(value) { this.update(() => { this.hovered = Boolean(value); }); }
    frame() {
      const d = this.definition;
      if (!d.frames) return d.png;
      let time = Math.max(0, this.now() - this.since) % d.cycleMs;
      for (let i = 0; i < d.frames.length; i++) {
        if (time < d.frameDurationsMs[i]) return d.frames[i];
        time -= d.frameDurationsMs[i];
      }
      return d.frames[0];
    }
  }
  if (typeof module !== 'undefined') module.exports = { PetController };
  else root.PetController = PetController;
})(globalThis);
