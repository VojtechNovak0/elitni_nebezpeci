// ship.js – Player ship physics
class PlayerShip {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.angle    = -Math.PI / 2; // pointing up initially
        this.throttle = 0;            // 0–1

        this.hull    = 100;
        this.shields = 100;
        this._shieldCooldown = 0;     // delay before regen starts

        // ── Fuel ──────────────────────────────────────────────────
        this.fuel    = CONF.FUEL_CAP;
        this.maxFuel = CONF.FUEL_CAP;

        // ── Upgrades ──────────────────────────────────────────────
        this.upgrades   = new Set(); // installed upgrade IDs
        this.maxHull    = 100;
        this.maxShields = 100;
    }

    rotate(da) { this.angle += da; }

    addThrottle(delta) {
        this.throttle = clamp(this.throttle + delta, 0, 1);
    }

    // ── Upgrade helpers ───────────────────────────────────────────

    hasUpgrade(id) { return this.upgrades.has(id); }

    // Returns true if successfully installed, false if already owned / req missing
    installUpgrade(id) {
        const def = CONF.SHIP_UPGRADES.find(u => u.id === id);
        if (!def) return false;
        if (this.upgrades.has(id)) return false;
        if (def.requires && !this.upgrades.has(def.requires)) return false;

        this.upgrades.add(id);

        // Apply stat effects immediately
        if (id === 'shields2') { this.maxShields = 150; this.shields = Math.min(this.shields + 50, this.maxShields); }
        if (id === 'hull2')    { this.maxHull    = 150; this.hull    = Math.min(this.hull    + 50, this.maxHull);    }
        if (id === 'fuel2')    { this.maxFuel    = CONF.FUEL_CAP * 2; }

        return true;
    }

    // Effective thrust (may be boosted by engine upgrades)
    get effectiveThrust() {
        if (this.upgrades.has('engine3')) return CONF.THRUST * 1.60;
        if (this.upgrades.has('engine2')) return CONF.THRUST * 1.30;
        return CONF.THRUST;
    }

    // Effective max speed
    get effectiveMaxSpeed() {
        if (this.upgrades.has('engine3')) return CONF.MAX_SPEED * 1.60;
        if (this.upgrades.has('engine2')) return CONF.MAX_SPEED * 1.30;
        return CONF.MAX_SPEED;
    }

    // Effective hold capacity
    get holdCap() {
        return CONF.HOLD_CAP + (this.upgrades.has('cargo2') ? 20 : 0);
    }

    // ── Physics update ────────────────────────────────────────────

    update(dt) {
        // Fuel check: no fuel → no thrust
        const canThrust = this.fuel > 0;
        const effectiveThrottle = canThrust ? this.throttle : 0;

        // Burn fuel
        if (canThrust && this.throttle > 0) {
            this.fuel = Math.max(0, this.fuel - this.throttle * CONF.FUEL_BURN_RATE * dt);
            if (this.fuel <= 0) this.throttle = 0;
        }

        // Logarithmic thrust using effective stats
        if (effectiveThrottle > 0) {
            const accel = this.effectiveThrust * Math.log10(1 + effectiveThrottle * 9);
            this.vx += Math.cos(this.angle) * accel * dt;
            this.vy += Math.sin(this.angle) * accel * dt;
        }

        // Hard speed cap
        const spd = this.speed;
        if (spd > this.effectiveMaxSpeed) {
            const f = this.effectiveMaxSpeed / spd;
            this.vx *= f;
            this.vy *= f;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Shield regeneration (starts 3 s after last damage)
        this._shieldCooldown = Math.max(0, this._shieldCooldown - dt);
        if (this._shieldCooldown === 0 && this.shields < this.maxShields) {
            this.shields = Math.min(this.maxShields, this.shields + 8 * dt);
        }
    }

    get speed() { return vecLen(this.vx, this.vy); }

    takeDamage(amount) {
        this._shieldCooldown = 3;
        const absorbed = Math.min(this.shields, amount);
        this.shields -= absorbed;
        this.hull = Math.max(0, this.hull - (amount - absorbed));
    }
}
