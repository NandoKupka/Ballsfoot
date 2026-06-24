# Ballsfoot Context

## Project Shape

Ballsfoot is a local, browser-only football tactics simulator with a directly opened `index.html` entry point and plain JavaScript modules under `src/`. The app has no build step, package manager, backend, or persistence layer.

The current product surface is a live match simulator: two teams line up in a 4-4-2, the ball moves between players, the score and clock advance, and important actions are shown in a timeline with copyable hidden logs.

## Core Domain

- Match: a simulated football game with two periods, stoppage time, score, state transitions, and restarts.
- Team: one side of the match. Each team has identity, colors, venue, direction of attack, formation, players, and score.
- Player: a member of a team with a stable shirt number, four configured attributes, a derived overall rating, ordered preferred positions, and a current on-field role.
- Player attribute: one of the four stable capabilities used to resolve actions: physical, technique, intelligence, or defense.
- Overall: the rounded arithmetic mean of physical, technique, intelligence, and defense. It is calculated by the engine and is never configured directly.
- Player match statistics: observed production during one match, such as touches, distance covered, passes, shots, goals, interceptions, recoveries, carries, and saves.
- Preferred position: a role a player is suited to occupy, ordered from strongest preference to weaker alternatives.
- Lineup assignment: the allocation of players to formation slots. Players with a higher derived overall claim compatible preferred slots first; unassigned players fill the remaining slots.
- Formation: a set of tactical slots, each defined by an on-field role and base position. The only implemented formation is `4-4-2`.
- Possession: the current player carrying the ball. Many tactical calculations are centered on the possession holder.
- Ball state: the ball's current lifecycle state: controlled by a player, travelling toward a target, loose after a deflection, or out of play. A travelling or loose ball has no possession holder.
- Simulation time: continuous elapsed time advanced through fixed internal steps. Match-clock time is derived from simulation time, while playback speed controls how quickly simulation time is consumed.
- Tactical context: a derived snapshot for one team: phase, intent, pressure zone, ball side, line centers, mentality, and defensive line.
- Support option: a nearby teammate positioned to give the possession holder a safe short pass and form a small triangle around the ball.
- First-time pass: an immediate redirection of a received ball without establishing a new controlled-possession phase. Intelligence governs whether the player recognizes the option in time; technique governs execution.
- Wall pass: a first-time return pass to the teammate who supplied the ball, allowing that teammate to continue the attacking move.
- Cover shadow: a defender positioned between the possession holder and a likely receiver to close a passing lane without abandoning the team block.
- Fullback cover: the same-side center back's responsibility to protect the channel behind an advanced fullback.
- Pressure: a normalized measure of how strongly nearby opponents are affecting the player on the ball or a receiving option.
- Space score: a normalized measure of how useful or open a player's receiving position is.
- Event log: structured match events with fan-facing copy and analytics data. The visible timeline shows the current match, while the hidden session log accumulates every match played until the page is reloaded.
- Match event: one recorded football action or match-state change, with human copy, structured event data, tactical context, and export metadata.
- Telemetry export: machine-readable match log data used to inspect patterns across a simulated match.
- Realism signal: a derived metric from match events that points to possible simulation tuning, such as pass completion, shot volume, turnover volume, pressure, and pass directness.
- Simulation report: an aggregate of seeded matches containing team results, player production, playing-style metrics, and realism signals.

## Match State

`MatchEngine.state` uses these states:

- `pre`: match is ready but not running.
- `playing`: action and movement loops are active.
- `paused`: match is paused by the user.
- `goalPause`: a goal modal is open and kickoff waits for confirmation.
- `halftime`: first period is complete and the second period can start.
- `finished`: full time is complete and reset is available.

The match clock is derived from continuous elapsed match time, the current period, and seeded stoppage time for each half. The visual clock shows first-half minutes as `00'` through `45+N'` and second-half minutes as `45'` through `90+N'`.

## Tactical Model

The simulator is rule-weighted rather than physics-accurate. It uses deterministic geometry, seeded random weighted choices, and fixed simulation steps to create plausible football sequences.

Important tactical concepts:

- Defensive line height and compactness keep the team shape coherent.
- Build-up rules prefer center backs, fullbacks, the holding midfielder, and playmaker options.
- Passing and receiving use technique for execution and intelligence for option selection, timing, and positioning.
- Final-third actions can become through balls or crosses before a shot.
- Offside is modeled using attacking progress, defensive line progress, ball position, and eligibility.
- Running speed and acceleration use physical; carries and dribbles combine physical and technique.
- Off-ball movement, decision speed, support selection, and composure use intelligence.
- Marking, pressure, lane closure, and interceptions combine defense and intelligence.
- Shots combine technique and intelligence. Goalkeepers combine defense and intelligence when attempting saves.
- Goalkeepers normally stay close to goal and advance only slightly with build-up. They close down a carrier only on a clear one-on-one and are always constrained to their own penalty area.
- Counter-attacks and post-loss press are temporary team states after possession changes.

## UI Model

The page has three main columns:

- Home team panel.
- Match panel with scorebar, field, controls, speed slider, status, and timeline.
- Away team panel.

The field uses percentage coordinates from `0` to `100`. Player tokens and the ball are positioned by CSS custom properties or direct percentage styles. The app exposes the live `BrowserGameAdapter` instance at `window.tacticsGame`; its headless motor is available at `window.tacticsGame.engine`.

## Code Organization

Runtime behavior is organized by responsibility:

- `src/config/teams.js`: editable team, player, color, role, and four-attribute data. Overall is not stored here.
- `src/domain/match-engine.js`: headless match state, fixed-step timing, movement, decisions, ball lifecycle, scoring, statistics, and domain events.
- `src/analytics/match-analysis.js`: seeded batch simulation and aggregate reports.
- `src/ui/browser-game-adapter.js`: DOM, controls, animation loop, rendering, timeline, modal, and exports.
- `scripts/analyze-matches.js`: command-line entry point for automated simulation analysis.

The CSS and HTML remain inline in `index.html`, which loads the plain scripts and continues to work when opened directly.

## Current Constraints

- No backend, build step, or third-party runtime dependencies are currently installed; Node is used only for tests and batch analysis.
- Match randomness is generated from a seed, so headless simulations are reproducible.
- Automated tests use Node's built-in test runner and execute with `node --test`.
- The current repository has only one app context.

## Development Notes

For local development, run `node --test`, then open `index.html` directly for visual verification. Use `node scripts/analyze-matches.js --matches 100 --seed 1` for a deterministic simulation report.
