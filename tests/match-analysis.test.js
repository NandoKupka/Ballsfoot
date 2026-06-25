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

test("batch analysis can retain each match event log", () => {
  const report = simulateMatches({
    teams: TEAMS_CONFIG,
    matches: 2,
    seedStart: 300,
    includeMatchLogs: true
  });

  assert.equal(report.matchLogs.length, 2);
  assert.deepEqual(report.matchLogs.map((match) => match.seed), [300, 301]);
  report.matchLogs.forEach((match) => {
    assert.equal(match.score.length, 2);
    assert.ok(match.events.length > 0);
    assert.equal(match.events.at(-1).type, "fulltime");
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
  assert.ok(first.summary.oneTouchPassesPerMatch > 0);
  assert.ok(first.summary.oneTouchPassRate > 0);
  assert.ok(first.summary.oneTouchPassRate <= 14);
  assert.ok(first.summary.combinationsPerMatch > 0);
  assert.ok(first.summary.offsidesPerMatch >= 0);
  assert.ok(first.players.some((player) => player.passesAttempted > 0));
  assert.ok(first.players.some((player) => player.oneTouchPasses > 0));
  assert.ok(first.players.every((player) => player.attributes.physical >= 1));
  assert.ok(first.players.every((player) => {
    const values = Object.values(player.attributes);
    return player.overall === Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }));
  assert.ok(first.signals.some((signal) => signal.metric === "longPassRate"));
  assert.equal(
    first.signals.find((signal) => signal.metric === "oneTouchPassRate").status,
    "ok"
  );
  assert.equal(
    first.signals.find((signal) => signal.metric === "offsidesPerMatch").status,
    "ok"
  );
  assert.equal(
    first.signals.find((signal) => signal.metric === "goalsPerMatch").status,
    "ok"
  );
});
