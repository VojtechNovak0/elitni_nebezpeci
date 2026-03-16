// main.js – Game class and main loop

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx    = this.canvas.getContext('2d');
        this.canvas.width  = CONF.W;
        this.canvas.height = CONF.H;

        // Game state
        this.state = 'SPACE'; // SPACE | APPROACH | DOCKING_ANIM | INSIDE | LANDED | TRADING | MAP

        // Systems
        this.input    = new Input();
        this.camera   = new Camera();
        this.ship     = new PlayerShip(0, 0);
        this.universe = new Universe();
        this.docking  = new Docking(this);
        this.trading  = new Trading(this);
        this.hud      = new HUD(this);
        this.renderer = new Renderer(this);
        this.galaxyMap = new GalaxyMap(this);

        this._lastTime = 0;

        // Expose for browser console debugging
        window.game = this;
    }

    // ── Main loop ─────────────────────────────────────────────────────────────

    _loop(ts) {
        const dt = Math.min((ts - this._lastTime) / 1000, 0.05);
        this._lastTime = ts;
        this._update(dt);
        this._render();
        requestAnimationFrame(t => this._loop(t));
    }

    _update(dt) {
        switch (this.state) {
            case 'SPACE':        this._updateSpace(dt);               break;
            case 'APPROACH':     this.docking.updateApproach(dt);    break;
            case 'DOCKING_ANIM': this.docking.updateDockingAnim(dt); break;
            case 'INSIDE':       this.docking.updateInside(dt);      break;
            case 'LANDED':       this._updateLanded(dt);              break;
            case 'TRADING':      this.trading.handleInput();          break;
            case 'MAP':          this.galaxyMap.handleInput();        break;
        }
        // Must be at END of frame: keydown events fire between frames, so
        // copying keys→prev here lets justDown() correctly see new presses.
        this.input.update();
    }

    // ── SPACE ─────────────────────────────────────────────────────────────────

    _updateSpace(dt) {
        const { input, ship, camera, universe, docking } = this;

        if (input.isDown('ArrowLeft')  || input.isDown('KeyA')) ship.rotate(-CONF.ROT_SPEED * dt);
        if (input.isDown('ArrowRight') || input.isDown('KeyD')) ship.rotate( CONF.ROT_SPEED * dt);
        if (input.isDown('ArrowUp')    || input.isDown('KeyW')) ship.addThrottle( CONF.THROTTLE_RATE * dt);
        if (input.isDown('ArrowDown')  || input.isDown('KeyS')) ship.addThrottle(-CONF.THROTTLE_RATE * dt);
        if (input.justDown('KeyX'))  ship.throttle = 0;
        if (input.justDown('Tab'))   universe.cycleWaypoint();
        if (input.justDown('KeyM'))  this.galaxyMap.open('SPACE');

        // Mouse wheel controls throttle (forward = +, backward = -)
        if (input.wheelDelta !== 0)
            ship.addThrottle(-input.wheelDelta * 0.0005);

        ship.update(dt);

        if (ship.fuel <= 0) {
            const nearest = universe.nearestStation(ship.x, ship.y);
            docking.emergencyRescueToStation(nearest);
            return;
        }

        // Dynamic zoom: slow → zoomed in, fast → zoomed out
        const speedRatio = ship.speed / (ship.speed + CONF.ZOOM_SPEED_SCALE);
        const tgtZoom    = CONF.BASE_ZOOM * (1 - speedRatio * 0.9985);
        camera.setTargetZoom(Math.max(CONF.MIN_ZOOM, tgtZoom));

        // Ship is always fixed at screen centre – camera snaps instantly to ship
        camera.x = ship.x;
        camera.y = ship.y;
        camera.updateZoom(dt);

        universe.update(dt);
        universe.checkExpansion(ship.x, ship.y);
        docking.checkApproach(dt);
    }

    // ── LANDED ────────────────────────────────────────────────────────────────

    _updateLanded(dt) {
        const { input, docking } = this;
        if (docking.msgTimer > 0) docking.msgTimer -= dt;
        if (input.justDown('KeyT'))  this.state = 'TRADING';
        if (input.justDown('KeyM'))  this.galaxyMap.open('LANDED');
        if (input.justDown('KeyQ'))  docking.takeoff();   // take off → back to INSIDE
    }

    // ── Render ────────────────────────────────────────────────────────────────

    _render() {
        const ctx = this.ctx;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, CONF.W, CONF.H);

        switch (this.state) {
            case 'SPACE':
                this.renderer.renderSpace(ctx);
                this.hud.render(ctx);
                break;

            case 'APPROACH':
                this.renderer.renderApproach(ctx);
                this.hud.renderApproach(ctx);
                break;

            case 'DOCKING_ANIM':
                this.renderer.renderDockingAnim(ctx);
                break;

            case 'INSIDE':
            case 'LANDED':
                this.renderer.renderInside(ctx);
                this.hud.renderInside(ctx);
                break;

            case 'TRADING':
                this.renderer.renderInside(ctx);
                this.trading.render(ctx);
                break;

            case 'MAP':
                this.galaxyMap.render(ctx);
                break;
        }
    }

    start() {
        document.getElementById('gameCanvas').style.display = 'block';
        requestAnimationFrame(ts => {
            this._lastTime = ts;
            this._loop(ts);
        });
    }
}
