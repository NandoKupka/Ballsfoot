(function exposeBallsfootFormations(root, factory) {
  const exports = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exports;
  }

  if (root) {
    root.BallsfootFormations = exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createFormationsModule() {
  "use strict";

  const FORMATION_442 = {
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

  const ROLE_BEHAVIORS = {
    GOL: {
      groups: ["goalkeeper", "defensive"],
      attackPush: 0,
      defensiveLine: { offset: 0, min: 3, max: 4 },
      speed: 3.6,
      carryDistance: 0,
      zone: { x: [38, 62], progress: [3, 4] }
    },
    ZAG: {
      groups: ["centerBack", "defensive"],
      attackPush: 4,
      defensiveLine: { offset: 0, min: 15, max: 62 },
      speed: 6.4,
      carryDistance: 2.2,
      zone: { xOffset: [-13, 13], progress: [12, 53] }
    },
    LE: {
      groups: ["fullback", "wide", "defensive"],
      attackPush: 22,
      defensiveLine: { offset: 0, min: 15, max: 62 },
      speed: 9,
      carryDistance: 6.5,
      zone: {
        xBySide: { negative: [5, 42], positive: [58, 95] },
        progressFromBall: { sameSideOffset: -6, farSideOffset: -14, min: 18, max: 62 },
        progressMax: 88
      }
    },
    LD: {
      groups: ["fullback", "wide", "defensive"],
      attackPush: 22,
      defensiveLine: { offset: 0, min: 15, max: 62 },
      speed: 9,
      carryDistance: 6.5,
      zone: {
        xBySide: { negative: [5, 42], positive: [58, 95] },
        progressFromBall: { sameSideOffset: -6, farSideOffset: -14, min: 18, max: 62 },
        progressMax: 88
      }
    },
    VOL: {
      groups: ["centralMidfielder", "defensive"],
      attackPush: 7,
      defensiveLine: { offset: 16, min: 28, max: 75 },
      speed: 7.4,
      carryDistance: 3.5,
      zone: { x: [28, 72], progress: [22, 68] }
    },
    MC: {
      groups: ["centralMidfielder"],
      attackPush: 13,
      defensiveLine: { offset: 16, min: 28, max: 75 },
      speed: 7.4,
      carryDistance: 5.2,
      zone: { x: [24, 76], progress: [32, 82] }
    },
    ME: {
      groups: ["wideMidfielder", "wide"],
      attackPush: 28,
      defensiveLine: { offset: 16, min: 28, max: 75 },
      speed: 9,
      carryDistance: 6.5,
      zone: {
        xBySide: { negative: [5, 46], positive: [54, 95] },
        progressFromBall: { sameSideOffset: 12, farSideOffset: 7, min: 44, max: 80 },
        progressMax: 96
      }
    },
    MD: {
      groups: ["wideMidfielder", "wide"],
      attackPush: 28,
      defensiveLine: { offset: 16, min: 28, max: 75 },
      speed: 9,
      carryDistance: 6.5,
      zone: {
        xBySide: { negative: [5, 46], positive: [54, 95] },
        progressFromBall: { sameSideOffset: 12, farSideOffset: 7, min: 44, max: 80 },
        progressMax: 96
      }
    },
    ALA: {
      groups: ["wingback", "wide"],
      attackPush: 30,
      defensiveLine: { offset: 16, min: 28, max: 75 },
      speed: 9,
      carryDistance: 6.5,
      zone: {
        xBySide: { negative: [4, 48], positive: [52, 96] },
        progressFromBall: { sameSideOffset: 16, farSideOffset: 10, min: 42, max: 84 },
        progressMax: 95
      }
    },
    PE: {
      groups: ["wideForward", "wide", "forward"],
      attackPush: 18,
      defensiveLine: { offset: 31, min: 43, max: 88 },
      speed: 8.6,
      carryDistance: 6.2,
      zone: { xBySide: { negative: [8, 50], positive: [50, 92] }, progress: [46, 94] }
    },
    PD: {
      groups: ["wideForward", "wide", "forward"],
      attackPush: 18,
      defensiveLine: { offset: 31, min: 43, max: 88 },
      speed: 8.6,
      carryDistance: 6.2,
      zone: { xBySide: { negative: [8, 50], positive: [50, 92] }, progress: [46, 94] }
    },
    ATA: {
      groups: ["forward"],
      attackPush: 13,
      defensiveLine: { offset: 31, min: 43, max: 88 },
      speed: 8.6,
      carryDistance: 6.2,
      zone: { x: [18, 82], progressFromBall: { sameSideOffset: -8, farSideOffset: -8, min: 46, max: 76 }, progressMax: 94 }
    },
    CA: {
      groups: ["forward"],
      attackPush: 13,
      defensiveLine: { offset: 31, min: 43, max: 88 },
      speed: 8.6,
      carryDistance: 6.2,
      zone: { x: [18, 82], progressFromBall: { sameSideOffset: -8, farSideOffset: -8, min: 46, max: 76 }, progressMax: 94 }
    },
    RES: {
      groups: [],
      attackPush: 0,
      defensiveLine: { offset: 0, min: 8, max: 8 },
      speed: 7.4,
      carryDistance: 5.2,
      zone: { xOffset: [-15, 15], progress: [22, 78] }
    }
  };

  const FORMATIONS = {
    [FORMATION_442.id]: FORMATION_442
  };

  function getFormation(id = "4-4-2") {
    return FORMATIONS[id] || FORMATION_442;
  }

  function getRoleBehavior(role) {
    return ROLE_BEHAVIORS[String(role || "RES").toUpperCase()] || ROLE_BEHAVIORS.RES;
  }

  function roleHasGroup(role, group) {
    return getRoleBehavior(role).groups.includes(group);
  }

  return {
    FORMATIONS,
    FORMATION_442,
    ROLE_BEHAVIORS,
    getFormation,
    getRoleBehavior,
    roleHasGroup
  };
});
