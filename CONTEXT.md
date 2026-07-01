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
- Ball state: the ball's current lifecycle state: controlled by a player, travelling toward a target, loose after a failed control, or out of play. A travelling or loose ball has no possession holder.
- Interception: contact with an opponent's travelling pass that immediately establishes controlled possession for the defending team, including a deflection brought under control.
- Tackle: a defensive challenge against the current possession holder that can win control, deflect the ball, be evaded, or commit a foul.
- Foul: an illegal defensive challenge that stops play and awards the opponent a free kick, or a penalty when committed inside the defender's own penalty area.
- Common free kick: a free kick outside direct shooting range. The nearest outfield player restarts play automatically from the infringement point.
- Dangerous free kick: a free kick in direct shooting range. The attacking team may choose the taker, the defending team forms a wall, and the restart is resolved as a direct shot.
- Restart: the controlled resumption of play after the ball is out or an infringement, including a throw-in, goal kick, corner, free kick, penalty, offside restart, or kickoff.
- Throw-in: the restart awarded to the opponent of the last-touch team when the ball crosses a touchline.
- Corner: the attacking-team restart awarded when the defending team last touches the ball before it crosses its own end line outside the goal.
- Goal kick: the defending-team restart awarded when the attacking team last touches the ball before it crosses the defending end line outside the goal.
- Goal area: the small box in front of each goal where the goalkeeper normally stays when not participating in build-up.
- Penalty area: the large box in front of each goal where penalties are awarded for defending fouls and where the goalkeeper may support build-up.
- Penalty: a direct shot against the goalkeeper awarded for a defending foul inside the defender's own penalty area.
- Simulation time: continuous elapsed time advanced through fixed internal steps. Match-clock time is derived from simulation time, while playback speed controls how quickly simulation time is consumed.
- Tactical context: a derived snapshot for one team: phase, intent, pressure zone, ball side, line centers, mentality, and defensive line.
- Support option: a nearby teammate positioned to give the possession holder a safe short pass and form a small triangle around the ball.
- Compact block: the team without the ball arranged as two connected lines of four with two forwards ahead, prioritizing central protection over individual pursuit.
- Ball-side shift: the coordinated lateral movement of the defensive block toward the side containing the ball while far-side players narrow toward the center.
- Active fullback: the fullback temporarily released to support or overlap on the ball side; the opposite fullback remains balanced behind the attack.
- Midfield balance: the temporary division of the two central midfielders into a supporting player near the ball and a holding player protecting the center.
- Complementary forward movement: one forward approaches the ball or channel while the other preserves depth or attacks behind the defense.
- Off-ball intent: the current attacking or defensive movement job assigned to a player away from the ball, such as support, depth run, wide run, box arrival, cutback option, pressing, or balance.
- Transition: the short phase immediately after possession changes, expressed as a counterattack by the recovering team and a counterpress by the team that lost the ball.
- Offside position: a receiving position in the opponent's half beyond both the ball and the second-last opponent at the instant a teammate plays the ball.
- Offside offense: active involvement by the intended receiver from an offside position, resulting in a quick defending-team restart from the offense spot. It is not a foul.
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

- Defensive line height, compactness, central protection, and ball-side shifting keep the team shape coherent.
- Build-up rules prefer center backs, fullbacks, the holding midfielder, and playmaker options.
- Passing and receiving use technique for execution and intelligence for option selection, timing, and positioning.
- Final-third actions can become through balls or crosses before a shot.
- Offside is judged from the frozen positions of the receiver, ball, and second-last opponent when the pass is played.
- Running speed and acceleration use physical; carries and dribbles combine physical and technique.
- Off-ball movement, decision speed, support selection, and composure use intelligence.
- Marking, pressure, lane closure, and interceptions combine defense and intelligence.
- Shots combine technique and intelligence. Goalkeepers combine defense and intelligence when attempting saves.
- Goalkeepers normally stay inside their own goal area. During build-up they may advance within their own penalty area to support circulation.
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
