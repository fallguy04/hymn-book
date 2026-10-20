// The spring that moves every sheet. lib/spring.ts has no runtime imports, so
// Node loads it directly; only the pure integrator is tested here (the frame
// loop is the same maths driven by requestAnimationFrame).

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { AWAY, RISE, stepSpring } from "../lib/spring.ts";

/** Run a spring at a steady frame rate for `seconds`, recording every position. */
function run(from, to, velocity, feel, seconds, frame = 1 / 60) {
  let s = { x: from, v: velocity };
  const xs = [s.x];
  for (let t = 0; t < seconds; t += frame) {
    s = stepSpring(s, to, feel, frame);
    xs.push(s.x);
  }
  return { final: s, xs };
}

describe("stepSpring", () => {
  test("settles at the target", () => {
    for (const feel of [RISE, AWAY]) {
      const { final } = run(500, 0, 0, feel, 3);
      assert.ok(Math.abs(final.x) < 0.01, `x=${final.x}`);
      assert.ok(Math.abs(final.v) < 0.1, `v=${final.v}`);
    }
  });

  test("critically damped never overshoots; the rise overshoots a little and lands", () => {
    const away = run(0, 500, 0, AWAY, 2).xs;
    assert.ok(away.every((x) => x <= 500 + 1e-6), "AWAY went past its target");

    const rise = run(444, 0, 0, RISE, 2).xs;
    const lowest = Math.min(...rise);
    assert.ok(lowest < 0, "RISE should overshoot slightly");
    assert.ok(lowest > -0.02 * 444, `RISE overshot too far: ${lowest}`);
  });

  test("honours the initial velocity", () => {
    const still = run(100, 0, 0, AWAY, 0.1).final.x;
    const pushed = run(100, 0, 2000, AWAY, 0.1).final.x;
    assert.ok(pushed > still, "a push away from the target should leave it further out");
    // The very next instant moves in the direction of the velocity.
    const tiny = stepSpring({ x: 0, v: 3000 }, 0, AWAY, 1 / 240);
    assert.ok(tiny.x > 0);
    const back = stepSpring({ x: 0, v: -3000 }, 0, AWAY, 1 / 240);
    assert.ok(back.x < 0);
  });

  test("a flick carries further than a drop", () => {
    const drop = run(100, 600, 0, AWAY, 0.15).final.x;
    const flick = run(100, 600, 3000, AWAY, 0.15).final.x;
    assert.ok(flick > drop);
  });

  test("a huge dt gives a finite answer, same as many small ones", () => {
    for (const dt of [0.5, 2, 30, 1000]) {
      const s = stepSpring({ x: 500, v: -4000 }, 0, RISE, dt);
      assert.ok(Number.isFinite(s.x) && Number.isFinite(s.v), `dt=${dt}`);
    }
    const big = stepSpring({ x: 500, v: 0 }, 0, AWAY, 0.4);
    const small = run(500, 0, 0, AWAY, 0.4, 1 / 240).final;
    assert.ok(Math.abs(big.x - small.x) < 1, `${big.x} vs ${small.x}`);
  });

  test("zero or negative dt changes nothing", () => {
    assert.deepEqual(stepSpring({ x: 7, v: 9 }, 0, AWAY, 0), { x: 7, v: 9 });
    assert.deepEqual(stepSpring({ x: 7, v: 9 }, 0, AWAY, -1), { x: 7, v: 9 });
  });
});
