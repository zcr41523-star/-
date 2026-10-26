"""与 docs/core.js 使用同一配置与契约测试；时间单位为毫秒。"""
import json
import math
from pathlib import Path

CONFIG = json.loads((Path(__file__).resolve().parents[1] / 'docs/config.json').read_text())


class GestureGate:
    def __init__(self, config=None):
        self.c = config or CONFIG
        self.reset()

    def reset(self):
        self.name = self.start = self.last = self.release = None
        self.frames = 0
        self.locked = False
        self.progress = 0

    def clear_hold(self):
        self.name = self.start = None
        self.frames = 0
        self.progress = 0

    def update(self, name, score, now):
        if not math.isfinite(now) or not math.isfinite(score):
            self.reset()
            return None
        if self.last is not None and (now <= self.last or now-self.last > self.c['maxGapMs']):
            self.clear_hold()
            self.release = None
        self.last = now
        valid = name in self.c['gestures'] and score >= self.c['threshold']
        if not valid:
            self.clear_hold()
            if self.release is None:
                self.release = now
            if now-self.release >= self.c['releaseMs']:
                self.locked = False
            return None
        self.release = None
        if self.locked:
            self.clear_hold()
            return None
        if self.name != name:
            self.clear_hold()
            self.name, self.start = name, now
        self.frames += 1
        rule = self.c['gestures'][name]
        self.progress = min(1, (now-self.start)/rule['holdMs'])
        if self.progress >= 1 and self.frames >= self.c['minFrames']:
            self.locked = True
            return rule['action']
        return None
