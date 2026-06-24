const test = require("node:test");
const assert = require("node:assert/strict");

const { TEAMS_CONFIG } = require("../src/config/teams.js");
const { simulateMatches } = require("../src/analytics/match-analysis.js");

test("batch analysis produces deterministic team and player metrics", () => {
  const first = simulateMatches({
    teams: TEAMS_CONFIG,
    matches: 8,
    seedStart: 100
  });
  const second = simulateMatches({
    teams: TEAMS_CONFIG,
    matches: 8,
    seedStart: 100
  });

  assert.deepEqual(first, second);
  assert.equal(first.summary.matches, 8);
  assert.equal(first.teams.length, 2);
  assert.equal(first.players.length, 22);
  assert.ok(first.summary.passesPerMatch > 0);
  assert.ok(first.players.some((player) => player.passesAttempted > 0));
  assert.ok(first.players.every((player) => player.attributes.pace >= 5));
  assert.ok(first.signals.some((signal) => signal.metric === "longPassRate"));
});
