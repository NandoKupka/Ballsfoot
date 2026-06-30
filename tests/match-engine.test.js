const test = require("node:test");
const assert = require("node:assert/strict");

const { MatchEngine } = require("../src/domain/match-engine.js");

function createTeams() {
  const roles = ["GOL", "LE", "ZAG", "ZAG", "LD", "ME", "VOL", "MC", "MD", "ATA", "ATA"];

  return ["home", "away"].map((venue, teamIndex) => ({
    id: venue,
    name: venue === "home" ? "Mandante" : "Visitante",
    shortName: venue === "home" ? "MAN" : "VIS",
    venue,
    colors: {
      main: teamIndex ? "#2878ff" : "#e84d55",
      deep: teamIndex ? "#134eb0" : "#9f2730",
      highlight: teamIndex ? "#5fa4ff" : "#ff8186",
      glow: "rgba(255, 255, 255, 0.2)"
    },
    players: roles.map((role, index) => ({
      id: `${venue}-${index + 1}`,
      name: `${venue}-${index + 1}`,
      number: index + 1,
      attributes: {
        physical: 80,
        technique: 80,
        intelligence: 80,
        defense: 80
      },
      preferredPositions: [role]
    }))
  }));
}

test("the match clock advances continuously and freezes while paused", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 42,
    matchClockRate: 60
  });

  engine.command({ type: "start" });
  engine.advance(1_000);

  const playing = engine.getSnapshot();
  assert.equal(playing.match.state, "playing");
  assert.equal(playing.match.elapsedMatchMs, 60_000);
  assert.equal(playing.match.clock, "01'");

  engine.command({ type: "pause" });
  engine.advance(5_000);

  const paused = engine.getSnapshot();
  assert.equal(paused.match.state, "paused");
  assert.equal(paused.match.elapsedMatchMs, 60_000);
});

test("a pass keeps the ball in transit until a player controls it", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 7,
    matchClockRate: 1,
    autonomous: false
  });
  const initial = engine.getSnapshot();
  const receiver = initial.teams[0].players.find((player) => player.id !== initial.ball.controllerId);

  engine.command({ type: "start" });
  engine.command({ type: "pass", receiverId: receiver.id });

  const travelling = engine.getSnapshot();
  assert.equal(travelling.ball.mode, "travelling");
  assert.equal(travelling.ball.controllerId, null);
  assert.equal(travelling.possession, null);

  engine.advance(5_000);

  const received = engine.getSnapshot();
  assert.equal(received.ball.mode, "controlled");
  assert.equal(received.ball.controllerId, receiver.id);
  assert.equal(received.possession.playerId, receiver.id);
});

test("a defensive deflection becomes immediate possession and counts as an interception", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 11,
    matchClockRate: 1,
    autonomous: false
  });
  const passer = engine.getController();
  const passingTeam = engine.getTeam(passer.teamId);
  const receiver = passingTeam.players.find((player) => player !== passer);
  const interceptor = engine.getOpponent(passingTeam).players.find((player) => player.role !== "GOL");

  engine.command({ type: "start" });
  engine.performPass(receiver.id);
  engine.findBallContact = () => ({ type: "deflect", player: interceptor });
  engine.updateBall(50);

  assert.equal(engine.ball.mode, "controlled");
  assert.equal(engine.ball.controllerId, interceptor.id);
  assert.equal(engine.possession.teamId, interceptor.teamId);
  assert.equal(engine.possession.playerId, interceptor.id);
  assert.equal(interceptor.matchStats.interceptions, 1);
  assert.equal(interceptor.matchStats.recoveries, 1);
  assert.equal(passingTeam.stats.passesMissed, 1);
  assert.equal(passingTeam.stats.turnovers, 1);

  const interception = engine.drainEvents().find((event) => event.type === "pass_intercepted");
  assert.equal(interception.data.playerId, interceptor.id);
  assert.equal(interception.data.deflected, true);
});

test("a loose ball crossing the touchline awards a throw-in to the opponent of the last touch", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 13,
    matchClockRate: 1,
    autonomous: false
  });
  const lastTouchTeam = engine.teams[0];
  const receivingTeam = engine.teams[1];

  engine.command({ type: "start" });
  Object.assign(engine.ball, {
    mode: "loose",
    x: 0.8,
    y: 58,
    velocityX: -4,
    velocityY: 0,
    lastTouchedTeamId: lastTouchTeam.id
  });
  engine.possession = null;
  engine.updateLooseBall(50);

  assert.equal(engine.ball.mode, "out");
  assert.equal(engine.ball.restartReason, "throw_in");
  assert.equal(engine.ball.restartTeamId, receivingTeam.id);
  assert.equal(engine.ball.restartX, 1);
  assert.equal(engine.ball.restartY, 58);
});

test("the last touch at the end line distinguishes a corner from a goal kick", () => {
  const createEndLineEngine = () => {
    const engine = new MatchEngine({
      teams: createTeams(),
      seed: 15,
      matchClockRate: 1,
      autonomous: false
    });
    engine.command({ type: "start" });
    return engine;
  };

  const cornerEngine = createEndLineEngine();
  const defendingTeam = cornerEngine.getDefendingTeamAtEndLine(0);
  const attackingTeam = cornerEngine.getOpponent(defendingTeam);
  Object.assign(cornerEngine.ball, {
    mode: "loose",
    x: 20,
    y: 0.5,
    velocityX: 0,
    velocityY: -3,
    lastTouchedTeamId: defendingTeam.id
  });
  cornerEngine.possession = null;
  cornerEngine.updateLooseBall(50);

  assert.equal(cornerEngine.ball.restartReason, "corner");
  assert.equal(cornerEngine.ball.restartTeamId, attackingTeam.id);

  const goalKickEngine = createEndLineEngine();
  const goalKickDefendingTeam = goalKickEngine.getDefendingTeamAtEndLine(0);
  const goalKickAttackingTeam = goalKickEngine.getOpponent(goalKickDefendingTeam);
  Object.assign(goalKickEngine.ball, {
    mode: "loose",
    x: 70,
    y: 0.5,
    velocityX: 0,
    velocityY: -3,
    lastTouchedTeamId: goalKickAttackingTeam.id
  });
  goalKickEngine.possession = null;
  goalKickEngine.updateLooseBall(50);

  assert.equal(goalKickEngine.ball.restartReason, "goal_kick");
  assert.equal(goalKickEngine.ball.restartTeamId, goalKickDefendingTeam.id);
});

test("a throw-in restart keeps shape and waits for the nearest player to run to the line", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 17,
    matchClockRate: 1,
    autonomous: false
  });
  const team = engine.teams[1];
  const restarter = team.players.find((player) => player.role === "MC");
  const teammate = team.players.find((player) => player.role === "ATA");
  team.players
    .filter((player) => player.role !== "GOL")
    .forEach((player, index) => {
      player.x = 48 + index * 2;
      player.y = 36 + index * 3;
      player.targetX = player.x;
      player.targetY = player.y;
      player.velocityX = 0;
      player.velocityY = 0;
    });
  restarter.x = 88;
  restarter.y = 62;
  restarter.targetX = restarter.x;
  restarter.targetY = restarter.y;
  teammate.x = 54;
  teammate.y = 44;
  teammate.targetX = teammate.x;
  teammate.targetY = teammate.y;

  engine.command({ type: "start" });
  engine.scheduleRestart("throw_in", team, { x: 99, y: 62 }, 50);

  assert.equal(engine.ball.restartTakerId, restarter.id);
  assert.equal(restarter.x, 88);
  assert.equal(restarter.y, 62);
  assert.equal(restarter.targetX, 96);
  assert.equal(restarter.targetY, 62);
  assert.equal(teammate.x, 54);
  assert.equal(teammate.y, 44);

  engine.advance(50);
  assert.equal(engine.ball.mode, "out");
  assert.ok(restarter.x > 88);
  assert.ok(restarter.x < 96);

  for (let tick = 0; tick < 120 && engine.ball.mode === "out"; tick += 1) {
    engine.advance(50);
  }

  const controller = engine.getController();
  assert.equal(engine.ball.mode, "controlled");
  assert.equal(engine.possession.teamId, team.id);
  assert.notEqual(controller.role, "GOL");
  assert.equal(controller.id, restarter.id);
  assert.ok(Math.abs(controller.x - 96) <= 0.8);
  assert.equal(team.stats.throwIns, 1);
});

test("a clean tackle transfers controlled possession to the defender", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 19,
    matchClockRate: 1,
    autonomous: false
  });
  const carrier = engine.getController();
  const attackingTeam = engine.getTeam(carrier.teamId);
  const defender = engine.getOpponent(attackingTeam).players.find((player) => player.role !== "GOL");

  engine.command({ type: "start" });
  engine.resolveTackle(defender, carrier, "won");

  assert.equal(engine.ball.mode, "controlled");
  assert.equal(engine.ball.controllerId, defender.id);
  assert.equal(engine.possession.teamId, defender.teamId);
  assert.equal(defender.matchStats.tacklesAttempted, 1);
  assert.equal(defender.matchStats.tacklesWon, 1);
  assert.equal(attackingTeam.stats.turnovers, 1);
  assert.ok(engine.drainEvents().some((event) => event.type === "tackle_won"));
});

test("a deflected tackle beside the touchline can immediately produce a throw-in", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 20,
    matchClockRate: 1,
    autonomous: false
  });
  const carrier = engine.getController();
  const attackingTeam = engine.getTeam(carrier.teamId);
  const defender = engine.getOpponent(attackingTeam).players.find((player) => player.role !== "GOL");
  carrier.x = 2;
  carrier.y = 55;
  defender.x = 3;
  defender.y = 55;
  engine.random.next = () => 0;

  engine.command({ type: "start" });
  engine.resolveTackle(defender, carrier, "deflected");

  assert.equal(engine.ball.mode, "out");
  assert.equal(engine.ball.restartReason, "throw_in");
  assert.equal(engine.ball.restartTeamId, attackingTeam.id);
});

test("a failed wide control can carry the ball through the touchline", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 22,
    matchClockRate: 1,
    autonomous: false
  });
  const receiver = engine.teams[0].players.find((player) => player.role === "ME");
  receiver.x = 18;
  receiver.y = 52;
  engine.makeBallLoose({ x: -6, y: 0 }, receiver.teamId);

  const awarded = engine.maybeAwardThrowInAfterBadControl(receiver, true);

  assert.equal(awarded, true);
  assert.equal(engine.ball.mode, "out");
  assert.equal(engine.ball.restartReason, "throw_in");
  assert.equal(engine.ball.restartTeamId, engine.teams[1].id);
});

test("a foul outside the penalty area awards a free kick at the infringement point", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 21,
    matchClockRate: 1,
    autonomous: false
  });
  const carrier = engine.getController();
  const attackingTeam = engine.getTeam(carrier.teamId);
  const defendingTeam = engine.getOpponent(attackingTeam);
  const defender = defendingTeam.players.find((player) => player.role !== "GOL");
  carrier.x = 50;
  carrier.y = 50;

  engine.command({ type: "start" });
  engine.resolveTackle(defender, carrier, "foul");

  assert.equal(engine.ball.mode, "out");
  assert.equal(engine.ball.restartReason, "free_kick");
  assert.equal(engine.ball.restartTeamId, attackingTeam.id);
  assert.equal(engine.ball.restartX, 50);
  assert.equal(engine.ball.restartY, 50);
  assert.equal(defender.matchStats.foulsCommitted, 1);
  assert.equal(carrier.matchStats.foulsWon, 1);
  assert.equal(defendingTeam.stats.fouls, 1);
});

test("a common free kick restarts automatically with the nearest player", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 22,
    matchClockRate: 1,
    autonomous: false
  });
  const team = engine.teams[0];
  const opponent = engine.getOpponent(team);
  const nearest = team.players.find((player) => player.role === "MC");
  const selected = team.players.find((player) => player.role === "ATA");
  const goalkeeper = opponent.players.find((player) => player.role === "GOL");
  const goalkeeperStart = { x: goalkeeper.x, y: goalkeeper.y };
  team.players
    .filter((player) => player.role !== "GOL")
    .forEach((player, index) => {
      player.x = 78 + index;
      player.y = 82;
    });
  nearest.x = 49;
  nearest.y = 51;
  selected.x = 82;
  selected.y = 18;

  engine.scheduleRestart("free_kick", team, { x: 50, y: 50 }, 1_000);
  engine.command({ type: "takeRestart", playerId: selected.id });

  assert.equal(engine.state, "playing");
  assert.equal(engine.ball.controllerId, nearest.id);
  assert.deepEqual({ x: goalkeeper.x, y: goalkeeper.y }, goalkeeperStart);
  const freeKick = engine.drainEvents().find((event) => event.type === "free_kick_taken");
  assert.equal(freeKick.data.playerId, nearest.id);
  assert.equal(freeKick.data.direct, false);
});

test("a dangerous free kick can be selected and is taken directly behind a wall", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 24,
    matchClockRate: 1,
    autonomous: false
  });
  const team = engine.teams[0];
  const selected = team.players.find((player) => player.role === "ATA");
  selected.attributes.technique = 95;
  selected.attributes.intelligence = 90;
  engine.random.next = () => 0;

  engine.scheduleRestart("free_kick", team, { x: 50, y: 24 }, 1_000);
  const awarded = engine.drainEvents().find((event) => event.type === "free_kick_awarded");
  assert.equal(awarded.data.dangerous, true);
  assert.equal(awarded.data.selectable, true);
  assert.equal(awarded.data.direct, true);
  assert.equal(engine.getSnapshot().ball.restartDangerous, true);

  const wall = engine.getOpponent(team).players
    .filter((player) => player.role !== "GOL" && Math.abs(player.y - 16) < 0.001)
    .sort((a, b) => a.x - b.x);
  assert.equal(wall.length, 4);
  assert.deepEqual(wall.map((player) => player.x), [44, 48, 52, 56]);

  engine.command({ type: "takeRestart", playerId: selected.id });

  const events = engine.drainEvents();
  assert.ok(events.some((event) =>
    event.type === "free_kick_taken" &&
    event.data.playerId === selected.id &&
    event.data.direct
  ));
  assert.ok(events.some((event) =>
    event.type === "shot_started" &&
    event.data.playerId === selected.id &&
    event.data.setPiece === "free_kick"
  ));
});

test("a defensive foul inside the penalty area awards a penalty", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 23,
    matchClockRate: 1,
    autonomous: false
  });
  const carrier = engine.getController();
  const attackingTeam = engine.getTeam(carrier.teamId);
  const defendingTeam = engine.getOpponent(attackingTeam);
  const defender = defendingTeam.players.find((player) => player.role !== "GOL");
  const ownGoal = engine.getOwnGoalPoint(defendingTeam);
  carrier.x = 50;
  carrier.y = ownGoal.y === 0 ? 10 : 90;

  engine.command({ type: "start" });
  engine.resolveTackle(defender, carrier, "foul");

  assert.equal(engine.ball.restartReason, "penalty");
  assert.equal(engine.ball.restartTeamId, attackingTeam.id);
  assert.equal(attackingTeam.stats.penaltiesWon, 1);
  assert.equal(defendingTeam.stats.penaltiesConceded, 1);
  assert.ok(engine.drainEvents().some((event) =>
    event.type === "foul_committed" && event.data.penalty
  ));
});

test("a scored penalty records the shot and enters the normal goal pause", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 25,
    matchClockRate: 1,
    autonomous: false
  });
  const kicker = engine.getController();
  const team = engine.getTeam(kicker.teamId);

  engine.command({ type: "start" });
  engine.takePenalty(kicker, "goal");

  assert.equal(team.score, 1);
  assert.equal(team.stats.shots, 1);
  assert.equal(team.stats.goals, 1);
  assert.equal(kicker.matchStats.shots, 1);
  assert.equal(kicker.matchStats.goals, 1);
  assert.equal(engine.state, "goalPause");
  const events = engine.drainEvents();
  assert.ok(events.some((event) => event.type === "penalty_taken"));
  assert.ok(events.some((event) => event.type === "penalty_scored"));
  assert.ok(events.some((event) => event.type === "goal" && event.data.penalty));
});

test("saved and missed penalties end without a rebound", () => {
  const savedEngine = new MatchEngine({
    teams: createTeams(),
    seed: 27,
    matchClockRate: 1,
    autonomous: false
  });
  const savedKicker = savedEngine.getController();
  const savedDefendingTeam = savedEngine.getOpponent(savedEngine.getTeam(savedKicker.teamId));
  const goalkeeper = savedDefendingTeam.players.find((player) => player.role === "GOL");
  savedEngine.command({ type: "start" });
  savedEngine.takePenalty(savedKicker, "saved");

  assert.equal(savedEngine.ball.mode, "controlled");
  assert.equal(savedEngine.ball.controllerId, goalkeeper.id);
  assert.equal(goalkeeper.matchStats.saves, 1);

  const missedEngine = new MatchEngine({
    teams: createTeams(),
    seed: 29,
    matchClockRate: 1,
    autonomous: false
  });
  const missedKicker = missedEngine.getController();
  const missedDefendingTeam = missedEngine.getOpponent(missedEngine.getTeam(missedKicker.teamId));
  missedEngine.command({ type: "start" });
  missedEngine.takePenalty(missedKicker, "missed");

  assert.equal(missedEngine.ball.mode, "out");
  assert.equal(missedEngine.ball.restartReason, "goal_kick");
  assert.equal(missedEngine.ball.restartTeamId, missedDefendingTeam.id);
  assert.ok(missedEngine.drainEvents().some((event) => event.type === "penalty_missed"));
});

test("a goalkeeper parry over the end line awards a corner", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 31,
    matchClockRate: 1,
    autonomous: false
  });
  const shooter = engine.getController();
  const shootingTeam = engine.getTeam(shooter.teamId);
  const defendingTeam = engine.getOpponent(shootingTeam);

  engine.command({ type: "start" });
  engine.performShot(shooter, { outcome: "parried" });
  engine.advance(5_000);

  assert.equal(shootingTeam.stats.corners, 1);
  const events = engine.drainEvents();
  assert.ok(events.some((event) => event.type === "shot_parried"));
  assert.ok(events.some((event) => event.type === "corner_awarded"));
  assert.ok(!events.some((event) => event.type === "shot_saved"));
  assert.equal(defendingTeam.stats.goalKicks, 0);
});

test("a corner is crossed into the box and can become a first-time header", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 32,
    matchClockRate: 1,
    autonomous: false
  });
  const team = engine.teams[0];
  const receiver = team.players.find((player) => player.role === "ATA");
  const marker = engine.getOpponent(team).players.find((player) => player.role === "ZAG");
  receiver.x = 50;
  receiver.y = 86;
  marker.x = 64;
  marker.y = 72;
  engine.random.next = () => 0;

  engine.scheduleRestart("corner", team, { x: 99, y: 99 }, 1);
  engine.command({ type: "takeRestart" });

  assert.equal(engine.ball.action, "corner_cross");
  assert.equal(engine.ball.passTrigger, "corner");

  for (let tick = 0; tick < 40 && engine.ball.action === "corner_cross"; tick += 1) {
    engine.advance(50);
  }

  const events = engine.drainEvents();
  const cross = events.find((event) => event.type === "corner_cross");
  assert.ok(cross);
  assert.ok(events.some((event) =>
    event.type === "corner_header" &&
    event.data.playerId === cross.data.receiverId
  ));
  assert.ok(events.some((event) =>
    event.type === "shot_started" &&
    event.data.playerId === cross.data.receiverId &&
    event.data.setPiece === "corner" &&
    event.data.header
  ));
});

test("corner target marking reduces the header contact chance", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 33,
    matchClockRate: 1,
    autonomous: false
  });
  const team = engine.teams[0];
  const kicker = team.players.find((player) => player.role === "MD");
  const receiver = team.players.find((player) => player.role === "ATA");
  const marker = engine.getOpponent(team).players.find((player) => player.role === "ZAG");
  receiver.x = 50;
  receiver.y = 86;
  receiver.pressure = 0.2;
  marker.attributes.defense = 95;
  marker.attributes.physical = 95;
  marker.attributes.intelligence = 95;

  marker.x = 51;
  marker.y = 86;
  const tightlyMarked = engine.getCornerHeaderChance(kicker, receiver, marker);

  marker.x = 72;
  marker.y = 70;
  const looselyMarked = engine.getCornerHeaderChance(kicker, receiver, marker);

  assert.ok(tightlyMarked < looselyMarked);
  assert.ok(tightlyMarked <= 0.3);
});

test("overall is derived from the four attributes and players accumulate match statistics", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 17,
    matchClockRate: 1,
    autonomous: false
  });
  const initial = engine.getSnapshot();
  const team = initial.teams[0];
  const striker = team.players.find((player) => player.role === "ATA");
  assert.deepEqual(Object.keys(striker.attributes).sort(), [
    "defense",
    "intelligence",
    "physical",
    "technique"
  ]);
  team.players.forEach((player) => {
    const values = Object.values(player.attributes);
    assert.equal(player.overall, Math.round(values.reduce((sum, value) => sum + value, 0) / values.length));
  });
  assert.deepEqual(Object.keys(striker.matchStats).sort(), [
    "carries",
    "distanceCovered",
    "foulsCommitted",
    "foulsWon",
    "goals",
    "interceptions",
    "offsides",
    "oneTouchPasses",
    "passesAttempted",
    "passesCompleted",
    "recoveries",
    "runDistance",
    "saves",
    "shots",
    "tacklesAttempted",
    "tacklesWon",
    "touches",
    "trotDistance",
    "walkDistance"
  ]);

  const receiver = team.players.find((player) => player.id !== initial.ball.controllerId);
  engine.command({ type: "start" });
  engine.command({ type: "pass", receiverId: receiver.id });
  engine.advance(5_000);

  const afterPass = engine.getSnapshot();
  const passerAfter = afterPass.teams[0].players.find((player) => player.id === initial.ball.controllerId);
  const receiverAfter = afterPass.teams[0].players.find((player) => player.id === receiver.id);
  assert.equal(passerAfter.matchStats.passesAttempted, 1);
  assert.equal(passerAfter.matchStats.passesCompleted, 1);
  assert.ok(receiverAfter.matchStats.touches >= 1);
  assert.ok(afterPass.teams.flatMap((candidate) => candidate.players)
    .some((player) => player.matchStats.distanceCovered > 0));
});

test("each canonical attribute influences its matching action group", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 23,
    autonomous: false
  });
  const player = engine.teams[0].players.find((candidate) => candidate.role === "ATA");

  player.attributes.physical = 20;
  const lowPhysicalSpeed = engine.getPlayerSpeed(player);
  player.attributes.physical = 95;
  const highPhysicalSpeed = engine.getPlayerSpeed(player);
  assert.ok(highPhysicalSpeed > lowPhysicalSpeed);
  const movementProfile = engine.getPlayerMovementProfile(player);
  assert.ok(movementProfile.walk < movementProfile.trot);
  assert.ok(movementProfile.trot < movementProfile.run);
  assert.equal(movementProfile.run, highPhysicalSpeed);

  player.pressure = 0;
  player.attributes.intelligence = 20;
  engine.random.state = 123;
  const lowIntelligenceDelay = engine.getDecisionDelay(player);
  player.attributes.intelligence = 95;
  engine.random.state = 123;
  const highIntelligenceDelay = engine.getDecisionDelay(player);
  assert.ok(highIntelligenceDelay < lowIntelligenceDelay);

  const passingSpeed = (technique) => {
    const passingEngine = new MatchEngine({
      teams: createTeams(),
      seed: 29,
      autonomous: false
    });
    const passer = passingEngine.getController();
    const receiver = passingEngine.teams[0].players.find((candidate) => candidate !== passer);
    passer.attributes.technique = technique;
    passingEngine.performPass(receiver.id);
    return passingEngine.ball.speed;
  };
  assert.ok(passingSpeed(95) > passingSpeed(20));

  const opponent = {
    x: 50,
    y: 50,
    attributes: {
      defense: 20,
      intelligence: 20
    }
  };
  const lowDefensiveLaneSafety = engine.getLaneSafety(
    { x: 20, y: 50 },
    { x: 80, y: 50 },
    [opponent]
  );
  opponent.attributes.defense = 95;
  opponent.attributes.intelligence = 95;
  const highDefensiveLaneSafety = engine.getLaneSafety(
    { x: 20, y: 50 },
    { x: 80, y: 50 },
    [opponent]
  );
  assert.ok(highDefensiveLaneSafety < lowDefensiveLaneSafety);
});

test("urgent movement spends stamina on sprints and recovers at lower tempo", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 34,
    autonomous: false
  });
  const team = engine.teams[0];
  const runner = team.players.find((player) => player.role === "ATA");
  runner.x = 50;
  runner.y = 70;
  runner.targetX = 50;
  runner.targetY = 30;
  runner.stamina = 100;
  runner.sprintStamina = 100;
  team.tacticalState.transition = "counter";
  engine.setBallController(runner);

  engine.movePlayers(1_000);

  assert.equal(runner.movementMode, "run");
  assert.ok(runner.stamina < 100);
  assert.ok(runner.stamina > 99.85);
  assert.ok(runner.sprintStamina < 100);
  assert.ok(runner.sprintStamina > 85);
  assert.ok(runner.matchStats.runDistance > 0);

  runner.stamina = 50;
  runner.sprintStamina = 20;
  runner.targetX = runner.x;
  runner.targetY = runner.y;
  team.tacticalState.transition = null;
  engine.movePlayers(1_000);

  assert.equal(runner.movementMode, "walk");
  assert.ok(runner.stamina < 50);
  assert.ok(runner.sprintStamina > 20);
  assert.ok(runner.sprintStamina < 27);
  assert.ok(runner.matchStats.walkDistance >= 0);
});

test("low stamina prevents a player from sprinting", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 36,
    autonomous: false
  });
  const team = engine.teams[0];
  const runner = team.players.find((player) => player.role === "ATA");
  runner.x = 50;
  runner.y = 70;
  runner.targetX = 50;
  runner.targetY = 30;
  runner.stamina = 80;
  runner.sprintStamina = 5;
  team.tacticalState.transition = "counter";

  engine.movePlayers(50);

  assert.equal(runner.movementMode, "trot");
  assert.equal(runner.matchStats.runDistance, 0);
});

test("visible stamina is limited by both match fatigue and short sprint energy", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 38,
    autonomous: false
  });
  const player = engine.teams[0].players.find((candidate) => candidate.role === "ATA");

  player.stamina = 82;
  player.sprintStamina = 35;
  assert.equal(engine.getVisibleStamina(player), 35);

  player.stamina = 42;
  player.sprintStamina = 90;
  assert.equal(engine.getVisibleStamina(player), 42);
  assert.equal(engine.getSnapshot().teams[0].players.find((candidate) => candidate.id === player.id).visibleStamina, 42);
});

test("high pressure can trigger a first-time return pass for a wall pass", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 37
  });
  const team = engine.teams[0];
  const receiver = team.players.find((player) => player.role === "MC");
  const originalPasser = team.players.find((player) => player.role === "ATA");

  receiver.x = 50;
  receiver.y = 60;
  receiver.pressure = 0.82;
  originalPasser.x = 50;
  originalPasser.y = 51;
  originalPasser.pressure = 0.1;
  originalPasser.spaceScore = 0.9;
  team.players
    .filter((player) => player !== receiver && player !== originalPasser)
    .forEach((player, index) => {
      player.x = index % 2 ? 8 : 92;
      player.y = 78;
      player.pressure = 0.7;
      player.spaceScore = 0.2;
    });
  engine.getOpponent(team).players.forEach((player, index) => {
    player.x = index % 2 ? 12 : 88;
    player.y = 25;
  });
  const incomingPass = {
    startX: 50,
    startY: 64,
    distance: 14,
    oneTouchChain: 0
  };
  engine.random.next = () => 0;

  receiver.attributes.intelligence = 35;
  assert.equal(
    engine.getOneTouchPassDecision(receiver, originalPasser, incomingPass),
    null
  );

  receiver.attributes.intelligence = 90;
  const decision = engine.getOneTouchPassDecision(receiver, originalPasser, incomingPass);

  assert.equal(decision.receiverId, originalPasser.id);
  assert.equal(decision.combination, true);
  assert.equal(decision.trigger, "pressure");
  assert.equal(decision.intelligence, 90);
  assert.ok(decision.requiredIntelligence > 35);
  assert.ok(decision.requiredIntelligence < 90);
  assert.equal(engine.getOneTouchPassDecision(receiver, originalPasser, {
    distance: 14,
    oneTouchChain: 1
  }), null);
});

test("a first-time pass continues the sequence without a control delay", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 41,
    autonomous: false
  });
  const passer = engine.getController();
  const teammates = engine.teams[0].players.filter((player) => player !== passer);
  const receiver = teammates[0];
  const returnTarget = teammates[1];
  passer.x = 46;
  passer.y = 50;
  receiver.x = 50;
  receiver.y = 50;
  returnTarget.x = 54;
  returnTarget.y = 50;
  engine.getOpponent(engine.teams[0]).players.forEach((player, index) => {
    player.x = index % 2 ? 8 : 92;
    player.y = 25;
  });
  let decisions = 0;
  engine.getOneTouchPassDecision = () => {
    decisions += 1;
    return decisions === 1
      ? {
          receiverId: returnTarget.id,
          combination: true,
          trigger: "combination",
          intelligence: 91,
          requiredIntelligence: 50
        }
      : null;
  };

  engine.command({ type: "start" });
  engine.performPass(receiver.id);
  engine.advance(5_000);

  const events = engine.drainEvents();
  const passes = events.filter((event) => event.type === "pass_started");
  const firstTimePass = passes.find((event) => event.data.oneTouch);
  const receiverAfter = engine.teams[0].players.find((player) => player.id === receiver.id);

  assert.equal(passes.length, 2);
  assert.equal(firstTimePass.data.playerId, receiver.id);
  assert.equal(firstTimePass.data.receiverId, returnTarget.id);
  assert.equal(firstTimePass.data.combination, true);
  assert.equal(firstTimePass.data.decisionIntelligence, 91);
  assert.equal(firstTimePass.data.requiredIntelligence, 50);
  assert.equal(receiverAfter.matchStats.oneTouchPasses, 1);
  assert.equal(engine.teams[0].stats.oneTouchPasses, 1);
});

test("the attacking team keeps its shape while a pass is travelling", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 43,
    autonomous: false
  });
  const receiver = engine.teams[0].players.find((player) => player.role === "MC");
  receiver.x = 50;
  receiver.y = 60;

  engine.command({ type: "start" });
  engine.performPass(receiver.id);
  engine.updateTacticalTargets();

  assert.equal(engine.ball.mode, "travelling");
  assert.equal(engine.ball.intendedReceiverId, receiver.id);
  assert.ok(receiver.targetY < receiver.y);
});

test("the attacking 4-4-2 staggers fullbacks, central midfielders, and forwards", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 47,
    autonomous: false
  });
  const team = engine.teams[0];
  const carrier = team.players.find((player) => player.role === "ME");
  carrier.x = 14;
  carrier.y = 45;
  engine.setBallController(carrier);
  engine.updateTacticalTargets();
  const context = engine.getCollectiveTacticalContext(team, true, carrier);

  const leftBack = team.players.find((player) => player.role === "LE");
  const rightBack = team.players.find((player) => player.role === "LD");
  const centralMidfielders = team.players.filter((player) => ["VOL", "MC"].includes(player.role));
  const forwards = team.players.filter((player) => player.role === "ATA");
  const collectiveTarget = (player) => engine.getCollectiveAttackingTarget(
    player,
    team,
    carrier,
    context
  );
  const progress = (player) => engine.getAttackProgress(collectiveTarget(player), team);

  assert.equal(team.tacticalState.activeFullbackId, leftBack.id);
  assert.ok(progress(leftBack) >= progress(rightBack) + 10);
  assert.ok(Math.abs(progress(centralMidfielders[0]) - progress(centralMidfielders[1])) >= 6);
  assert.ok(Math.abs(progress(forwards[0]) - progress(forwards[1])) >= 8);
});

test("the defensive 4-4-2 shifts toward the ball and tucks in the far side", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 49,
    autonomous: false
  });
  const defendingTeam = engine.teams[0];
  const attackingTeam = engine.teams[1];
  const carrier = attackingTeam.players.find((player) => player.role === "MD");
  carrier.x = 90;
  carrier.y = 58;
  engine.setBallController(carrier);
  engine.updateTacticalTargets();

  const farWideMidfielder = defendingTeam.players.find((player) => player.role === "ME");
  const farFullback = defendingTeam.players.find((player) => player.role === "LE");
  const centerBacks = defendingTeam.players.filter((player) => player.role === "ZAG");
  const averageCenterBackTargetX = centerBacks.reduce((sum, player) => sum + player.targetX, 0) /
    centerBacks.length;

  assert.equal(defendingTeam.tacticalState.ballSide, "right");
  assert.ok(Math.abs(farWideMidfielder.targetX - 50) < Math.abs(farWideMidfielder.baseX - 50));
  assert.ok(Math.abs(farFullback.targetX - 50) < Math.abs(farFullback.baseX - 50));
  assert.ok(averageCenterBackTargetX > 50);
  defendingTeam.players
    .filter((player) => player.markingTargetId)
    .forEach((player) => {
      const marked = engine.findPlayer(player.markingTargetId);
      assert.ok(engine.distance(player, marked) <= 21);
    });
});

test("crossing positions distribute runners while preserving defensive cover", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 51,
    autonomous: false
  });
  const team = engine.teams[0];
  const carrier = team.players.find((player) => player.role === "ME");
  carrier.x = 8;
  carrier.y = 24;
  engine.setBallController(carrier);
  engine.updateTacticalTargets();
  const context = engine.getCollectiveTacticalContext(team, true, carrier);

  const forwards = team.players.filter((player) => player.role === "ATA");
  const farWideMidfielder = team.players.find((player) => player.role === "MD");
  const fullbacks = team.players.filter((player) => ["LE", "LD"].includes(player.role));
  const collectiveTarget = (player) => engine.getCollectiveAttackingTarget(
    player,
    team,
    carrier,
    context
  );
  const progress = (player) => engine.getAttackProgress(collectiveTarget(player), team);

  assert.ok(forwards.every((player) => progress(player) >= 84));
  assert.ok(Math.abs(collectiveTarget(forwards[0]).x - collectiveTarget(forwards[1]).x) >= 6);
  assert.ok(progress(farWideMidfielder) >= 82);
  assert.ok(fullbacks.some((player) => progress(player) <= 64));
});

test("possession changes create short counter and counterpress phases", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 53,
    autonomous: false
  });
  engine.command({ type: "start" });
  engine.advance(50);
  const previousTeam = engine.getTeam(engine.possession.teamId);
  const gainingTeam = engine.getOpponent(previousTeam);
  const winner = gainingTeam.players.find((player) => player.role === "MC");

  engine.setBallController(winner);
  engine.updateTacticalTargets();

  assert.equal(previousTeam.tacticalState.transition, "counterpress");
  assert.equal(gainingTeam.tacticalState.transition, "counter");
  assert.equal(previousTeam.tacticalState.phase, "counterpress");
  assert.equal(gainingTeam.tacticalState.phase, "counterattack");

  engine.simulationElapsedMs += 4_000;
  engine.updateTacticalTargets();
  assert.equal(previousTeam.tacticalState.transition, null);
  assert.equal(gainingTeam.tacticalState.transition, null);
});

test("a backward pass acts as a trigger for opposing pressure", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 54,
    autonomous: false
  });
  const attackingTeam = engine.teams[0];
  const defendingTeam = engine.teams[1];
  const passer = engine.getController();
  const receiver = attackingTeam.players.find((player) => player.role === "ZAG");
  passer.x = 50;
  passer.y = 50;
  receiver.x = 50;
  receiver.y = 70;

  engine.performPass(receiver.id);
  const context = engine.getCollectiveTacticalContext(defendingTeam, false, receiver);

  assert.equal(context.pressTrigger, true);
});

test("offside is judged at the pass and restarts for the defending team", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 55,
    autonomous: false
  });
  const attackingTeam = engine.teams[0];
  const defendingTeam = engine.teams[1];
  const passer = engine.getController();
  const receiver = attackingTeam.players.find((player) => player.role === "ATA");
  passer.x = 50;
  passer.y = 50;
  receiver.x = 50;
  receiver.y = 20;
  defendingTeam.players.forEach((player, index) => {
    player.x = 35 + index * 3;
    player.y = player.role === "GOL" ? 5 : (index === 1 ? 25 : 35);
  });

  engine.command({ type: "start" });
  engine.performPass(receiver.id);

  assert.equal(engine.ball.mode, "out");
  assert.equal(engine.ball.restartReason, "offside");
  assert.equal(attackingTeam.stats.offsides, 1);
  assert.equal(receiver.matchStats.offsides, 1);
  const offsideEvent = engine.drainEvents().find((event) => event.type === "offside");
  assert.equal(offsideEvent.data.playerId, receiver.id);
  assert.ok(offsideEvent.data.playerProgress > offsideEvent.data.offsideLine);

  engine.advance(600);
  assert.equal(engine.possession.teamId, defendingTeam.id);
  assert.notEqual(engine.getController().role, "GOL");
});

test("a receiver level with the second-last opponent or behind the ball is onside", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 57,
    autonomous: false
  });
  const attackingTeam = engine.teams[0];
  const defendingTeam = engine.teams[1];
  const passer = engine.getController();
  const receiver = attackingTeam.players.find((player) => player.role === "ATA");
  defendingTeam.players.forEach((player, index) => {
    player.y = player.role === "GOL" ? 5 : (index === 1 ? 25 : 35);
  });

  passer.y = 50;
  receiver.y = 25;
  assert.equal(engine.getOffsidePosition(receiver, passer).isOffside, false);

  passer.y = 20;
  receiver.y = 25;
  assert.equal(engine.getOffsidePosition(receiver, passer).isOffside, false);

  passer.y = 65;
  receiver.y = 60;
  assert.equal(engine.getOffsidePosition(receiver, passer).isOffside, false);
});

test("goalkeepers stay in the goal area except during build-up", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 31,
    autonomous: false
  });
  const team = engine.teams[0];
  const goalkeeper = team.players.find((player) => player.role === "GOL");
  const opponent = engine.teams[1];
  const attacker = opponent.players.find((player) => player.role === "ATA");

  const ownCarrier = team.players.find((player) => player.role === "ZAG");
  ownCarrier.x = 50;
  ownCarrier.y = 88;
  engine.setBallController(ownCarrier);
  engine.updateTacticalTargets();
  assert.ok(goalkeeper.targetY <= 85.2);
  assert.ok(goalkeeper.targetY >= 84.5);
  assert.ok(goalkeeper.targetX >= 25.5 && goalkeeper.targetX <= 74.5);

  ownCarrier.y = 50;
  engine.setBallController(ownCarrier);
  engine.updateTacticalTargets();
  assert.ok(goalkeeper.targetY >= 96);
  assert.ok(goalkeeper.targetX >= 38 && goalkeeper.targetX <= 62);

  attacker.x = 50;
  attacker.y = 72;
  team.players
    .filter((player) => player.role !== "GOL")
    .forEach((player, index) => {
      player.x = index % 2 ? 12 : 88;
      player.y = 55;
    });
  engine.setBallController(attacker);
  engine.updateTacticalTargets();

  assert.equal(engine.isGoalkeeperOneOnOne(team, attacker), true);
  assert.ok(goalkeeper.targetY >= 96);
  assert.ok(goalkeeper.targetX >= 38 && goalkeeper.targetX <= 62);

  const topTeam = engine.teams[1];
  const topGoalkeeper = topTeam.players.find((player) => player.role === "GOL");
  const topCarrier = topTeam.players.find((player) => player.role === "ZAG");
  const topAttacker = engine.teams[0].players.find((player) => player.role === "ATA");

  topCarrier.x = 50;
  topCarrier.y = 12;
  engine.setBallController(topCarrier);
  engine.updateTacticalTargets();
  assert.ok(topGoalkeeper.targetY >= 14.8);
  assert.ok(topGoalkeeper.targetY <= 15.5);
  assert.ok(topGoalkeeper.targetX >= 25.5 && topGoalkeeper.targetX <= 74.5);

  topCarrier.y = 50;
  engine.setBallController(topCarrier);
  engine.updateTacticalTargets();
  assert.ok(topGoalkeeper.targetY <= 4);
  assert.ok(topGoalkeeper.targetX >= 38 && topGoalkeeper.targetX <= 62);

  topAttacker.x = 50;
  topAttacker.y = 28;
  engine.setBallController(topAttacker);
  engine.updateTacticalTargets();
  assert.equal(engine.isGoalkeeperOneOnOne(topTeam, topAttacker), true);
  assert.ok(topGoalkeeper.targetY <= 4);
  assert.ok(topGoalkeeper.targetX >= 38 && topGoalkeeper.targetX <= 62);
});

test("goalkeepers return from build-up without jumping back to goal", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 58,
    autonomous: false
  });
  const team = engine.teams[0];
  const goalkeeper = team.players.find((player) => player.role === "GOL");
  const buildUpCarrier = team.players.find((player) => player.role === "ZAG");
  const opponentCarrier = engine.teams[1].players.find((player) => player.role === "ATA");

  buildUpCarrier.x = 50;
  buildUpCarrier.y = 88;
  engine.setBallController(buildUpCarrier);
  engine.updateTacticalTargets();
  for (let step = 0; step < 30; step += 1) {
    engine.movePlayers(50);
  }

  assert.ok(goalkeeper.y < 96);
  const advancedY = goalkeeper.y;

  opponentCarrier.x = 50;
  opponentCarrier.y = 70;
  engine.setBallController(opponentCarrier);
  engine.updateTacticalTargets();
  engine.movePlayers(50);

  assert.ok(
    goalkeeper.y <= advancedY + 0.6,
    `goalkeeper jumped from ${advancedY} to ${goalkeeper.y}`
  );
});

test("backward pass weight rises when the passer is under pressure", () => {
  const weightedBackwardPass = (pressure) => {
    const engine = new MatchEngine({
      teams: createTeams(),
      seed: 53,
      autonomous: false
    });
    const team = engine.teams[0];
    const passer = team.players.find((player) => player.role === "MC");
    const backwardReceiver = team.players.find((player) => player.role === "ZAG");
    const forwardReceiver = team.players.find((player) => player.role === "ATA");
    passer.x = 50;
    passer.y = 50;
    passer.pressure = pressure;
    backwardReceiver.x = 48;
    backwardReceiver.y = 66;
    backwardReceiver.pressure = 0.1;
    forwardReceiver.x = 52;
    forwardReceiver.y = 35;
    forwardReceiver.pressure = 0.1;
    engine.getOpponent(team).players.forEach((player) => {
      player.x = player.baseX;
      player.y = 8;
    });

    let candidates = [];
    engine.pickWeighted = (items) => {
      candidates = items;
      return items[0]?.player || null;
    };
    engine.choosePassTarget(passer);

    return candidates.find((candidate) => candidate.player === backwardReceiver).weight;
  };

  const lowPressureWeight = weightedBackwardPass(0.12);
  const highPressureWeight = weightedBackwardPass(0.82);

  assert.ok(
    lowPressureWeight < highPressureWeight / 3,
    `low=${lowPressureWeight}, high=${highPressureWeight}`
  );
});

test("goalkeepers never leave their penalty area", () => {
  for (let seed = 1; seed <= 8; seed += 1) {
    const engine = new MatchEngine({
      teams: createTeams(),
      seed
    });
    engine.command({ type: "start" });

    for (let step = 0; step < 3_000 && engine.getSnapshot().match.state !== "finished"; step += 1) {
      engine.advance(50);
      const snapshot = engine.getSnapshot();

      snapshot.teams.forEach((team) => {
        const goalkeeper = team.players.find((player) => player.role === "GOL");
        assert.ok(goalkeeper.x >= 25.5 && goalkeeper.x <= 74.5);
        assert.ok(team.attacksDown
          ? goalkeeper.y >= 3 && goalkeeper.y <= 15.5
          : goalkeeper.y >= 84.5 && goalkeeper.y <= 97
        );
      });

      if (snapshot.match.state === "goalPause") engine.command({ type: "confirmGoal" });
      if (snapshot.match.state === "halftime") engine.command({ type: "start" });
    }
  }
});

test("fixed-step simulation produces the same result for different frame chunks", () => {
  const options = {
    teams: createTeams(),
    seed: 99,
    matchClockRate: 1
  };
  const singleChunk = new MatchEngine(options);
  const manyChunks = new MatchEngine(options);

  singleChunk.command({ type: "start" });
  manyChunks.command({ type: "start" });
  singleChunk.advance(4_000);
  for (let index = 0; index < 80; index += 1) {
    manyChunks.advance(50);
  }

  assert.deepEqual(singleChunk.getSnapshot(), manyChunks.getSnapshot());
  assert.deepEqual(singleChunk.drainEvents(), manyChunks.drainEvents());
});

test("the engine owns halftime, side changes, and fulltime transitions", () => {
  const engine = new MatchEngine({
    teams: createTeams(),
    seed: 12,
    matchClockRate: 60_000,
    autonomous: false
  });
  const initialDirections = engine.getSnapshot().teams.map((team) => team.attacksDown);

  engine.command({ type: "start" });
  engine.advance(50);
  assert.equal(engine.getSnapshot().match.state, "halftime");

  engine.command({ type: "start" });
  const secondHalf = engine.getSnapshot();
  assert.equal(secondHalf.match.period, 2);
  assert.deepEqual(
    secondHalf.teams.map((team) => team.attacksDown),
    initialDirections.map((direction) => !direction)
  );
  secondHalf.teams.forEach((team) => {
    team.players
      .filter((player) => player.id !== secondHalf.ball.controllerId)
      .forEach((player) => {
        assert.ok(team.attacksDown ? player.y <= 50 : player.y >= 50);
      });
  });

  engine.advance(50);
  assert.equal(engine.getSnapshot().match.state, "finished");
});

test("autonomous matches finish with plausible circulation and attempts", () => {
  const totals = {
    matches: 12,
    passes: 0,
    shots: 0,
    goals: 0
  };

  for (let seed = 1; seed <= totals.matches; seed += 1) {
    const engine = new MatchEngine({
      teams: createTeams(),
      seed
    });
    engine.command({ type: "start" });

    for (let step = 0; step < 2_500 && engine.getSnapshot().match.state !== "finished"; step += 1) {
      engine.advance(50);
      const state = engine.getSnapshot().match.state;
      if (state === "goalPause") engine.command({ type: "confirmGoal" });
      if (state === "halftime") engine.command({ type: "start" });
    }

    const snapshot = engine.getSnapshot();
    assert.equal(snapshot.match.state, "finished");
    assert.ok(Number.isFinite(snapshot.ball.x));
    assert.ok(Number.isFinite(snapshot.ball.y));
    assert.ok(snapshot.ball.x >= 0 && snapshot.ball.x <= 100);
    assert.ok(snapshot.ball.y >= 0 && snapshot.ball.y <= 100);

    totals.passes += snapshot.teams.reduce((sum, team) => sum + team.stats.passesAttempted, 0);
    totals.shots += snapshot.teams.reduce((sum, team) => sum + team.stats.shots, 0);
    totals.goals += snapshot.teams.reduce((sum, team) => sum + team.score, 0);
  }

  assert.ok(totals.passes / totals.matches >= 25);
  assert.ok(totals.shots / totals.matches >= 1);
  assert.ok(totals.goals >= 1);
});

function collectPlayStyleMetrics(matchCount = 12) {
  const metrics = {
    passes: 0,
    longPasses: 0,
    shots: 0,
    longShots: 0,
    shotDistance: 0,
    targetChecks: 0,
    attackingMoves: 0,
    spaceGains: 0,
    markingChecks: 0,
    markingResponses: 0
  };

  for (let seed = 1; seed <= matchCount; seed += 1) {
    const engine = new MatchEngine({
      teams: createTeams(),
      seed
    });
    engine.command({ type: "start" });
    let previous = null;

    for (let step = 0; step < 3_000 && engine.getSnapshot().match.state !== "finished"; step += 1) {
      engine.advance(50);
      const snapshot = engine.getSnapshot();

      engine.drainEvents().forEach((event) => {
        if (event.type === "pass_started") {
          metrics.passes += 1;
          if (event.data.distance > 30) metrics.longPasses += 1;
        }
        if (event.type === "shot_started") {
          metrics.shots += 1;
          metrics.shotDistance += event.data.distance;
          if (event.data.distance > 30) metrics.longShots += 1;
        }
      });

      if (step % 5 === 0 && previous && snapshot.possession) {
        const attackingTeam = snapshot.teams.find((team) => team.id === snapshot.possession.teamId);
        const defendingTeam = snapshot.teams.find((team) => team.id !== snapshot.possession.teamId);

        attackingTeam.players
          .filter((player) => player.id !== snapshot.ball.controllerId && player.role !== "GOL")
          .forEach((player) => {
            const previousPlayer = previous.players.get(player.id);
            const currentSpace = Math.min(...defendingTeam.players.map((defender) =>
              Math.hypot(player.x - defender.x, player.y - defender.y)
            ));
            const projectedSpace = Math.min(...defendingTeam.players.map((defender) =>
              Math.hypot(player.targetX - defender.x, player.targetY - defender.y)
            ));
            if (Math.hypot(player.targetX - player.x, player.targetY - player.y) > 2) {
              metrics.targetChecks += 1;
              if (projectedSpace > currentSpace + 0.5) metrics.spaceGains += 1;
            }

            const movement = Math.hypot(player.x - previousPlayer.x, player.y - previousPlayer.y);
            if (movement < 0.12) return;

            metrics.attackingMoves += 1;

            const assignedDefender = defendingTeam.players
              .filter((defender) => defender.markingTargetId === player.id)
              .map((defender) => {
                const previousDefender = previous.players.get(defender.id);
                return {
                  defender,
                  distance: Math.hypot(
                    previousPlayer.x - previousDefender.x,
                    previousPlayer.y - previousDefender.y
                  )
                };
              })
              .sort((a, b) => a.distance - b.distance)[0]?.defender;
            if (!assignedDefender) return;

            const previousDefender = previous.players.get(assignedDefender.id);
            const defenderMove = {
              x: assignedDefender.x - previousDefender.x,
              y: assignedDefender.y - previousDefender.y
            };
            const towardAttacker = {
              x: player.x - previousDefender.x,
              y: player.y - previousDefender.y
            };
            const moveLength = Math.hypot(defenderMove.x, defenderMove.y);
            const targetLength = Math.hypot(towardAttacker.x, towardAttacker.y);
            if (moveLength <= 0.05 || targetLength === 0) return;

            metrics.markingChecks += 1;
            const alignment = (
              defenderMove.x * towardAttacker.x +
              defenderMove.y * towardAttacker.y
            ) / (moveLength * targetLength);
            if (alignment > 0.35) metrics.markingResponses += 1;
          });
      }

      if (step % 5 === 0) {
        previous = {
          players: new Map(snapshot.teams.flatMap((team) =>
            team.players.map((player) => [player.id, { ...player }])
          ))
        };
      }

      if (snapshot.match.state === "goalPause") engine.command({ type: "confirmGoal" });
      if (snapshot.match.state === "halftime") engine.command({ type: "start" });
    }
  }

  return {
    longPassRate: metrics.longPasses / metrics.passes,
    longShotRate: metrics.longShots / metrics.shots,
    averageShotDistance: metrics.shotDistance / metrics.shots,
    spaceGainRate: metrics.spaceGains / metrics.targetChecks,
    markingResponseRate: metrics.markingResponses / metrics.markingChecks
  };
}

test("autonomous play favors support combinations over long passes and speculative shots", () => {
  const metrics = collectPlayStyleMetrics();

  assert.ok(metrics.longPassRate <= 0.24, `long pass rate was ${metrics.longPassRate}`);
  assert.ok(metrics.longShotRate <= 0.25, `long shot rate was ${metrics.longShotRate}`);
  assert.ok(metrics.averageShotDistance <= 28, `average shot distance was ${metrics.averageShotDistance}`);
});

test("off-ball movement creates space and pulls nearby marking", () => {
  const metrics = collectPlayStyleMetrics();

  assert.ok(metrics.spaceGainRate >= 0.5, `space gain rate was ${metrics.spaceGainRate}`);
  assert.ok(metrics.markingResponseRate >= 0.54, `marking response rate was ${metrics.markingResponseRate}`);
});

test("fullbacks and wide midfielders advance during possession", () => {
  const roles = ["LE", "LD", "ME", "MD"];
  const totals = new Map(roles.map((role) => [role, {
    progress: 0,
    samples: 0,
    advanced: 0
  }]));

  for (let seed = 1; seed <= 12; seed += 1) {
    const engine = new MatchEngine({
      teams: createTeams(),
      seed
    });
    engine.command({ type: "start" });

    for (let step = 0; step < 3_000 && engine.getSnapshot().match.state !== "finished"; step += 1) {
      engine.advance(50);
      const snapshot = engine.getSnapshot();
      engine.drainEvents();

      if (step % 5 === 0 && snapshot.possession) {
        const attackingTeam = snapshot.teams.find((team) => team.id === snapshot.possession.teamId);
        attackingTeam.players
          .filter((player) => roles.includes(player.role))
          .forEach((player) => {
            const metrics = totals.get(player.role);
            const progress = attackingTeam.attacksDown ? player.y : 100 - player.y;
            metrics.progress += progress;
            metrics.samples += 1;
            if (progress >= 65) metrics.advanced += 1;
          });
      }

      if (snapshot.match.state === "goalPause") engine.command({ type: "confirmGoal" });
      if (snapshot.match.state === "halftime") engine.command({ type: "start" });
    }
  }

  const average = (role) => totals.get(role).progress / totals.get(role).samples;
  const advancedRate = (role) => totals.get(role).advanced / totals.get(role).samples;

  const fullbackAverage = (average("LE") + average("LD")) / 2;
  const wideMidfielderAverage = (average("ME") + average("MD")) / 2;
  const wideMidfielderAdvancedRate = (advancedRate("ME") + advancedRate("MD")) / 2;

  assert.ok(fullbackAverage >= 31, `fullback average progress was ${fullbackAverage}`);
  assert.ok(
    wideMidfielderAverage >= 47.5,
    `wide midfielder average progress was ${wideMidfielderAverage}`
  );
  assert.ok(
    wideMidfielderAdvancedRate >= 0.06,
    `wide midfielder advanced rate was ${wideMidfielderAdvancedRate}`
  );
});
