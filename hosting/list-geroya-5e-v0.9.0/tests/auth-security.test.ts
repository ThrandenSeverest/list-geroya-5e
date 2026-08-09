import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, normalizeEmail, sessionCookie, verifyPassword } from "../app/appAuth";

test("passwords are salted and never stored as plaintext", async () => {
  const first = await hashPassword("correct horse battery staple");
  const second = await hashPassword("correct horse battery staple");
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert(!first.hash.includes("correct horse"));
  assert(await verifyPassword("correct horse battery staple", first.salt, first.hash));
  assert(!(await verifyPassword("wrong password", first.salt, first.hash)));
});

test("email normalization and session cookie security are stable", () => {
  assert.equal(normalizeEmail("  Hero@Example.COM "), "hero@example.com");
  const cookie = sessionCookie("secret-token");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
});
