export class GestureGate {
  constructor(config) {
    this.c = config;
    this.reset();
  }
  reset() {
    this.name = null;
    this.start = null;
    this.last = null;
    this.frames = 0;
    this.locked = false;
    this.release = null;
    this.progress = 0;
  }
  clearHold() {
    this.name = null;
    this.start = null;
    this.frames = 0;
    this.progress = 0;
  }
  update(name, score, now) {
    if (!Number.isFinite(now) || !Number.isFinite(score)) {
      this.reset();
      return null;
    }
    if (
      this.last !== null &&
      (now <= this.last || now - this.last > this.c.maxGapMs)
    ) {
      this.clearHold();
      this.release = null; // An unseen gap cannot prove a deliberate release.
    }
    this.last = now;
    const valid =
      Object.hasOwn(this.c.gestures, name) && score >= this.c.threshold;
    if (!valid) {
      this.clearHold();
      if (this.release === null) this.release = now;
      if (now - this.release >= this.c.releaseMs) this.locked = false;
      return null;
    }
    this.release = null;
    if (this.locked) {
      this.clearHold();
      return null;
    }
    if (this.name !== name) {
      this.clearHold();
      this.name = name;
      this.start = now;
    }
    this.frames++;
    const rule = this.c.gestures[name];
    this.progress = Math.min(1, (now - this.start) / rule.holdMs);
    if (this.progress >= 1 && this.frames >= this.c.minFrames) {
      this.locked = true;
      return rule.action;
    }
    return null;
  }
}
export function reduceState(state, action) {
  const next = { ...state };
  if (["HELP", "FALL_DETECTED"].includes(action)) next.alert = true;
  if (action === "CANCEL_ALERT") next.alert = false;
  if (action === "LIGHT_ON") next.light = true;
  if (action === "LIGHT_OFF") next.light = false;
  return next;
}
