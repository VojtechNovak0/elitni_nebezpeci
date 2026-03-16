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

        // Station communication panel (shown after entering interior)
        this.stationCommsRows  = [];
        this.stationCommsTimer = 0;
    }

    // ── Public helpers ────────────────────────────────────────────────────────

    showMsg(text, duration = 4) {
        this.msg      = text;
        this.msgTimer = duration;
    }

    tickStationComms(dt) {
        if (this.stationCommsTimer > 0) this.stationCommsTimer -= dt;
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

        // Q abort must be checked before ring entry so it is never swallowed
        if (input.justDown('KeyQ')) { this.abort(); return; }

        ship.update(dt);

        const st = this.targetStation;
        const d  = st.distTo(ship.x, ship.y);

        // Any contact with the ring area ports the ship directly inside
        if (d < CONF.DOCK_RING_R) {
            this._enterStation();
        }
    }

    // ── Enter station interior ────────────────────────────────────────────────

    _enterStation() {
        // Store ship's world position relative to station for the animation
        const st          = this.targetStation;
        this._animRelX    = this.game.ship.x - st.x;
        this._animRelY    = this.game.ship.y - st.y;
        this._animTimer   = 0;
        this._animDuration = 2.4;
        this.game.state   = 'DOCKING_ANIM';
    }

    // ── DOCKING_ANIM: cinematic zoom into the docking ring ───────────────────

    updateDockingAnim(dt) {
        const { input } = this.game;
        this._animTimer += dt;
        if (this._animTimer >= this._animDuration) {
            this._completeEntry();
            return;
        }
        if (input.justDown('KeyQ')) this.abort();
    }

    get animProgress() {
        return Math.min(1, (this._animTimer || 0) / (this._animDuration || 1));
    }

    _completeEntry() {
        this.ip    = { x: 0, y: 210 }; // just inside the entrance (bottom)
        this.iv    = { x: 0, y: -30 }; // gentle upward push
        this.ia    = -Math.PI / 2;
        this.onPad = false;
        this.game.ship.throttle = 0;   // reset throttle on entry
        this._openStationComms();
        this.game.state = 'INSIDE';
        this.showMsg(`INSIDE ${this.targetStation.name.toUpperCase()} – NAV TO PAD ${this.assignedPad.id}`, 5);
    }

    _openStationComms() {
        if (!this.targetStation) return;
        const assignedId = this.assignedPad?.id ?? null;
        this.stationCommsRows = this.targetStation.pads
            .filter(pad => !pad.occupied || pad.shipId === 'player')
            .map(pad => ({
                id: pad.id,
                status: assignedId === pad.id ? 'ASSIGNED' : 'FREE',
            }));
        this.stationCommsTimer = CONF.STATION_COMMS_TIME;
    }

    // ── INSIDE: manoeuvre to assigned pad ────────────────────────────────────

    updateInside(dt) {
        const { input, ship } = this.game;
        const st = this.targetStation;
        if (!st) return;
        if (this.msgTimer > 0) this.msgTimer -= dt;
        this.tickStationComms(dt);
        this._blinkTimer += dt;

        // Controls (throttle half-rate inside)
        if (input.isDown('ArrowLeft')  || input.isDown('KeyA')) this.ia -= CONF.ROT_SPEED * dt;
        if (input.isDown('ArrowRight') || input.isDown('KeyD')) this.ia += CONF.ROT_SPEED * dt;
        if (input.isDown('ArrowUp')    || input.isDown('KeyW')) ship.addThrottle( CONF.THROTTLE_RATE * 0.5 * dt);
        if (input.isDown('ArrowDown')  || input.isDown('KeyS')) ship.addThrottle(-CONF.THROTTLE_RATE * 0.5 * dt);
        if (input.justDown('KeyX')) ship.throttle = 0;

        // Physics – acceleration factor tuned for interior pixel-space
        // throttleToAccel(1) ≈ 1800; × 0.008 ≈ 14 u/s² at full throttle
        const accel = throttleToAccel(ship.throttle) * 0.008;
        this.iv.x += Math.cos(this.ia) * accel * dt;
        this.iv.y += Math.sin(this.ia) * accel * dt;

        // Light drag so the ship decelerates naturally when throttle is off
        const drag = Math.pow(0.88, dt);
        this.iv.x *= drag;
        this.iv.y *= drag;

        // Cap interior speed
        const spd    = vecLen(this.iv.x, this.iv.y);
        const maxSpd = 100;
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

        // Check landing on any unoccupied pad (not just the assigned one)
        if (!this.onPad) {
            for (const pad of st.pads) {
                // Skip pads occupied by AI ships
                if (pad.occupied && pad.shipId !== 'player') continue;
                const dx = this.ip.x - pad.x;
                const dy = this.ip.y - pad.y;
                if (Math.hypot(dx, dy) < 34 && spd < 40) {
                    // If landing on a different pad than assigned, re-assign
                    if (this.assignedPad && this.assignedPad.id !== pad.id) {
                        st.releasePad('player');
                        pad.occupied = true;
                        pad.shipId   = 'player';
                        this.assignedPad = pad;
                    } else if (!this.assignedPad) {
                        pad.occupied = true;
                        pad.shipId   = 'player';
                        this.assignedPad = pad;
                    }
                    this.onPad    = true;
                    this.iv       = { x: 0, y: 0 };
                    ship.throttle = 0;
                    this.game.state = 'LANDED';
                    this.showMsg(`LANDED – PAD ${pad.id}  [T] TRADE   [Q] TAKE OFF`, 8);
                    break;
                }
            }
        }

        if (input.justDown('KeyQ')) this.abort();
    }

    // ── Takeoff from pad → back to flying inside ──────────────────────────────

    takeoff() {
        // Release the pad so other ships can use it
        if (this.targetStation && this.assignedPad) {
            this.targetStation.releasePad('player');
            this.assignedPad = null;
        }
        this.onPad = false;
        this.iv    = { x: 0, y: -55 };   // gentle upward kick off the pad
        this.game.ship.throttle = 0;
        this.game.state = 'INSIDE';
        this.showMsg('ENGINES ONLINE – [Q] EXIT STATION', 3);
    }

    // ── Abort / Depart (exits station back to space) ──────────────────────────

    abort() {
        if (this.targetStation && this.assignedPad) {
            this.targetStation.releasePad('player');
        }

        const { ship } = this.game;
        if (this.targetStation) {
            const a        = Math.random() * Math.PI * 2;
            // Place ship well outside APPROACH_RANGE so it doesn't immediately re-dock
            const spawnR   = CONF.APPROACH_RANGE * 1.3;
            ship.x  = this.targetStation.x + Math.cos(a) * spawnR;
            ship.y  = this.targetStation.y + Math.sin(a) * spawnR;
            ship.vx = Math.cos(a) * 400;
            ship.vy = Math.sin(a) * 400;
        }
        ship.throttle      = 0;
        this.targetStation = null;
        this.assignedPad   = null;
        this.stationCommsRows  = [];
        this.stationCommsTimer = 0;
        this.onPad         = false;
        this.holdTimer     = 0;
        this.game.state    = 'SPACE';
    }

    depart() { this.abort(); }
}
