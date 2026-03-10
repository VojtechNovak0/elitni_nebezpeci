// aiship.js – AI-controlled ships that travel between stations and dock
class AIShip {
    constructor(x, y, station, universe) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 400;
        this.vy = (Math.random() - 0.5) * 400;
        this.angle = Math.random() * Math.PI * 2;
        this.size  = 9;

        this.universe      = universe;
        this.homeStation   = station;
        this.targetStation = station;
        this.pad           = null;
        this.id            = 'ai_' + Math.random().toString(36).slice(2, 8);

        this.maxSpeed  = 55000;
        this.thrust    = 400;
        this.state     = 'DEPART';
        this.dockTimer = 0;
    }

    update(dt) {
        switch (this.state) {
            case 'TRAVEL':  this._travel(dt);  break;
            case 'DOCKING': this._docking(dt); break;
            case 'DOCKED':  this._docked(dt);  break;
            case 'DEPART':  this._depart(dt);  break;
        }
    }

    _travel(dt) {
        const tx = this.targetStation.x, ty = this.targetStation.y;
        const d  = dist(this.x, this.y, tx, ty);

        // Steer toward target
        const want = angleTo(this.x, this.y, tx, ty);
        const da   = normalizeAngle(want - this.angle);
        this.angle += clamp(da, -3 * dt, 3 * dt);

        // Brake distance estimate
        const brakeDist = this.maxSpeed ** 2 / (2 * this.thrust);
        if (d < brakeDist * 1.5) {
            // Retrograde burn
            const retroA = this.angle + Math.PI;
            const factor = clamp(d / brakeDist, 0, 1);
            this.vx += Math.cos(retroA) * this.thrust * factor * dt;
            this.vy += Math.sin(retroA) * this.thrust * factor * dt;
        } else {
            this.vx += Math.cos(this.angle) * this.thrust * dt;
            this.vy += Math.sin(this.angle) * this.thrust * dt;
        }

        const spd = vecLen(this.vx, this.vy);
        if (spd > this.maxSpeed) {
            this.vx = this.vx / spd * this.maxSpeed;
            this.vy = this.vy / spd * this.maxSpeed;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        if (d < 110 && spd < 800) {
            this.pad = this.targetStation.assignPad(this.id);
            this.state = 'DOCKING';
        }
    }

    _docking(dt) {
        // Exponential decay toward station centre
        this.vx *= Math.pow(0.005, dt);
        this.vy *= Math.pow(0.005, dt);
        this.x = lerp(this.x, this.targetStation.x, 1 - Math.pow(0.002, dt));
        this.y = lerp(this.y, this.targetStation.y, 1 - Math.pow(0.002, dt));

        const d = dist(this.x, this.y, this.targetStation.x, this.targetStation.y);
        if (d < 60) {
            this.state     = 'DOCKED';
            this.dockTimer = 8 + Math.random() * 18;
        }
    }

    _docked(dt) {
        this.dockTimer -= dt;
        if (this.dockTimer <= 0) {
            if (this.pad) { this.homeStation.releasePad(this.id); this.pad = null; }
            this.homeStation = this.targetStation;
            const others = this.universe.stations.filter(s => s !== this.targetStation);
            this.targetStation = others.length
                ? others[Math.floor(Math.random() * others.length)]
                : this.targetStation;
            this.state = 'DEPART';
        }
    }

    _depart(dt) {
        // Thrust directly away from home station
        const away = angleTo(this.homeStation.x, this.homeStation.y, this.x, this.y);
        this.angle = away;
        this.vx += Math.cos(this.angle) * this.thrust * 3 * dt;
        this.vy += Math.sin(this.angle) * this.thrust * 3 * dt;
        this.x  += this.vx * dt;
        this.y  += this.vy * dt;

        const d = dist(this.x, this.y, this.homeStation.x, this.homeStation.y);
        if (d > 220) this.state = 'TRAVEL';
    }
}
