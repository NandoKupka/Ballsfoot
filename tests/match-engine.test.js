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
    "goals",
    "interceptions",
    "passesAttempted",
    "passesCompleted",
    "recoveries",
    "saves",
    "shots",
    "touches"
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
