const fs = require("node:fs");
const path = require("node:path");

const { TEAMS_CONFIG, MATCH_SETTINGS } = require("../src/config/teams.js");
const { simulateMatches } = require("../src/analytics/match-analysis.js");

function readArgument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const matches = Number(readArgument("matches", 100));
const seedStart = Number(readArgument("seed", 1));
const output = readArgument("output", "");
const report = simulateMatches({
  teams: TEAMS_CONFIG,
  matches,
  seedStart,
  matchClockRate: MATCH_SETTINGS.matchClockRate
});
const json = JSON.stringify(report, null, 2);

if (output) {
  const outputPath = path.resolve(output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${json}\n`);
  console.log(`Analysis written to ${outputPath}`);
} else {
  process.stdout.write(`${json}\n`);
}
