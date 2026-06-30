const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class FakeStyle {
  constructor() {
    this.values = new Map();
  }

  setProperty(name, value) {
    this.values.set(name, String(value));
  }
}

class FakeClassList {
  toggle() {}
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.style = new FakeStyle();
    this.classList = new FakeClassList();
    this.dataset = {};
    this.hidden = false;
    this.textContent = "";
    this.value = "";
    this.className = "";
    this.listeners = new Map();
  }

  append(...children) {
    this.children.push(...children);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    this.children = [...children];
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  setAttribute() {}
  focus() {}
  select() {}
  click() {}
  remove() {}

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 640, height: 920 };
  }
}

class FakeDocument {
  constructor() {
    this.listeners = new Map();
    this.documentElement = new FakeElement("html");
    this.body = new FakeElement("body");
    this.elements = new Map();

    [
      "home-team-slot", "away-team-slot", "field", "ball", "clock", "score",
      "score-home-label", "score-away-label", "status-text", "status-dot", "controls",
      "speed-slider", "speed-value", "event-log", "key-moments", "match-stats",
      "log-count", "copy-logs", "copy-jsonl", "copy-csv", "download-json",
      "test-throw-in", "test-corner", "test-penalty", "test-free-kick",
      "copy-feedback", "goal-modal", "goal-team", "goal-title", "goal-detail", "goal-ok",
      "set-piece-modal", "set-piece-team", "set-piece-title", "set-piece-detail",
      "set-piece-list", "set-piece-auto", "restart-notice-modal", "restart-notice-team",
      "restart-notice-title", "restart-notice-detail"
    ].forEach((id) => this.elements.set(id, new FakeElement()));

    this.elements.get("goal-modal").hidden = true;
    this.elements.get("set-piece-modal").hidden = true;
    this.elements.get("restart-notice-modal").hidden = true;
    this.elements.get("speed-slider").value = "1";
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  execCommand() {
    return true;
  }
}

test("the browser adapter initializes the engine and mounts every player", () => {
  const document = new FakeDocument();
  const context = vm.createContext({
    console,
    document,
    navigator: {
      clipboard: {
        writeText: async () => {}
      }
    },
    performance: {
      now: () => 0
    },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    addEventListener: () => {},
    clearTimeout,
    setTimeout,
    Blob,
    URL: {
      createObjectURL: () => "blob:test",
      revokeObjectURL: () => {}
    }
  });
  context.globalThis = context;

  const root = path.resolve(__dirname, "..");
  vm.runInContext(fs.readFileSync(path.join(root, "src", "config", "teams.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "src", "domain", "match-engine.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "src", "ui", "browser-game-adapter.js"), "utf8"), context);
  document.listeners.get("DOMContentLoaded")();

  assert.ok(context.tacticsGame);
  assert.equal(context.tacticsGame.engine.getSnapshot().teams.length, 2);
  assert.equal(context.tacticsGame.engine.matchClockRate, 15);
  assert.equal(context.tacticsGame.playerElements.size, 22);
  const firstToken = [...context.tacticsGame.playerElements.values()][0];
  assert.equal(firstToken.children[0].className, "player-token__number");
  assert.equal(firstToken.children[1].className, "player-token__stamina");
  assert.equal(firstToken.style.values.get("--stamina"), "100%");
  assert.equal(firstToken.style.values.get("--stamina-color"), "#45c46d");
  assert.equal(document.getElementById("clock").textContent, "00'");
  assert.equal(document.getElementById("score").textContent, "0 x 0");
  assert.equal(context.tacticsGame.speedOptions.at(-1), 10);
  context.tacticsGame.setSpeed(10);
  assert.equal(context.tacticsGame.speed, 10);
  assert.equal(document.getElementById("speed-slider").value, "8");
  assert.equal(document.getElementById("speed-value").textContent, "10.0x");
  assert.equal(document.documentElement.style.values.get("--ball-move-ms"), "14ms");
  assert.equal(document.documentElement.style.values.get("--player-move-ms"), "9ms");

  const staminaSnapshot = context.tacticsGame.engine.getSnapshot();
  const firstPlayer = staminaSnapshot.teams[0].players[0];
  firstPlayer.stamina = 42;
  firstPlayer.sprintStamina = 80;
  firstPlayer.visibleStamina = 42;
  firstPlayer.movementMode = "run";
  context.tacticsGame.renderPlayers(staminaSnapshot);
  const updatedToken = context.tacticsGame.playerElements.get(firstPlayer.id);
  assert.equal(updatedToken.style.values.get("--stamina"), "42%");
  assert.equal(updatedToken.style.values.get("--stamina-color"), "#f0ca4d");
  assert.equal(updatedToken.dataset.movementMode, "run");
  assert.match(updatedToken.title, /Stamina 42%/);

  firstPlayer.stamina = 80;
  firstPlayer.sprintStamina = 24;
  delete firstPlayer.visibleStamina;
  context.tacticsGame.renderPlayers(staminaSnapshot);
  assert.equal(updatedToken.style.values.get("--stamina"), "24%");

  const restartSnapshot = context.tacticsGame.engine.getSnapshot();
  restartSnapshot.ball.mode = "out";
  restartSnapshot.ball.restartReason = "corner";
  context.tacticsGame.renderStatus(restartSnapshot);
  assert.match(document.getElementById("status-text").textContent, /Escanteio/);

  const cornerEntry = context.tacticsGame.describeEvent({
    type: "corner_awarded",
    matchMs: 0,
    data: { teamId: restartSnapshot.teams[0].id }
  }, restartSnapshot);
  assert.equal(cornerEntry.title, "Escanteio");
});

test("test penalty opens a sorted set-piece taker picker and pauses the match", () => {
  const document = new FakeDocument();
  let timeoutCallback = null;
  let timeoutDelay = null;
  const context = vm.createContext({
    console,
    document,
    navigator: { clipboard: { writeText: async () => {} } },
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    addEventListener: () => {},
    clearTimeout,
    setTimeout: (callback, delay) => {
      timeoutCallback = callback;
      timeoutDelay = delay;
      return 1;
    },
    Blob,
    URL: {
      createObjectURL: () => "blob:test",
      revokeObjectURL: () => {}
    }
  });
  context.globalThis = context;

  const root = path.resolve(__dirname, "..");
  vm.runInContext(fs.readFileSync(path.join(root, "src", "config", "teams.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "src", "domain", "match-engine.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "src", "ui", "browser-game-adapter.js"), "utf8"), context);
  document.listeners.get("DOMContentLoaded")();

  const game = context.tacticsGame;
  const sorted = game.getSetPieceCandidates({
    players: [
      { name: "Baixa tecnica", number: 8, role: "MC", attributes: { technique: 50, intelligence: 80 } },
      { name: "Alta tecnica", number: 10, role: "MC", attributes: { technique: 92, intelligence: 70 } },
      { name: "Goleiro", number: 1, role: "GOL", attributes: { technique: 99, intelligence: 99 } }
    ]
  }, "free_kick");
  assert.equal(sorted[0].name, "Alta tecnica");

  document.getElementById("test-penalty").listeners.get("click")();

  assert.equal(document.getElementById("set-piece-modal").hidden, false);
  assert.equal(game.engine.getSnapshot().match.state, "paused");
  assert.equal(game.engine.getSnapshot().ball.restartReason, "penalty");
  assert.equal(document.getElementById("set-piece-title").textContent, "Cobrador de penalti");
  assert.ok(document.getElementById("set-piece-list").children.length > 0);

  document.getElementById("set-piece-list").children[0].listeners.get("click")();
  assert.equal(document.getElementById("set-piece-modal").hidden, true);
  assert.equal(document.getElementById("restart-notice-modal").hidden, false);
  assert.equal(document.getElementById("restart-notice-title").textContent, "Penalti");
  assert.match(document.getElementById("restart-notice-detail").textContent, /respira/);
  assert.equal(document.getElementById("restart-notice-modal").style.values.get("--notice-duration-ms"), "1200ms");
  assert.equal(timeoutDelay, 1200);
  assert.equal(game.engine.getSnapshot().match.state, "paused");
  assert.equal(game.engine.getSnapshot().ball.restartReason, "penalty");

  timeoutCallback();
  assert.equal(document.getElementById("restart-notice-modal").hidden, true);
  assert.notEqual(game.engine.getSnapshot().match.state, "paused");
});

test("test free kick opens a dangerous free-kick taker picker", () => {
  const document = new FakeDocument();
  const context = vm.createContext({
    console,
    document,
    navigator: { clipboard: { writeText: async () => {} } },
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    addEventListener: () => {},
    clearTimeout,
    setTimeout,
    Blob,
    URL: {
      createObjectURL: () => "blob:test",
      revokeObjectURL: () => {}
    }
  });
  context.globalThis = context;

  const root = path.resolve(__dirname, "..");
  vm.runInContext(fs.readFileSync(path.join(root, "src", "config", "teams.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "src", "domain", "match-engine.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "src", "ui", "browser-game-adapter.js"), "utf8"), context);
  document.listeners.get("DOMContentLoaded")();

  document.getElementById("test-free-kick").listeners.get("click")();

  assert.equal(document.getElementById("set-piece-modal").hidden, false);
  assert.equal(context.tacticsGame.engine.getSnapshot().ball.restartReason, "free_kick");
  assert.equal(context.tacticsGame.engine.getSnapshot().ball.restartDangerous, true);
  assert.equal(document.getElementById("set-piece-title").textContent, "Cobrador da falta");
  assert.match(document.getElementById("set-piece-detail").textContent, /finaliza direto/);
});

test("test buttons can stage non-selected restarts", () => {
  const document = new FakeDocument();
  const context = vm.createContext({
    console,
    document,
    navigator: { clipboard: { writeText: async () => {} } },
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    addEventListener: () => {},
    clearTimeout,
    setTimeout,
    Blob,
    URL: {
      createObjectURL: () => "blob:test",
      revokeObjectURL: () => {}
    }
  });
  context.globalThis = context;

  const root = path.resolve(__dirname, "..");
  vm.runInContext(fs.readFileSync(path.join(root, "src", "config", "teams.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "src", "domain", "match-engine.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "src", "ui", "browser-game-adapter.js"), "utf8"), context);
  document.listeners.get("DOMContentLoaded")();

  document.getElementById("test-throw-in").listeners.get("click")();
  assert.equal(context.tacticsGame.engine.getSnapshot().ball.restartReason, "throw_in");
  assert.equal(document.getElementById("set-piece-modal").hidden, true);
  assert.equal(document.getElementById("key-moments").children[0].children[1].children[0].textContent, "Lateral");
  assert.match(document.getElementById("key-moments").children[0].children[1].children[1].textContent, /1 no jogo/);

  document.getElementById("test-corner").listeners.get("click")();
  assert.equal(context.tacticsGame.engine.getSnapshot().ball.restartReason, "corner");
  assert.equal(document.getElementById("set-piece-modal").hidden, true);
});

test("corner and offside show a one-second restart notice over the field", () => {
  const document = new FakeDocument();
  let timeoutCallback = null;
  let timeoutDelay = null;
  const context = vm.createContext({
    console,
    document,
    navigator: { clipboard: { writeText: async () => {} } },
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    addEventListener: () => {},
    clearTimeout: () => {},
    setTimeout: (callback, delay) => {
      timeoutCallback = callback;
      timeoutDelay = delay;
      return 1;
    },
    Blob,
    URL: {
      createObjectURL: () => "blob:test",
      revokeObjectURL: () => {}
    }
  });
  context.globalThis = context;

  const root = path.resolve(__dirname, "..");
  vm.runInContext(fs.readFileSync(path.join(root, "src", "config", "teams.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "src", "domain", "match-engine.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "src", "ui", "browser-game-adapter.js"), "utf8"), context);
  document.listeners.get("DOMContentLoaded")();

  document.getElementById("test-corner").listeners.get("click")();

  assert.equal(document.getElementById("restart-notice-modal").hidden, false);
  assert.equal(document.getElementById("restart-notice-title").textContent, "Escanteio");
  assert.equal(timeoutDelay, 1000);
  assert.equal(document.getElementById("restart-notice-modal").style.values.get("--goal-modal-width"), "640px");
  context.tacticsGame.frame(0);
  context.tacticsGame.frame(250);
  context.tacticsGame.frame(500);
  context.tacticsGame.frame(750);
  assert.equal(context.tacticsGame.engine.getSnapshot().ball.mode, "out");
  assert.equal(context.tacticsGame.engine.getSnapshot().ball.restartReason, "corner");
  timeoutCallback();
  assert.equal(document.getElementById("restart-notice-modal").hidden, true);
  assert.equal(context.tacticsGame.engine.getSnapshot().ball.action, "corner_cross");

  context.tacticsGame.openRestartNotice({
    type: "offside",
    matchMs: 0,
    data: { teamId: context.tacticsGame.engine.getSnapshot().teams[1].id }
  }, context.tacticsGame.engine.getSnapshot());

  assert.equal(document.getElementById("restart-notice-modal").hidden, false);
  assert.equal(document.getElementById("restart-notice-title").textContent, "Impedimento");
  assert.equal(timeoutDelay, 1000);
});

test("hidden export logs accumulate while the visible match log resets", () => {
  const document = new FakeDocument();
  const context = vm.createContext({
    console,
    document,
    navigator: { clipboard: { writeText: async () => {} } },
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    addEventListener: () => {},
    clearTimeout,
    setTimeout,
    Blob,
    URL: {
      createObjectURL: () => "blob:test",
      revokeObjectURL: () => {}
    }
  });
  context.globalThis = context;

  const root = path.resolve(__dirname, "..");
  vm.runInContext(fs.readFileSync(path.join(root, "src", "config", "teams.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "src", "domain", "match-engine.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "src", "ui", "browser-game-adapter.js"), "utf8"), context);
  document.listeners.get("DOMContentLoaded")();

  const game = context.tacticsGame;
  const initialCount = game.allLogEntries.length;
  game.addLog({ kind: "goal", title: "Gol da primeira", detail: "Primeira partida" });
  game.beginNewMatchLog();
  game.addLog({ kind: "pass_completed", title: "Passe da segunda", detail: "Segunda partida" });

  assert.equal(game.allLogEntries.length, initialCount + 2);
  assert.equal(game.currentMatchEntries.length, 1);
  assert.equal(game.currentMatchEntries[0].sessionMatch, 2);
  assert.match(game.getLogText("text"), /Gol da primeira/);
  assert.match(game.getLogText("text"), /Passe da segunda/);
});

test("match data is rendered vertically with both teams compared per metric", () => {
  const document = new FakeDocument();
  const context = vm.createContext({
    console,
    document,
    navigator: { clipboard: { writeText: async () => {} } },
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    addEventListener: () => {},
    clearTimeout,
    setTimeout,
    Blob,
    URL: {
      createObjectURL: () => "blob:test",
      revokeObjectURL: () => {}
    }
  });
  context.globalThis = context;

  const root = path.resolve(__dirname, "..");
  vm.runInContext(fs.readFileSync(path.join(root, "src", "config", "teams.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "src", "domain", "match-engine.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "src", "ui", "browser-game-adapter.js"), "utf8"), context);
  document.listeners.get("DOMContentLoaded")();

  const game = context.tacticsGame;
  game.renderStats(game.engine.getSnapshot());
  const stats = document.getElementById("match-stats");

  assert.equal(stats.children[0].className, "match-stats-head");
  assert.deepEqual(
    Array.from(stats.children.slice(1), (row) => row.children[0].textContent),
    ["Posse", "Passes", "Finalizacoes", "Faltas", "Laterais", "Escanteios"]
  );
  stats.children.slice(1).forEach((row) => assert.equal(row.children.length, 3));
});

test("visible event feed keeps only important events with newest first", () => {
  const document = new FakeDocument();
  const context = vm.createContext({
    console,
    document,
    navigator: { clipboard: { writeText: async () => {} } },
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    addEventListener: () => {},
    clearTimeout,
    setTimeout,
    Blob,
    URL: {
      createObjectURL: () => "blob:test",
      revokeObjectURL: () => {}
    }
  });
  context.globalThis = context;

  const root = path.resolve(__dirname, "..");
  vm.runInContext(fs.readFileSync(path.join(root, "src", "config", "teams.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "src", "domain", "match-engine.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "src", "ui", "browser-game-adapter.js"), "utf8"), context);
  document.listeners.get("DOMContentLoaded")();

  const game = context.tacticsGame;
  game.beginNewMatchLog();
  game.addLog({ kind: "pass_completed", title: "Passe", detail: "Evento comum" });
  game.addLog({ kind: "foul_committed", title: "Falta", detail: "Primeiro importante" });
  game.addLog({ kind: "throw_in_awarded", title: "Lateral", detail: "Segundo importante" });
  game.addLog({ kind: "goal", title: "Gol", detail: "Mais recente" });

  const visible = document.getElementById("key-moments").children;
  assert.equal(visible.length, 3);
  assert.equal(visible[0].children[1].children[0].textContent, "Gol");
  assert.equal(visible[1].children[1].children[0].textContent, "Lateral");
  assert.equal(visible[2].children[1].children[0].textContent, "Falta");
  assert.match(document.getElementById("log-count").textContent, /3 importantes/);
});
