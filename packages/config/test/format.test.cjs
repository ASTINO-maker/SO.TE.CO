const test = require("node:test");
const assert = require("node:assert/strict");
const {
  formatTnd,
  formatTndCompact,
  parseTndInput,
} = require("../dist/format.js");

test("parses Tunisian/French monetary input", () => {
  assert.equal(parseTndInput("1 234,500 TND"), 1234.5);
  assert.equal(parseTndInput("1.234,567"), 1234.567);
  assert.equal(parseTndInput("1,234.567"), 1234.567);
  assert.equal(parseTndInput("-1 200,250"), -1200.25);
});

test("uses compact operational TND display", () => {
  assert.equal(formatTndCompact(0), "0 TND");
  assert.equal(formatTndCompact(1234.5), "1 234,5 TND");
  assert.equal(formatTndCompact(1234.567), "1 234,567 TND");
});

test("keeps millimes for formal accounting documents", () => {
  assert.equal(formatTnd(0), "0,000 TND");
  assert.equal(formatTnd(1234.5), "1 234,500 TND");
});

test("never renders a rounded negative zero", () => {
  assert.equal(formatTnd(-0.0001), "0,000 TND");
  assert.equal(formatTndCompact(-0.0001), "0 TND");
});
