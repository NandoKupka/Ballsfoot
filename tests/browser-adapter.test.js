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
      "copy-feedback", "goal-modal", "goal-team", "goal-title", "goal-detail", "goal-ok"
    ].forEach((id) => this.elements.set(id, new FakeElement()));

    this.elements.get("goal-modal").hidden = true;
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
  assert.equal(context.tacticsGame.engine.matchClockRate, 30);
  assert.equal(context.tacticsGame.playerElements.size, 22);
  assert.equal(document.getElementById("clock").textContent, "00'");
  assert.equal(document.getElementById("score").textContent, "0 x 0");
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
