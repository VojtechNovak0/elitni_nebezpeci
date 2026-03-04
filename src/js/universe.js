// universe.js – Universe management and procedural expansion

const STATION_NAMES = [
    'Alpha Station', 'New Berlin', 'Proxima Base', 'Kepler Outpost',
    'Vega Terminal', 'Tau Nexus',  'Sigma Depot',  'Beta Hub',
    'Gamma Post',    'Delta Node', 'Epsilon Gate', 'Zeta Colony',
    'Eta Refinery',  'Theta Platform', 'Iota Post', 'Kappa Exchange',
    'Lambda Nexus',  'Mu Depot',  'Nu Base',       'Xi Outpost',
    'Omicron Station', 'Pi Terminal', 'Rho Gateway', 'Upsilon Hub',
    'Phi Crossing',  'Chi Depot', 'Psi Exchange',  'Omega Frontier',
];

class Universe {
    constructor() {
        this.stations  = [];
        this.aiShips   = [];
        this._nameIdx  = 0;
        this._rng      = new SeededRNG(42);
        this.generatedRadius     = CONF.STATION_SPREAD;
        this.selectedWaypointIdx = 0;

        this._generateInitial();
    }

    _generateInitial() {
        for (let i = 0; i < CONF.INIT_STATIONS; i++) this._addStation();
    }

    _addStation() {
        let x, y, tries = 0;
        const minD = CONF.STATION_MIN_GAP;

        do {
            const a = this._rng.next() * Math.PI * 2;
            const r = this._rng.range(minD * 2, this.generatedRadius);
            x = Math.cos(a) * r;
            y = Math.sin(a) * r;
            tries++;
        } while (tries < 60 && this.stations.some(s => dist(s.x, s.y, x, y) < minD));

        const name    = STATION_NAMES[this._nameIdx++ % STATION_NAMES.length];
        const station = new Station(x, y, name, this._rng.int(100, 99999));
        this.stations.push(station);

        // Spawn AI ships near this station
        for (let i = 0; i < CONF.AI_PER_STATION; i++) {
            this.aiShips.push(new AIShip(
                x + this._rng.range(-60, 60),
                y + this._rng.range(-60, 60),
                station, this
            ));
        }

        return station;
    }

    // Expand universe: add more stations beyond the frontier
    expand() {
        this.generatedRadius += CONF.STATION_SPREAD * 0.6;
        for (let i = 0; i < CONF.EXPAND_ADD; i++) this._addStation();
        console.log(`[Universe] Expanded to radius ${this.generatedRadius.toFixed(0)}, ${this.stations.length} stations`);
    }

    checkExpansion(px, py) {
        if (dist(0, 0, px, py) > this.generatedRadius * CONF.EXPAND_THRESHOLD) {
            this.expand();
        }
    }

    update(dt) {
        this.stations.forEach(s => s.update(dt));
        this.aiShips.forEach(a => a.update(dt));
    }

    get selectedWaypoint() {
        return this.stations[this.selectedWaypointIdx] || null;
    }

    cycleWaypoint() {
        this.selectedWaypointIdx = (this.selectedWaypointIdx + 1) % this.stations.length;
    }

    nearestStation(x, y) {
        let best = null, bestD = Infinity;
        for (const s of this.stations) {
            const d = s.distTo(x, y);
            if (d < bestD) { bestD = d; best = s; }
        }
        return best;
    }
}
