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
        { name: "Rochet", number: 1, preferredPositions: ["GOL"], attributes: { physical: 82, technique: 87, intelligence: 94, defense: 97 } },
        { name: "Bernabei", number: 6, preferredPositions: ["LE", "ME"], attributes: { physical: 97, technique: 91, intelligence: 90, defense: 88 } },
        { name: "Vitor Gabriel", number: 3, preferredPositions: ["ZAG"], attributes: { physical: 88, technique: 83, intelligence: 94, defense: 96 } },
        { name: "Mercado", number: 4, preferredPositions: ["ZAG"], attributes: { physical: 81, technique: 84, intelligence: 97, defense: 98 } },
        { name: "Bruno Gomes", number: 2, preferredPositions: ["LD", "MD"], attributes: { physical: 94, technique: 91, intelligence: 90, defense: 88 } },
        { name: "Villagra", number: 5, preferredPositions: ["VOL", "MC"], attributes: { physical: 88, technique: 92, intelligence: 95, defense: 94 } },
        { name: "Bruno Henrique", number: 8, preferredPositions: ["MD", "ME"], attributes: { physical: 89, technique: 94, intelligence: 93, defense: 84 } },
        { name: "Alan Patrick", number: 10, preferredPositions: ["MC"], attributes: { physical: 83, technique: 98, intelligence: 99, defense: 76 } },
        { name: "Carbonero", number: 7, preferredPositions: ["MD", "ATA"], attributes: { physical: 98, technique: 95, intelligence: 90, defense: 71 } },
        { name: "Borre", number: 11, preferredPositions: ["ATA"], attributes: { physical: 92, technique: 94, intelligence: 97, defense: 67 } },
        { name: "Alejandro", number: 9, preferredPositions: ["ATA"], attributes: { physical: 94, technique: 98, intelligence: 96, defense: 64 } }
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
        { name: "Rafael", number: 1, preferredPositions: ["GOL"], attributes: { physical: 18, technique: 17, intelligence: 24, defense: 29 } },
        { name: "Bruno", number: 6, preferredPositions: ["LE", "ME"], attributes: { physical: 32, technique: 21, intelligence: 20, defense: 24 } },
        { name: "Caio", number: 3, preferredPositions: ["ZAG"], attributes: { physical: 20, technique: 16, intelligence: 25, defense: 30 } },
        { name: "Diego", number: 4, preferredPositions: ["ZAG"], attributes: { physical: 18, technique: 17, intelligence: 28, defense: 29 } },
        { name: "Andre", number: 2, preferredPositions: ["LD", "MD"], attributes: { physical: 30, technique: 22, intelligence: 21, defense: 23 } },
        { name: "Lucas", number: 5, preferredPositions: ["VOL", "MC"], attributes: { physical: 22, technique: 24, intelligence: 25, defense: 27 } },
        { name: "Mateus", number: 8, preferredPositions: ["MC", "VOL"], attributes: { physical: 22, technique: 29, intelligence: 27, defense: 21 } },
        { name: "Nicolas", number: 11, preferredPositions: ["ME", "ATA"], attributes: { physical: 28, technique: 26, intelligence: 23, defense: 16 } },
        { name: "Pedro", number: 7, preferredPositions: ["MD", "ATA"], attributes: { physical: 31, technique: 25, intelligence: 22, defense: 16 } },
        { name: "Tiago", number: 9, preferredPositions: ["ATA"], attributes: { physical: 26, technique: 29, intelligence: 25, defense: 8 } },
        { name: "Vitor", number: 10, preferredPositions: ["ATA", "MC"], attributes: { physical: 25, technique: 27, intelligence: 28, defense: 10 } }
      ]
    }
  ];
  const MATCH_SETTINGS = {
    matchClockRate: 15
  };

  return {
    TEAMS_CONFIG,
    MATCH_SETTINGS
  };
});
