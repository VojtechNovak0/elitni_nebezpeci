// station.js – Space station and trade goods

const GOODS = [
    'Metals', 'Food', 'Electronics', 'Medicine',
    'Fuel',   'Textiles', 'Narcotics', 'Weapons',
];

const BASE_PRICES = {
    Metals: 120, Food: 35, Electronics: 280, Medicine: 150,
    Fuel: 55, Textiles: 90, Narcotics: 550, Weapons: 420,
};

// Landing pad positions inside station (in interior pixel space, relative to centre)
const PAD_POSITIONS = [
    { x: -145, y: -95 }, { x: 145, y: -95 },
    { x: -145, y:  95 }, { x: 145, y:  95 },
];

class Station {
    constructor(x, y, name, seed) {
        this.x    = x;
        this.y    = y;
        this.name = name;
        this.seed = seed;

        this.angle    = Math.random() * Math.PI * 2; // start at random angle
        this.rotSpeed = CONF.STATION_ROT_SPEED;

        // Landing pads
        this.pads = PAD_POSITIONS.map((p, i) => ({
            id: i + 1, x: p.x, y: p.y,
            occupied: false, shipId: null,
        }));

        // Generate inventory and prices
        const rng = new SeededRNG(seed);
        this.inventory = {};
        this.prices    = {};
        for (const g of GOODS) {
            this.inventory[g] = rng.int(5, 60);
            this.prices[g]    = Math.floor(BASE_PRICES[g] * rng.range(0.6, 1.5));
        }
    }

    update(dt) {
        this.angle += this.rotSpeed * dt;
    }

    // Gap is always at local angle 0, which in world space = this.angle.
    // Returns true if the world position (wx, wy) is inside the gap.
    isPortOpen(wx, wy) {
        const playerAngle = angleTo(this.x, this.y, wx, wy);
        const diff = Math.abs(normalizeAngle(playerAngle - this.angle));
        return diff < CONF.PORT_GAP / 2 + CONF.PORT_TOLERANCE;
    }

    assignPad(shipId) {
        const pad = this.pads.find(p => !p.occupied);
        if (pad) { pad.occupied = true; pad.shipId = shipId; }
        return pad || null;
    }

    releasePad(shipId) {
        const pad = this.pads.find(p => p.shipId === shipId);
        if (pad) { pad.occupied = false; pad.shipId = null; }
    }

    distTo(x, y) { return dist(this.x, this.y, x, y); }
}
