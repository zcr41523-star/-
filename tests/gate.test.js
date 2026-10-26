import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { GestureGate, reduceState } from "../docs/core.js";
const config = JSON.parse(
  readFileSync(new URL("../docs/config.json", import.meta.url)),
);
const cases = JSON.parse(
  readFileSync(new URL("./gate_cases.json", import.meta.url)),
);
for (const c of cases)
  test(c.name, () => {
    const gate = new GestureGate({ ...config, ...c.config });
    const actions = [];
    for (const step of c.steps) {
      if (step === "reset") gate.reset();
      else {
        const a = gate.update(...step);
        if (a) actions.push(a);
      }
    }
    assert.deepEqual(actions, c.expected);
  });
test("state transitions", () => {
  let state = { alert: false, light: false };
  for (const a of ["FALL_DETECTED", "LIGHT_ON"]) state = reduceState(state, a);
  assert.deepEqual(state, { alert: true, light: true });
  state = reduceState(state, "CANCEL_ALERT");
  state = reduceState(state, "LIGHT_OFF");
  assert.deepEqual(state, { alert: false, light: false });
});
