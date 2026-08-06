window.CYBER_CONFIG = Object.freeze({
    mapBoundary: 245,
    maxEnemies: 50,
    movement: Object.freeze({ acceleration: 25, deceleration: 1.5, maxSpeed: 12, rotationSpeed: 80 }),
    player: Object.freeze({ hp: 100, armor: 25, power: 100, powerRegen: 6, lowPower: 30 }),
    weapons: Object.freeze({
        cannon: Object.freeze({ reloadMs: 2500, powerCost: 20, blastRadius: 10 }),
        machineGun: Object.freeze({ reloadMs: 100, powerCost: 0.5, maxHeat: 100, heatPerShot: 5, coolRate: 30 })
    })
});
