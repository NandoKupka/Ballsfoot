(function exposeTeamsConfig(root, factory) {
  const exports = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exports;
  }

  if (root) {
    root.BallsfootConfig = exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createTeamsConfig() {
  "use strict";

  const TEAMS_CONFIG = [
    {
      id: "time-vermelho",
      name: "Time Vermelho",
      shortName: "Vermelho",
      mark: "VM",
      venue: "home",
      colors: {
        main: "#e84d55",
        deep: "#9f2730",
        highlight: "#ff8186",
        glow: "rgba(232, 77, 85, 0.28)"
      },
      players: [
        { name: "Rochet", number: 1, overall: 90, preferredPositions: ["GOL"], attributes: { goalkeeping: 96, passing: 84 } },
        { name: "Bernabei", number: 6, overall: 90, preferredPositions: ["LE", "ME"], attributes: { pace: 97, control: 92 } },
        { name: "Vitor Gabriel", number: 3, overall: 90, preferredPositions: ["ZAG"], attributes: { defending: 95, positioning: 94 } },
        { name: "Mercado", number: 4, overall: 90, preferredPositions: ["ZAG"], attributes: { defending: 97, pace: 80 } },
        { name: "Bruno Gomes", number: 2, overall: 90, preferredPositions: ["LD", "MD"], attributes: { pace: 94, passing: 91 } },
        { name: "Villagra", number: 5, overall: 90, preferredPositions: ["VOL", "MC"], attributes: { defending: 94, passing: 92 } },
        { name: "Bruno Henrique", number: 8, overall: 90, preferredPositions: ["MD", "ME"], attributes: { passing: 94, vision: 93 } },
        { name: "Alan Patrick", number: 10, overall: 90, preferredPositions: ["MC"], attributes: { vision: 99, passing: 97, control: 97 } },
        { name: "Carbonero", number: 7, overall: 90, preferredPositions: ["MD", "ATA"], attributes: { pace: 98, control: 95 } },
        { name: "Borre", number: 11, overall: 90, preferredPositions: ["ATA"], attributes: { positioning: 97, finishing: 95 } },
        { name: "Alejandro", number: 9, overall: 90, preferredPositions: ["ATA"], attributes: { finishing: 98, pace: 94 } }
      ]
    },
    {
      id: "time-azul",
      name: "Time Azul",
      shortName: "Azul",
      mark: "AZ",
      venue: "away",
      colors: {
        main: "#2878ff",
        deep: "#134eb0",
        highlight: "#5fa4ff",
        glow: "rgba(40, 120, 255, 0.32)"
      },
      players: [
        { name: "Rafael", number: 1, overall: 20, preferredPositions: ["GOL"], attributes: { goalkeeping: 28, passing: 18 } },
        { name: "Bruno", number: 6, overall: 20, preferredPositions: ["LE", "ME"], attributes: { pace: 32 } },
        { name: "Caio", number: 3, overall: 20, preferredPositions: ["ZAG"], attributes: { defending: 30 } },
        { name: "Diego", number: 4, overall: 20, preferredPositions: ["ZAG"], attributes: { positioning: 28 } },
        { name: "Andre", number: 2, overall: 20, preferredPositions: ["LD", "MD"], attributes: { pace: 30 } },
        { name: "Lucas", number: 5, overall: 20, preferredPositions: ["VOL", "MC"], attributes: { defending: 27 } },
        { name: "Mateus", number: 8, overall: 20, preferredPositions: ["MC", "VOL"], attributes: { passing: 29, vision: 27 } },
        { name: "Nicolas", number: 11, overall: 20, preferredPositions: ["ME", "ATA"], attributes: { control: 26 } },
        { name: "Pedro", number: 7, overall: 20, preferredPositions: ["MD", "ATA"], attributes: { pace: 31 } },
        { name: "Tiago", number: 9, overall: 20, preferredPositions: ["ATA"], attributes: { finishing: 29 } },
        { name: "Vitor", number: 10, overall: 20, preferredPositions: ["ATA", "MC"], attributes: { vision: 27 } }
      ]
    }
  ];
  const MATCH_SETTINGS = {
    matchClockRate: 30
  };

  return {
    TEAMS_CONFIG,
    MATCH_SETTINGS
  };
});
