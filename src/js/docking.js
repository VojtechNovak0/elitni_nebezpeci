// docking.js – Docking state machine
// States: SPACE → APPROACH → INSIDE → LANDED (→ TRADING) → SPACE

class Docking {
    constructor(game) {
        this.game = game;

        this.targetStation = null;
        this.assignedPad   = null;
        this.holdTimer     = 0;

        // Notification message
        this.msg      = '';
        this.msgTimer = 0;

        // ── Inside station state (pixel-space, relative to interior centre) ──
        this.ip = { x: 0, y: 200 }; // player inside position
        this.iv = { x: 0, y: 0  }; // player inside velocity
        this.ia = -Math.PI / 2;     // player inside angle (pointing up)
        this.onPad = false;

        // Blink timer for assigned-pad highlight
        this._blinkTimer = 0;
    }

    // ── Public helpers ────────────────────────────────────────────────────────

    showMsg(text, duration = 4) {
        this.msg      = text;
        this.msgTimer = duration;
    }

    // ── SPACE: check whether approach should be triggered ─────────────────────

    checkApproach(dt) {
        if (this.msgTimer > 0) this.msgTimer -= dt;

        const { ship, universe } = this.game;

        for (const st of universe.stations) {
            const d = st.distTo(ship.x, ship.y);

            if (d < CONF.APPROACH_RANGE) {
                if (ship.speed < CONF.APPROACH_MAX_SPEED) {
                    this.holdTimer += dt;
                    const rem = (CONF.DOCK_HOLD_TIME - this.holdTimer).toFixed(1);

                    if (this.holdTimer < CONF.DOCK_HOLD_TIME) {
                        this.showMsg(`DOCKING REQUEST – HOLD SPEED ${rem}s`, 0.12);
                    } else {
                        this._initiateApproach(st);
                    }
                } else {
                    this.holdTimer = 0;
                    if (d < CONF.APPROACH_RANGE * 0.75) {
                        this.showMsg(`REDUCE SPEED < ${CONF.APPROACH_MAX_SPEED} u/s TO DOCK`, 0.5);
                    }
                }
                return; // only one station at a time
            }
        }

        this.holdTimer = 0;
    }

    // ── Initiate approach to a station ────────────────────────────────────────

    _initiateApproach(station) {
        const pad = station.assignPad('player');
        if (!pad) {
            this.showMsg('STATION FULL – DOCKING DENIED', 4);
            this.holdTimer = 0;
            return;
        }

        this.targetStation = station;
        this.assignedPad   = pad;
        this.holdTimer     = 0;
        this.game.state    = 'APPROACH';
        this.showMsg(`DOCKING APPROVED – PAD ${pad.id}`, 5);
    }

    // ── APPROACH: flight controls + ring collision ────────────────────────────

    updateApproach(dt) {
        const { ship, input } = this.game;
        if (this.msgTimer > 0) this.msgTimer -= dt;

        // Same controls as space
        if (input.isDown('ArrowLeft')  || input.isDown('KeyA')) ship.rotate(-CONF.ROT_SPEED * dt);
        if (input.isDown('ArrowRight') || input.isDown('KeyD')) ship.rotate( CONF.ROT_SPEED * dt);
        if (input.isDown('ArrowUp')    || input.isDown('KeyW')) ship.addThrottle( CONF.THROTTLE_RATE * dt);
        if (input.isDown('ArrowDown')  || input.isDown('KeyS')) ship.addThrottle(-CONF.THROTTLE_RATE * dt);
        if (input.justDown('KeyX'))  ship.throttle = 0;

        ship.update(dt);

        const st = this.targetStation;
        const d  = st.distTo(ship.x, ship.y);

        if (d < CONF.DOCK_RING_R) {
            if (st.isPortOpen(ship.x, ship.y)) {
                this._enterStation();
            } else {
                // Collision with the solid part of the ring
                const pushA = angleTo(st.x, st.y, ship.x, ship.y);
                const spd   = ship.speed;
                ship.vx = Math.cos(pushA) * spd * 0.55;
                ship.vy = Math.sin(pushA) * spd * 0.55;
                ship.takeDamage(12 * dt * 60);
                this.showMsg('⚠ DOCKING RING COLLISION', 1.2);
            }
        }

        if (input.justDown('Escape')) this.abort();
    }

    // ── Enter station interior ────────────────────────────────────────────────

    _enterStation() {
        this.ip    = { x: 0, y: 210 }; // just inside the entrance (bottom)
        this.iv    = { x: 0, y: -35 }; // initial upward drift
        this.ia    = -Math.PI / 2;
        this.onPad = false;
        this.game.state = 'INSIDE';
        this.showMsg(`INSIDE ${this.targetStation.name.toUpperCase()} – NAV TO PAD ${this.assignedPad.id}`, 5);
    }

    // ── INSIDE: manoeuvre to assigned pad ────────────────────────────────────

    updateInside(dt) {
        const { input, ship } = this.game;
        if (this.msgTimer > 0) this.msgTimer -= dt;
        this._blinkTimer += dt;

        // Controls (throttle half-rate inside)
        if (input.isDown('ArrowLeft')  || input.isDown('KeyA')) this.ia -= CONF.ROT_SPEED * dt;
        if (input.isDown('ArrowRight') || input.isDown('KeyD')) this.ia += CONF.ROT_SPEED * dt;
        if (input.isDown('ArrowUp')    || input.isDown('KeyW')) ship.addThrottle( CONF.THROTTLE_RATE * 0.5 * dt);
        if (input.isDown('ArrowDown')  || input.isDown('KeyS')) ship.addThrottle(-CONF.THROTTLE_RATE * 0.5 * dt);
        if (input.justDown('KeyX')) ship.throttle = 0;

        // Physics scaled way down for interior precision flying
        const accel = throttleToAccel(ship.throttle) * 0.00016;
        this.iv.x += Math.cos(this.ia) * accel * dt;
        this.iv.y += Math.sin(this.ia) * accel * dt;

        // Cap interior speed
        const spd    = vecLen(this.iv.x, this.iv.y);
        const maxSpd = 130;
        if (spd > maxSpd) {
            this.iv.x = this.iv.x / spd * maxSpd;
            this.iv.y = this.iv.y / spd * maxSpd;
        }

        this.ip.x += this.iv.x * dt;
        this.ip.y += this.iv.y * dt;

        // Wall collisions (interior bounds ±270 x, ±215 y)
        const BX = 270, BY = 215;
        if (Math.abs(this.ip.x) > BX) {
            this.ip.x  = Math.sign(this.ip.x) * BX;
            this.iv.x *= -0.4;
            ship.takeDamage(spd * 0.12);
        }
        if (this.ip.y < -BY) {
            this.ip.y  = -BY;
            this.iv.y *= -0.4;
            ship.takeDamage(spd * 0.12);
        }
        // Flew back out through the entrance
        if (this.ip.y > BY + 15) {
            this.abort();
            return;
        }

        // Check landing on assigned pad
        if (!this.onPad && this.assignedPad) {
            const pad = this.assignedPad;
            const dx  = this.ip.x - pad.x;
            const dy  = this.ip.y - pad.y;
            if (Math.hypot(dx, dy) < 28 && spd < 28) {
                this.onPad    = true;
                this.iv       = { x: 0, y: 0 };
                ship.throttle = 0;
                this.game.state = 'LANDED';
                this.showMsg('LANDED – [T] TRADE   [ESC] DEPART', 8);
            }
        }

        if (input.justDown('Escape')) this.abort();
    }

    // ── Abort / Depart ────────────────────────────────────────────────────────

    abort() {
        if (this.targetStation && this.assignedPad) {
            this.targetStation.releasePad('player');
        }

        const { ship } = this.game;
        if (this.targetStation) {
            const a = Math.random() * Math.PI * 2;
            ship.x  = this.targetStation.x + Math.cos(a) * (CONF.DOCK_RING_R + 40);
            ship.y  = this.targetStation.y + Math.sin(a) * (CONF.DOCK_RING_R + 40);
            ship.vx = Math.cos(a) * 80;
            ship.vy = Math.sin(a) * 80;
        }
        ship.throttle      = 0;
        this.targetStation = null;
        this.assignedPad   = null;
        this.onPad         = false;
        this.holdTimer     = 0;
        this.game.state    = 'SPACE';
    }

    depart() { this.abort(); }
}
