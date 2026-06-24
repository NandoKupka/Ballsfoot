# Simulation analysis

Run deterministic match batches through the same headless engine used by the browser:

```powershell
node scripts\analyze-matches.js --matches 100 --seed 1
```

Write the full JSON report to a file when comparing revisions:

```powershell
node scripts\analyze-matches.js --matches 500 --seed 1 --output analysis\baseline.json
```

The report includes:

- aggregate goals, shots, passes, completion, long-pass rate, and shot distance;
- team-level results;
- every player's attributes and accumulated match statistics;
- realism signals that highlight suspicious distributions.

Use the same match count and seed when comparing two code revisions. A changed result with identical inputs means simulation behavior changed, not sampling noise.
