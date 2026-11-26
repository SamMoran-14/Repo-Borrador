import test from "node:test";
import assert from "node:assert/strict";
import { requireManager } from "./requireManager.js";

function run(role) {
  const res = {
    statusCode: null,
    status(code) { this.statusCode = code; return this; },
    json() { return this; }
  };
  let passed = false;
  requireManager({ user: role ? { role } : undefined }, res, () => { passed = true; });
  return { passed, statusCode: res.statusCode };
}

test("ADMIN y MANAGER pasan", () => {
  assert.equal(run("ADMIN").passed, true);
  assert.equal(run("MANAGER").passed, true);
});

test("otros roles o sin usuario reciben 403", () => {
  for (const role of ["CASHIER", "WAITER", undefined]) {
    const result = run(role);
    assert.equal(result.passed, false);
    assert.equal(result.statusCode, 403);
  }
});
