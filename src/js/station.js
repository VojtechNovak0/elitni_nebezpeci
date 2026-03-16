// station.js – Space station and trade goods

const GOODS = [
    'Metals', 'Food', 'Electronics', 'Medicine',
    'Fuel',   'Textiles', 'Narcotics', 'Weapons',
];

const BASE_PRICES = {
    Metals: 120, Food: 35, Electronics: 280, Medicine: 150,
    Fuel: 55, Textiles: 90, Narcotics: 550, Weapons: 420,
};

// Goods excluded per station type
const TYPE_EXCLUDED = {
    TRADE:      [],
    MILITARY:   ['Narcotics'],
    INDUSTRIAL: ['Narcotics', 'Textiles'],
    FUEL_DEPOT: ['Narcotics', 'Textiles', 'Weapons', 'Medicine'],
};

// Price multipliers per station type (good → multiplier)
const TYPE_PRICE_MOD = {
    TRADE:      {},
    MILITARY:   { Weapons: 0.70, Medicine: 0.80, Metals: 1.20 },
    INDUSTRIAL: { Metals: 0.65, Electronics: 0.75, Fuel: 0.60 },
    FUEL_DEPOT: { Fuel: 0.45 },
};

// Landing pad positions inside station (in interior pixel space, relative to centre)
const PAD_POSITIONS = [
    { x: -145, y: -95 }, { x: 145, y: -95 },
    { x: -145, y:  95 }, { x: 145, y:  95 },
];

// Station types (assigned procedurally)
const STATION_TYPES = ['TRADE', 'MILITARY', 'INDUSTRIAL', 'FUEL_DEPOT'];

// Human-readable type labels shown inside station
const TYPE_LABEL = {
    TRADE:      'TRADE HUB',
    MILITARY:   'MILITARY BASE',
    INDUSTRIAL: 'INDUSTRIAL',
    FUEL_DEPOT: 'FUEL DEPOT',
};

class Station {
    constructor(x, y, name, seed) {
        this.x    = x;
        this.y    = y;
        this.name = name;
        this.seed = seed;

        this.angle    = Math.random() * Math.PI * 2; // start at random angle
        this.rotSpeed = CONF.STATION_ROT_SPEED;

        // Assign type deterministically from seed
        const typeRng = new SeededRNG(seed + 77);
        this.type = STATION_TYPES[typeRng.int(0, STATION_TYPES.length - 1)];

        // Landing pads
        this.pads = PAD_POSITIONS.map((p, i) => ({
            id: i + 1, x: p.x, y: p.y,
            occupied: false, shipId: null,
        }));

        // Generate inventory and prices
        const rng      = new SeededRNG(seed);
        const excluded = TYPE_EXCLUDED[this.type] || [];
        const priceMod = TYPE_PRICE_MOD[this.type] || {};

        this.inventory = {};
        this.prices    = {};
        for (const g of GOODS) {
            if (excluded.includes(g)) {
                this.inventory[g] = 0;
                this.prices[g]    = Math.floor(BASE_PRICES[g] * rng.range(0.6, 1.5));
            } else {
                const mod = priceMod[g] || 1;
                this.inventory[g] = rng.int(5, 60);
                this.prices[g]    = Math.floor(BASE_PRICES[g] * mod * rng.range(0.6, 1.5));
            }
        }

        // Fuel price for refuelling (credits per unit of ship fuel)
        const fuelMod   = (priceMod['Fuel'] || 1);
        this.fuelPrice  = Math.max(1, Math.floor(6 * fuelMod * rng.range(0.8, 1.3)));

        // Which ship upgrades are sold here
        this.availableUpgrades = CONF.SHIP_UPGRADES
            .filter(u => u.types.includes(this.type))
            .map(u => u.id);
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

    randomizePadOccupancy() {
        // Random occupancy for station arrival, but always keep at least one pad free.
        for (const pad of this.pads) {
            const occupied = Math.random() < 0.5;
            pad.occupied = occupied;
            pad.shipId   = occupied ? `npc-${pad.id}` : null;
        }

        if (this.pads.every(p => p.occupied)) {
            const idx = Math.floor(Math.random() * this.pads.length);
            this.pads[idx].occupied = false;
            this.pads[idx].shipId   = null;
        }
    }

    getFreePads() {
        return this.pads.filter(p => !p.occupied);
    }

    assignPad(shipId) {
        const pad = this.getFreePads()[0];
        if (pad) { pad.occupied = true; pad.shipId = shipId; }
        return pad || null;
    }

    releasePad(shipId) {
        const pad = this.pads.find(p => p.shipId === shipId);
        if (pad) { pad.occupied = false; pad.shipId = null; }
    }

    distTo(x, y) { return dist(this.x, this.y, x, y); }
}

// Colour used on map / HUD for each station type
function stationTypeColor(type) {
    switch (type) {
        case 'MILITARY':   return '#ff8888';
        case 'INDUSTRIAL': return '#ffaa44';
        case 'FUEL_DEPOT': return '#88ff99';
        default:           return '#88aaff'; // TRADE
    }
}
