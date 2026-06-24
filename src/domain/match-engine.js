(function exposeBallsfootMatchEngine(root, factory) {
  const exports = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exports;
  }

  if (root) {
    root.BallsfootSimulation = exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createMatchEngineModule() {
  "use strict";

  const DEFAULT_FIXED_STEP_MS = 50;
  const DEFAULT_MATCH_CLOCK_RATE = 120;
  const HALF_DURATION_MS = 45 * 60 * 1000;
  const FORMATION_442 = [
    { role: "GOL", x: 50, y: 91 },
    { role: "LE", x: 18, y: 73 },
    { role: "ZAG", x: 39, y: 79 },
    { role: "ZAG", x: 61, y: 79 },
    { role: "LD", x: 82, y: 73 },
    { role: "ME", x: 18, y: 48 },
    { role: "VOL", x: 40, y: 60 },
    { role: "MC", x: 60, y: 60 },
    { role: "MD", x: 82, y: 48 },
    { role: "ATA", x: 42, y: 41 },
    { role: "ATA", x: 58, y: 41 }
  ];
  const ATTRIBUTE_NAMES = [
    "pace",
    "passing",
    "vision",
    "control",
    "finishing",
    "defending",
    "positioning",
    "goalkeeping"
  ];
  const ROLE_ATTRIBUTE_BIASES = {
    GOL: { pace: -16, passing: -4, vision: 1, control: 0, finishing: -38, defending: 2, positioning: 10, goalkeeping: 14 },
    ZAG: { pace: -3, passing: -3, vision: -2, control: -3, finishing: -30, defending: 12, positioning: 9, goalkeeping: -55 },
    LE: { pace: 8, passing: 3, vision: 1, control: 4, finishing: -12, defending: 5, positioning: 5, goalkeeping: -55 },
    LD: { pace: 8, passing: 3, vision: 1, control: 4, finishing: -12, defending: 5, positioning: 5, goalkeeping: -55 },
    VOL: { pace: 0, passing: 5, vision: 5, control: 4, finishing: -10, defending: 9, positioning: 8, goalkeeping: -55 },
    MC: { pace: 2, passing: 9, vision: 10, control: 8, finishing: 3, defending: 0, positioning: 7, goalkeeping: -55 },
    ME: { pace: 8, passing: 6, vision: 5, control: 7, finishing: 4, defending: -2, positioning: 7, goalkeeping: -55 },
    MD: { pace: 8, passing: 6, vision: 5, control: 7, finishing: 4, defending: -2, positioning: 7, goalkeeping: -55 },
    ALA: { pace: 10, passing: 7, vision: 5, control: 8, finishing: 5, defending: 1, positioning: 8, goalkeeping: -55 },
    ATA: { pace: 6, passing: 0, vision: 1, control: 7, finishing: 12, defending: -25, positioning: 10, goalkeeping: -55 }
  };

  class SeededRandom {
    constructor(seed = Date.now()) {
      this.state = (Number(seed) >>> 0) || 1;
    }

    next() {
      this.state = (this.state + 0x6d2b79f5) >>> 0;
      let value = this.state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    }
  }

  class MatchEngine {
    constructor(options = {}) {
      if (!Array.isArray(options.teams) || options.teams.length !== 2) {
        throw new Error("MatchEngine requires exactly two teams.");
      }

      this.options = options;
      this.autonomous = options.autonomous !== false;
      this.random = new SeededRandom(options.seed);
      this.fixedStepMs = options.fixedStepMs || DEFAULT_FIXED_STEP_MS;
      this.matchClockRate = options.matchClockRate || DEFAULT_MATCH_CLOCK_RATE;
      this.accumulatorMs = 0;
      this.simulationElapsedMs = 0;
      this.tacticalAccumulatorMs = 0;
      this.decisionRemainingMs = 650;
      this.restartRemainingMs = 0;
      this.events = [];
      this.sequence = 0;
      this.state = "pre";
      this.period = 1;
      this.periodElapsedMatchMs = 0;
      this.elapsedMatchMs = 0;
      this.stoppageMs = {
        first: this.randomInt(1, 4) * 60_000,
        second: this.randomInt(2, 6) * 60_000
      };
      this.teams = options.teams.map((team, index) => this.createTeam(team, index));
      this.possession = null;
      this.ball = {
        mode: "controlled",
        x: 50,
        y: 50,
        controllerId: null,
        intendedReceiverId: null,
        action: null,
        startX: 50,
        startY: 50,
        targetX: 50,
        targetY: 50,
        speed: 0,
        velocityX: 0,
        velocityY: 0,
        travelled: 0,
        distance: 0,
        outcome: null,
        restartTeamId: null,
        lastTouchedTeamId: null,
        contactedPlayerIds: [],
        passerId: null,
        shooterId: null,
        goalChance: null
      };
      this.prepareKickoff(this.teams[0]);
      this.updatePressure();
    }

    createTeam(config, index) {
      const team = {
        id: config.id,
        name: config.name,
        shortName: config.shortName || config.name,
        venue: config.venue || (index === 0 ? "home" : "away"),
        colors: { ...(config.colors || {}) },
        score: 0,
        stats: {
          possessionMatchMs: 0,
          passesAttempted: 0,
          passesCompleted: 0,
          passesMissed: 0,
          shots: 0,
          goals: 0,
          turnovers: 0
        },
        attacksDown: index === 1,
        players: (config.players || []).map((player, playerIndex) => ({
          id: player.id || `${config.id}-${player.number || playerIndex + 1}`,
          teamId: config.id,
          name: player.name,
          number: player.number || playerIndex + 1,
          overall: player.overall ?? 80,
          preferredPositions: [...(player.preferredPositions || [])],
          attributeOverrides: { ...(player.attributes || {}) },
          role: "RES",
          x: 50,
          y: 50,
          targetX: 50,
          targetY: 50,
          velocityX: 0,
          velocityY: 0,
          pressure: 0,
          spaceScore: 0,
          movementPhase: this.random.next() * Math.PI * 2,
          roamingBias: this.random.next() * 2 - 1,
          nextTargetReviewMs: 0
        }))
      };

      this.applyFormation(team);
      return team;
    }

    applyFormation(team) {
      const slots = FORMATION_442.map((slot, slotIndex) => ({
        ...slot,
        y: team.attacksDown ? 100 - slot.y : slot.y,
        slotIndex
      }));
      const available = [...slots];
      const rankedPlayers = [...team.players].sort((a, b) =>
        b.overall - a.overall ||
        a.preferredPositions.length - b.preferredPositions.length ||
        a.number - b.number
      );

      rankedPlayers.forEach((player) => {
        let slotIndex = -1;
        for (const role of player.preferredPositions) {
          slotIndex = available.findIndex((slot) => slot.role === String(role).toUpperCase());
          if (slotIndex >= 0) break;
        }
        if (slotIndex < 0) slotIndex = 0;
        const slot = available.splice(slotIndex, 1)[0];
        if (!slot) return;
        Object.assign(player, {
          role: slot.role,
          baseX: slot.x,
          baseY: slot.y,
          x: slot.x,
          y: slot.y,
          targetX: slot.x,
          targetY: slot.y,
          velocityX: 0,
          velocityY: 0
        });
        player.attributes = this.createPlayerAttributes(player, slot.role);
        player.matchStats = player.matchStats || this.createPlayerMatchStats();
      });
    }

    createPlayerAttributes(player, role) {
      const base = player.overall ?? 80;
      const biases = ROLE_ATTRIBUTE_BIASES[role] || {};
      return ATTRIBUTE_NAMES.reduce((attributes, name) => {
        const override = player.attributeOverrides?.[name];
        attributes[name] = this.clamp(
          Math.round(override ?? (base + (biases[name] || 0))),
          5,
          99
        );
        return attributes;
      }, {});
    }

    createPlayerMatchStats() {
      return {
        touches: 0,
        distanceCovered: 0,
        passesAttempted: 0,
        passesCompleted: 0,
        shots: 0,
        goals: 0,
        interceptions: 0,
        recoveries: 0,
        carries: 0,
        saves: 0
      };
    }

    prepareKickoff(team) {
      this.teams.forEach((candidateTeam) => {
        candidateTeam.players.forEach((player) => {
          const ownHalfY = candidateTeam.attacksDown
            ? Math.min(player.baseY, 48.5)
            : Math.max(player.baseY, 51.5);
          player.x = player.baseX;
          player.y = player.role === "GOL" ? player.baseY : ownHalfY;
          player.targetX = player.x;
          player.targetY = player.y;
          player.velocityX = 0;
          player.velocityY = 0;
        });
      });

      const taker = team.players.find((player) => player.number === 9) ||
        team.players.find((player) => this.isForward(player)) ||
        team.players[0];
      taker.x = 50;
      taker.y = 50;
      taker.targetX = 50;
      taker.targetY = 50;
      this.setBallController(taker);
      this.decisionRemainingMs = 520;
      this.updatePressure();
    }

    command(command) {
      if (!command || typeof command.type !== "string") return;

      if (command.type === "start") {
        if (this.state === "finished" || this.state === "goalPause") return;
        const previousState = this.state;
        if (this.state === "halftime") {
          this.period = 2;
          this.periodElapsedMatchMs = 0;
          this.teams.forEach((team) => {
            team.attacksDown = !team.attacksDown;
            this.applyFormation(team);
          });
          this.prepareKickoff(this.teams[1]);
        }
        this.state = "playing";
        this.emit(previousState === "paused" ? "match_resumed" : (this.period === 2 ? "second_half_started" : "match_started"));
        return;
      }

      if (command.type === "pause" && this.state === "playing") {
        this.state = "paused";
        this.emit("match_paused");
        return;
      }

      if (command.type === "pass" && this.state === "playing") {
        this.performPass(command.receiverId);
        return;
      }

      if (command.type === "confirmGoal" && this.state === "goalPause") {
        const restartTeam = this.teams.find((team) => team.id === this.ball.restartTeamId) || this.teams[0];
        this.prepareKickoff(restartTeam);
        this.state = "playing";
        this.emit("kickoff", { teamId: restartTeam.id, reason: "goal" });
        return;
      }

      if (command.type === "reset") {
        this.reset();
      }
    }

    advance(deltaMs) {
      if (this.state !== "playing") return this.getSnapshot();

      const safeDelta = Math.max(0, Math.min(Number(deltaMs) || 0, 10_000));
      this.accumulatorMs += safeDelta;

      while (this.accumulatorMs >= this.fixedStepMs && this.state === "playing") {
        this.step(this.fixedStepMs);
        this.accumulatorMs -= this.fixedStepMs;
      }

      return this.getSnapshot();
    }

    step(stepMs) {
      this.simulationElapsedMs += stepMs;
      this.tacticalAccumulatorMs += stepMs;

      if (this.tacticalAccumulatorMs >= 250) {
        this.updateTacticalTargets();
        this.tacticalAccumulatorMs %= 250;
      }

      this.movePlayers(stepMs);
      this.updatePressure();
      this.updateBall(stepMs);

      if (this.possession) {
        const possessionTeam = this.getTeam(this.possession.teamId);
        if (possessionTeam) {
          possessionTeam.stats.possessionMatchMs += stepMs * this.matchClockRate;
        }
      }

      if (this.ball.mode === "loose") {
        this.updateLooseBall(stepMs);
      }

      if (this.ball.mode === "out" && this.restartRemainingMs > 0) {
        this.restartRemainingMs -= stepMs;
        if (this.restartRemainingMs <= 0) this.restartFromOut();
      }

      if (this.autonomous && this.ball.mode === "controlled") {
        this.decisionRemainingMs -= stepMs;
        if (this.decisionRemainingMs <= 0) {
          this.decideAction();
        }
      }

      const matchDeltaMs = stepMs * this.matchClockRate;
      this.periodElapsedMatchMs += matchDeltaMs;
      this.elapsedMatchMs = (this.period - 1) * HALF_DURATION_MS + this.periodElapsedMatchMs;

      const stoppageMs = this.period === 1 ? this.stoppageMs.first : this.stoppageMs.second;
      if (this.periodElapsedMatchMs >= HALF_DURATION_MS + stoppageMs) {
        this.periodElapsedMatchMs = HALF_DURATION_MS + stoppageMs;
        this.elapsedMatchMs = this.period === 1
          ? this.periodElapsedMatchMs
          : HALF_DURATION_MS + this.periodElapsedMatchMs;
        this.state = this.period === 1 ? "halftime" : "finished";
        this.emit(this.period === 1 ? "halftime" : "fulltime");
      }
    }

    reset() {
      this.accumulatorMs = 0;
      this.simulationElapsedMs = 0;
      this.tacticalAccumulatorMs = 0;
      this.decisionRemainingMs = 650;
      this.restartRemainingMs = 0;
      this.events.length = 0;
      this.sequence = 0;
      this.state = "pre";
      this.period = 1;
      this.periodElapsedMatchMs = 0;
      this.elapsedMatchMs = 0;
      this.teams.forEach((team, index) => {
        team.score = 0;
        Object.assign(team.stats, {
          possessionMatchMs: 0,
          passesAttempted: 0,
          passesCompleted: 0,
          passesMissed: 0,
          shots: 0,
          goals: 0,
          turnovers: 0
        });
        team.attacksDown = index === 1;
        this.applyFormation(team);
        team.players.forEach((player) => {
          player.matchStats = this.createPlayerMatchStats();
        });
      });
      this.prepareKickoff(this.teams[0]);
      this.updatePressure();
      this.emit("match_reset");
    }

    performPass(receiverId) {
      const passer = this.getController();
      const receiver = this.findPlayer(receiverId);
      if (!passer || !receiver || passer.id === receiver.id || passer.teamId !== receiver.teamId) return false;

      const distance = this.distance(passer, receiver);
      const passingTeam = this.getTeam(passer.teamId);
      passingTeam.stats.passesAttempted += 1;
      passer.matchStats.passesAttempted += 1;
      this.possession = null;
      Object.assign(this.ball, {
        mode: "travelling",
        x: passer.x,
        y: passer.y,
        controllerId: null,
        intendedReceiverId: receiver.id,
        action: "pass",
        startX: passer.x,
        startY: passer.y,
        targetX: receiver.x,
        targetY: receiver.y,
        speed: 28 + passer.attributes.passing * 0.08 + Math.min(distance, 35) * 0.42,
        velocityX: 0,
        velocityY: 0,
        travelled: 0,
        distance,
        outcome: null,
        restartTeamId: null,
        lastTouchedTeamId: passer.teamId,
        contactedPlayerIds: [],
        passerId: passer.id,
        shooterId: null,
        goalChance: null
      });
      this.emit("pass_started", {
        teamId: passer.teamId,
        playerId: passer.id,
        receiverId: receiver.id,
        distance
      });
      return true;
    }

    updateBall(stepMs) {
      if (this.ball.mode === "controlled") {
        const controller = this.getController();
        if (controller) {
          this.ball.x = controller.x;
          this.ball.y = controller.y;
        }
        return;
      }

      if (this.ball.mode !== "travelling") return;

      const receiver = this.findPlayer(this.ball.intendedReceiverId);
      if (!receiver && this.ball.action !== "shot") {
        this.makeBallLoose();
        return;
      }

      if (receiver && this.ball.action === "pass") {
        this.ball.targetX = receiver.x;
        this.ball.targetY = receiver.y;
      }

      const target = { x: this.ball.targetX, y: this.ball.targetY };
      const remaining = this.distance(this.ball, target);
      const stepDistance = this.ball.speed * (stepMs / 1000);

      if (remaining <= stepDistance + 0.35) {
        this.ball.x = target.x;
        this.ball.y = target.y;
        if (this.ball.action === "shot") {
          this.resolveShot();
        } else {
          const passer = this.findPlayer(this.ball.passerId);
          const receptionChance = this.autonomous
            ? this.clamp(
                0.72 +
                  receiver.attributes.control / 420 +
                  receiver.attributes.positioning / 900 -
                  this.ball.distance / 320,
                0.68,
                0.98
              )
            : 1;
          if (this.random.next() <= receptionChance) {
            this.setBallController(receiver);
            const receivingTeam = this.getTeam(receiver.teamId);
            receivingTeam.stats.passesCompleted += 1;
            if (passer) passer.matchStats.passesCompleted += 1;
            this.emit("pass_completed", {
              teamId: receiver.teamId,
              playerId: receiver.id
            });
          } else {
            const passingTeam = this.getTeam(receiver.teamId);
            passingTeam.stats.passesMissed += 1;
            this.makeBallLoose({
              x: (this.random.next() - 0.5) * 8,
              y: (this.random.next() - 0.5) * 8
            }, receiver.teamId);
            this.emit("bad_control", {
              teamId: receiver.teamId,
              playerId: receiver.id,
              passerId: passer?.id || null
            });
          }
        }
        return;
      }

      const directionX = (target.x - this.ball.x) / Math.max(remaining, 0.001);
      const directionY = (target.y - this.ball.y) / Math.max(remaining, 0.001);
      const previous = { x: this.ball.x, y: this.ball.y };
      this.ball.x += directionX * stepDistance;
      this.ball.y += directionY * stepDistance;
      this.ball.travelled += stepDistance;

      if (this.ball.action === "pass") {
        const contact = this.findBallContact(previous, this.ball, receiver);
        if (contact?.type === "control") {
          const interceptor = contact.player;
          const passingTeam = this.getOpponent(this.getTeam(interceptor.teamId));
          passingTeam.stats.passesMissed += 1;
          passingTeam.stats.turnovers += 1;
          interceptor.matchStats.interceptions += 1;
          interceptor.matchStats.recoveries += 1;
          this.setBallController(interceptor);
          this.emit("pass_intercepted", {
            teamId: interceptor.teamId,
            playerId: interceptor.id,
            intendedReceiverId: receiver.id
          });
        } else if (contact?.type === "deflect") {
          const passingTeam = this.getOpponent(this.getTeam(contact.player.teamId));
          passingTeam.stats.passesMissed += 1;
          this.makeBallLoose({
            x: directionX * this.ball.speed * 0.32 + (this.random.next() - 0.5) * 9,
            y: directionY * this.ball.speed * 0.32 + (this.random.next() - 0.5) * 9
          }, contact.player.teamId);
          this.emit("pass_deflected", {
            teamId: contact.player.teamId,
            playerId: contact.player.id,
            intendedReceiverId: receiver.id
          });
        }
      }
    }

    makeBallLoose(velocity = { x: 0, y: 0 }, lastTouchedTeamId = this.ball.lastTouchedTeamId) {
      Object.assign(this.ball, {
        mode: "loose",
        controllerId: null,
        intendedReceiverId: null,
        action: null,
        speed: 0,
        velocityX: velocity.x || 0,
        velocityY: velocity.y || 0,
        outcome: null,
        lastTouchedTeamId,
        contactedPlayerIds: [],
        passerId: null,
        shooterId: null,
        goalChance: null
      });
      this.possession = null;
    }

    setBallController(player) {
      if (!player) {
        this.makeBallLoose();
        return;
      }

      this.possession = {
        teamId: player.teamId,
        playerId: player.id
      };
      player.matchStats.touches += 1;
      Object.assign(this.ball, {
        mode: "controlled",
        x: player.x,
        y: player.y,
        controllerId: player.id,
        intendedReceiverId: null,
        action: null,
        startX: player.x,
        startY: player.y,
        targetX: player.x,
        targetY: player.y,
        speed: 0,
        velocityX: 0,
        velocityY: 0,
        travelled: 0,
        distance: 0,
        outcome: null,
        restartTeamId: null,
        lastTouchedTeamId: player.teamId,
        contactedPlayerIds: [],
        passerId: null,
        shooterId: null,
        goalChance: null
      });
      this.decisionRemainingMs = this.getDecisionDelay(player);
    }

    getController() {
      return this.findPlayer(this.ball.controllerId);
    }

    findPlayer(playerId) {
      if (!playerId) return null;
      for (const team of this.teams) {
        const player = team.players.find((candidate) => candidate.id === playerId);
        if (player) return player;
      }
      return null;
    }

    isForward(player) {
      return ["ATA", "CA", "PE", "PD"].includes(player.role);
    }

    distance(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    emit(type, data = {}) {
      this.events.push({
        id: ++this.sequence,
        type,
        matchMs: this.elapsedMatchMs,
        data
      });
    }

    updateTacticalTargets() {
      const possessionTeamId = this.possession?.teamId;
      const carrier = this.getController();

      this.teams.forEach((team) => {
        const inPossession = team.id === possessionTeamId;
        const direction = team.attacksDown ? 1 : -1;
        const ballProgress = this.getAttackProgress(this.ball, team);
        const nearestPresser = !inPossession && carrier
          ? this.nearestPlayers(team.players.filter((player) => player.role !== "GOL"), carrier, 1)[0]
          : null;
        const markingAssignments = !inPossession && carrier
          ? this.assignDefensiveMarks(team, carrier, nearestPresser)
          : new Map();

        team.players.forEach((player) => {
          if (player.role === "GOL") {
            player.markingTargetId = null;
            player.targetX = this.clamp(50 + (this.ball.x - 50) * 0.08, 45, 55);
            player.targetY = player.baseY + direction * this.clamp(ballProgress * 0.025, 0, 4);
            return;
          }

          if (player === carrier) {
            player.markingTargetId = null;
            const goal = this.getGoalPoint(team);
            const towardGoal = this.normalized(player, goal);
            const carry = this.getCarrierCarryDistance(player);
            player.targetX = this.clamp(player.x + towardGoal.x * carry, 5, 95);
            player.targetY = this.clamp(player.y + towardGoal.y * carry, 5, 95);
            return;
          }

          if (!inPossession && player === nearestPresser) {
            player.markingTargetId = carrier.id;
            const pressPoint = this.pointBetween(carrier, this.getOwnGoalPoint(team), 0.08);
            player.targetX = this.clamp(pressPoint.x, 5, 95);
            player.targetY = this.clamp(pressPoint.y, 5, 95);
            return;
          }

          if (inPossession) {
            player.markingTargetId = null;
            const distanceToTarget = Math.hypot(player.targetX - player.x, player.targetY - player.y);
            if (this.simulationElapsedMs >= player.nextTargetReviewMs || distanceToTarget < 1.2) {
              const target = this.getOffBallTarget(player, team, carrier);
              player.targetX = target.x;
              player.targetY = target.y;
              player.nextTargetReviewMs = this.simulationElapsedMs + 460 + this.random.next() * 520;
            }
            return;
          }

          const defensiveTarget = this.getDefensiveMovementTarget(
            player,
            team,
            markingAssignments.get(player.id) || null,
            ballProgress
          );
          player.markingTargetId = markingAssignments.get(player.id)?.id || null;
          player.targetX = this.clamp(player.targetX * 0.18 + defensiveTarget.x * 0.82, 5, 95);
          player.targetY = this.clamp(player.targetY * 0.18 + defensiveTarget.y * 0.82, 5, 95);
        });
      });
    }

    getOffBallTarget(player, team, carrier) {
      if (!carrier) return { x: player.baseX, y: player.baseY };

      const opponents = this.getOpponent(team).players;
      const teammates = team.players.filter((teammate) => teammate !== player && teammate !== carrier);
      const direction = team.attacksDown ? 1 : -1;
      const goal = this.getGoalPoint(team);
      const towardGoal = this.normalized(player, goal);
      const marker = this.nearestPlayers(opponents.filter((opponent) => opponent.role !== "GOL"), player, 1)[0];
      const awayFromMarker = marker ? this.normalized(marker, player) : { x: 0, y: 0 };
      const anchor = this.getAttackingAnchor(player, team);
      const side = Math.sign(player.baseX - 50) || (player.number % 2 ? -1 : 1);
      const supportSide = Math.sign(player.x - carrier.x) || side;
      const pulse = Math.sin(this.simulationElapsedMs / 1_150 + player.movementPhase);
      const carrierProgress = this.getAttackProgress(carrier, team);
      const candidates = [
        anchor,
        {
          x: carrier.x + supportSide * (this.isForward(player) ? 11 : 9),
          y: carrier.y + direction * (this.isForward(player) ? 8 : (this.isDefensive(player) ? -10 : -3))
        },
        {
          x: player.x + awayFromMarker.x * 7 + towardGoal.x * 4,
          y: player.y + awayFromMarker.y * 7 + towardGoal.y * 4
        },
        {
          x: anchor.x + side * (5 + pulse * 3),
          y: anchor.y + direction * (this.isForward(player) ? 9 : 5)
        },
        {
          x: carrier.x - supportSide * (this.isWide(player) ? 16 : 11),
          y: carrier.y + direction * (this.isForward(player) ? 12 : 2)
        }
      ];

      if (this.isForward(player) || player.role === "MC") {
        candidates.push({
          x: this.clamp(carrier.x + side * (this.isForward(player) ? 14 : 9), 12, 88),
          y: team.attacksDown
            ? this.clamp(Math.max(player.y, carrier.y + 13), 8, 93)
            : this.clamp(Math.min(player.y, carrier.y - 13), 7, 92)
        });
      }

      if (this.isWide(player)) {
        const wideAdvance = player.role === "ALA"
          ? 24
          : (this.isWideMidfielder(player) ? 20 : 14);
        candidates.push({
          x: side < 0 ? 8 + Math.abs(pulse) * 7 : 92 - Math.abs(pulse) * 7,
          y: team.attacksDown
            ? this.clamp(carrier.y + wideAdvance, 16, 94)
            : this.clamp(carrier.y - wideAdvance, 6, 84)
        });
      }

      const best = candidates
        .map((candidate) => {
          const point = this.clampToRoleZone(player, team, candidate, carrierProgress);
          const nearestOpponent = Math.min(...opponents.map((opponent) => this.distance(point, opponent)));
          const nearestTeammate = teammates.length
            ? Math.min(...teammates.map((teammate) => this.distance(point, teammate)))
            : 12;
          const passDistance = this.distance(carrier, point);
          const passDistanceFit = this.clamp(1 - Math.abs(passDistance - 16) / 22, 0, 1);
          const laneSafety = this.getLaneSafety(carrier, point, opponents);
          const progress = this.getAttackProgress(point, team) - carrierProgress;
          const usefulProgress = this.clamp((progress + 8) / 24, 0, 1);
          const goalThreat = this.clamp((44 - this.distance(point, goal)) / 30, 0, 1);
          const movementCost = this.clamp(this.distance(player, point) / 24, 0, 1);
          const roleProgress = this.isFullback(player)
            ? usefulProgress * 0.88
            : (this.isDefensive(player) ? usefulProgress * 0.45 : usefulProgress);
          const finalThirdRunner = this.isForward(player) ||
            player.role === "MC" ||
            this.isWideMidfielder(player) ||
            player.role === "ALA";
          const finalThirdRun = carrierProgress > 42 && finalThirdRunner
            ? goalThreat * (this.isWideMidfielder(player) || player.role === "ALA" ? 0.58 : 0.48)
            : goalThreat * 0.06;
          const wideAdvanceBias = this.isWideMidfielder(player) || player.role === "ALA"
            ? usefulProgress * 0.38
            : (this.isFullback(player) ? usefulProgress * 0.2 : 0);
          const positioningBias = player.attributes.positioning / 500;
          const score =
            this.clamp(nearestOpponent / 15, 0, 1) * 0.3 +
            laneSafety * 0.26 +
            passDistanceFit * 0.2 +
            this.clamp(nearestTeammate / 11, 0, 1) * 0.12 +
            roleProgress * (this.isForward(player) || player.role === "MC" ? 0.26 : 0.14) -
            movementCost * 0.08 +
            finalThirdRun +
            wideAdvanceBias +
            positioningBias +
            player.roamingBias * 0.015;
          return { point, score };
        })
        .sort((a, b) => b.score - a.score)[0];

      const separated = this.avoidCrowding(player, best?.point || anchor);
      return this.clampToRoleZone(player, team, separated, carrierProgress);
    }

    getAttackingAnchor(player, team) {
      const direction = team.attacksDown ? 1 : -1;
      const ballProgress = this.getAttackProgress(this.ball, team);
      const longitudinalShift = this.clamp((ballProgress - 35) * 0.28, -3, 18);
      const horizontalShift = this.clamp((this.ball.x - 50) * 0.18, -8, 8);
      let x = player.baseX + horizontalShift;
      let y = player.baseY + direction * (longitudinalShift + this.getRoleAttackPush(player.role));

      if (this.isWide(player)) {
        const side = player.baseX < 50 ? -1 : 1;
        const ballSide = this.isBallSide(player);
        x += side * (ballSide ? 5 : -4);

        if (this.isFullback(player)) {
          y += direction * (ballSide ? 12 : 6);
        } else if (this.isWideMidfielder(player)) {
          y += direction * (ballSide ? 18 : 13);
        } else if (player.role === "ALA") {
          y += direction * (ballSide ? 22 : 16);
        }
      }
      if (this.isForward(player)) {
        const forwards = team.players.filter((candidate) => this.isForward(candidate));
        const forwardIndex = forwards.indexOf(player);
        x = 50 + (forwardIndex === 0 ? -10 : 10) + horizontalShift * 0.35;
        y += direction * 5;
      }

      return this.clampToRoleZone(player, team, { x, y }, ballProgress);
    }

    clampToRoleZone(player, team, point, ballProgress = this.getAttackProgress(this.ball, team)) {
      const side = player.baseX < 50 ? -1 : 1;
      let xMin = player.baseX - 15;
      let xMax = player.baseX + 15;
      let progressMin = 22;
      let progressMax = 78;

      if (player.role === "ZAG") {
        xMin = player.baseX - 13;
        xMax = player.baseX + 13;
        progressMin = 12;
        progressMax = 53;
      } else if (["LE", "LD"].includes(player.role)) {
        xMin = side < 0 ? 5 : 58;
        xMax = side < 0 ? 42 : 95;
        progressMin = this.clamp(
          ballProgress - (this.isBallSide(player) ? 6 : 14),
          18,
          62
        );
        progressMax = 88;
      } else if (player.role === "VOL") {
        xMin = 28;
        xMax = 72;
        progressMin = 22;
        progressMax = 68;
      } else if (player.role === "MC") {
        xMin = 24;
        xMax = 76;
        progressMin = 32;
        progressMax = 82;
      } else if (["ME", "MD"].includes(player.role)) {
        xMin = side < 0 ? 5 : 54;
        xMax = side < 0 ? 46 : 95;
        progressMin = this.clamp(
          ballProgress + (this.isBallSide(player) ? 12 : 7),
          44,
          80
        );
        progressMax = 96;
      } else if (player.role === "ALA") {
        xMin = side < 0 ? 4 : 52;
        xMax = side < 0 ? 48 : 96;
        progressMin = this.clamp(
          ballProgress + (this.isBallSide(player) ? 16 : 10),
          42,
          84
        );
        progressMax = 95;
      } else if (this.isForward(player)) {
        xMin = 18;
        xMax = 82;
        progressMin = this.clamp(ballProgress - 8, 46, 76);
        progressMax = 94;
      }

      const progress = this.clamp(this.getAttackProgress(point, team), progressMin, progressMax);
      return {
        x: this.clamp(point.x, xMin, xMax),
        y: team.attacksDown ? progress : 100 - progress
      };
    }

    assignDefensiveMarks(team, carrier, presser) {
      const assignments = new Map();
      const opponents = this.getOpponent(team).players
        .filter((opponent) => opponent.role !== "GOL" && opponent !== carrier)
        .sort((a, b) => this.distance(a, this.getOwnGoalPoint(team)) - this.distance(b, this.getOwnGoalPoint(team)));
      const defenders = team.players
        .filter((player) => player.role !== "GOL" && player !== presser)
        .sort((a, b) => this.distance(a, carrier) - this.distance(b, carrier));

      defenders.forEach((defender) => {
        const mark = opponents
          .map((opponent) => {
            const laneDistance = Math.abs(opponent.x - defender.baseX);
            const currentDistance = this.distance(defender, opponent);
            const threat = this.distance(opponent, this.getOwnGoalPoint(team));
            const rolePenalty = this.isDefensive(defender) ? 0 : 2.5;
            return {
              opponent,
              score: currentDistance + laneDistance * 0.18 + threat * 0.04 + rolePenalty
            };
          })
          .filter((candidate) => candidate.score < 44)
          .sort((a, b) => a.score - b.score)[0]?.opponent;

        if (mark) assignments.set(defender.id, mark);
      });

      return assignments;
    }

    getDefensiveMovementTarget(player, team, mark, ballProgress) {
      const direction = team.attacksDown ? 1 : -1;
      const blockProgress = this.clamp(ballProgress - 22, 15, 62);
      const lineProgress = this.getRoleDefensiveProgress(player.role, blockProgress);
      const horizontalShift = this.clamp((this.ball.x - 50) * 0.12, -8, 8);
      let zoneTarget = {
        x: player.baseX + horizontalShift,
        y: team.attacksDown ? lineProgress : 100 - lineProgress
      };

      if (this.isWide(player) && !this.isBallSide(player)) {
        zoneTarget.x += (50 - zoneTarget.x) * 0.38;
      }
      if (!mark) return this.avoidCrowding(player, zoneTarget);

      const goalSide = this.pointBetween(mark, this.getOwnGoalPoint(team), this.isDefensive(player) ? 0.16 : 0.1);
      const defensiveQuality = (player.attributes.defending + player.attributes.positioning) / 200;
      const markingWeight = this.clamp(
        (this.isDefensive(player) ? 0.7 : 0.62) + defensiveQuality * 0.2,
        0.68,
        0.94
      );
      const target = {
        x: zoneTarget.x * (1 - markingWeight) + goalSide.x * markingWeight,
        y: zoneTarget.y * (1 - markingWeight) + goalSide.y * markingWeight + direction * 0.8
      };
      return this.avoidCrowding(player, target);
    }

    movePlayers(stepMs) {
      const seconds = stepMs / 1000;
      const controller = this.getController();

      this.teams.forEach((team) => {
        team.players.forEach((player) => {
          const distance = Math.hypot(player.targetX - player.x, player.targetY - player.y);
          const baseSpeed = this.getPlayerSpeed(player);
          const pressurePenalty = player === controller && player.pressure > 0.55 ? 0.82 : 1;
          const arrivalFactor = this.clamp(distance / 4.5, 0.12, 1);
          const desiredSpeed = baseSpeed * pressurePenalty * arrivalFactor;
          const desiredVelocity = distance > 0.03
            ? {
                x: ((player.targetX - player.x) / distance) * desiredSpeed,
                y: ((player.targetY - player.y) / distance) * desiredSpeed
              }
            : { x: 0, y: 0 };
          const acceleration = (this.isForward(player) || this.isWide(player) ? 20 : 17) * seconds;
          player.velocityX = this.approach(player.velocityX, desiredVelocity.x, acceleration);
          player.velocityY = this.approach(player.velocityY, desiredVelocity.y, acceleration);

          const stepX = player.velocityX * seconds;
          const stepY = player.velocityY * seconds;
          const stepDistance = Math.hypot(stepX, stepY);
          let travelledDistance = stepDistance;
          if (distance > 0.03 && stepDistance >= distance) {
            player.x = player.targetX;
            player.y = player.targetY;
            travelledDistance = distance;
            player.velocityX *= 0.35;
            player.velocityY *= 0.35;
          } else {
            player.x += stepX;
            player.y += stepY;
          }
          player.matchStats.distanceCovered += travelledDistance;
          player.x = this.clamp(player.x, 4, 96);
          player.y = this.clamp(player.y, 3, 97);
        });
      });
    }

    updatePressure() {
      this.teams.forEach((team) => {
        const opponents = this.getOpponent(team).players.filter((player) => player.role !== "GOL");
        team.players.forEach((player) => {
          const distances = opponents
            .map((opponent) => ({
              opponent,
              distance: this.distance(player, opponent)
            }))
            .sort((a, b) => a.distance - b.distance);
          const nearest = distances[0];
          const crowd = distances
            .filter((item) => item.distance < 10)
            .reduce((sum, item) =>
              sum + ((10 - item.distance) / 10) * (0.75 + item.opponent.attributes.defending / 200)
            , 0);
          const nearestDefendingFactor = nearest
            ? 0.72 + nearest.opponent.attributes.defending / 180
            : 1;
          const composureFactor = 1.18 - player.attributes.control / 260;
          player.markerId = nearest?.opponent.id || null;
          player.pressure = nearest
            ? this.clamp(((1 - nearest.distance / 17) * nearestDefendingFactor + crowd * 0.1) * composureFactor, 0, 1)
            : 0;
          player.spaceScore = this.clamp((nearest?.distance || 18) / 18, 0, 1);
        });
      });
    }

    decideAction() {
      const carrier = this.getController();
      if (!carrier) return;

      const team = this.getTeam(carrier.teamId);
      const goalDistance = this.distance(carrier, this.getGoalPoint(team));
      const maximumShotDistance = this.isForward(carrier)
        ? 40
        : (["MC", "ME", "MD"].includes(carrier.role) ? 33 : 0);
      const shotCloseness = maximumShotDistance
        ? this.clamp((maximumShotDistance - goalDistance) / maximumShotDistance, 0, 1)
        : 0;
      let shotChance = maximumShotDistance && goalDistance < maximumShotDistance
        ? this.clamp(0.36 + shotCloseness * 0.62 + (1 - carrier.pressure) * 0.1, 0.18, 0.92)
        : 0;
      if (goalDistance < 24 && maximumShotDistance) shotChance = Math.max(shotChance, 0.9);
      if (goalDistance > 30) shotChance *= 0.3;

      if (shotChance && this.random.next() < shotChance) {
        this.performShot(carrier);
        return;
      }

      const passTarget = this.choosePassTarget(carrier);
      const finalThirdCarryBoost = (
        (this.isForward(carrier) || ["MC", "ME", "MD"].includes(carrier.role)) &&
        goalDistance < 48 &&
        goalDistance > 19 &&
        carrier.pressure < 0.7
      ) ? 0.38 : 0;
      const carryChance = carrier.role === "GOL"
        ? 0
        : this.clamp(
            0.12 +
              carrier.spaceScore * 0.2 -
              carrier.pressure * 0.22 +
              finalThirdCarryBoost +
              (carrier.attributes.control + carrier.attributes.pace - 160) / 300,
            0.04,
            0.72
          );

      if (passTarget && (carrier.pressure > 0.58 || this.random.next() > carryChance)) {
        this.performPass(passTarget.id);
        return;
      }

      const oldPosition = { x: carrier.x, y: carrier.y };
      const goal = this.getGoalPoint(team);
      const towardGoal = this.normalized(carrier, goal);
      carrier.targetX = this.clamp(carrier.x + towardGoal.x * this.getCarrierCarryDistance(carrier), 5, 95);
      carrier.targetY = this.clamp(carrier.y + towardGoal.y * this.getCarrierCarryDistance(carrier), 5, 95);
      carrier.matchStats.carries += 1;
      this.emit("carry", {
        teamId: team.id,
        playerId: carrier.id,
        from: oldPosition,
        to: { x: carrier.targetX, y: carrier.targetY }
      });
      this.decisionRemainingMs = this.getDecisionDelay(carrier) * 0.82;
    }

    choosePassTarget(passer) {
      const team = this.getTeam(passer.teamId);
      const opponents = this.getOpponent(team).players;
      const passerProgress = this.getAttackProgress(passer, team);
      const closeOptions = team.players
        .filter((player) => player !== passer)
        .filter((player) => this.distance(passer, player) <= 28)
        .filter((player) => this.getLaneSafety(passer, player, opponents) >= 0.36)
        .length;
      const candidates = team.players
        .filter((player) => player !== passer)
        .map((player) => {
          const distance = this.distance(passer, player);
          const progress = this.getAttackProgress(player, team) - this.getAttackProgress(passer, team);
          const laneSafety = this.getLaneSafety(passer, player, opponents);
          const distanceFit = distance < 8
            ? 0.72
            : (distance < 20 ? 1.35 : (distance < 28 ? 1.08 : (distance < 36 ? 0.48 : 0.18)));
          const progressBias = progress < -10 ? 0.38 : (progress < 4 ? 0.94 : (progress < 18 ? 1.3 : 1.38));
          const pressureBias = Math.max(0.22, 1 - player.pressure * 0.72);
          let roleBias = this.isForward(player) ? 1.2 : (player.role === "MC" || player.role === "VOL" ? 1.16 : 1);
          if (passerProgress > 42 && this.isForward(player)) roleBias *= 1.48;
          if (passerProgress > 68 && player.role === "MC") roleBias *= 1.28;
          const supportBias = distance >= 8 && distance <= 24 ? 1.24 : 1;
          const longOptionPenalty = closeOptions >= 3 && distance > 30 ? 0.42 : 1;
          const highQualityLongOption = distance > 30 && progress > 10 && laneSafety > 0.82 && player.spaceScore > 0.72
            ? 1.8
            : 1;
          const receiverGoalDistance = this.distance(player, this.getGoalPoint(team));
          const chanceCreationBias = passerProgress > 44 &&
            distance <= 27 &&
            receiverGoalDistance < 42 &&
            (this.isForward(player) || player.role === "MC")
            ? 3
            : 1;
          let buildUpBias = 1;
          if (passer.role === "GOL") {
            if (["ZAG", "LE", "LD", "VOL"].includes(player.role) && distance <= 28) buildUpBias *= 2.4;
            if (this.isForward(player)) buildUpBias *= 0.08;
            if (distance > 30) buildUpBias *= 0.1;
          } else if (passer.role === "ZAG" && this.isForward(player) && distance > 28) {
            buildUpBias *= 0.16;
          }
          const offsidePenalty = this.isOffside(player, passer) ? 0.02 : 1;
          const passerQuality = (passer.attributes.passing * 0.58 + passer.attributes.vision * 0.42) / 100;
          const receiverQuality = (player.attributes.control + player.attributes.positioning) / 200;
          const abilityBias = 0.62 + passerQuality * 0.24 + receiverQuality * 0.24;
          const longPassSkill = distance > 30 ? 0.42 + passerQuality * 0.78 : 1;
          return {
            player,
            weight: Math.max(
              0.003,
              distanceFit *
              progressBias *
              laneSafety *
              pressureBias *
              roleBias *
              supportBias *
              longOptionPenalty *
              highQualityLongOption *
              chanceCreationBias *
              buildUpBias *
              abilityBias *
              longPassSkill *
              offsidePenalty
            )
          };
        });

      return this.pickWeighted(candidates);
    }

    performShot(shooter) {
      const team = this.getTeam(shooter.teamId);
      const opponent = this.getOpponent(team);
      const goalkeeper = opponent.players.find((player) => player.role === "GOL");
      const goal = this.getGoalPoint(team);
      const distance = this.distance(shooter, goal);
      const finishingQuality = (
        shooter.attributes.finishing * 0.62 +
        shooter.attributes.control * 0.18 +
        shooter.attributes.positioning * 0.2
      ) / 100;
      const goalkeeperQuality = goalkeeper?.attributes.goalkeeping || 50;
      const goalChance = this.clamp(
        (
          0.025 +
          (1 - this.clamp(distance / 48, 0, 1)) * 0.4 +
          (1 - shooter.pressure) * 0.09
        ) * (0.62 + finishingQuality * 0.58) -
          (goalkeeperQuality - 50) / 420,
        0.015,
        0.6
      );
      const roll = this.random.next();
      const saveChance = this.clamp(
        0.34 + goalkeeperQuality / 180 - shooter.attributes.finishing / 450,
        0.3,
        0.82
      );
      const outcome = roll < goalChance
        ? "goal"
        : (this.random.next() < saveChance ? "saved" : "out");
      const target = outcome === "saved" && goalkeeper
        ? { x: goalkeeper.x, y: goalkeeper.y }
        : (outcome === "out"
          ? { x: this.clamp(goal.x + (this.random.next() - 0.5) * 24, 2, 98), y: team.attacksDown ? 99 : 1 }
          : goal);

      team.stats.shots += 1;
      shooter.matchStats.shots += 1;
      this.possession = null;
      Object.assign(this.ball, {
        mode: "travelling",
        x: shooter.x,
        y: shooter.y,
        controllerId: null,
        intendedReceiverId: outcome === "saved" ? goalkeeper?.id || null : null,
        action: "shot",
        startX: shooter.x,
        startY: shooter.y,
        targetX: target.x,
        targetY: target.y,
        speed: 58,
        velocityX: 0,
        velocityY: 0,
        travelled: 0,
        distance,
        outcome,
        restartTeamId: opponent.id,
        lastTouchedTeamId: shooter.teamId,
        contactedPlayerIds: [],
        shooterId: shooter.id,
        goalChance
      });
      this.emit("shot_started", {
        teamId: team.id,
        playerId: shooter.id,
        distance,
        goalChance
      });
    }

    resolveShot() {
      const shooter = this.findPlayer(this.ball.shooterId);
      const shootingTeam = shooter ? this.getTeam(shooter.teamId) : null;
      const defendingTeam = shootingTeam ? this.getOpponent(shootingTeam) : this.getTeam(this.ball.restartTeamId);
      const outcome = this.ball.outcome;

      if (outcome === "goal" && shootingTeam) {
        shootingTeam.score += 1;
        shootingTeam.stats.goals += 1;
        if (shooter) shooter.matchStats.goals += 1;
        this.state = "goalPause";
        Object.assign(this.ball, {
          mode: "out",
          controllerId: null,
          action: null,
          restartTeamId: defendingTeam.id
        });
        this.possession = null;
        this.emit("goal", {
          teamId: shootingTeam.id,
          playerId: shooter.id,
          score: this.teams.map((team) => team.score),
          distance: this.ball.distance,
          goalChance: this.ball.goalChance
        });
        return;
      }

      if (outcome === "saved" && defendingTeam) {
        const shotDistance = this.ball.distance;
        const goalkeeper = defendingTeam.players.find((player) => player.role === "GOL");
        if (goalkeeper) goalkeeper.matchStats.saves += 1;
        this.setBallController(goalkeeper);
        this.emit("shot_saved", {
          teamId: shootingTeam?.id || null,
          playerId: shooter?.id || null,
          goalkeeperId: goalkeeper?.id || null,
          distance: shotDistance
        });
        return;
      }

      Object.assign(this.ball, {
        mode: "out",
        controllerId: null,
        action: null,
        restartTeamId: defendingTeam?.id || this.teams[0].id
      });
      this.possession = null;
      this.restartRemainingMs = 700;
      this.emit("shot_out", {
        teamId: shootingTeam?.id || null,
        playerId: shooter?.id || null,
        distance: this.ball.distance
      });
    }

    updateLooseBall(stepMs) {
      const seconds = stepMs / 1000;
      this.ball.x += this.ball.velocityX * seconds;
      this.ball.y += this.ball.velocityY * seconds;
      const friction = Math.pow(0.16, seconds);
      this.ball.velocityX *= friction;
      this.ball.velocityY *= friction;

      const nearest = this.nearestPlayers(this.allPlayers(), this.ball, 1)[0];
      if (nearest && this.distance(nearest, this.ball) < 1.7) {
        nearest.matchStats.recoveries += 1;
        this.setBallController(nearest);
        this.emit("loose_ball_recovered", {
          teamId: nearest.teamId,
          playerId: nearest.id
        });
        return;
      }

      if (this.ball.x < 1 || this.ball.x > 99 || this.ball.y < 1 || this.ball.y > 99) {
        const lastTeam = this.getTeam(this.ball.lastTouchedTeamId);
        const restartTeam = lastTeam ? this.getOpponent(lastTeam) : this.teams[0];
        this.ball.mode = "out";
        this.ball.restartTeamId = restartTeam.id;
        this.restartRemainingMs = 600;
        this.emit("ball_out", { restartTeamId: restartTeam.id });
      }
    }

    restartFromOut() {
      const team = this.getTeam(this.ball.restartTeamId) || this.teams[0];
      const goalkeeper = team.players.find((player) => player.role === "GOL");
      this.setBallController(goalkeeper || team.players[0]);
      this.emit("restart", {
        teamId: team.id,
        playerId: this.ball.controllerId
      });
    }

    findBallContact(from, to, receiver) {
      if (!receiver) return null;
      const receiverTeam = this.getTeam(receiver.teamId);
      const opponents = this.getOpponent(receiverTeam).players.filter((player) => player.role !== "GOL");
      const contacted = new Set(this.ball.contactedPlayerIds || []);
      const candidates = opponents
        .filter((player) => !contacted.has(player.id))
        .map((player) => ({
          player,
          distance: this.distanceToSegment(player, from, to)
        }))
        .filter((item) => item.distance < 1.15)
        .sort((a, b) => a.distance - b.distance);

      const candidate = candidates[0];
      if (!candidate) return null;
      this.ball.contactedPlayerIds.push(candidate.player.id);
      const controlChance = this.clamp(
        0.3 +
          candidate.player.attributes.defending / 230 +
          candidate.player.attributes.positioning / 420,
        0.34,
        0.86
      );
      const roll = this.random.next();
      if (roll < controlChance) return { type: "control", player: candidate.player };
      if (roll < controlChance + 0.22) return { type: "deflect", player: candidate.player };
      return null;
    }

    getLaneSafety(from, to, opponents) {
      const danger = opponents.reduce((sum, opponent) => {
        const distance = this.distanceToSegment(opponent, from, to);
        if (distance > 10) return sum;
        return sum + (10 - distance) / 10;
      }, 0);
      return this.clamp(1 - danger * 0.24, 0.08, 1);
    }

    isOffside(player, passer) {
      if (!this.isForward(player) && !["ME", "MD"].includes(player.role)) return false;
      const team = this.getTeam(player.teamId);
      const opponent = this.getOpponent(team);
      const playerProgress = this.getAttackProgress(player, team);
      const passerProgress = this.getAttackProgress(passer, team);
      const defenderProgress = opponent.players
        .filter((candidate) => candidate.role !== "GOL")
        .map((candidate) => this.getAttackProgress(candidate, team))
        .sort((a, b) => b - a)[1] || 100;
      return playerProgress > 50 && playerProgress > passerProgress + 1.2 && playerProgress > defenderProgress + 1.2;
    }

    getRoleAttackPush(role) {
      if (role === "ZAG") return 4;
      if (role === "LE" || role === "LD") return 20;
      if (role === "VOL") return 7;
      if (role === "MC") return 13;
      if (role === "ME" || role === "MD") return 26;
      if (role === "ALA") return 30;
      if (this.isForward({ role })) return 13;
      return 0;
    }

    getRoleDefensiveProgress(role, blockProgress) {
      if (["ZAG", "LE", "LD"].includes(role)) return blockProgress;
      if (["VOL", "MC", "ME", "MD"].includes(role)) return this.clamp(blockProgress + 16, 28, 75);
      if (this.isForward({ role })) return this.clamp(blockProgress + 31, 43, 88);
      return 8;
    }

    getPlayerSpeed(player) {
      const paceFactor = this.clamp(0.65 + player.attributes.pace / 160, 0.68, 1.28);
      if (player.role === "GOL") return 3.6 * paceFactor;
      if (this.isForward(player) || this.isWide(player)) return 8.6 * paceFactor;
      if (player.role === "ZAG") return 6.4 * paceFactor;
      return 7.4 * paceFactor;
    }

    getCarrierCarryDistance(player) {
      if (player.role === "ZAG") return 2.2;
      if (player.role === "VOL") return 3.5;
      if (this.isWide(player)) return 6.5;
      if (this.isForward(player)) return 6.2;
      return 5.2;
    }

    getDecisionDelay(player) {
      const pressureFactor = player?.pressure > 0.6 ? 0.72 : 1;
      const mentalQuality = ((player?.attributes.vision || 80) + (player?.attributes.control || 80)) / 2;
      const composureFactor = this.clamp(1.18 - mentalQuality / 260, 0.78, 1.16);
      return (360 + this.random.next() * 420) * pressureFactor * composureFactor;
    }

    isWide(player) {
      return ["LE", "LD", "ME", "MD", "ALA", "PE", "PD"].includes(player.role);
    }

    isFullback(player) {
      return ["LE", "LD"].includes(player.role);
    }

    isWideMidfielder(player) {
      return ["ME", "MD"].includes(player.role);
    }

    isDefensive(player) {
      return ["GOL", "ZAG", "LE", "LD", "VOL"].includes(player.role);
    }

    isBallSide(player) {
      if (this.ball.x < 42) return player.baseX <= 50;
      if (this.ball.x > 58) return player.baseX >= 50;
      return true;
    }

    avoidCrowding(player, target) {
      const nearby = this.getTeam(player.teamId).players
        .filter((teammate) => teammate !== player)
        .filter((teammate) => this.distance(teammate, target) < 6.5);
      if (!nearby.length) return target;

      return nearby.reduce((point, teammate) => {
        const away = this.normalized(teammate, point);
        return {
          x: point.x + away.x * 1.6,
          y: point.y + away.y * 1.2
        };
      }, { ...target });
    }

    getTeam(teamId) {
      return this.teams.find((team) => team.id === teamId) || null;
    }

    getOpponent(team) {
      return this.teams.find((candidate) => candidate !== team);
    }

    allPlayers() {
      return this.teams.flatMap((team) => team.players);
    }

    nearestPlayers(players, target, amount) {
      return [...players]
        .sort((a, b) => this.distance(a, target) - this.distance(b, target))
        .slice(0, amount);
    }

    getGoalPoint(team) {
      return { x: 50, y: team.attacksDown ? 100 : 0 };
    }

    getOwnGoalPoint(team) {
      return { x: 50, y: team.attacksDown ? 0 : 100 };
    }

    getAttackProgress(point, team) {
      return team.attacksDown ? point.y : 100 - point.y;
    }

    pointBetween(from, to, amount) {
      return {
        x: from.x + (to.x - from.x) * amount,
        y: from.y + (to.y - from.y) * amount
      };
    }

    normalized(from, to) {
      const distance = this.distance(from, to) || 1;
      return {
        x: (to.x - from.x) / distance,
        y: (to.y - from.y) / distance
      };
    }

    distanceToSegment(point, start, end) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSquared = dx * dx + dy * dy || 1;
      const amount = this.clamp(
        ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
        0,
        1
      );
      return this.distance(point, {
        x: start.x + amount * dx,
        y: start.y + amount * dy
      });
    }

    pickWeighted(items) {
      const total = items.reduce((sum, item) => sum + item.weight, 0);
      if (total <= 0) return null;
      let roll = this.random.next() * total;
      for (const item of items) {
        roll -= item.weight;
        if (roll <= 0) return item.player;
      }
      return items.at(-1)?.player || null;
    }

    randomInt(min, max) {
      return Math.floor(this.random.next() * (max - min + 1)) + min;
    }

    clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    approach(value, target, maximumDelta) {
      if (value < target) return Math.min(value + maximumDelta, target);
      if (value > target) return Math.max(value - maximumDelta, target);
      return target;
    }

    getSnapshot() {
      return {
        match: {
          state: this.state,
          period: this.period,
          elapsedMatchMs: this.elapsedMatchMs,
          periodElapsedMatchMs: this.periodElapsedMatchMs,
          clock: this.formatClock()
        },
        teams: this.teams.map((team) => ({
          ...team,
          colors: { ...team.colors },
          stats: { ...team.stats },
          players: team.players.map((player) => ({
            ...player,
            preferredPositions: [...player.preferredPositions],
            attributes: { ...player.attributes },
            matchStats: { ...player.matchStats }
          }))
        })),
        possession: this.possession ? { ...this.possession } : null,
        ball: {
          ...this.ball,
          contactedPlayerIds: [...this.ball.contactedPlayerIds]
        }
      };
    }

    drainEvents() {
      return this.events.splice(0);
    }

    formatClock() {
      const halfMinute = Math.floor(this.periodElapsedMatchMs / 60_000);
      let visibleMinute;

      if (this.period === 1) {
        visibleMinute = halfMinute <= 45
          ? String(halfMinute).padStart(2, "0")
          : `45+${halfMinute - 45}`;
      } else {
        visibleMinute = halfMinute <= 45
          ? String(45 + halfMinute).padStart(2, "0")
          : `90+${halfMinute - 45}`;
      }

      return `${visibleMinute}'`;
    }
  }

  return {
    MatchEngine,
    SeededRandom
  };
});
