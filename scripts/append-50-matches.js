const fs = require("node:fs");
const path = require("node:path");

const { TEAMS_CONFIG, MATCH_SETTINGS } = require("../src/config/teams.js");
const { simulateMatches } = require("../src/analytics/match-analysis.js");

const MATCHES_PER_BATCH = 50;
const DEFAULT_OUTPUT = path.resolve(__dirname, "../analysis/50-partidas.json");

function readHistory(outputPath) {
  if (!fs.existsSync(outputPath)) {
    return {
      formatVersion: 1,
      totalMatches: 0,
      nextSeed: 1,
      batches: []
    };
  }

  const existing = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  if (Array.isArray(existing.batches)) return existing;

  if (existing.summary && Number(existing.summary.matches) > 0) {
    const matches = Number(existing.summary.matches);
    const seedStart = Number(existing.summary.seedStart) || 1;
    return {
      formatVersion: 1,
      totalMatches: matches,
      nextSeed: seedStart + matches,
      batches: [{
        batchNumber: 1,
        generatedAt: null,
        ...existing
      }]
    };
  }

  throw new Error(`Unsupported simulation history format in ${outputPath}`);
}

function appendSimulationBatch(options = {}) {
  const outputPath = path.resolve(options.outputPath || DEFAULT_OUTPUT);
  const history = readHistory(outputPath);
  const seedStart = Number(history.nextSeed) || 1;
  const simulate = options.simulate || simulateMatches;
  const report = simulate({
    teams: options.teams || TEAMS_CONFIG,
    matches: MATCHES_PER_BATCH,
    seedStart,
    includeMatchLogs: true,
    matchClockRate: options.matchClockRate || MATCH_SETTINGS.matchClockRate
  });

  history.batches.push({
    batchNumber: history.batches.length + 1,
    generatedAt: options.generatedAt || new Date().toISOString(),
    ...report
  });
  history.totalMatches = history.batches.reduce(
    (total, batch) => total + Number(batch.summary?.matches || 0),
    0
  );
  history.nextSeed = seedStart + MATCHES_PER_BATCH;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(history, null, 2)}\n`);

  return {
    outputPath,
    batchNumber: history.batches.length,
    seedStart,
    seedEnd: seedStart + MATCHES_PER_BATCH - 1,
    totalMatches: history.totalMatches
  };
}

function readArgument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

if (require.main === module) {
  const result = appendSimulationBatch({
    outputPath: readArgument("output", DEFAULT_OUTPUT)
  });
  console.log(
    `Added matches with seeds ${result.seedStart}-${result.seedEnd}. ` +
    `History now contains ${result.totalMatches} matches at ${result.outputPath}`
  );
}

module.exports = {
  MATCHES_PER_BATCH,
  appendSimulationBatch,
  readHistory
};
