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
        { name: "Rochet", number: 1, preferredPositions: ["GOL"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } },
        { name: "Bernabei", number: 6, preferredPositions: ["LE", "ME"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } },
        { name: "Vitor Gabriel", number: 3, preferredPositions: ["ZAG"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } },
        { name: "Mercado", number: 4, preferredPositions: ["ZAG"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } },
        { name: "Bruno Gomes", number: 2, preferredPositions: ["LD", "MD"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } },
        { name: "Villagra", number: 5, preferredPositions: ["VOL", "MC"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } },
        { name: "Bruno Henrique", number: 8, preferredPositions: ["MD", "ME"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } },
        { name: "Alan Patrick", number: 10, preferredPositions: ["MC"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } },
        { name: "Carbonero", number: 7, preferredPositions: ["MD", "ATA"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } },
        { name: "Alejandro", number: 9, preferredPositions: ["ATA"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } },
        { name: "Borre", number: 11, preferredPositions: ["ATA"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } }
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
        { name: "Rafael", number: 1, preferredPositions: ["GOL"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } },
        { name: "Bruno", number: 6, preferredPositions: ["LE", "ME"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } },
        { name: "Caio", number: 3, preferredPositions: ["ZAG"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } },
        { name: "Diego", number: 4, preferredPositions: ["ZAG"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } },
        { name: "Andre", number: 2, preferredPositions: ["LD", "MD"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } },
        { name: "Lucas", number: 5, preferredPositions: ["VOL", "MC"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } },
        { name: "Mateus", number: 8, preferredPositions: ["MC", "VOL"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } },
        { name: "Nicolas", number: 11, preferredPositions: ["ME", "ATA"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } },
        { name: "Pedro", number: 7, preferredPositions: ["MD", "ATA"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } },
        { name: "Tiago", number: 9, preferredPositions: ["ATA"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } },
        { name: "Vitor", number: 10, preferredPositions: ["ATA", "MC"], attributes: { physical: 70, technique: 70, intelligence: 70, defense: 70 } }
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
