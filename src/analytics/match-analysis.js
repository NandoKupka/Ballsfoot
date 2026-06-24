(function exposeMatchAnalysis(root, factory) {
  const simulation = typeof module !== "undefined" && module.exports
    ? require("../domain/match-engine.js")
    : root.BallsfootSimulation;
  const exports = factory(simulation);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exports;
  }

  if (root) {
    root.BallsfootAnalytics = exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createMatchAnalysisModule(simulation) {
  "use strict";

  const { MatchEngine } = simulation || {};
  if (!MatchEngine) throw new Error("MatchEngine is required for match analysis.");

  function simulateMatch(options) {
    const engine = new MatchEngine({
      teams: options.teams,
      seed: options.seed,
      matchClockRate: options.matchClockRate || 30
    });
    const events = [];
    engine.command({ type: "start" });

    for (let step = 0; step < 4_000 && engine.getSnapshot().match.state !== "finished"; step += 1) {
      engine.advance(50);
      const snapshot = engine.getSnapshot();
      events.push(...engine.drainEvents());
      if (snapshot.match.state === "goalPause") engine.command({ type: "confirmGoal" });
      if (snapshot.match.state === "halftime") engine.command({ type: "start" });
    }

    const snapshot = engine.getSnapshot();
    if (snapshot.match.state !== "finished") {
      throw new Error(`Simulation with seed ${options.seed} did not finish.`);
    }

    events.push(...engine.drainEvents());
    return { snapshot, events };
  }

  function simulateMatches(options = {}) {
    if (!Array.isArray(options.teams) || options.teams.length !== 2) {
      throw new Error("simulateMatches requires exactly two teams.");
    }

    const matches = Math.max(1, Number(options.matches) || 100);
    const seedStart = Number(options.seedStart) || 1;
    const teamAggregates = new Map();
    const playerAggregates = new Map();
    const totals = {
      goals: 0,
      shots: 0,
      passesAttempted: 0,
      passesCompleted: 0,
      longPasses: 0,
      passEvents: 0,
      oneTouchPasses: 0,
      combinations: 0,
      offsides: 0,
      shotDistance: 0,
      shotEvents: 0
    };

    for (let matchIndex = 0; matchIndex < matches; matchIndex += 1) {
      const result = simulateMatch({
        teams: options.teams,
        seed: seedStart + matchIndex,
        matchClockRate: options.matchClockRate
      });

      result.snapshot.teams.forEach((team) => {
        const aggregate = teamAggregates.get(team.id) || {
          id: team.id,
          name: team.name,
          matches: 0,
          goals: 0,
          shots: 0,
          passesAttempted: 0,
          passesCompleted: 0,
          oneTouchPasses: 0,
          offsides: 0,
          possessionMatchMs: 0
        };
        aggregate.matches += 1;
        aggregate.goals += team.score;
        aggregate.shots += team.stats.shots;
        aggregate.passesAttempted += team.stats.passesAttempted;
        aggregate.passesCompleted += team.stats.passesCompleted;
        aggregate.oneTouchPasses += team.stats.oneTouchPasses;
        aggregate.offsides += team.stats.offsides;
        aggregate.possessionMatchMs += team.stats.possessionMatchMs;
        teamAggregates.set(team.id, aggregate);

        team.players.forEach((player) => {
          const key = `${team.id}:${player.id}`;
          const aggregatePlayer = playerAggregates.get(key) || {
            teamId: team.id,
            team: team.shortName,
            playerId: player.id,
            name: player.name,
            number: player.number,
            role: player.role,
            overall: player.overall,
            attributes: { ...player.attributes },
            matches: 0,
            touches: 0,
            distanceCovered: 0,
            passesAttempted: 0,
            passesCompleted: 0,
            shots: 0,
            goals: 0,
            interceptions: 0,
            recoveries: 0,
            carries: 0,
            oneTouchPasses: 0,
            offsides: 0,
            saves: 0
          };
          aggregatePlayer.matches += 1;
          Object.keys(player.matchStats).forEach((stat) => {
            aggregatePlayer[stat] += player.matchStats[stat];
          });
          playerAggregates.set(key, aggregatePlayer);
        });
      });

      result.events.forEach((event) => {
        if (event.type === "pass_started") {
          totals.passEvents += 1;
          if (event.data.distance > 30) totals.longPasses += 1;
          if (event.data.oneTouch) totals.oneTouchPasses += 1;
          if (event.data.combination) totals.combinations += 1;
        }
        if (event.type === "shot_started") {
          totals.shotEvents += 1;
          totals.shotDistance += event.data.distance;
        }
      });
    }

    const teams = [...teamAggregates.values()].map((team) => {
      totals.goals += team.goals;
      totals.shots += team.shots;
      totals.passesAttempted += team.passesAttempted;
      totals.passesCompleted += team.passesCompleted;
      totals.offsides += team.offsides;
      return {
        ...team,
        goalsPerMatch: round(team.goals / team.matches),
        shotsPerMatch: round(team.shots / team.matches),
        passCompletionRate: rate(team.passesCompleted, team.passesAttempted),
        oneTouchPassesPerMatch: round(team.oneTouchPasses / team.matches),
        offsidesPerMatch: round(team.offsides / team.matches)
      };
    });

    const players = [...playerAggregates.values()]
      .map((player) => ({
        ...player,
        distanceCovered: round(player.distanceCovered),
        passCompletionRate: rate(player.passesCompleted, player.passesAttempted),
        goalsPerMatch: round(player.goals / player.matches),
        shotsPerMatch: round(player.shots / player.matches)
      }))
      .sort((a, b) =>
        b.goals - a.goals ||
        b.shots - a.shots ||
        b.passesCompleted - a.passesCompleted
      );

    const summary = {
      matches,
      seedStart,
      goalsPerMatch: round(totals.goals / matches),
      shotsPerMatch: round(totals.shots / matches),
      passesPerMatch: round(totals.passesAttempted / matches),
      passCompletionRate: rate(totals.passesCompleted, totals.passesAttempted),
      longPassRate: rate(totals.longPasses, totals.passEvents),
      oneTouchPassRate: rate(totals.oneTouchPasses, totals.passEvents),
      oneTouchPassesPerMatch: round(totals.oneTouchPasses / matches),
      combinationsPerMatch: round(totals.combinations / matches),
      offsidesPerMatch: round(totals.offsides / matches),
      averageShotDistance: round(totals.shotDistance / Math.max(totals.shotEvents, 1))
    };

    return {
      summary,
      signals: createSignals(summary),
      teams,
      players
    };
  }

  function createSignals(summary) {
    return [
      {
        metric: "longPassRate",
        value: summary.longPassRate,
        status: summary.longPassRate > 25 ? "warning" : "ok",
        note: summary.longPassRate > 25 ? "passes longos podem estar frequentes demais" : "circulacao curta predominante"
      },
      {
        metric: "averageShotDistance",
        value: summary.averageShotDistance,
        status: summary.averageShotDistance > 30 ? "warning" : "ok",
        note: summary.averageShotDistance > 30 ? "finalizacoes podem estar distantes demais" : "distancia de chute controlada"
      },
      {
        metric: "shotsPerMatch",
        value: summary.shotsPerMatch,
        status: summary.shotsPerMatch < 1 || summary.shotsPerMatch > 20 ? "warning" : "ok",
        note: summary.shotsPerMatch < 1
          ? "criacao de chances pode estar baixa"
          : (summary.shotsPerMatch > 20
            ? "volume de finalizacoes pode estar alto demais"
            : "partidas produzem finalizacoes")
      },
      {
        metric: "goalsPerMatch",
        value: summary.goalsPerMatch,
        status: summary.goalsPerMatch > 6 ? "warning" : "ok",
        note: summary.goalsPerMatch > 6
          ? "volume de gols pode estar alto demais"
          : "volume de gols permanece controlado"
      },
      {
        metric: "oneTouchPassRate",
        value: summary.oneTouchPassRate,
        status: summary.oneTouchPassRate > 14 || summary.oneTouchPassRate < 1 ? "warning" : "ok",
        note: summary.oneTouchPassRate > 14
          ? "passes de primeira podem estar automaticos demais"
          : (summary.oneTouchPassRate < 1
            ? "passes de primeira quase nao aparecem"
            : "passes de primeira aparecem de forma seletiva")
      },
      {
        metric: "offsidesPerMatch",
        value: summary.offsidesPerMatch,
        status: summary.offsidesPerMatch > 8 ? "warning" : "ok",
        note: summary.offsidesPerMatch > 8
          ? "movimentos em profundidade estao gerando impedimentos demais"
          : "linha de impedimento participa sem interromper excessivamente"
      }
    ];
  }

  function rate(part, total) {
    return total ? round(part / total * 100) : 0;
  }

  function round(value) {
    return Number((Number(value) || 0).toFixed(2));
  }

  return {
    simulateMatch,
    simulateMatches
  };
});
