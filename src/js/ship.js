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
    }

    rotate(da) { this.angle += da; }

    addThrottle(delta) {
        this.throttle = clamp(this.throttle + delta, 0, 1);
    }

    update(dt) {
        // Logarithmic thrust in facing direction
        const accel = throttleToAccel(this.throttle);
        this.vx += Math.cos(this.angle) * accel * dt;
        this.vy += Math.sin(this.angle) * accel * dt;

        // Hard speed cap
        const spd = this.speed;
        if (spd > CONF.MAX_SPEED) {
            const f = CONF.MAX_SPEED / spd;
            this.vx *= f;
            this.vy *= f;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Shield regeneration (starts 3 s after last damage)
        this._shieldCooldown = Math.max(0, this._shieldCooldown - dt);
        if (this._shieldCooldown === 0 && this.shields < 100) {
            this.shields = Math.min(100, this.shields + 8 * dt);
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
