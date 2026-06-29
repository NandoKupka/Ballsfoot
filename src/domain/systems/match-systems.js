(function exposeBallsfootMatchSystems(root, factory) {
  const exports = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exports;
  }

  if (root) {
    root.BallsfootSystems = exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createMatchSystemsModule() {
  "use strict";

  const HALF_DURATION_MS = 45 * 60 * 1000;

  class MatchStepPipeline {
    constructor(systems) {
      this.systems = systems;
    }

    run(world, stepMs) {
      this.systems.forEach((system) => system.update(world, stepMs));
    }
  }

  class SimulationClockSystem {
    update(world, stepMs) {
      world.simulationElapsedMs += stepMs;
      world.tacticalAccumulatorMs += stepMs;
    }
  }

  class TacticalContextSystem {
    update(world) {
      if (world.tacticalAccumulatorMs < 250) return;
      world.updateTacticalTargets();
      world.tacticalAccumulatorMs %= 250;
    }
  }

  class MovementSystem {
    update(world, stepMs) {
      world.movePlayers(stepMs);
    }
  }

  class PressureSystem {
    update(world) {
      world.updatePressure();
    }
  }

  class DefensiveActionSystem {
    update(world) {
      if (world.autonomous && world.ball.mode === "controlled") {
        world.attemptDefensiveTackle();
      }
    }
  }

  class BallLifecycleSystem {
    update(world, stepMs) {
      world.updateBall(stepMs);
    }
  }

  class LooseBallSystem {
    update(world, stepMs) {
      if (world.ball.mode === "loose") {
        world.updateLooseBall(stepMs);
      }
    }
  }

  class RestartSystem {
    update(world, stepMs) {
      if (world.ball.mode !== "out" || world.restartRemainingMs <= 0) return;
      world.restartRemainingMs -= stepMs;
      if (world.restartRemainingMs <= 0) world.restartFromOut();
    }
  }

  class PossessionStatsSystem {
    update(world, stepMs) {
      if (!world.possession) return;
      const possessionTeam = world.getTeam(world.possession.teamId);
      if (possessionTeam) {
        possessionTeam.stats.possessionMatchMs += stepMs * world.matchClockRate;
      }
    }
  }

  class AttackingDecisionSystem {
    update(world, stepMs) {
      if (!world.autonomous || world.ball.mode !== "controlled") return;

      world.decisionRemainingMs -= stepMs;
      if (world.decisionRemainingMs <= 0) {
        world.decideAction();
      }
    }
  }

  class MatchClockSystem {
    update(world, stepMs) {
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
  }

  function createDefaultMatchPipeline() {
    return new MatchStepPipeline([
      new SimulationClockSystem(),
      new TacticalContextSystem(),
      new MovementSystem(),
      new PressureSystem(),
      new DefensiveActionSystem(),
      new BallLifecycleSystem(),
      new PossessionStatsSystem(),
      new LooseBallSystem(),
      new RestartSystem(),
      new AttackingDecisionSystem(),
      new MatchClockSystem()
    ]);
  }

  return {
    MatchStepPipeline,
    SimulationClockSystem,
    TacticalContextSystem,
    MovementSystem,
    PressureSystem,
    DefensiveActionSystem,
    BallLifecycleSystem,
    LooseBallSystem,
    RestartSystem,
    PossessionStatsSystem,
    AttackingDecisionSystem,
    MatchClockSystem,
    createDefaultMatchPipeline
  };
});
