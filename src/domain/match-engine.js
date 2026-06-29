(function exposeBallsfootMatchEngine(root, factory) {
  const systems = typeof module !== "undefined" && module.exports
    ? require("./systems/match-systems.js")
    : root.BallsfootSystems;
  const formations = typeof module !== "undefined" && module.exports
    ? require("./formations/formation-442.js")
    : root.BallsfootFormations;
  const exports = factory(systems, formations);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exports;
  }

  if (root) {
    root.BallsfootSimulation = exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createMatchEngineModule(systems, formations) {
  "use strict";

  const { createDefaultMatchPipeline } = systems || {};
  const {
    FORMATION_442: DATA_FORMATION_442,
    getFormation: getConfiguredFormation,
    getRoleBehavior: getConfiguredRoleBehavior,
    roleHasGroup: configuredRoleHasGroup
  } = formations || {};
  const DEFAULT_FIXED_STEP_MS = 50;
  const DEFAULT_MATCH_CLOCK_RATE = 120;
  const HALF_DURATION_MS = 45 * 60 * 1000;
  const PENALTY_AREA = {
    xMin: 25.5,
    xMax: 74.5,
    depth: 15.5
  };
  const GOAL_AREA = {
    xMin: 38,
    xMax: 62,
    depth: 4
  };
  const FALLBACK_FORMATION_442 = {
    id: "4-4-2",
    name: "4-4-2",
    slots: [
      { id: "gk", role: "GOL", x: 50, y: 97 },
      { id: "lb", role: "LE", x: 18, y: 73 },
      { id: "lcb", role: "ZAG", x: 39, y: 79 },
      { id: "rcb", role: "ZAG", x: 61, y: 79 },
      { id: "rb", role: "LD", x: 82, y: 73 },
      { id: "lm", role: "ME", x: 18, y: 48 },
      { id: "dm", role: "VOL", x: 40, y: 60 },
      { id: "cm", role: "MC", x: 60, y: 60 },
      { id: "rm", role: "MD", x: 82, y: 48 },
      { id: "lf", role: "ATA", x: 42, y: 41 },
      { id: "rf", role: "ATA", x: 58, y: 41 }
    ]
  };
  const FALLBACK_ROLE_BEHAVIORS = {
    GOL: { groups: ["goalkeeper", "defensive"], attackPush: 0, defensiveLine: { offset: 0, min: 3, max: 4 }, speed: 3.6, carryDistance: 0, zone: { x: [38, 62], progress: [3, 4] } },
    ZAG: { groups: ["centerBack", "defensive"], attackPush: 4, defensiveLine: { offset: 0, min: 15, max: 62 }, speed: 6.4, carryDistance: 2.2, zone: { xOffset: [-13, 13], progress: [12, 53] } },
    LE: { groups: ["fullback", "wide", "defensive"], attackPush: 22, defensiveLine: { offset: 0, min: 15, max: 62 }, speed: 9, carryDistance: 6.5, zone: { xBySide: { negative: [5, 42], positive: [58, 95] }, progressFromBall: { sameSideOffset: -6, farSideOffset: -14, min: 18, max: 62 }, progressMax: 88 } },
    LD: { groups: ["fullback", "wide", "defensive"], attackPush: 22, defensiveLine: { offset: 0, min: 15, max: 62 }, speed: 9, carryDistance: 6.5, zone: { xBySide: { negative: [5, 42], positive: [58, 95] }, progressFromBall: { sameSideOffset: -6, farSideOffset: -14, min: 18, max: 62 }, progressMax: 88 } },
    VOL: { groups: ["centralMidfielder", "defensive"], attackPush: 7, defensiveLine: { offset: 16, min: 28, max: 75 }, speed: 7.4, carryDistance: 3.5, zone: { x: [28, 72], progress: [22, 68] } },
    MC: { groups: ["centralMidfielder"], attackPush: 13, defensiveLine: { offset: 16, min: 28, max: 75 }, speed: 7.4, carryDistance: 5.2, zone: { x: [24, 76], progress: [32, 82] } },
    ME: { groups: ["wideMidfielder", "wide"], attackPush: 28, defensiveLine: { offset: 16, min: 28, max: 75 }, speed: 9, carryDistance: 6.5, zone: { xBySide: { negative: [5, 46], positive: [54, 95] }, progressFromBall: { sameSideOffset: 12, farSideOffset: 7, min: 44, max: 80 }, progressMax: 96 } },
    MD: { groups: ["wideMidfielder", "wide"], attackPush: 28, defensiveLine: { offset: 16, min: 28, max: 75 }, speed: 9, carryDistance: 6.5, zone: { xBySide: { negative: [5, 46], positive: [54, 95] }, progressFromBall: { sameSideOffset: 12, farSideOffset: 7, min: 44, max: 80 }, progressMax: 96 } },
    ALA: { groups: ["wingback", "wide"], attackPush: 30, defensiveLine: { offset: 16, min: 28, max: 75 }, speed: 9, carryDistance: 6.5, zone: { xBySide: { negative: [4, 48], positive: [52, 96] }, progressFromBall: { sameSideOffset: 16, farSideOffset: 10, min: 42, max: 84 }, progressMax: 95 } },
    ATA: { groups: ["forward"], attackPush: 13, defensiveLine: { offset: 31, min: 43, max: 88 }, speed: 8.6, carryDistance: 6.2, zone: { x: [18, 82], progressFromBall: { sameSideOffset: -8, farSideOffset: -8, min: 46, max: 76 }, progressMax: 94 } },
    CA: { groups: ["forward"], attackPush: 13, defensiveLine: { offset: 31, min: 43, max: 88 }, speed: 8.6, carryDistance: 6.2, zone: { x: [18, 82], progressFromBall: { sameSideOffset: -8, farSideOffset: -8, min: 46, max: 76 }, progressMax: 94 } },
    PE: { groups: ["wideForward", "wide", "forward"], attackPush: 18, defensiveLine: { offset: 31, min: 43, max: 88 }, speed: 8.6, carryDistance: 6.2, zone: { xBySide: { negative: [8, 50], positive: [50, 92] }, progress: [46, 94] } },
    PD: { groups: ["wideForward", "wide", "forward"], attackPush: 18, defensiveLine: { offset: 31, min: 43, max: 88 }, speed: 8.6, carryDistance: 6.2, zone: { xBySide: { negative: [8, 50], positive: [50, 92] }, progress: [46, 94] } },
    RES: { groups: [], attackPush: 0, defensiveLine: { offset: 0, min: 8, max: 8 }, speed: 7.4, carryDistance: 5.2, zone: { xOffset: [-15, 15], progress: [22, 78] } }
  };
  const ATTRIBUTE_NAMES = ["physical", "technique", "intelligence", "defense"];

  function getFormation(id) {
    if (typeof getConfiguredFormation === "function") return getConfiguredFormation(id);
    return DATA_FORMATION_442 || FALLBACK_FORMATION_442;
  }

  function getRoleBehavior(role) {
    if (typeof getConfiguredRoleBehavior === "function") return getConfiguredRoleBehavior(role);
    return FALLBACK_ROLE_BEHAVIORS[String(role || "RES").toUpperCase()] || FALLBACK_ROLE_BEHAVIORS.RES;
  }

  function roleHasGroup(role, group) {
    if (typeof configuredRoleHasGroup === "function") return configuredRoleHasGroup(role, group);
    return getRoleBehavior(role).groups.includes(group);
  }

  function createInlineMatchPipeline() {
    return {
      run(world, stepMs) {
        world.simulationElapsedMs += stepMs;
        world.tacticalAccumulatorMs += stepMs;

        if (world.tacticalAccumulatorMs >= 250) {
          world.updateTacticalTargets();
          world.tacticalAccumulatorMs %= 250;
        }

        world.movePlayers(stepMs);
        world.updatePressure();
        if (world.autonomous && world.ball.mode === "controlled") {
          world.attemptDefensiveTackle();
        }
        world.updateBall(stepMs);

        if (world.possession) {
          const possessionTeam = world.getTeam(world.possession.teamId);
          if (possessionTeam) {
            possessionTeam.stats.possessionMatchMs += stepMs * world.matchClockRate;
          }
        }

        if (world.ball.mode === "loose") {
          world.updateLooseBall(stepMs);
        }

        if (world.ball.mode === "out" && world.restartRemainingMs > 0) {
          world.restartRemainingMs -= stepMs;
          if (world.restartRemainingMs <= 0) world.restartFromOut();
        }

        if (world.autonomous && world.ball.mode === "controlled") {
          world.decisionRemainingMs -= stepMs;
          if (world.decisionRemainingMs <= 0) {
            world.decideAction();
          }
        }

        const matchDeltaMs = stepMs * world.matchClockRate;
        world.periodElapsedMatchMs += matchDeltaMs;
        world.elapsedMatchMs = (world.period - 1) * HALF_DURATION_MS + world.periodElapsedMatchMs;

        const stoppageMs = world.period === 1 ? world.stoppageMs.first : world.stoppageMs.second;
        if (world.periodElapsedMatchMs < HALF_DURATION_MS + stoppageMs) return;

        world.periodElapsedMatchMs = HALF_DURATION_MS + stoppageMs;
        world.elapsedMatchMs = world.period === 1
          ? world.periodElapsedMatchMs
          : HALF_DURATION_MS + world.periodElapsedMatchMs;
        world.state = world.period === 1 ? "halftime" : "finished";
        world.emit(world.period === 1 ? "halftime" : "fulltime");
      }
    };
  }

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
      this.stepPipeline = (createDefaultMatchPipeline || createInlineMatchPipeline)();
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
      this.lastControlledTeamId = null;
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
        deflectorId: null,
        goalChance: null,
        restartReason: null,
        restartX: null,
        restartY: null,
        oneTouch: false,
        oneTouchChain: 0,
        combination: false,
        passTrigger: null,
        decisionIntelligence: null,
        requiredIntelligence: null
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
        formationId: config.formation || config.formationId || "4-4-2",
        score: 0,
        stats: {
          possessionMatchMs: 0,
          passesAttempted: 0,
          passesCompleted: 0,
          passesMissed: 0,
          oneTouchPasses: 0,
          offsides: 0,
          shots: 0,
          goals: 0,
          turnovers: 0,
          tacklesAttempted: 0,
          tacklesWon: 0,
          fouls: 0,
          corners: 0,
          throwIns: 0,
          goalKicks: 0,
          penaltiesWon: 0,
          penaltiesConceded: 0
        },
        attacksDown: index === 1,
        tacticalState: this.createTeamTacticalState(),
        players: (config.players || []).map((player, playerIndex) => {
          const attributes = this.createPlayerAttributes(player);
          return {
            id: player.id || `${config.id}-${player.number || playerIndex + 1}`,
            teamId: config.id,
            name: player.name,
            number: player.number || playerIndex + 1,
            overall: this.calculateOverall(attributes),
            preferredPositions: [...(player.preferredPositions || [])],
            attributes,
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
            nextTargetReviewMs: 0,
            nextTackleAttemptMs: 0
          };
        })
      };

      this.applyFormation(team);
      return team;
    }

    createTeamTacticalState() {
      return {
        phase: "settled",
        transition: null,
        transitionUntilMs: 0,
        ballSide: "center",
        activeFullbackId: null,
        supportingMidfielderId: null,
        holdingMidfielderId: null,
        droppingForwardId: null,
        runningForwardId: null,
        pressingPlayerId: null
      };
    }

    applyFormation(team) {
      const formation = getFormation(team.formationId);
      const slots = formation.slots.map((slot, slotIndex) => ({
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
          slotId: slot.id || `${slot.role}-${slot.slotIndex}`,
          formationId: formation.id,
          baseX: slot.x,
          baseY: slot.y,
          x: slot.x,
          y: slot.y,
          targetX: slot.x,
          targetY: slot.y,
          velocityX: 0,
          velocityY: 0
        });
        player.matchStats = player.matchStats || this.createPlayerMatchStats();
      });
    }

    createPlayerAttributes(player) {
      return ATTRIBUTE_NAMES.reduce((attributes, name) => {
        const value = player.attributes?.[name];
        if (!Number.isFinite(value)) {
          throw new Error(`Player ${player.name || player.number || "unknown"} is missing attribute ${name}.`);
        }
        attributes[name] = this.clamp(Math.round(value), 1, 99);
        return attributes;
      }, {});
    }

    calculateOverall(attributes) {
      const total = ATTRIBUTE_NAMES.reduce((sum, name) => sum + attributes[name], 0);
      return Math.round(total / ATTRIBUTE_NAMES.length);
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
        tacklesAttempted: 0,
        tacklesWon: 0,
        foulsCommitted: 0,
        foulsWon: 0,
        oneTouchPasses: 0,
        offsides: 0,
        saves: 0
      };
    }

    prepareKickoff(team) {
      this.teams.forEach((candidateTeam) => {
        candidateTeam.tacticalState = this.createTeamTacticalState();
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
      this.lastControlledTeamId = team.id;
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
      this.stepPipeline.run(this, stepMs);
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
          oneTouchPasses: 0,
          offsides: 0,
          shots: 0,
          goals: 0,
          turnovers: 0,
          tacklesAttempted: 0,
          tacklesWon: 0,
          fouls: 0,
          corners: 0,
          throwIns: 0,
          goalKicks: 0,
          penaltiesWon: 0,
          penaltiesConceded: 0
        });
        team.attacksDown = index === 1;
        team.tacticalState = this.createTeamTacticalState();
        this.applyFormation(team);
        team.players.forEach((player) => {
          player.matchStats = this.createPlayerMatchStats();
          player.nextTackleAttemptMs = 0;
        });
      });
      this.lastControlledTeamId = null;
      this.prepareKickoff(this.teams[0]);
      this.updatePressure();
      this.emit("match_reset");
    }

    performPass(receiverId, options = {}) {
      const passer = this.getController();
      const receiver = this.findPlayer(receiverId);
      if (!passer || !receiver || passer.id === receiver.id || passer.teamId !== receiver.teamId) return false;

      const distance = this.distance(passer, receiver);
      const passingTeam = this.getTeam(passer.teamId);
      passingTeam.stats.passesAttempted += 1;
      passer.matchStats.passesAttempted += 1;
      if (options.oneTouch) {
        passingTeam.stats.oneTouchPasses += 1;
        passer.matchStats.oneTouchPasses += 1;
      }
      const offside = this.getOffsidePosition(receiver, passer);
      if (offside.isOffside) {
        passingTeam.stats.passesMissed += 1;
        passingTeam.stats.turnovers += 1;
        passingTeam.stats.offsides += 1;
        receiver.matchStats.offsides += 1;
        this.emit("pass_started", {
          teamId: passer.teamId,
          playerId: passer.id,
          receiverId: receiver.id,
          distance,
          oneTouch: Boolean(options.oneTouch),
          combination: Boolean(options.combination),
          trigger: options.trigger || null,
          offside: true
        });
        this.callOffside(passer, receiver, offside);
        return true;
      }
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
        speed: 28 + passer.attributes.technique * 0.08 + Math.min(distance, 35) * 0.42,
        velocityX: 0,
        velocityY: 0,
        travelled: 0,
        distance,
        outcome: null,
        restartTeamId: null,
        restartReason: null,
        restartX: null,
        restartY: null,
        lastTouchedTeamId: passer.teamId,
        contactedPlayerIds: [],
        passerId: passer.id,
        shooterId: null,
        deflectorId: null,
        goalChance: null,
        oneTouch: Boolean(options.oneTouch),
        oneTouchChain: options.oneTouch ? Number(options.oneTouchChain) || 1 : 0,
        combination: Boolean(options.combination),
        passTrigger: options.trigger || null,
        decisionIntelligence: options.decisionIntelligence || null,
        requiredIntelligence: options.requiredIntelligence || null
      });
      this.emit("pass_started", {
        teamId: passer.teamId,
        playerId: passer.id,
        receiverId: receiver.id,
        distance,
        oneTouch: Boolean(options.oneTouch),
        combination: Boolean(options.combination),
        trigger: options.trigger || null,
        decisionIntelligence: options.decisionIntelligence || null,
        requiredIntelligence: options.requiredIntelligence || null
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
          const incomingPass = {
            startX: this.ball.startX,
            startY: this.ball.startY,
            distance: this.ball.distance,
            oneTouch: Boolean(this.ball.oneTouch),
            oneTouchChain: this.ball.oneTouchChain || 0,
            combination: Boolean(this.ball.combination),
            trigger: this.ball.passTrigger || null
          };
          const receptionChance = this.autonomous
            ? this.clamp(
                0.72 +
                  receiver.attributes.technique / 520 +
                  receiver.attributes.intelligence / 700 -
                  this.ball.distance / 320,
                0.68,
                0.98
              )
            : 1;
          if (this.random.next() <= receptionChance) {
            const oneTouchDecision = this.getOneTouchPassDecision(
              receiver,
              passer,
              incomingPass
            );
            this.setBallController(receiver);
            const receivingTeam = this.getTeam(receiver.teamId);
            receivingTeam.stats.passesCompleted += 1;
            if (passer) passer.matchStats.passesCompleted += 1;
            this.emit("pass_completed", {
              teamId: receiver.teamId,
              playerId: receiver.id,
              passerId: passer?.id || null,
              oneTouch: incomingPass.oneTouch,
              combination: incomingPass.combination,
              continuedFirstTime: Boolean(oneTouchDecision)
            });
            if (oneTouchDecision) {
              this.performPass(oneTouchDecision.receiverId, {
                oneTouch: true,
                oneTouchChain: incomingPass.oneTouchChain + 1,
                combination: oneTouchDecision.combination,
                trigger: oneTouchDecision.trigger,
                decisionIntelligence: oneTouchDecision.intelligence,
                requiredIntelligence: oneTouchDecision.requiredIntelligence
              });
            }
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
            this.maybeAwardThrowInAfterBadControl(receiver);
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
        if (contact?.type === "control" || contact?.type === "deflect") {
          const interceptor = contact.player;
          const passer = this.findPlayer(this.ball.passerId);
          const possessionChanged = Boolean(passer && passer.teamId !== interceptor.teamId);
          if (possessionChanged) {
            const passingTeam = this.getTeam(passer.teamId);
            passingTeam.stats.passesMissed += 1;
            passingTeam.stats.turnovers += 1;
            interceptor.matchStats.interceptions += 1;
          }
          interceptor.matchStats.recoveries += 1;
          this.setBallController(interceptor);
          this.emit(possessionChanged ? "pass_intercepted" : "pass_completed", {
            teamId: interceptor.teamId,
            playerId: interceptor.id,
            intendedReceiverId: receiver.id,
            deflected: contact.type === "deflect"
          });
        }
      }
    }

    maybeAwardThrowInAfterBadControl(player, force = false) {
      if (!player || this.ball.mode !== "loose") return false;
      const touchlineDistance = Math.min(player.x, 100 - player.x);
      if (touchlineDistance > 30 || (!force && this.random.next() > 0.55)) return false;
      const lastTouchTeam = this.getTeam(player.teamId);
      const restartTeam = lastTouchTeam ? this.getOpponent(lastTouchTeam) : this.teams[0];
      const exitX = player.x < 50 ? 1 : 99;
      this.scheduleRestart("throw_in", restartTeam, {
        x: exitX,
        y: this.clamp(player.y, 3, 97)
      });
      return true;
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
        restartReason: null,
        restartX: null,
        restartY: null,
        lastTouchedTeamId,
        contactedPlayerIds: [],
        passerId: null,
        shooterId: null,
        deflectorId: null,
        goalChance: null,
        oneTouch: false,
        oneTouchChain: 0,
        combination: false,
        passTrigger: null,
        decisionIntelligence: null,
        requiredIntelligence: null
      });
      this.possession = null;
    }

    setBallController(player) {
      if (!player) {
        this.makeBallLoose();
        return;
      }

      const previousTeamId = this.possession?.teamId || this.lastControlledTeamId;
      const previousBallMode = this.ball.mode;
      if (
        previousTeamId &&
        previousTeamId !== player.teamId &&
        previousBallMode !== "out" &&
        this.simulationElapsedMs > 0
      ) {
        this.startPossessionTransition(previousTeamId, player.teamId);
      }

      this.possession = {
        teamId: player.teamId,
        playerId: player.id
      };
      this.lastControlledTeamId = player.teamId;
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
        restartReason: null,
        restartX: null,
        restartY: null,
        lastTouchedTeamId: player.teamId,
        contactedPlayerIds: [],
        passerId: null,
        shooterId: null,
        deflectorId: null,
        goalChance: null,
        oneTouch: false,
        oneTouchChain: 0,
        combination: false,
        passTrigger: null,
        decisionIntelligence: null,
        requiredIntelligence: null
      });
      this.decisionRemainingMs = this.getDecisionDelay(player);
    }

    callOffside(passer, receiver, offside) {
      const attackingTeam = this.getTeam(passer.teamId);
      const defendingTeam = this.getOpponent(attackingTeam);
      Object.assign(this.ball, {
        mode: "out",
        x: receiver.x,
        y: receiver.y,
        controllerId: null,
        intendedReceiverId: null,
        action: null,
        restartTeamId: defendingTeam.id,
        restartReason: "offside",
        restartX: receiver.x,
        restartY: receiver.y,
        passerId: passer.id,
        lastTouchedTeamId: passer.teamId
      });
      this.possession = null;
      this.restartRemainingMs = 520;
      this.emit("offside", {
        teamId: attackingTeam.id,
        playerId: receiver.id,
        passerId: passer.id,
        restartTeamId: defendingTeam.id,
        playerProgress: offside.playerProgress,
        ballProgress: offside.ballProgress,
        secondLastOpponentProgress: offside.secondLastOpponentProgress,
        offsideLine: offside.offsideLine
      });
    }

    startPossessionTransition(losingTeamId, gainingTeamId) {
      const losingTeam = this.getTeam(losingTeamId);
      const gainingTeam = this.getTeam(gainingTeamId);
      if (losingTeam) {
        losingTeam.tacticalState.transition = "counterpress";
        losingTeam.tacticalState.transitionUntilMs = this.simulationElapsedMs + 2_400;
      }
      if (gainingTeam) {
        gainingTeam.tacticalState.transition = "counter";
        gainingTeam.tacticalState.transitionUntilMs = this.simulationElapsedMs + 3_600;
      }
      this.emit("possession_transition", {
        losingTeamId,
        gainingTeamId
      });
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
      return this.roleHasGroup(player.role, "forward");
    }

    getRoleBehavior(role) {
      return getRoleBehavior(role);
    }

    roleHasGroup(role, group) {
      return roleHasGroup(role, group);
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

    getBallSide(point = this.ball) {
      if (point.x < 40) return "left";
      if (point.x > 60) return "right";
      return "center";
    }

    getCollectiveTacticalContext(team, inPossession, carrier) {
      if (team.tacticalState.transitionUntilMs <= this.simulationElapsedMs) {
        team.tacticalState.transition = null;
        team.tacticalState.transitionUntilMs = 0;
      }

      const ballSide = this.getBallSide();
      const fullbacks = team.players.filter((player) => this.isFullback(player));
      const centralMidfielders = team.players.filter((player) => ["VOL", "MC"].includes(player.role));
      const forwards = team.players.filter((player) => this.isForward(player));
      const reference = carrier || this.ball;
      const activeFullback = fullbacks
        .map((player) => ({
          player,
          score: this.distance(player, reference) +
            (ballSide === "center"
              ? 0
              : ((player.baseX < 50) === (ballSide === "left") ? -12 : 12))
        }))
        .sort((a, b) => a.score - b.score)[0]?.player || null;
      const supportingMidfielder = centralMidfielders
        .sort((a, b) => this.distance(a, reference) - this.distance(b, reference))[0] || null;
      const holdingMidfielder = centralMidfielders.find((player) => player !== supportingMidfielder) || null;
      const droppingForward = forwards
        .sort((a, b) => this.distance(a, reference) - this.distance(b, reference))[0] || null;
      const runningForward = forwards.find((player) => player !== droppingForward) || null;
      const carrierProgress = carrier ? this.getAttackProgress(carrier, team) : 0;
      const crossing = Boolean(
        inPossession &&
        carrier &&
        Math.abs(carrier.x - 50) >= 27 &&
        carrierProgress >= 66
      );
      const passReceiver = this.ball.mode === "travelling" && this.ball.action === "pass"
        ? this.findPlayer(this.ball.intendedReceiverId)
        : null;
      const passingTeam = passReceiver ? this.getTeam(passReceiver.teamId) : null;
      const backwardPass = Boolean(
        passingTeam &&
        this.getAttackProgress({ x: this.ball.targetX, y: this.ball.targetY }, passingTeam) <
          this.getAttackProgress({ x: this.ball.startX, y: this.ball.startY }, passingTeam) - 4
      );
      const pressTrigger = !inPossession && Boolean(
        team.tacticalState.transition === "counterpress" ||
        carrier?.pressure >= 0.62 ||
        backwardPass
      );
      const phase = inPossession
        ? (team.tacticalState.transition === "counter" ? "counterattack" : "attack")
        : (team.tacticalState.transition === "counterpress" ? "counterpress" : "defense");

      Object.assign(team.tacticalState, {
        phase,
        ballSide,
        activeFullbackId: activeFullback?.id || null,
        supportingMidfielderId: supportingMidfielder?.id || null,
        holdingMidfielderId: holdingMidfielder?.id || null,
        droppingForwardId: droppingForward?.id || null,
        runningForwardId: runningForward?.id || null
      });

      return {
        phase,
        transition: team.tacticalState.transition,
        ballSide,
        activeFullback,
        supportingMidfielder,
        holdingMidfielder,
        droppingForward,
        runningForward,
        crossing,
        pressTrigger,
        carrierProgress
      };
    }

    getPrimaryPresser(team, carrier, context) {
      if (!carrier) return null;
      const ownGoal = this.getOwnGoalPoint(team);
      const ballSide = context.ballSide;
      return team.players
        .filter((player) => player.role !== "GOL")
        .map((player) => {
          const sameSideWide = this.isWide(player) &&
            ballSide !== "center" &&
            ((player.baseX < 50) === (ballSide === "left"));
          const defenderDraggedHigh = this.isDefensive(player) &&
            this.distance(carrier, ownGoal) > 38;
          const forwardBuildUpPress = this.isForward(player) &&
            this.distance(carrier, ownGoal) > 62;
          return {
            player,
            score: this.distance(player, carrier) -
              (sameSideWide ? 5 : 0) -
              (forwardBuildUpPress ? 4 : 0) +
              (defenderDraggedHigh ? 14 : 0)
          };
        })
        .sort((a, b) => a.score - b.score)[0]?.player || null;
    }

    updateTacticalTargets() {
      const passReceiver = this.ball.mode === "travelling" && this.ball.action === "pass"
        ? this.findPlayer(this.ball.intendedReceiverId)
        : null;
      const possessionTeamId = this.possession?.teamId || passReceiver?.teamId || null;
      const carrier = this.getController() || passReceiver;

      this.teams.forEach((team) => {
        const inPossession = team.id === possessionTeamId;
        const ballProgress = this.getAttackProgress(this.ball, team);
        const context = this.getCollectiveTacticalContext(team, inPossession, carrier);
        const nearestPresser = !inPossession
          ? this.getPrimaryPresser(team, carrier, context)
          : null;
        team.tacticalState.pressingPlayerId = nearestPresser?.id || null;
        const markingAssignments = !inPossession && carrier
          ? this.assignDefensiveMarks(team, carrier, nearestPresser, context)
          : new Map();

        team.players.forEach((player) => {
          if (player.role === "GOL") {
            player.markingTargetId = null;
            const goalkeeperTarget = this.getGoalkeeperTarget(
              player,
              team,
              inPossession,
              carrier
            );
            player.targetX = goalkeeperTarget.x;
            player.targetY = goalkeeperTarget.y;
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
            const pressureDepth = context.pressTrigger ? 0.07 : 0.1;
            const pressPoint = this.pointBetween(carrier, this.getOwnGoalPoint(team), pressureDepth);
            player.targetX = this.clamp(pressPoint.x, 5, 95);
            player.targetY = this.clamp(pressPoint.y, 5, 95);
            return;
          }

          if (inPossession) {
            player.markingTargetId = null;
            const distanceToTarget = Math.hypot(player.targetX - player.x, player.targetY - player.y);
            if (this.simulationElapsedMs >= player.nextTargetReviewMs || distanceToTarget < 1.2) {
              const target = this.getOffBallTarget(player, team, carrier, context);
              player.targetX = target.x;
              player.targetY = target.y;
              const readingDelay = 650 - player.attributes.intelligence * 3.2;
              player.nextTargetReviewMs = this.simulationElapsedMs +
                this.clamp(readingDelay, 260, 620) +
                this.random.next() * 320;
            }
            return;
          }

          const defensiveTarget = this.getDefensiveMovementTarget(
            player,
            team,
            markingAssignments.get(player.id) || null,
            ballProgress,
            context
          );
          player.markingTargetId = markingAssignments.get(player.id)?.id || null;
          player.targetX = this.clamp(player.targetX * 0.18 + defensiveTarget.x * 0.82, 5, 95);
          player.targetY = this.clamp(player.targetY * 0.18 + defensiveTarget.y * 0.82, 5, 95);
        });
      });
    }

    getGoalkeeperTarget(goalkeeper, team, inPossession, carrier) {
      const direction = team.attacksDown ? 1 : -1;
      const ownGoal = this.getOwnGoalPoint(team);

      const ballProgress = this.getAttackProgress(this.ball, team);
      const inBuildUp = inPossession && ballProgress <= 42;
      const buildUpLimitY = team.attacksDown ? PENALTY_AREA.depth : 100 - PENALTY_AREA.depth;
      const buildUpMaxAdvance = Math.abs(goalkeeper.baseY - buildUpLimitY);
      const buildUpAdvance = inBuildUp
        ? this.clamp(6 + (42 - ballProgress) * 0.24, 0.8, buildUpMaxAdvance)
        : 0.35;
      const horizontalFollow = inBuildUp ? 0.16 : 0.05;
      const area = inBuildUp ? PENALTY_AREA : GOAL_AREA;
      return this.clampGoalkeeperToArea(team, {
        x: this.clamp(50 + (this.ball.x - 50) * horizontalFollow, area.xMin, area.xMax),
        y: goalkeeper.baseY + direction * buildUpAdvance
      }, area);
    }

    isGoalkeeperOneOnOne(team, carrier) {
      if (!carrier || carrier.teamId === team.id || carrier.role === "GOL") return false;

      const ownGoal = this.getOwnGoalPoint(team);
      const carrierGoalDistance = this.distance(carrier, ownGoal);
      if (carrierGoalDistance > 30 || carrier.x < 20 || carrier.x > 80) return false;

      const outfieldPlayers = team.players.filter((player) => player.role !== "GOL");
      const hasCloseChallenge = outfieldPlayers.some((player) => this.distance(player, carrier) <= 5.5);
      if (hasCloseChallenge) return false;

      const hasGoalSideCover = outfieldPlayers.some((player) =>
        this.distance(player, ownGoal) < carrierGoalDistance - 0.75 &&
        this.distanceToSegment(player, carrier, ownGoal) < 7
      );
      return !hasGoalSideCover;
    }

    clampGoalkeeperToPenaltyArea(team, point) {
      return this.clampGoalkeeperToArea(team, point, PENALTY_AREA);
    }

    clampGoalkeeperToGoalArea(team, point) {
      return this.clampGoalkeeperToArea(team, point, GOAL_AREA);
    }

    isGoalkeeperBuildUpActive(team) {
      const passReceiver = this.ball.mode === "travelling" && this.ball.action === "pass"
        ? this.findPlayer(this.ball.intendedReceiverId)
        : null;
      const inPossession = this.possession?.teamId === team.id || passReceiver?.teamId === team.id;
      return Boolean(inPossession && this.getAttackProgress(this.ball, team) <= 42);
    }

    clampGoalkeeperToArea(team, point, area) {
      const yMin = team.attacksDown ? 3 : 100 - area.depth;
      const yMax = team.attacksDown ? area.depth : 97;
      return {
        x: this.clamp(point.x, area.xMin, area.xMax),
        y: this.clamp(point.y, yMin, yMax)
      };
    }

    getCollectiveAttackingTarget(player, team, carrier, context) {
      const direction = team.attacksDown ? 1 : -1;
      const progressPoint = (x, progress) => ({
        x,
        y: team.attacksDown ? progress : 100 - progress
      });
      const carrierProgress = this.getAttackProgress(carrier, team);
      const side = player.baseX < 50 ? -1 : 1;
      const sameSideAsBall = context.ballSide === "center" ||
        ((side < 0) === (context.ballSide === "left"));
      const pulse = Math.sin(this.simulationElapsedMs / 1_700 + player.movementPhase);

      if (player.role === "ZAG") {
        const centerBackX = player.baseX < 50 ? 32 : 68;
        return progressPoint(
          centerBackX + (this.ball.x - 50) * 0.06,
          this.clamp(carrierProgress - 28, 14, 43)
        );
      }

      if (this.isFullback(player)) {
        const isActive = context.activeFullback?.id === player.id;
        if (isActive) {
          return progressPoint(
            side < 0 ? 10 : 90,
            this.clamp(
              carrierProgress + (context.phase === "counterattack" ? 13 : 8),
              34,
              84
            )
          );
        }
        return progressPoint(
          side < 0 ? 25 : 75,
          this.clamp(carrierProgress - 15, 24, 56)
        );
      }

      if (["VOL", "MC"].includes(player.role)) {
        const isSupport = context.supportingMidfielder?.id === player.id;
        if (context.crossing && isSupport) {
          return progressPoint(50 + side * 7, 76);
        }
        return progressPoint(
          isSupport
            ? this.clamp(carrier.x + (50 - carrier.x) * 0.38 + side * 5, 30, 70)
            : 50 - side * 9,
          this.clamp(
            carrierProgress + (isSupport ? 1 : -14),
            isSupport ? 34 : 24,
            isSupport ? 76 : 62
          )
        );
      }

      if (this.isForward(player)) {
        const isDropping = context.droppingForward?.id === player.id;
        if (context.crossing) {
          const crossFromLeft = carrier.x < 50;
          const firstPostPlayer = team.players
            .filter((candidate) => this.isForward(candidate))
            .sort((a, b) => crossFromLeft ? a.x - b.x : b.x - a.x)[0];
          return progressPoint(
            player.id === firstPostPlayer?.id
              ? (crossFromLeft ? 42 : 58)
              : 50,
            player.id === firstPostPlayer?.id ? 88 : 84
          );
        }
        if (isDropping) {
          return progressPoint(
            this.clamp(carrier.x + side * 8, 28, 72),
            this.clamp(carrierProgress + 5, 48, 72)
          );
        }
        return progressPoint(
          this.clamp(50 + side * 12 + pulse * 4, 24, 76),
          this.clamp(
            carrierProgress + (context.phase === "counterattack" ? 24 : 17),
            58,
            91
          )
        );
      }

      if (this.isWideMidfielder(player) || player.role === "ALA") {
        const activeOnSide = context.activeFullback &&
          ((context.activeFullback.baseX < 50) === (player.baseX < 50));
        const farSide = !sameSideAsBall && context.ballSide !== "center";
        if (context.crossing && farSide) {
          return progressPoint(side < 0 ? 34 : 66, 84);
        }
        const attacksDepth = context.phase === "counterattack" ||
          (sameSideAsBall && carrierProgress > 48 && pulse > 0.15);
        const movesInside = activeOnSide && sameSideAsBall && !attacksDepth && pulse > -0.45;
        if (movesInside) {
          return progressPoint(
            side < 0 ? 37 : 63,
            this.clamp(carrierProgress + 7, 46, 80)
          );
        }
        return progressPoint(
          side < 0 ? 8 : 92,
          this.clamp(
            carrierProgress + (attacksDepth ? 18 : 7),
            44,
            attacksDepth ? 91 : 80
          )
        );
      }

      return {
        x: player.baseX,
        y: player.baseY + direction * this.getRoleAttackPush(player.role)
      };
    }

    getOffBallTarget(player, team, carrier, context) {
      if (!carrier) return { x: player.baseX, y: player.baseY };

      const opponents = this.getOpponent(team).players;
      const teammates = team.players.filter((teammate) => teammate !== player && teammate !== carrier);
      const direction = team.attacksDown ? 1 : -1;
      const goal = this.getGoalPoint(team);
      const towardGoal = this.normalized(player, goal);
      const marker = this.nearestPlayers(opponents.filter((opponent) => opponent.role !== "GOL"), player, 1)[0];
      const awayFromMarker = marker ? this.normalized(marker, player) : { x: 0, y: 0 };
      const anchor = this.getAttackingAnchor(player, team);
      const collectiveTarget = this.getCollectiveAttackingTarget(player, team, carrier, context);
      const side = Math.sign(player.baseX - 50) || (player.number % 2 ? -1 : 1);
      const supportSide = Math.sign(player.x - carrier.x) || side;
      const pulse = Math.sin(this.simulationElapsedMs / 1_150 + player.movementPhase);
      const carrierProgress = this.getAttackProgress(carrier, team);
      const candidates = [
        { point: collectiveTarget, bias: 0.22 },
        { point: anchor, bias: 0.08 },
        { point: {
          x: carrier.x + supportSide * (this.isForward(player) ? 11 : 9),
          y: carrier.y + direction * (this.isForward(player) ? 8 : (this.isDefensive(player) ? -10 : -3))
        }, bias: 0 },
        { point: {
          x: player.x + awayFromMarker.x * 7 + towardGoal.x * 4,
          y: player.y + awayFromMarker.y * 7 + towardGoal.y * 4
        }, bias: 0 },
        { point: {
          x: anchor.x + side * (5 + pulse * 3),
          y: anchor.y + direction * (this.isForward(player) ? 9 : 5)
        }, bias: 0 },
        { point: {
          x: carrier.x - supportSide * (this.isWide(player) ? 16 : 11),
          y: carrier.y + direction * (this.isForward(player) ? 12 : 2)
        }, bias: 0 }
      ];

      if (this.isForward(player) || player.role === "MC") {
        candidates.push({ point: {
          x: this.clamp(carrier.x + side * (this.isForward(player) ? 14 : 9), 12, 88),
          y: team.attacksDown
            ? this.clamp(Math.max(player.y, carrier.y + 13), 8, 93)
            : this.clamp(Math.min(player.y, carrier.y - 13), 7, 92)
        }, bias: 0.04 });
      }

      if (this.isWide(player)) {
        const wideAdvance = player.role === "ALA"
          ? 24
          : (this.isWideMidfielder(player) ? 20 : 14);
        candidates.push({ point: {
          x: side < 0 ? 8 + Math.abs(pulse) * 7 : 92 - Math.abs(pulse) * 7,
          y: team.attacksDown
            ? this.clamp(carrier.y + wideAdvance, 16, 94)
            : this.clamp(carrier.y - wideAdvance, 6, 84)
        }, bias: 0.06 });
      }

      const best = candidates
        .map(({ point: candidate, bias = 0 }) => {
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
            ? usefulProgress * 0.62
            : (this.isFullback(player) ? usefulProgress * 0.2 : 0);
          const decisionNoise = (this.random.next() - 0.5) *
            (100 - player.attributes.intelligence) / 100 *
            0.28;
          const score =
            this.clamp(nearestOpponent / 15, 0, 1) * 0.3 +
            laneSafety * 0.26 +
            passDistanceFit * 0.2 +
            this.clamp(nearestTeammate / 11, 0, 1) * 0.12 +
            roleProgress * (this.isForward(player) || player.role === "MC" ? 0.26 : 0.14) -
            movementCost * 0.08 +
            finalThirdRun +
            wideAdvanceBias +
            bias +
            decisionNoise +
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
      const zone = this.getRoleBehavior(player.role).zone || {};
      const xRange = zone.x ||
        (zone.xBySide ? zone.xBySide[side < 0 ? "negative" : "positive"] : null) ||
        (zone.xOffset ? [player.baseX + zone.xOffset[0], player.baseX + zone.xOffset[1]] : null) ||
        [player.baseX - 15, player.baseX + 15];
      let progressMin = zone.progress?.[0] ?? 22;
      let progressMax = zone.progressMax ?? zone.progress?.[1] ?? 78;

      if (zone.progressFromBall) {
        const ballOffset = this.isBallSide(player)
          ? zone.progressFromBall.sameSideOffset
          : zone.progressFromBall.farSideOffset;
        progressMin = this.clamp(
          ballProgress + ballOffset,
          zone.progressFromBall.min,
          zone.progressFromBall.max
        );
      }

      const progress = this.clamp(this.getAttackProgress(point, team), progressMin, progressMax);
      return {
        x: this.clamp(point.x, xRange[0], xRange[1]),
        y: team.attacksDown ? progress : 100 - progress
      };
    }

    assignDefensiveMarks(team, carrier, presser, context) {
      const assignments = new Map();
      const assignedOpponents = new Set();
      const opponents = this.getOpponent(team).players
        .filter((opponent) => opponent.role !== "GOL" && opponent !== carrier)
        .sort((a, b) => this.distance(a, this.getOwnGoalPoint(team)) - this.distance(b, this.getOwnGoalPoint(team)));
      const defenders = team.players
        .filter((player) => player.role !== "GOL" && player !== presser)
        .sort((a, b) => this.distance(a, carrier) - this.distance(b, carrier));

      defenders.forEach((defender) => {
        const mark = opponents
          .filter((opponent) => !assignedOpponents.has(opponent.id))
          .map((opponent) => {
            const laneDistance = Math.abs(opponent.x - defender.baseX);
            const currentDistance = this.distance(defender, opponent);
            const threat = this.distance(opponent, this.getOwnGoalPoint(team));
            const rolePenalty = this.isDefensive(defender) ? 0 : 2.5;
            const oppositeSidePenalty = this.isWide(defender) &&
              Math.sign(defender.baseX - 50) !== Math.sign(opponent.x - 50)
              ? 12
              : 0;
            const defensiveReading = (
              defender.attributes.defense * 0.58 +
              defender.attributes.intelligence * 0.42
            ) / 100;
            return {
              opponent,
              score: currentDistance +
                laneDistance * 0.18 +
                threat * 0.04 +
                rolePenalty -
                defensiveReading * 4 +
                oppositeSidePenalty,
              currentDistance
            };
          })
          .filter((candidate) =>
            candidate.currentDistance <= (context.transition === "counterpress" ? 21 : 16) &&
            candidate.score < 34
          )
          .sort((a, b) => a.score - b.score)[0]?.opponent;

        if (mark) {
          assignments.set(defender.id, mark);
          assignedOpponents.add(mark.id);
        }
      });

      return assignments;
    }

    getDefensiveMovementTarget(player, team, mark, ballProgress, context) {
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
      const defensiveQuality = (player.attributes.defense + player.attributes.intelligence) / 200;
      const markingWeight = this.clamp(
        (this.isDefensive(player) ? 0.712 : 0.632) + defensiveQuality * 0.2,
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
          const accelerationFactor = 0.68 + player.attributes.physical / 160;
          const acceleration = (this.isForward(player) || this.isWide(player) ? 20 : 17) *
            accelerationFactor *
            seconds;
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
          if (player.role === "GOL") {
            const goalkeeperPosition = this.clampGoalkeeperToPenaltyArea(team, player);
            player.x = goalkeeperPosition.x;
            player.y = goalkeeperPosition.y;
          }
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
              sum + ((10 - item.distance) / 10) * (0.75 + item.opponent.attributes.defense / 200)
            , 0);
          const nearestDefendingFactor = nearest
            ? 0.72 + nearest.opponent.attributes.defense / 180
            : 1;
          const composureFactor = 1.22 -
            (player.attributes.technique * 0.45 + player.attributes.intelligence * 0.55) / 260;
          player.markerId = nearest?.opponent.id || null;
          player.pressure = nearest
            ? this.clamp(((1 - nearest.distance / 17) * nearestDefendingFactor + crowd * 0.1) * composureFactor, 0, 1)
            : 0;
          player.spaceScore = this.clamp((nearest?.distance || 18) / 18, 0, 1);
        });
      });
    }

    resolveTackle(defender, carrier, forcedOutcome = null) {
      if (
        !defender ||
        !carrier ||
        defender.teamId === carrier.teamId ||
        this.ball.controllerId !== carrier.id
      ) {
        return false;
      }

      const defendingTeam = this.getTeam(defender.teamId);
      const attackingTeam = this.getTeam(carrier.teamId);
      defender.matchStats.tacklesAttempted += 1;
      defendingTeam.stats.tacklesAttempted += 1;

      const defensiveQuality = (
        defender.attributes.defense * 0.58 +
        defender.attributes.intelligence * 0.27 +
        defender.attributes.physical * 0.15
      ) / 100;
      const carrierResistance = (
        carrier.attributes.technique * 0.5 +
        carrier.attributes.physical * 0.3 +
        carrier.attributes.intelligence * 0.2
      ) / 100;
      const cleanChance = this.clamp(
        0.34 + (defensiveQuality - carrierResistance) * 0.65,
        0.16,
        0.68
      );
      const foulChance = this.clamp(
        0.045 +
          (1 - defender.attributes.intelligence / 100) * 0.11 +
          Math.max(0, carrier.attributes.physical - defender.attributes.physical) / 500,
        0.04,
        0.2
      );
      const deflectionChance = 0.16;
      const roll = this.random.next();
      const outcome = forcedOutcome || (
        roll < foulChance
          ? "foul"
          : (roll < foulChance + cleanChance
            ? "won"
            : (roll < foulChance + cleanChance + deflectionChance ? "deflected" : "evaded"))
      );

      if (outcome === "won") {
        defender.matchStats.tacklesWon += 1;
        defender.matchStats.recoveries += 1;
        defendingTeam.stats.tacklesWon += 1;
        attackingTeam.stats.turnovers += 1;
        this.setBallController(defender);
        this.emit("tackle_won", {
          teamId: defender.teamId,
          playerId: defender.id,
          carrierId: carrier.id
        });
        return true;
      }

      if (outcome === "deflected") {
        const nearestBoundary = [
          { distance: carrier.x, direction: { x: -1, y: 0 } },
          { distance: 100 - carrier.x, direction: { x: 1, y: 0 } },
          { distance: carrier.y, direction: { x: 0, y: -1 } },
          { distance: 100 - carrier.y, direction: { x: 0, y: 1 } }
        ].sort((a, b) => a.distance - b.distance)[0];
        const naturalDirection = this.normalized(defender, carrier);
        const boundaryBias = nearestBoundary.distance < 10 ? 0.78 : 0;
        const direction = {
          x: naturalDirection.x * (1 - boundaryBias) + nearestBoundary.direction.x * boundaryBias,
          y: naturalDirection.y * (1 - boundaryBias) + nearestBoundary.direction.y * boundaryBias
        };
        this.makeBallLoose({
          x: direction.x * (8 + this.random.next() * 8),
          y: direction.y * (8 + this.random.next() * 8)
        }, defender.teamId);
        this.emit("tackle_deflected", {
          teamId: defender.teamId,
          playerId: defender.id,
          carrierId: carrier.id
        });
        const isTouchline = nearestBoundary.direction.x !== 0;
        const exitDistance = isTouchline ? 14 : 8;
        const exitChance = isTouchline ? 0.86 : 0.62;
        if (nearestBoundary.distance < exitDistance && this.random.next() < exitChance) {
          this.ball.x = nearestBoundary.direction.x < 0
            ? 0.5
            : (nearestBoundary.direction.x > 0 ? 99.5 : carrier.x);
          this.ball.y = nearestBoundary.direction.y < 0
            ? 0.5
            : (nearestBoundary.direction.y > 0 ? 99.5 : carrier.y);
          this.classifyBallOut();
        }
        return true;
      }

      if (outcome === "foul") {
        const penalty = this.isInsideOwnPenaltyArea(carrier, defendingTeam);
        defender.matchStats.foulsCommitted += 1;
        carrier.matchStats.foulsWon += 1;
        defendingTeam.stats.fouls += 1;
        if (penalty) {
          attackingTeam.stats.penaltiesWon += 1;
          defendingTeam.stats.penaltiesConceded += 1;
        }
        this.emit("foul_committed", {
          teamId: defender.teamId,
          playerId: defender.id,
          fouledPlayerId: carrier.id,
          penalty
        });
        this.scheduleRestart(
          penalty ? "penalty" : "free_kick",
          attackingTeam,
          { x: carrier.x, y: carrier.y },
          penalty ? 900 : 650,
          {
            playerId: defender.id,
            fouledPlayerId: carrier.id
          }
        );
        return true;
      }

      this.emit("tackle_evaded", {
        teamId: defender.teamId,
        playerId: defender.id,
        carrierId: carrier.id
      });
      return false;
    }

    attemptDefensiveTackle() {
      const carrier = this.getController();
      if (!carrier || carrier.role === "GOL") return false;
      const attackingTeam = this.getTeam(carrier.teamId);
      const nearestDefender = this.nearestPlayers(
        this.getOpponent(attackingTeam).players.filter((player) => player.role !== "GOL"),
        carrier,
        1
      )[0];
      if (
        !nearestDefender ||
        this.distance(nearestDefender, carrier) > 1.7 ||
        nearestDefender.nextTackleAttemptMs > this.simulationElapsedMs
      ) {
        return false;
      }

      const cooldown = this.clamp(
        1_350 - nearestDefender.attributes.intelligence * 4 + this.random.next() * 450,
        750,
        1_550
      );
      nearestDefender.nextTackleAttemptMs = this.simulationElapsedMs + cooldown;
      const attemptChance = this.clamp(
        0.12 +
          carrier.pressure * 0.22 +
          nearestDefender.attributes.defense / 520,
        0.18,
        0.5
      );
      if (this.random.next() > attemptChance) return false;
      return this.resolveTackle(nearestDefender, carrier);
    }

    attemptLastDitchChallenge(carrier) {
      const attackingTeam = this.getTeam(carrier.teamId);
      const defendingTeam = this.getOpponent(attackingTeam);
      if (!this.isInsideOwnPenaltyArea(carrier, defendingTeam)) return false;
      const defender = this.nearestPlayers(
        defendingTeam.players.filter((player) => player.role !== "GOL"),
        carrier,
        1
      )[0];
      if (!defender || this.distance(defender, carrier) > 2.8) return false;
      const foulChance = this.clamp(
        0.018 +
          carrier.pressure * 0.032 +
          (1 - defender.attributes.intelligence / 100) * 0.02,
        0.018,
        0.07
      );
      if (this.random.next() > foulChance) return false;
      return this.resolveTackle(defender, carrier, "foul");
    }

    isInsideOwnPenaltyArea(point, team) {
      if (!point || !team) return false;
      const insideWidth = point.x >= PENALTY_AREA.xMin && point.x <= PENALTY_AREA.xMax;
      const insideDepth = team.attacksDown
        ? point.y <= PENALTY_AREA.depth
        : point.y >= 100 - PENALTY_AREA.depth;
      return insideWidth && insideDepth;
    }

    getOneTouchPassDecision(receiver, incomingPasser, incomingPass = {}) {
      if (
        !this.autonomous ||
        receiver.role === "GOL" ||
        (incomingPass.oneTouchChain || 0) >= 1 ||
        (incomingPass.distance || 0) > 32
      ) {
        return null;
      }

      const team = this.getTeam(receiver.teamId);
      const opponents = this.getOpponent(team).players;
      const receiverProgress = this.getAttackProgress(receiver, team);
      const pressureUrgency = this.clamp((receiver.pressure - 0.62) / 0.36, 0, 1);
      const technique = receiver.attributes.technique / 100;
      const intelligence = receiver.attributes.intelligence;
      const incomingOrigin = {
        x: incomingPass.startX ?? incomingPasser?.x ?? receiver.x,
        y: incomingPass.startY ?? incomingPasser?.y ?? receiver.y
      };

      const candidates = team.players
        .filter((player) => player !== receiver)
        .filter((player) => !this.isOffside(player, receiver))
        .map((player) => {
          const distance = this.distance(receiver, player);
          const laneSafety = this.getLaneSafety(receiver, player, opponents);
          const progress = this.getAttackProgress(player, team) - receiverProgress;
          const isReturnPass = player === incomingPasser;
          const passerRun = isReturnPass ? this.distance(player, incomingOrigin) : 0;
          const combination = Boolean(
            isReturnPass &&
            distance >= 5 &&
            distance <= 24 &&
            laneSafety >= 0.58 &&
            passerRun >= 2.5
          );
          const exceptional = Boolean(
            distance >= 6 &&
            distance <= 27 &&
            laneSafety >= 0.8 &&
            player.pressure <= 0.48 &&
            player.spaceScore >= 0.5 &&
            (progress >= 6 || combination)
          );
          const score =
            laneSafety * 0.34 +
            this.clamp(1 - Math.abs(distance - 15) / 17, 0, 1) * 0.2 +
            this.clamp((progress + 6) / 22, 0, 1) * 0.18 +
            player.spaceScore * 0.12 +
            (1 - player.pressure) * 0.08 +
            (combination ? 0.22 : 0) +
            (exceptional ? 0.14 : 0);
          return {
            player,
            distance,
            laneSafety,
            progress,
            combination,
            exceptional,
            score
          };
        })
        .filter((candidate) =>
          candidate.distance <= 30 &&
          candidate.laneSafety >= 0.46
        )
        .sort((a, b) => b.score - a.score);

      const best = candidates[0];
      if (!best) return null;

      const underHighPressure = receiver.pressure >= 0.7;
      if (!underHighPressure && !best.exceptional && !best.combination) return null;

      const requiredIntelligence = underHighPressure
        ? Math.round(42 + pressureUrgency * 12)
        : (best.combination ? 50 : 64);
      if (intelligence < requiredIntelligence) return null;

      const intelligenceReadiness = this.clamp(
        (intelligence - requiredIntelligence) / Math.max(99 - requiredIntelligence, 1),
        0,
        1
      );
      const attemptChance = this.clamp(
        0.02 +
          technique * 0.14 +
          intelligenceReadiness * 0.24 +
          pressureUrgency * 0.16 +
          (best.exceptional ? 0.08 : 0) +
          (best.combination ? 0.05 : 0),
        0.05,
        0.58
      );
      if (this.random.next() > attemptChance) return null;

      return {
        receiverId: best.player.id,
        combination: best.combination,
        trigger: underHighPressure
          ? "pressure"
          : (best.combination ? "combination" : "vision"),
        pressure: receiver.pressure,
        optionScore: best.score,
        intelligence,
        requiredIntelligence
      };
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
        ? this.clamp(0.12 + shotCloseness * 0.28 + (1 - carrier.pressure) * 0.05, 0.06, 0.46)
        : 0;
      const shootingDecision = (
        carrier.attributes.technique * 0.45 +
        carrier.attributes.intelligence * 0.55
      ) / 100;
      shotChance *= 0.65 + shootingDecision * 0.45;
      if (goalDistance < 24 && maximumShotDistance) shotChance = Math.max(shotChance, 0.32);
      if (goalDistance > 30) shotChance *= 0.3;

      if (shotChance && goalDistance < 18 && this.attemptLastDitchChallenge(carrier)) {
        return;
      }

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
              (carrier.attributes.technique + carrier.attributes.physical - 160) / 300,
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
      const ballSide = this.getBallSide(passer);
      const defendersNearBall = opponents.filter((opponent) => this.distance(opponent, passer) <= 24).length;
      const crossingPosition = Math.abs(passer.x - 50) >= 27 && passerProgress >= 66;
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
          const backwardReleaseBias = progress < -4
            ? this.clamp(0.18 + passer.pressure * 1.25, 0.18, 1.18)
            : 1;
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
          const passerAndReceiverWidePair = (
            (this.isFullback(passer) && this.isWideMidfielder(player)) ||
            (this.isWideMidfielder(passer) && this.isFullback(player))
          ) && Math.sign(passer.baseX - 50) === Math.sign(player.baseX - 50);
          const wideCombinationBias = passerAndReceiverWidePair && distance <= 24 ? 1.75 : 1;
          const centerBackTriangleBias = passer.role === "ZAG" &&
            ["LE", "LD", "VOL", "MC", "ZAG"].includes(player.role) &&
            distance <= 28
            ? 1.45
            : 1;
          const playerSide = player.x < 42 ? "left" : (player.x > 58 ? "right" : "center");
          const inversionBias = defendersNearBall >= 4 &&
            ballSide !== "center" &&
            playerSide !== "center" &&
            playerSide !== ballSide &&
            laneSafety >= 0.68
            ? 2
            : 1;
          const throughBallBias = (
            this.isForward(player) || this.isWideMidfielder(player)
          ) && progress >= 8 && laneSafety >= 0.7 && player.spaceScore >= 0.55
            ? 1.75
            : 1;
          const crossTargetBias = crossingPosition && (
            this.isForward(player) ||
            (this.isWideMidfielder(player) &&
              Math.sign(player.baseX - 50) !== Math.sign(passer.x - 50))
          )
            ? 2.1
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
          const passerQuality = (passer.attributes.technique * 0.58 + passer.attributes.intelligence * 0.42) / 100;
          const receiverQuality = (player.attributes.technique + player.attributes.intelligence) / 200;
          const abilityBias = 0.62 + passerQuality * 0.24 + receiverQuality * 0.24;
          const longPassSkill = distance > 30 ? 0.42 + passerQuality * 0.78 : 1;
          return {
            player,
            weight: Math.max(
              0.003,
              distanceFit *
              progressBias *
              backwardReleaseBias *
              laneSafety *
              pressureBias *
              roleBias *
              supportBias *
              longOptionPenalty *
              highQualityLongOption *
              chanceCreationBias *
              wideCombinationBias *
              centerBackTriangleBias *
              inversionBias *
              throughBallBias *
              crossTargetBias *
              buildUpBias *
              abilityBias *
              longPassSkill *
              offsidePenalty
            )
          };
        });

      return this.pickWeighted(candidates);
    }

    performShot(shooter, options = {}) {
      const team = this.getTeam(shooter.teamId);
      const opponent = this.getOpponent(team);
      const goalkeeper = opponent.players.find((player) => player.role === "GOL");
      const blockers = opponent.players
        .filter((player) => player.role !== "GOL")
        .filter((player) => this.distanceToSegment(player, shooter, this.getGoalPoint(team)) < 2.4)
        .sort((a, b) => this.distance(a, shooter) - this.distance(b, shooter));
      const blocker = blockers[0] || null;
      const goal = this.getGoalPoint(team);
      const distance = this.distance(shooter, goal);
      const finishingQuality = (
        shooter.attributes.technique * 0.68 +
        shooter.attributes.intelligence * 0.32
      ) / 100;
      const goalkeeperQuality = goalkeeper
        ? goalkeeper.attributes.defense * 0.72 + goalkeeper.attributes.intelligence * 0.28
        : 50;
      const goalChance = this.clamp(
        (
          0.025 +
          (1 - this.clamp(distance / 48, 0, 1)) * 0.4 +
          (1 - shooter.pressure) * 0.09
        ) * (0.62 + finishingQuality * 0.58) -
          (goalkeeperQuality - 50) / 420,
        0.015,
        0.6
      ) * 0.65;
      const adjustedGoalChance = this.clamp(
        goalChance,
        0.01,
        0.42
      );
      const roll = this.random.next();
      const saveChance = this.clamp(
        0.34 + goalkeeperQuality / 180 - shooter.attributes.technique / 450,
        0.3,
        0.82
      );
      const defensiveOutcomeRoll = this.random.next();
      const blockChance = blocker
        ? this.clamp(0.04 + blocker.attributes.defense / 520, 0.08, 0.22)
        : 0;
      const outcome = options.outcome || (
        roll < adjustedGoalChance
          ? "goal"
          : (defensiveOutcomeRoll < blockChance
            ? "blocked"
            : (defensiveOutcomeRoll < blockChance + saveChance
              ? (this.random.next() < 0.24 ? "parried" : "saved")
              : "out"))
      );
      const target = outcome === "saved" && goalkeeper
        ? { x: goalkeeper.x, y: goalkeeper.y }
        : (["out", "parried", "blocked"].includes(outcome)
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
        lastTouchedTeamId: ["parried", "blocked"].includes(outcome)
          ? opponent.id
          : shooter.teamId,
        contactedPlayerIds: [],
        shooterId: shooter.id,
        deflectorId: outcome === "blocked" ? blocker?.id || null : goalkeeper?.id || null,
        goalChance: adjustedGoalChance,
        oneTouch: false,
        oneTouchChain: 0,
        combination: false,
        passTrigger: null,
        decisionIntelligence: null,
        requiredIntelligence: null
      });
      this.emit("shot_started", {
        teamId: team.id,
        playerId: shooter.id,
        distance,
        goalChance: adjustedGoalChance
      });
    }

    takePenalty(kicker, forcedOutcome = null) {
      if (!kicker) return false;
      const team = this.getTeam(kicker.teamId);
      const defendingTeam = this.getOpponent(team);
      const goalkeeper = defendingTeam.players.find((player) => player.role === "GOL");
      const scoringQuality = (
        kicker.attributes.technique * 0.65 +
        kicker.attributes.intelligence * 0.35
      ) / 100;
      const goalkeeperQuality = goalkeeper
        ? (goalkeeper.attributes.defense * 0.7 + goalkeeper.attributes.intelligence * 0.3) / 100
        : 0.5;
      const goalChance = this.clamp(
        0.68 + scoringQuality * 0.2 - goalkeeperQuality * 0.14,
        0.58,
        0.86
      );
      const saveChance = this.clamp(0.18 + goalkeeperQuality * 0.18, 0.2, 0.38);
      const roll = this.random.next();
      const outcome = forcedOutcome || (
        roll < goalChance
          ? "goal"
          : (roll < goalChance + saveChance ? "saved" : "missed")
      );

      this.positionForPenalty(kicker, defendingTeam);
      team.stats.shots += 1;
      kicker.matchStats.shots += 1;
      this.emit("penalty_taken", {
        teamId: team.id,
        playerId: kicker.id,
        goalkeeperId: goalkeeper?.id || null,
        goalChance
      });

      if (outcome === "goal") {
        team.score += 1;
        team.stats.goals += 1;
        kicker.matchStats.goals += 1;
        this.state = "goalPause";
        Object.assign(this.ball, {
          mode: "out",
          x: 50,
          y: team.attacksDown ? 100 : 0,
          controllerId: null,
          action: null,
          restartTeamId: defendingTeam.id,
          restartReason: "kickoff"
        });
        this.possession = null;
        this.emit("penalty_scored", {
          teamId: team.id,
          playerId: kicker.id,
          goalkeeperId: goalkeeper?.id || null
        });
        this.emit("goal", {
          teamId: team.id,
          playerId: kicker.id,
          score: this.teams.map((candidate) => candidate.score),
          distance: 11,
          goalChance,
          penalty: true
        });
        return true;
      }

      if (outcome === "saved" && goalkeeper) {
        goalkeeper.matchStats.saves += 1;
        this.setBallController(goalkeeper);
        this.emit("penalty_saved", {
          teamId: team.id,
          playerId: kicker.id,
          goalkeeperId: goalkeeper.id
        });
        return true;
      }

      this.emit("penalty_missed", {
        teamId: team.id,
        playerId: kicker.id,
        goalkeeperId: goalkeeper?.id || null
      });
      this.scheduleRestart(
        "goal_kick",
        defendingTeam,
        { x: 50, y: this.getOwnGoalPoint(defendingTeam).y === 0 ? 5 : 95 },
        500,
        { penalty: true }
      );
      return true;
    }

    positionForPenalty(kicker, defendingTeam) {
      const attackingTeam = this.getTeam(kicker.teamId);
      const goal = this.getGoalPoint(attackingTeam);
      const spotY = goal.y === 0 ? 11 : 89;
      kicker.x = 50;
      kicker.y = spotY;
      kicker.targetX = 50;
      kicker.targetY = spotY;

      const goalkeeper = defendingTeam.players.find((player) => player.role === "GOL");
      if (goalkeeper) {
        goalkeeper.x = 50;
        goalkeeper.y = goal.y === 0 ? 3 : 97;
        goalkeeper.targetX = goalkeeper.x;
        goalkeeper.targetY = goalkeeper.y;
      }

      this.allPlayers()
        .filter((player) => player !== kicker && player.role !== "GOL")
        .forEach((player, index) => {
          player.x = this.clamp(34 + (index % 6) * 6, 25, 75);
          player.y = goal.y === 0 ? 22 + Math.floor(index / 6) * 3 : 78 - Math.floor(index / 6) * 3;
          player.targetX = player.x;
          player.targetY = player.y;
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

      if (["parried", "blocked"].includes(outcome) && shootingTeam && defendingTeam) {
        const eventType = outcome === "parried" ? "shot_parried" : "shot_blocked";
        const deflector = this.findPlayer(this.ball.deflectorId);
        if (outcome === "parried" && deflector?.role === "GOL") {
          deflector.matchStats.saves += 1;
        }
        this.emit(eventType, {
          teamId: shootingTeam.id,
          playerId: shooter?.id || null,
          deflectorId: deflector?.id || null,
          distance: this.ball.distance
        });
        this.scheduleRestart(
          "corner",
          shootingTeam,
          {
            x: this.ball.x < 50 ? 1 : 99,
            y: this.getOwnGoalPoint(defendingTeam).y === 0 ? 1 : 99
          },
          700,
          {
            playerId: shooter?.id || null,
            deflectorId: deflector?.id || null
          }
        );
        return;
      }

      this.emit("shot_out", {
        teamId: shootingTeam?.id || null,
        playerId: shooter?.id || null,
        distance: this.ball.distance
      });
      this.scheduleRestart(
        "goal_kick",
        defendingTeam || this.teams[0],
        {
          x: this.clamp(this.ball.x, 25, 75),
          y: this.getOwnGoalPoint(defendingTeam || this.teams[0]).y === 0 ? 5 : 95
        },
        700,
        {
          playerId: shooter?.id || null
        }
      );
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
        this.classifyBallOut();
      }
    }

    classifyBallOut() {
      const lastTouchTeam = this.getTeam(this.ball.lastTouchedTeamId);
      if (this.ball.x < 1 || this.ball.x > 99) {
        const restartTeam = lastTouchTeam ? this.getOpponent(lastTouchTeam) : this.teams[0];
        this.scheduleRestart("throw_in", restartTeam, {
          x: this.ball.x < 1 ? 1 : 99,
          y: this.clamp(this.ball.y, 3, 97)
        });
        return;
      }

      const defendingTeam = this.getDefendingTeamAtEndLine(this.ball.y);
      const restartReason = lastTouchTeam === defendingTeam ? "corner" : "goal_kick";
      const restartTeam = restartReason === "corner"
        ? this.getOpponent(defendingTeam)
        : defendingTeam;
      this.scheduleRestart(restartReason, restartTeam, {
        x: this.clamp(this.ball.x, 1, 99),
        y: this.ball.y < 1 ? 1 : 99
      });
    }

    getDefendingTeamAtEndLine(y) {
      return this.teams.find((team) => {
        const ownGoal = this.getOwnGoalPoint(team);
        return y < 50 ? ownGoal.y === 0 : ownGoal.y === 100;
      }) || this.teams[0];
    }

    scheduleRestart(reason, team, point, delayMs = 600, eventData = {}) {
      if (reason === "throw_in") team.stats.throwIns += 1;
      if (reason === "corner") team.stats.corners += 1;
      if (reason === "goal_kick") team.stats.goalKicks += 1;
      Object.assign(this.ball, {
        mode: "out",
        x: point.x,
        y: point.y,
        controllerId: null,
        intendedReceiverId: null,
        action: null,
        restartTeamId: team.id,
        restartReason: reason,
        restartX: point.x,
        restartY: point.y
      });
      this.possession = null;
      this.restartRemainingMs = delayMs;
      this.emit(`${reason}_awarded`, {
        teamId: team.id,
        x: point.x,
        y: point.y,
        ...eventData
      });
    }

    restartFromOut() {
      const team = this.getTeam(this.ball.restartTeamId) || this.teams[0];
      const restartReason = this.ball.restartReason;
      const restartPoint = {
        x: this.ball.restartX ?? this.ball.x,
        y: this.ball.restartY ?? this.ball.y
      };
      const goalkeeper = team.players.find((player) => player.role === "GOL");
      if (restartReason === "penalty") {
        const kicker = [...team.players]
          .filter((player) => player.role !== "GOL")
          .sort((a, b) =>
            (b.attributes.technique * 0.65 + b.attributes.intelligence * 0.35) -
            (a.attributes.technique * 0.65 + a.attributes.intelligence * 0.35)
          )[0];
        this.takePenalty(kicker || team.players[0]);
        return;
      }

      const outfieldRestarter = this.nearestPlayers(
        team.players.filter((player) => player.role !== "GOL"),
        restartPoint,
        1
      )[0];
      const restarter = ["offside", "throw_in", "corner", "free_kick"].includes(restartReason)
        ? outfieldRestarter
        : goalkeeper || outfieldRestarter || team.players[0];
      if (["offside", "throw_in", "corner", "free_kick"].includes(restartReason) && restarter) {
        const isTouchlineRestart = restartReason === "throw_in";
        const isCorner = restartReason === "corner";
        restarter.x = isTouchlineRestart
          ? (restartPoint.x < 50 ? 4 : 96)
          : this.clamp(restartPoint.x, isCorner ? 4 : 5, isCorner ? 96 : 95);
        restarter.y = isCorner
          ? (restartPoint.y < 50 ? 3 : 97)
          : this.clamp(restartPoint.y, 4, 96);
        restarter.targetX = restarter.x;
        restarter.targetY = restarter.y;
      }
      this.setBallController(restarter || goalkeeper || team.players[0]);
      this.emit("restart", {
        teamId: team.id,
        playerId: this.ball.controllerId,
        reason: restartReason
      });
    }

    findBallContact(from, to, receiver) {
      if (!receiver) return null;
      const receiverTeam = this.getTeam(receiver.teamId);
      const opponents = this.getOpponent(receiverTeam).players.filter((player) => player.role !== "GOL");
      const contacted = new Set(this.ball.contactedPlayerIds || []);
      const passer = this.findPlayer(this.ball.passerId);
      const passQuality = passer
        ? (passer.attributes.technique * 0.62 + passer.attributes.intelligence * 0.38) / 100
        : 0.5;
      const interceptionRadius = this.clamp(1.42 - passQuality * 0.58, 0.78, 1.18);
      const candidates = opponents
        .filter((player) => !contacted.has(player.id))
        .map((player) => ({
          player,
          distance: this.distanceToSegment(player, from, to)
        }))
        .filter((item) => item.distance < interceptionRadius)
        .sort((a, b) => a.distance - b.distance);

      const candidate = candidates[0];
      if (!candidate) return null;
      this.ball.contactedPlayerIds.push(candidate.player.id);
      const controlChance = this.clamp(
        0.3 +
          candidate.player.attributes.defense / 230 +
          candidate.player.attributes.intelligence / 420,
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
        const defensiveReading = (
          opponent.attributes.defense * 0.58 +
          opponent.attributes.intelligence * 0.42
        ) / 100;
        return sum + ((10 - distance) / 10) * (0.55 + defensiveReading * 0.75);
      }, 0);
      return this.clamp(1 - danger * 0.24, 0.08, 1);
    }

    getOffsidePosition(player, passer) {
      const team = this.getTeam(player.teamId);
      const opponent = this.getOpponent(team);
      const playerProgress = this.getAttackProgress(player, team);
      const ballProgress = this.getAttackProgress(passer, team);
      const opponentProgress = opponent.players
        .map((candidate) => this.getAttackProgress(candidate, team))
        .sort((a, b) => b - a);
      const secondLastOpponentProgress = opponentProgress[1] ?? opponentProgress[0] ?? 100;
      const offsideLine = Math.max(50, ballProgress, secondLastOpponentProgress);
      return {
        isOffside: player.teamId === passer.teamId &&
          playerProgress > offsideLine + 0.6,
        playerProgress,
        ballProgress,
        secondLastOpponentProgress,
        offsideLine
      };
    }

    isOffside(player, passer) {
      return this.getOffsidePosition(player, passer).isOffside;
    }

    getRoleAttackPush(role) {
      return this.getRoleBehavior(role).attackPush || 0;
    }

    getRoleDefensiveProgress(role, blockProgress) {
      const line = this.getRoleBehavior(role).defensiveLine || { offset: 0, min: 8, max: 8 };
      return this.clamp(blockProgress + line.offset, line.min, line.max);
    }

    getPlayerSpeed(player) {
      const paceFactor = this.clamp(0.65 + player.attributes.physical / 160, 0.68, 1.28);
      return this.getRoleBehavior(player.role).speed * paceFactor;
    }

    getCarrierCarryDistance(player) {
      return this.getRoleBehavior(player.role).carryDistance;
    }

    getDecisionDelay(player) {
      const pressureFactor = player?.pressure > 0.6 ? 0.72 : 1;
      const intelligence = player?.attributes.intelligence || 50;
      const composureFactor = this.clamp(1.2 - intelligence / 260, 0.78, 1.18);
      return (360 + this.random.next() * 420) * pressureFactor * composureFactor;
    }

    isWide(player) {
      return this.roleHasGroup(player.role, "wide");
    }

    isFullback(player) {
      return this.roleHasGroup(player.role, "fullback");
    }

    isWideMidfielder(player) {
      return this.roleHasGroup(player.role, "wideMidfielder");
    }

    isDefensive(player) {
      return this.roleHasGroup(player.role, "defensive");
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
          tacticalState: { ...team.tacticalState },
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
