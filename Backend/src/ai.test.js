const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeComplaint } = require("./ai");

test("classifies, summarizes, and prioritizes complaint descriptions", () => {
  assert.deepEqual(analyzeComplaint("Urgent: exposed wire near the power socket."), {
    category: "Electrical",
    summary: "Urgent: exposed wire near the power socket.",
    priority: "High"
  });
});

test("summaries remain short for long descriptions", () => {
  const result = analyzeComplaint(`${"A broken classroom fan needs repair, ".repeat(10)}and it affects classes.`);
  assert.ok(result.summary.length <= 160);
  assert.ok(result.summary.endsWith("..."));
  assert.equal(result.priority, "Medium");
});

test("classifies a non-working ceiling fan as electrical and medium priority", () => {
  const result = analyzeComplaint("The ceiling fans in Lab 2 are not working during afternoon classes.");
  assert.equal(result.category, "Electrical");
  assert.equal(result.priority, "Medium");
});
