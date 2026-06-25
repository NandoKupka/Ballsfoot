const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { appendSimulationBatch } = require("../scripts/append-50-matches.js");

test("each execution preserves existing simulations and appends the next 50 seeds", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ballsfoot-logs-"));
  const outputPath = path.join(directory, "50-partidas.json");
  const simulatedSeeds = [];
  const simulate = ({ matches, seedStart, includeMatchLogs }) => {
    simulatedSeeds.push({ matches, seedStart, includeMatchLogs });
    return {
      summary: { matches, seedStart },
      signals: [],
      teams: [],
      players: [],
      matchLogs: []
    };
  };

  appendSimulationBatch({ outputPath, simulate, generatedAt: "2026-06-25T00:00:00.000Z" });
  appendSimulationBatch({ outputPath, simulate, generatedAt: "2026-06-25T01:00:00.000Z" });

  const history = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.deepEqual(simulatedSeeds, [
    { matches: 50, seedStart: 1, includeMatchLogs: true },
    { matches: 50, seedStart: 51, includeMatchLogs: true }
  ]);
  assert.equal(history.totalMatches, 100);
  assert.equal(history.nextSeed, 101);
  assert.equal(history.batches.length, 2);
  assert.equal(history.batches[0].summary.seedStart, 1);
  assert.equal(history.batches[1].summary.seedStart, 51);
});

test("an existing single report becomes the first batch before appending", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ballsfoot-legacy-"));
  const outputPath = path.join(directory, "50-partidas.json");
  fs.writeFileSync(outputPath, JSON.stringify({
    summary: { matches: 50, seedStart: 1 },
    signals: [{ metric: "passesPerMatch", value: 120 }],
    teams: [{ id: "home" }],
    players: [{ playerId: "home-1" }]
  }));

  const result = appendSimulationBatch({
    outputPath,
    generatedAt: "2026-06-25T02:00:00.000Z",
    simulate: ({ matches, seedStart }) => ({
      summary: { matches, seedStart },
      signals: [],
      teams: [],
      players: []
    })
  });

  const history = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.equal(result.seedStart, 51);
  assert.equal(history.totalMatches, 100);
  assert.equal(history.nextSeed, 101);
  assert.equal(history.batches.length, 2);
  assert.deepEqual(history.batches[0].signals, [{ metric: "passesPerMatch", value: 120 }]);
  assert.deepEqual(history.batches[0].teams, [{ id: "home" }]);
  assert.deepEqual(history.batches[0].players, [{ playerId: "home-1" }]);
});
