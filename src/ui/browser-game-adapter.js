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
      this.speedOptions = [0.5, 1, 1.5, 2, 3, 4, 5];
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
      this.copyFeedback = byId("copy-feedback");
      this.goalModal = byId("goal-modal");
      this.goalTeam = byId("goal-team");
      this.goalTitle = byId("goal-title");
      this.goalDetail = byId("goal-detail");
      this.goalOkButton = byId("goal-ok");
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
          token.className = "player-token";
          token.textContent = player.number;
          token.style.setProperty("--team-color", team.colors.main);
          token.style.setProperty("--team-deep", team.colors.deep);
          token.style.setProperty("--team-highlight", team.colors.highlight);
          token.title = this.formatPlayerTooltip(team, player);
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
      this.goalOkButton.addEventListener("click", () => {
        this.goalModal.hidden = true;
        this.engine.command({ type: "confirmGoal" });
        this.render();
      });
      root.addEventListener("resize", () => this.positionGoalModal());
    }

    frame(timestamp) {
      if (this.lastFrameAt === null) this.lastFrameAt = timestamp;
      const deltaMs = Math.min(250, Math.max(0, timestamp - this.lastFrameAt));
      this.lastFrameAt = timestamp;
      let snapshot = this.engine.getSnapshot();

      if (snapshot.match.state === "playing") {
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
      const animationRate = Math.max(this.speed, 0.5);
      this.document.documentElement.style.setProperty("--ball-move-ms", `${Math.round(140 / animationRate)}ms`);
      this.document.documentElement.style.setProperty("--player-move-ms", `${Math.round(90 / animationRate)}ms`);
    }

    consumeEvents(snapshot = this.engine.getSnapshot()) {
      this.engine.drainEvents().forEach((event) => {
        if (event.type === "match_reset") this.beginNewMatchLog();
        const entry = this.describeEvent(event, snapshot);
        if (entry) this.addLog(entry);
        if (event.type === "goal") this.openGoalModal(event, snapshot);
      });
    }

    describeEvent(event, snapshot = this.engine.getSnapshot()) {
      const team = snapshot.teams.find((candidate) => candidate.id === event.data.teamId);
      const player = team?.players.find((candidate) => candidate.id === event.data.playerId);
      const receiver = snapshot.teams
        .flatMap((candidate) => candidate.players)
        .find((candidate) => candidate.id === event.data.receiverId);
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
        pass_intercepted: {
          title: "Interceptacao",
          detail: `${player?.name || "Defensor"} corta a trajetoria e assume a posse.`
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
          title: "Finalizacao",
          detail: `${player?.name || "Jogador"} chuta de ${Math.round(event.data.distance || 0)} unidades.`
        },
        shot_saved: {
          title: "Defesa",
          detail: "O goleiro controla a finalizacao."
        },
        shot_out: {
          title: "Para fora",
          detail: "A finalizacao sai sem acertar o gol."
        },
        goal: {
          title: "Gol",
          detail: `${player?.name || "Jogador"} manda a bola para a rede.`
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

      if (["goal", "shot_started", "shot_saved", "pass_intercepted", "halftime", "fulltime"].includes(normalized.kind)) {
        this.keyMomentEntries.push(normalized);
      }

      this.renderLogs();
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

    formatPlayerTooltip(team, player) {
      const attributes = player.attributes;
      const stats = player.matchStats;
      return [
        `${team.name} ${player.number} - ${player.name} (${player.role}) OVR ${player.overall}`,
        `FIS ${attributes.physical} | TEC ${attributes.technique} | INT ${attributes.intelligence} | DEF ${attributes.defense}`,
        `Partida: ${stats.passesCompleted}/${stats.passesAttempted} passes | ${stats.oneTouchPasses} de primeira | ${stats.shots} chutes | ${stats.goals} gols | ${stats.interceptions} interceptacoes`
      ].join("\n");
    }

    renderStats(snapshot) {
      const totalPossession = snapshot.teams.reduce((sum, team) => sum + team.stats.possessionMatchMs, 0);
      const header = this.document.createElement("div");
      header.className = "match-stats-head";
      ["Time", "Posse", "Chutes", "Passes", "Erros"].forEach((label) => {
        const cell = this.document.createElement("span");
        cell.textContent = label;
        header.appendChild(cell);
      });

      const rows = snapshot.teams.map((team) => {
        const row = this.document.createElement("div");
        row.className = "match-stats-row";
        row.style.setProperty("--team-color", team.colors.main);
        const values = [
          team.shortName,
          `${totalPossession ? Math.round(team.stats.possessionMatchMs / totalPossession * 100) : 50}%`,
          team.stats.shots,
          team.stats.passesCompleted,
          team.stats.passesMissed
        ];
        values.forEach((value, index) => {
          const cell = this.document.createElement("span");
          cell.className = index === 0 ? "match-stats-team" : "match-stats-value";
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
      this.logCount.textContent = `${this.currentMatchEntries.length} lances | ${this.allLogEntries.length} acumulados`;
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
        title.textContent = "Timeline";
        detail.textContent = "Lances importantes vao aparecer aqui.";
        copy.append(title, detail);
        empty.append(time, copy);
        this.keyMoments.replaceChildren(empty);
        return;
      }

      this.keyMoments.replaceChildren(...this.keyMomentEntries.slice(-24).map((entry) => {
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
