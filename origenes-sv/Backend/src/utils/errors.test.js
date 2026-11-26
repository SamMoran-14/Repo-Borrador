import test from "node:test";
import assert from "node:assert/strict";
import { fail, handleError } from "./errors.js";

function fakeResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

test("fail crea un error con código HTTP y mensaje", () => {
  const error = fail(409, "Ya existe.");
  assert.equal(error.statusCode, 409);
  assert.equal(error.message, "Ya existe.");
});

test("handleError traduce errores de PostgreSQL y errores HTTP", () => {
  const cases = [
    [{ code: "23505" }, 409],
    [{ code: "23503" }, 400],
    [{ code: "23514" }, 400],
    [fail(404, "No existe."), 404]
  ];
  for (const [error, expectedStatus] of cases) {
    const res = fakeResponse();
    handleError(error, res);
    assert.equal(res.statusCode, expectedStatus);
    assert.ok(res.body.error);
  }
});

test("handleError no filtra detalles de errores inesperados", () => {
  const original = console.error;
  console.error = () => {};
  try {
    const res = fakeResponse();
    handleError(new Error("detalle interno secreto"), res);
    assert.equal(res.statusCode, 500);
    assert.doesNotMatch(res.body.error, /secreto/);
  } finally {
    console.error = original;
  }
});
