(function exposeBallsfootBrowserGame(root) {
  "use strict";

  if (!root || !root.document) return;

  const { MatchEngine } = root.BallsfootSimulation || {};
  const { TEAMS_CONFIG, MATCH_SETTINGS } = root.BallsfootConfig || {};
  if (!MatchEngine) {
    throw new Error("BallsfootSimulation.MatchEngine must be loaded before the browser adapter.");
  }
  if (!TEAMS_CONFIG) {
    throw new Error("BallsfootConfig.TEAMS_CONFIG must be loaded before the browser adapter.");
  }

  class BrowserGameAdapter {
    constructor(documentRef = root.document, options = {}) {
      this.document = documentRef;
      this.speedOptions = [0.5, 1, 1.5, 2, 3, 4, 5, 7.5, 10];
      this.speed = 1;
      this.lastFrameAt = null;
      this.animationFrameId = null;
      this.playerElements = new Map();
      this.teamLists = new Map();
      this.allLogEntries = [];
      this.currentMatchEntries = [];
      this.keyMomentEntries = [];
      this.matchSequence = 1;
      this.copyFeedbackTimer = null;
      this.restartNoticeTimer = null;
      this.restartNoticeBlocking = false;
      this.restartNoticeReason = null;
      this.forcedFieldAnimationRate = null;
      this.seed = options.seed ?? Date.now();
      this.lastPanelRenderAt = 0;
      this.lastRenderedState = null;
      this.teamListsRendered = false;

      this.cacheElements();
      this.renderTeamPanels();
      this.engine = new MatchEngine({
        teams: TEAMS_CONFIG,
        seed: this.seed,
        matchClockRate: MATCH_SETTINGS.matchClockRate
      });
      this.mountPlayerTokens();
      this.bindControls();
      this.setSpeed(this.speed);
      this.addLog({
        type: "system",
        title: "Pronto para iniciar",
        detail: "O motor continuo esta preparado; a bola e os jogadores possuem estados independentes."
      });
      this.render();
      this.animationFrameId = root.requestAnimationFrame((timestamp) => this.frame(timestamp));
    }

    cacheElements() {
      const byId = (id) => this.document.getElementById(id);
      this.homeSlot = byId("home-team-slot");
      this.awaySlot = byId("away-team-slot");
      this.field = byId("field");
      this.ballElement = byId("ball");
      this.clock = byId("clock");
      this.score = byId("score");
      this.scoreHomeLabel = byId("score-home-label");
      this.scoreAwayLabel = byId("score-away-label");
      this.statusText = byId("status-text");
      this.statusDot = byId("status-dot");
      this.controls = byId("controls");
      this.speedSlider = byId("speed-slider");
      this.speedValue = byId("speed-value");
      this.eventLog = byId("event-log");
      this.keyMoments = byId("key-moments");
      this.matchStats = byId("match-stats");
      this.logCount = byId("log-count");
      this.copyLogsButton = byId("copy-logs");
      this.copyJsonlButton = byId("copy-jsonl");
      this.copyCsvButton = byId("copy-csv");
      this.downloadJsonButton = byId("download-json");
      this.testThrowInButton = byId("test-throw-in");
      this.testCornerButton = byId("test-corner");
      this.testPenaltyButton = byId("test-penalty");
      this.testFreeKickButton = byId("test-free-kick");
      this.copyFeedback = byId("copy-feedback");
      this.goalModal = byId("goal-modal");
      this.goalTeam = byId("goal-team");
      this.goalTitle = byId("goal-title");
      this.goalDetail = byId("goal-detail");
      this.goalOkButton = byId("goal-ok");
      this.setPieceModal = byId("set-piece-modal");
      this.setPieceTeam = byId("set-piece-team");
      this.setPieceTitle = byId("set-piece-title");
      this.setPieceDetail = byId("set-piece-detail");
      this.setPieceList = byId("set-piece-list");
      this.setPieceAutoButton = byId("set-piece-auto");
      this.restartNoticeModal = byId("restart-notice-modal");
      this.restartNoticeTeam = byId("restart-notice-team");
      this.restartNoticeTitle = byId("restart-notice-title");
      this.restartNoticeDetail = byId("restart-notice-detail");
    }

    renderTeamPanels() {
      TEAMS_CONFIG.forEach((team) => {
        const slot = team.venue === "home" ? this.homeSlot : this.awaySlot;
        const panel = this.document.createElement("aside");
        const heading = this.document.createElement("div");
        const nameBlock = this.document.createElement("div");
        const title = this.document.createElement("h2");
        const venue = this.document.createElement("span");
        const mark = this.document.createElement("div");
        const control = this.document.createElement("div");
        const label = this.document.createElement("label");
        const select = this.document.createElement("select");
        const list = this.document.createElement("ol");

        panel.className = "team-panel";
        panel.style.setProperty("--team-color", team.colors.main);
        panel.style.setProperty("--team-deep", team.colors.deep);
        panel.style.setProperty("--team-highlight", team.colors.highlight);
        panel.style.setProperty("--team-glow", team.colors.glow);
        heading.className = "team-heading";
        nameBlock.className = "team-name";
        title.textContent = team.name;
        venue.textContent = team.venue === "home" ? "Mandante" : "Visitante";
        mark.className = "team-mark";
        mark.textContent = team.mark;
        control.className = "control-group";
        label.textContent = "Formacao";
        select.disabled = true;
        select.setAttribute("aria-label", `Formacao do ${team.name}`);
        const option = this.document.createElement("option");
        option.value = "4-4-2";
        option.textContent = "4-4-2";
        select.appendChild(option);
        list.className = "player-list";

        nameBlock.append(title, venue);
        heading.append(nameBlock, mark);
        control.append(label, select);
        panel.append(heading, control, list);
        slot.replaceChildren(panel);
        this.teamLists.set(team.id, list);
      });

      this.scoreHomeLabel.textContent = TEAMS_CONFIG[0].shortName;
      this.scoreAwayLabel.textContent = TEAMS_CONFIG[1].shortName;
    }

    mountPlayerTokens() {
      const snapshot = this.engine.getSnapshot();
      snapshot.teams.forEach((team) => {
        team.players.forEach((player) => {
          const token = this.document.createElement("div");
          const number = this.document.createElement("span");
          const stamina = this.document.createElement("span");
          token.className = "player-token";
          number.className = "player-token__number";
          number.textContent = player.number;
          stamina.className = "player-token__stamina";
          token.style.setProperty("--team-color", team.colors.main);
          token.style.setProperty("--team-deep", team.colors.deep);
          token.style.setProperty("--team-highlight", team.colors.highlight);
          token.style.setProperty("--stamina", this.formatStaminaPercent(this.getPlayerVisibleStamina(player)));
          token.style.setProperty("--stamina-color", this.getStaminaColor(this.getPlayerVisibleStamina(player)));
          token.dataset.movementMode = player.movementMode || "walk";
          token.title = this.formatPlayerTooltip(team, player);
          token.append(number, stamina);
          this.field.appendChild(token);
          this.playerElements.set(player.id, token);
        });
      });
    }

    bindControls() {
      this.speedSlider.addEventListener("input", () => {
        this.setSpeed(this.speedOptions[Number(this.speedSlider.value)] ?? 1);
      });
      this.copyLogsButton.addEventListener("click", () => this.copyLogs("text"));
      this.copyJsonlButton.addEventListener("click", () => this.copyLogs("jsonl"));
      this.copyCsvButton.addEventListener("click", () => this.copyLogs("csv"));
      this.downloadJsonButton.addEventListener("click", () => this.downloadLogs());
      this.testThrowInButton.addEventListener("click", () => this.createTestRestart("throw_in"));
      this.testCornerButton.addEventListener("click", () => this.createTestRestart("corner"));
      this.testPenaltyButton.addEventListener("click", () => this.createTestRestart("penalty"));
      this.testFreeKickButton.addEventListener("click", () => this.createTestRestart("free_kick"));
      this.goalOkButton.addEventListener("click", () => {
        this.goalModal.hidden = true;
        this.engine.command({ type: "confirmGoal" });
        this.render();
      });
      this.setPieceAutoButton.addEventListener("click", () => this.selectSetPieceTaker(null));
      root.addEventListener("resize", () => {
        this.positionGoalModal();
        this.positionSetPieceModal();
        this.positionRestartNotice();
      });
    }

    frame(timestamp) {
      if (this.lastFrameAt === null) this.lastFrameAt = timestamp;
      const deltaMs = Math.min(250, Math.max(0, timestamp - this.lastFrameAt));
      this.lastFrameAt = timestamp;
      let snapshot = this.engine.getSnapshot();

      if (snapshot.match.state === "playing" && !this.restartNoticeBlocking) {
        snapshot = this.engine.advance(deltaMs * this.speed);
      }

      this.consumeEvents(snapshot);
      this.render(timestamp, snapshot);
      this.animationFrameId = root.requestAnimationFrame((nextTimestamp) => this.frame(nextTimestamp));
    }

    setSpeed(speed) {
      this.speed = this.speedOptions.reduce((closest, candidate) =>
        Math.abs(candidate - speed) < Math.abs(closest - speed) ? candidate : closest
      , this.speedOptions[0]);
      this.speedSlider.value = String(this.speedOptions.indexOf(this.speed));
      this.speedValue.textContent = `${Number.isInteger(this.speed) ? `${this.speed}.0` : this.speed}x`;
      this.applyFieldAnimationRate(this.forcedFieldAnimationRate ?? this.speed);
    }

    applyFieldAnimationRate(rate) {
      const animationRate = Math.max(rate, 0.5);
      this.document.documentElement.style.setProperty("--ball-move-ms", `${Math.round(140 / animationRate)}ms`);
      this.document.documentElement.style.setProperty("--player-move-ms", `${Math.round(90 / animationRate)}ms`);
    }

    setForcedFieldAnimationRate(rate) {
      this.forcedFieldAnimationRate = rate;
      this.applyFieldAnimationRate(rate ?? this.speed);
    }

    consumeEvents(snapshot = this.engine.getSnapshot()) {
      this.engine.drainEvents().forEach((event) => {
        if (event.type === "match_reset") this.beginNewMatchLog();
        const entry = this.describeEvent(event, snapshot);
        if (entry) this.addLog(entry);
        if (event.type === "goal") this.openGoalModal(event, snapshot);
        if (this.isSelectableSetPieceEvent(event)) this.openSetPieceModal(event, snapshot);
        if (this.isRestartNoticeEvent(event)) this.openRestartNotice(event, snapshot);
      });
    }

    isSelectableSetPieceEvent(event) {
      return event.type === "penalty_awarded" ||
        (event.type === "free_kick_awarded" && event.data.selectable);
    }

    isRestartNoticeEvent(event) {
      return event.type === "corner_awarded" || event.type === "offside";
    }

    describeEvent(event, snapshot = this.engine.getSnapshot()) {
      const team = snapshot.teams.find((candidate) => candidate.id === event.data.teamId);
      const allPlayers = snapshot.teams.flatMap((candidate) => candidate.players);
      const findPlayer = (playerId) => allPlayers.find((candidate) => candidate.id === playerId);
      const player = findPlayer(event.data.playerId);
      const receiver = findPlayer(event.data.receiverId);
      const fouledPlayer = findPlayer(event.data.fouledPlayerId);
      const goalkeeper = findPlayer(event.data.goalkeeperId);
      const base = {
        time: this.formatEventClock(event.matchMs),
        type: team?.id || "system",
        kind: event.type,
        data: event.data
      };

      const descriptions = {
        match_started: {
          title: "Apito inicial",
          detail: "A partida comecou com movimento e decisoes atualizados continuamente."
        },
        match_resumed: {
          title: "Jogo retomado",
          detail: "A simulacao voltou a avançar."
        },
        match_paused: {
          title: "Partida pausada",
          detail: "Relogio, jogadores e bola foram congelados."
        },
        second_half_started: {
          title: "Comeca o segundo tempo",
          detail: "Os times trocaram o lado de ataque."
        },
        halftime: {
          title: "Intervalo",
          detail: "Fim do primeiro tempo."
        },
        fulltime: {
          title: "Fim de jogo",
          detail: "A simulacao terminou."
        },
        pass_started: {
          title: event.data.combination
            ? "Tabela"
            : (event.data.oneTouch ? "Passe de primeira" : "Passe"),
          detail: event.data.combination
            ? `${player?.name || "Jogador"} devolve de primeira para ${receiver?.name || "o companheiro"}.`
            : (event.data.oneTouch
              ? `${player?.name || "Jogador"} redireciona de primeira para ${receiver?.name || "um companheiro"}.`
              : `${player?.name || "Jogador"} procura ${receiver?.name || "um companheiro"}.`)
        },
        pass_completed: {
          title: "Passe completo",
          detail: event.data.continuedFirstTime
            ? `${player?.name || "Jogador"} prepara o passe de primeira.`
            : `${player?.name || "Jogador"} domina a bola.`
        },
        offside: {
          title: "Impedimento",
          detail: `${player?.name || "Jogador"} recebe em posicao irregular e a defesa ganha a reposicao.`
        },
        pass_intercepted: {
          title: "Interceptacao",
          detail: `${player?.name || "Defensor"} corta a trajetoria e assume a posse.`
        },
        tackle_won: {
          title: "Desarme",
          detail: `${player?.name || "Defensor"} ganha o duelo e assume a posse.`
        },
        tackle_deflected: {
          title: "Desarme com desvio",
          detail: `${player?.name || "Defensor"} toca na bola durante o duelo.`
        },
        foul_committed: {
          title: event.data.penalty ? "Penalti" : "Falta",
          detail: event.data.penalty
            ? `${player?.name || "Defensor"} derruba ${fouledPlayer?.name || "o adversario"} dentro da area.`
            : `${player?.name || "Defensor"} para ${fouledPlayer?.name || "o adversario"} com falta.`
        },
        throw_in_awarded: {
          title: "Lateral",
          detail: `${team?.shortName || "O time"} ganha a cobranca lateral${event.data.count ? ` (${event.data.count} no jogo)` : ""}.`
        },
        corner_awarded: {
          title: "Escanteio",
          detail: `${team?.shortName || "O time"} ganha nova chance de ataque pela bola desviada na linha de fundo.`
        },
        corner_cross: {
          title: "Cruzamento",
          detail: `${player?.name || "Jogador"} cobra o escanteio buscando ${receiver?.name || "um companheiro"} na area.`
        },
        corner_header: {
          title: "Cabeceio",
          detail: `${player?.name || "Jogador"} ganha a disputa pelo alto e finaliza de primeira.`
        },
        corner_cleared: {
          title: "Corte no escanteio",
          detail: `${player?.name || "Defensor"} acompanha a marcacao e afasta o cruzamento.`
        },
        goal_kick_awarded: {
          title: "Tiro de meta",
          detail: `${team?.shortName || "O time"} reinicia desde a defesa.`
        },
        free_kick_awarded: {
          title: event.data.dangerous ? "Falta perigosa" : "Falta",
          detail: event.data.dangerous
            ? `${team?.shortName || "O time"} tem uma cobranca direta perto da area.`
            : `${team?.shortName || "O time"} reinicia rapido com o jogador mais perto.`
        },
        penalty_awarded: {
          title: "Penalti marcado",
          detail: `${team?.shortName || "O time"} recebe a cobranca apos falta de ${player?.name || "um defensor"} na area.`
        },
        pass_deflected: {
          title: "Passe desviado",
          detail: `${player?.name || "Defensor"} toca na bola, que fica solta.`
        },
        bad_control: {
          title: "Dominio ruim",
          detail: `${player?.name || "Jogador"} nao consegue controlar e a bola fica solta.`
        },
        carry: {
          title: "Conducao",
          detail: `${player?.name || "Jogador"} avanca com a bola.`
        },
        shot_started: {
          title: event.data.header
            ? "Cabeceio"
            : (event.data.setPiece === "penalty"
              ? "Penalti"
              : (event.data.setPiece === "free_kick" ? "Falta direta" : "Finalizacao")),
          detail: event.data.setPiece === "penalty"
            ? `${player?.name || "Jogador"} cobra o penalti.`
            : (event.data.setPiece === "free_kick"
              ? `${player?.name || "Jogador"} cobra direto de ${Math.round(event.data.distance || 0)} unidades.`
              : (event.data.header
                ? `${player?.name || "Jogador"} cabeceia apos o cruzamento.`
                : `${player?.name || "Jogador"} chuta de ${Math.round(event.data.distance || 0)} unidades.`))
        },
        shot_saved: {
          title: "Defesa",
          detail: `${goalkeeper?.name || "O goleiro"} segura a finalizacao de ${player?.name || "um atacante"}${event.data.distance ? `, de ${Math.round(event.data.distance)} metros` : ""}.`
        },
        shot_parried: {
          title: "Defesa para escanteio",
          detail: "O goleiro espalma a finalizacao pela linha de fundo."
        },
        shot_blocked: {
          title: "Chute bloqueado",
          detail: "Um defensor bloqueia a finalizacao pela linha de fundo."
        },
        shot_out: {
          title: "Para fora",
          detail: `${player?.name || "Jogador"} finaliza${event.data.distance ? ` de ${Math.round(event.data.distance)} metros` : ""}, mas nao acerta o gol.`
        },
        goal: {
          title: "Gol",
          detail: `${player?.name || "Jogador"} marca para ${team?.shortName || "seu time"}. Placar: ${snapshot.teams[0].score} x ${snapshot.teams[1].score}.`
        },
        penalty_taken: {
          title: "Cobranca de penalti",
          detail: `${player?.name || "Jogador"} parte para a bola.`
        },
        free_kick_taken: {
          title: "Cobranca de falta",
          detail: event.data.direct
            ? `${player?.name || "Jogador"} tenta a finalizacao direta.`
            : `${player?.name || "Jogador"} prepara a bola parada.`
        },
        penalty_scored: {
          title: "Penalti convertido",
          detail: `${player?.name || "Jogador"} converte a cobranca.`
        },
        penalty_saved: {
          title: "Penalti defendido",
          detail: event.data.held === false
            ? `${goalkeeper?.name || "O goleiro"} espalma a cobranca de ${player?.name || "um atacante"} para escanteio.`
            : `${goalkeeper?.name || "O goleiro"} defende a cobranca de ${player?.name || "um atacante"} sem dar rebote.`
        },
        penalty_missed: {
          title: "Penalti perdido",
          detail: `${player?.name || "Jogador"} manda a cobranca para fora.`
        },
        loose_ball_recovered: {
          title: "Bola recuperada",
          detail: `${player?.name || "Jogador"} chega primeiro na sobra.`
        },
        restart: {
          title: "Reposicao",
          detail: `${team?.shortName || "O time"} recoloca a bola em jogo.`
        },
        kickoff: {
          title: "Saida de bola",
          detail: `${team?.shortName || "O time"} reinicia pelo centro.`
        },
        match_reset: {
          title: "Partida reiniciada",
          detail: "Placar, relogio e estado da bola voltaram ao inicio."
        }
      };
      const description = descriptions[event.type];
      return description ? { ...base, ...description } : null;
    }

    addLog(entry) {
      const normalized = {
        id: this.allLogEntries.length + 1,
        sessionMatch: this.matchSequence,
        time: entry.time || this.engine?.getSnapshot().match.clock || "00'",
        type: entry.type || "system",
        kind: entry.kind || "system",
        title: entry.title || "Evento",
        detail: entry.detail || "",
        data: entry.data || {}
      };
      this.allLogEntries.push(normalized);
      this.currentMatchEntries.push(normalized);

      if (this.isImportantEvent(normalized.kind)) {
        this.keyMomentEntries.push(normalized);
      }

      this.renderLogs();
    }

    isImportantEvent(kind) {
      return [
        "match_started",
        "second_half_started",
        "halftime",
        "fulltime",
        "goal",
        "shot_saved",
        "shot_out",
        "foul_committed",
        "throw_in_awarded",
        "corner_awarded",
        "penalty_awarded",
        "penalty_saved",
        "penalty_missed",
        "offside"
      ].includes(kind);
    }

    beginNewMatchLog() {
      this.matchSequence += 1;
      this.currentMatchEntries = [];
      this.keyMomentEntries = [];
    }

    render(timestamp = root.performance?.now?.() || Date.now(), snapshot = this.engine.getSnapshot()) {
      this.clock.textContent = snapshot.match.clock;
      this.score.textContent = `${snapshot.teams[0].score} x ${snapshot.teams[1].score}`;
      this.renderPlayers(snapshot);
      this.renderBall(snapshot.ball);
      if (!this.teamListsRendered) {
        this.renderTeamLists(snapshot);
        this.teamListsRendered = true;
      }

      const stateChanged = snapshot.match.state !== this.lastRenderedState;
      if (stateChanged || timestamp - this.lastPanelRenderAt >= 200) {
        this.renderStats(snapshot);
        this.renderStatus(snapshot);
        this.lastPanelRenderAt = timestamp;
      }
      if (stateChanged) {
        this.renderControls(snapshot.match.state);
        this.lastRenderedState = snapshot.match.state;
      }
    }

    renderPlayers(snapshot) {
      snapshot.teams.forEach((team) => {
        team.players.forEach((player) => {
          const token = this.playerElements.get(player.id);
          if (!token) return;
          token.style.setProperty("--x", player.x);
          token.style.setProperty("--y", player.y);
          token.style.setProperty("--stamina", this.formatStaminaPercent(this.getPlayerVisibleStamina(player)));
          token.style.setProperty("--stamina-color", this.getStaminaColor(this.getPlayerVisibleStamina(player)));
          token.dataset.movementMode = player.movementMode || "walk";
          token.classList.toggle("has-ball", snapshot.ball.controllerId === player.id);
          token.title = this.formatPlayerTooltip(team, player);
        });
      });
    }

    renderBall(ball) {
      this.ballElement.style.left = `${ball.x}%`;
      this.ballElement.style.top = `${ball.y}%`;
      this.ballElement.dataset.mode = ball.mode;
      this.ballElement.hidden = false;
    }

    renderTeamLists(snapshot) {
      snapshot.teams.forEach((team) => {
        const list = this.teamLists.get(team.id);
        if (!list) return;
        const items = team.players.map((player) => {
          const item = this.document.createElement("li");
          const number = this.document.createElement("span");
          const badge = this.document.createElement("b");
          const name = this.document.createElement("span");
          const role = this.document.createElement("span");
          badge.textContent = player.number;
          number.appendChild(badge);
          name.textContent = player.name;
          role.className = "player-role";
          role.textContent = `${player.role} | ${this.formatPlayerAttributes(player)}`;
          item.append(number, name, role);
          return item;
        });
        list.replaceChildren(...items);
      });
    }

    formatPlayerAttributes(player) {
      const attributes = player.attributes;
      return `OVR ${player.overall} | FIS ${attributes.physical} TEC ${attributes.technique} INT ${attributes.intelligence} DEF ${attributes.defense}`;
    }

    formatStaminaPercent(stamina) {
      const value = Number.isFinite(stamina) ? stamina : 100;
      return `${Math.round(Math.max(0, Math.min(100, value)))}%`;
    }

    getPlayerVisibleStamina(player) {
      if (Number.isFinite(player.visibleStamina)) return player.visibleStamina;
      const stamina = Number.isFinite(player.stamina) ? player.stamina : 100;
      const sprintStamina = Number.isFinite(player.sprintStamina) ? player.sprintStamina : 100;
      return Math.min(stamina, sprintStamina);
    }

    getStaminaColor(stamina) {
      const value = Number.isFinite(stamina) ? stamina : 100;
      if (value < 30) return "#e55353";
      if (value < 60) return "#f0ca4d";
      return "#45c46d";
    }

    formatMovementMode(mode) {
      return {
        walk: "andando",
        trot: "trotando",
        run: "correndo"
      }[mode] || "andando";
    }

    formatPlayerTooltip(team, player) {
      const attributes = player.attributes;
      const stats = player.matchStats;
      return [
        `${team.name} ${player.number} - ${player.name} (${player.role}) OVR ${player.overall}`,
        `FIS ${attributes.physical} | TEC ${attributes.technique} | INT ${attributes.intelligence} | DEF ${attributes.defense}`,
        `Stamina ${this.formatStaminaPercent(this.getPlayerVisibleStamina(player))} | Ritmo ${this.formatMovementMode(player.movementMode)}`,
        `Partida: ${stats.passesCompleted}/${stats.passesAttempted} passes | ${stats.oneTouchPasses} de primeira | ${stats.shots} chutes | ${stats.goals} gols | ${stats.interceptions} interceptacoes | ${stats.tacklesWon}/${stats.tacklesAttempted} desarmes | ${stats.foulsCommitted} faltas`
      ].join("\n");
    }

    renderStats(snapshot) {
      const totalPossession = snapshot.teams.reduce((sum, team) => sum + team.stats.possessionMatchMs, 0);
      const header = this.document.createElement("div");
      header.className = "match-stats-head";
      ["Dados", ...snapshot.teams.map((team) => team.shortName)].forEach((label, index) => {
        const cell = this.document.createElement("span");
        if (index > 0) {
          cell.style.setProperty("--team-color", snapshot.teams[index - 1].colors.main);
          cell.className = "match-stats-team";
        }
        cell.textContent = label;
        header.appendChild(cell);
      });

      const possession = snapshot.teams.map((team) =>
        `${totalPossession ? Math.round(team.stats.possessionMatchMs / totalPossession * 100) : 50}%`
      );
      const metrics = [
        {
          label: "Posse",
          values: possession
        },
        {
          label: "Passes",
          values: snapshot.teams.map((team) => {
            const attempted = team.stats.passesAttempted;
            const rate = attempted ? Math.round(team.stats.passesCompleted / attempted * 100) : 0;
            return `${team.stats.passesCompleted}/${attempted} · ${rate}%`;
          })
        },
        {
          label: "Finalizacoes",
          values: snapshot.teams.map((team) => `${team.stats.shots} · ${team.score} gols`)
        },
        {
          label: "Faltas",
          values: snapshot.teams.map((team) => String(team.stats.fouls))
        },
        {
          label: "Laterais",
          values: snapshot.teams.map((team) => String(team.stats.throwIns))
        },
        {
          label: "Escanteios",
          values: snapshot.teams.map((team) => String(team.stats.corners))
        }
      ];

      const rows = metrics.map((metric) => {
        const row = this.document.createElement("div");
        row.className = "match-stats-row";
        [metric.label, ...metric.values].forEach((value, index) => {
          const cell = this.document.createElement("span");
          cell.className = index === 0 ? "match-stats-label" : "match-stats-value";
          cell.textContent = value;
          row.appendChild(cell);
        });
        return row;
      });

      this.matchStats.replaceChildren(header, ...rows);
    }

    renderStatus(snapshot) {
      const controller = snapshot.teams
        .flatMap((team) => team.players.map((player) => ({ team, player })))
        .find((item) => item.player.id === snapshot.ball.controllerId);

      if (snapshot.ball.mode === "travelling") {
        this.statusText.textContent = snapshot.ball.action === "shot"
          ? "Bola em trajetoria de finalizacao"
          : "Bola viajando entre jogadores";
        this.statusDot.style.background = "#ffffff";
        this.statusDot.style.boxShadow = "0 0 0 4px rgba(255,255,255,0.18)";
        return;
      }

      if (snapshot.ball.mode === "loose") {
        this.statusText.textContent = "Bola solta: disputa pela sobra";
        return;
      }

      if (snapshot.ball.mode === "out") {
        const restartLabels = {
          throw_in: "Lateral",
          corner: "Escanteio",
          goal_kick: "Tiro de meta",
          free_kick: "Tiro livre",
          penalty: "Penalti",
          offside: "Impedimento"
        };
        this.statusText.textContent = restartLabels[snapshot.ball.restartReason]
          ? `${restartLabels[snapshot.ball.restartReason]} aguardando cobranca`
          : "Bola fora de jogo";
        return;
      }

      if (controller) {
        this.statusText.textContent = `Posse: ${controller.team.name} ${controller.player.number} - marcado ${Math.round(controller.player.pressure * 100)}%`;
        this.statusDot.style.background = controller.team.colors.main;
        this.statusDot.style.boxShadow = `0 0 0 4px ${controller.team.colors.glow}`;
      }
    }

    renderControls(state) {
      const controlsByState = {
        pre: [{ label: "Iniciar", command: "start", primary: true }],
        playing: [{ label: "Pausar", command: "pause", primary: false }],
        paused: [{ label: "Continuar", command: "start", primary: true }],
        goalPause: [],
        halftime: [{ label: "Iniciar 2o tempo", command: "start", primary: true }],
        finished: [{ label: "Reiniciar", command: "reset", primary: true }]
      };
      const buttons = (controlsByState[state] || []).map((control) => {
        const button = this.document.createElement("button");
        button.className = `btn${control.primary ? " primary" : ""}`;
        button.type = "button";
        button.textContent = control.label;
        button.addEventListener("click", () => {
          this.engine.command({ type: control.command });
          this.consumeEvents();
          this.render();
        });
        return button;
      });
      this.controls.replaceChildren(...buttons);
    }

    renderLogs() {
      this.logCount.textContent = `${this.keyMomentEntries.length} importantes`;
      this.eventLog.replaceChildren(...this.allLogEntries.map((entry) => {
        const item = this.document.createElement("li");
        item.className = entry.kind;
        item.textContent = `${entry.time} ${entry.title} - ${entry.detail}`;
        return item;
      }));

      if (!this.keyMomentEntries.length) {
        const empty = this.document.createElement("div");
        const time = this.document.createElement("time");
        const copy = this.document.createElement("div");
        const title = this.document.createElement("strong");
        const detail = this.document.createElement("span");
        empty.className = "key-moment system";
        time.textContent = "--";
        title.textContent = "Eventos importantes";
        detail.textContent = "Gols, finalizacoes, faltas e bolas paradas aparecerao aqui.";
        copy.append(title, detail);
        empty.append(time, copy);
        this.keyMoments.replaceChildren(empty);
        return;
      }

      this.keyMoments.replaceChildren(...this.keyMomentEntries.slice(-20).reverse().map((entry) => {
        const item = this.document.createElement("div");
        const time = this.document.createElement("time");
        const copy = this.document.createElement("div");
        const title = this.document.createElement("strong");
        const detail = this.document.createElement("span");
        const team = TEAMS_CONFIG.find((candidate) => candidate.id === entry.type);
        item.className = `key-moment ${entry.kind}`;
        item.style.borderLeftColor = entry.kind === "goal" ? "var(--yellow)" : (team?.colors.main || "rgba(255,255,255,0.24)");
        time.textContent = entry.time;
        title.textContent = entry.title;
        detail.textContent = entry.detail;
        copy.append(title, detail);
        item.append(time, copy);
        return item;
      }));
    }

    createTestRestart(reason) {
      this.engine.command({ type: "testRestart", reason });
      const snapshot = this.engine.getSnapshot();
      this.consumeEvents(snapshot);
      this.render(root.performance?.now?.() || Date.now(), this.engine.getSnapshot());
    }

    openSetPieceModal(event, snapshot = this.engine.getSnapshot()) {
      const reason = event.type === "penalty_awarded" ? "penalty" : "free_kick";
      const team = snapshot.teams.find((candidate) => candidate.id === event.data.teamId);
      if (!team || this.engine.getSnapshot().ball.mode !== "out") return;

      if (this.engine.getSnapshot().match.state === "playing") {
        this.engine.command({ type: "pause" });
      }

      this.setPieceTeam.textContent = team.shortName || team.name;
      this.setPieceTitle.textContent = reason === "penalty" ? "Cobrador de penalti" : "Cobrador da falta";
      this.setPieceDetail.textContent = reason === "penalty"
        ? "Jogadores ordenados por tecnica para a cobranca."
        : "Falta perigosa: escolha quem finaliza direto para o gol.";

      const options = this.getSetPieceCandidates(team, reason).map((player) => {
        const button = this.document.createElement("button");
        const number = this.document.createElement("span");
        const name = this.document.createElement("span");
        const title = this.document.createElement("strong");
        const detail = this.document.createElement("span");
        const score = this.document.createElement("span");
        const setPieceScore = this.getSetPieceScore(player, reason);

        button.className = "set-piece-option";
        button.type = "button";
        number.className = "set-piece-number";
        name.className = "set-piece-name";
        score.className = "set-piece-score";
        number.textContent = player.number;
        title.textContent = player.name;
        detail.textContent = `${player.role} | TEC ${player.attributes.technique} INT ${player.attributes.intelligence}`;
        score.textContent = String(Math.round(setPieceScore));
        name.append(title, detail);
        button.append(number, name, score);
        button.addEventListener("click", () => this.selectSetPieceTaker(player.id));
        return button;
      });

      this.setPieceList.replaceChildren(...options);
      this.setPieceModal.hidden = false;
      this.positionSetPieceModal();
      options[0]?.focus();
    }

    getSetPieceCandidates(team, reason) {
      return [...team.players]
        .filter((player) => player.role !== "GOL")
        .sort((a, b) =>
          this.getSetPieceScore(b, reason) - this.getSetPieceScore(a, reason) ||
          b.attributes.technique - a.attributes.technique ||
          a.number - b.number
        );
    }

    getSetPieceScore(player, reason) {
      const techniqueWeight = reason === "penalty" ? 0.7 : 0.76;
      const intelligenceWeight = reason === "penalty" ? 0.3 : 0.24;
      return player.attributes.technique * techniqueWeight + player.attributes.intelligence * intelligenceWeight;
    }

    selectSetPieceTaker(playerId) {
      const snapshot = this.engine.getSnapshot();
      if (snapshot.ball.restartReason === "penalty") {
        this.setPieceModal.hidden = true;
        this.openPenaltyDrama(playerId, snapshot);
        return;
      }
      this.setPieceModal.hidden = true;
      this.engine.command({ type: "takeRestart", playerId });
      this.consumeEvents();
      this.render(root.performance?.now?.() || Date.now(), this.engine.getSnapshot());
    }

    openPenaltyDrama(playerId, snapshot = this.engine.getSnapshot()) {
      const team = snapshot.teams.find((candidate) => candidate.id === snapshot.ball.restartTeamId);
      const selected = team?.players.find((player) => player.id === playerId) ||
        (team ? this.getSetPieceCandidates(team, "penalty")[0] : null);
      this.restartNoticeTeam.textContent = team?.shortName || "Penalti";
      this.restartNoticeTitle.textContent = "Penalti";
      this.restartNoticeDetail.textContent = `${selected?.name || "O cobrador"} respira, toma distancia e parte para a bola.`;
      this.restartNoticeModal.hidden = false;
      this.restartNoticeModal.dataset.noticeKind = "penalty";
      this.restartNoticeModal.style.setProperty("--notice-duration-ms", "2200ms");
      this.setForcedFieldAnimationRate(1);
      this.restartNoticeBlocking = true;
      this.restartNoticeReason = "penalty";
      this.positionRestartNotice();

      if (this.restartNoticeTimer) root.clearTimeout(this.restartNoticeTimer);
      this.restartNoticeTimer = root.setTimeout(() => {
        this.restartNoticeModal.hidden = true;
        this.restartNoticeBlocking = false;
        this.restartNoticeReason = null;
        this.restartNoticeTimer = null;
        this.setForcedFieldAnimationRate(null);
        const liveSnapshot = this.engine.getSnapshot();
        if (liveSnapshot.ball.mode === "out" && liveSnapshot.ball.restartReason === "penalty") {
          this.engine.command({ type: "takeRestart", playerId });
          const takenSnapshot = this.engine.getSnapshot();
          this.consumeEvents(takenSnapshot);
          this.render(root.performance?.now?.() || Date.now(), takenSnapshot);
        }
      }, 2200);
      this.render(root.performance?.now?.() || Date.now(), snapshot);
    }

    openRestartNotice(event, snapshot = this.engine.getSnapshot()) {
      const team = snapshot.teams.find((candidate) => candidate.id === event.data.teamId);
      const copy = event.type === "corner_awarded"
        ? {
            title: "Escanteio",
            detail: `${team?.shortName || "O time"} organiza a bola parada.`
          }
        : {
            title: "Impedimento",
            detail: "A defesa sobe e prepara a reposicao."
          };

      this.restartNoticeTeam.textContent = team?.shortName || "Bola parada";
      this.restartNoticeTitle.textContent = copy.title;
      this.restartNoticeDetail.textContent = copy.detail;
      this.restartNoticeModal.hidden = false;
      this.restartNoticeModal.dataset.noticeKind = "restart";
      this.restartNoticeModal.style.setProperty("--notice-duration-ms", "1000ms");
      this.restartNoticeBlocking = true;
      this.restartNoticeReason = event.type === "corner_awarded" ? "corner" : "offside";
      this.positionRestartNotice();

      if (this.restartNoticeTimer) root.clearTimeout(this.restartNoticeTimer);
      this.restartNoticeTimer = root.setTimeout(() => {
        const reason = this.restartNoticeReason;
        this.restartNoticeModal.hidden = true;
        this.restartNoticeBlocking = false;
        this.restartNoticeReason = null;
        this.restartNoticeTimer = null;
        const liveSnapshot = this.engine.getSnapshot();
        if (liveSnapshot.ball.mode === "out" && liveSnapshot.ball.restartReason === reason) {
          this.engine.command({ type: "takeRestart" });
          const restartedSnapshot = this.engine.getSnapshot();
          this.consumeEvents(restartedSnapshot);
          this.render(root.performance?.now?.() || Date.now(), restartedSnapshot);
        }
      }, 1000);
    }

    openGoalModal(event, snapshot = this.engine.getSnapshot()) {
      const team = snapshot.teams.find((candidate) => candidate.id === event.data.teamId);
      const scorer = team?.players.find((player) => player.id === event.data.playerId);
      this.goalTeam.textContent = team?.shortName || "Gol";
      this.goalTitle.textContent = "Gol";
      this.goalDetail.textContent = `${scorer?.name || "Jogador"} marcou aos ${snapshot.match.clock}. ${snapshot.teams[0].score} x ${snapshot.teams[1].score}.`;
      this.goalModal.hidden = false;
      this.positionGoalModal();
      this.goalOkButton.focus();
    }

    positionGoalModal() {
      if (!this.field || this.goalModal.hidden) return;
      const rect = this.field.getBoundingClientRect();
      this.goalModal.style.setProperty("--goal-modal-left", `${rect.left + rect.width / 2}px`);
      this.goalModal.style.setProperty("--goal-modal-top", `${rect.top + rect.height / 2}px`);
      this.goalModal.style.setProperty("--goal-modal-width", `${rect.width}px`);
      this.goalModal.style.setProperty("--goal-modal-height", `${rect.height}px`);
    }

    positionSetPieceModal() {
      if (!this.field || this.setPieceModal.hidden) return;
      const rect = this.field.getBoundingClientRect();
      this.setPieceModal.style.setProperty("--goal-modal-left", `${rect.left + rect.width / 2}px`);
      this.setPieceModal.style.setProperty("--goal-modal-top", `${rect.top + rect.height / 2}px`);
      this.setPieceModal.style.setProperty("--goal-modal-width", `${rect.width}px`);
      this.setPieceModal.style.setProperty("--goal-modal-height", `${rect.height}px`);
    }

    positionRestartNotice() {
      if (!this.field || this.restartNoticeModal.hidden) return;
      const rect = this.field.getBoundingClientRect();
      this.restartNoticeModal.style.setProperty("--goal-modal-left", `${rect.left + rect.width / 2}px`);
      this.restartNoticeModal.style.setProperty("--goal-modal-top", `${rect.top + rect.height / 2}px`);
      this.restartNoticeModal.style.setProperty("--goal-modal-width", `${rect.width}px`);
      this.restartNoticeModal.style.setProperty("--goal-modal-height", `${rect.height}px`);
    }

    formatEventClock(matchMs) {
      const minute = Math.floor(matchMs / 60_000);
      if (minute <= 45) return `${String(minute).padStart(2, "0")}'`;
      if (minute <= 90) return `${String(minute).padStart(2, "0")}'`;
      return `90+${minute - 90}'`;
    }

    getLogText(mode) {
      if (mode === "jsonl") {
        return this.allLogEntries.map((entry) => JSON.stringify(entry)).join("\n");
      }
      if (mode === "csv") {
        const cell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
        return [
          ["id", "sessionMatch", "time", "kind", "team", "title", "detail"].join(","),
          ...this.allLogEntries.map((entry) =>
            [entry.id, entry.sessionMatch, entry.time, entry.kind, entry.type, entry.title, entry.detail].map(cell).join(",")
          )
        ].join("\n");
      }
      return this.allLogEntries
        .map((entry) => `[Jogo ${entry.sessionMatch}] ${entry.time} ${entry.title} - ${entry.detail}`)
        .join("\n");
    }

    async copyLogs(mode) {
      const text = this.getLogText(mode);
      try {
        await root.navigator.clipboard.writeText(text);
      } catch {
        const textarea = this.document.createElement("textarea");
        textarea.value = text;
        this.document.body.appendChild(textarea);
        textarea.select();
        this.document.execCommand("copy");
        textarea.remove();
      }
      this.showCopyFeedback(`${mode.toUpperCase()} copiado`);
    }

    downloadLogs() {
      const payload = {
        seed: this.seed,
        snapshot: this.engine.getSnapshot(),
        events: this.allLogEntries
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = this.document.createElement("a");
      link.href = url;
      link.download = `ballsfoot-${this.seed}.json`;
      link.click();
      URL.revokeObjectURL(url);
      this.showCopyFeedback("JSON baixado");
    }

    showCopyFeedback(message) {
      root.clearTimeout(this.copyFeedbackTimer);
      this.copyFeedback.textContent = message;
      this.copyFeedbackTimer = root.setTimeout(() => {
        this.copyFeedback.textContent = "";
      }, 1800);
    }

    destroy() {
      if (this.animationFrameId) root.cancelAnimationFrame(this.animationFrameId);
    }
  }

  root.BallsfootApp = {
    BrowserGameAdapter,
    TEAMS_CONFIG
  };

  root.document.addEventListener("DOMContentLoaded", () => {
    root.tacticsGame = new BrowserGameAdapter();
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
