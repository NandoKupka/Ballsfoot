const test = require("node:test");
const assert = require("node:assert/strict");

const { TEAMS_CONFIG } = require("../src/config/teams.js");
const { simulateMatches } = require("../src/analytics/match-analysis.js");

test("team config stores exactly four attributes and no fixed overall", () => {
  const attributeNames = ["defense", "intelligence", "physical", "technique"];

  TEAMS_CONFIG.flatMap((team) => team.players).forEach((player) => {
    assert.equal(Object.hasOwn(player, "overall"), false);
    assert.deepEqual(Object.keys(player.attributes).sort(), attributeNames);
    assert.ok(Object.values(player.attributes).every((value) =>
      Number.isInteger(value) && value >= 1 && value <= 99
    ));
  });
});

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
  assert.ok(first.players.every((player) => player.attributes.physical >= 1));
  assert.ok(first.players.every((player) => {
    const values = Object.values(player.attributes);
    return player.overall === Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }));
  assert.ok(first.signals.some((signal) => signal.metric === "longPassRate"));
});
