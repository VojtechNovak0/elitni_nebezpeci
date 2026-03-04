// renderer.js – Camera, StarField, and all canvas rendering

// ── Camera ────────────────────────────────────────────────────────────────────
class Camera {
    constructor() {
        this.x    = 0;
        this.y    = 0;
        this.zoom = CONF.BASE_ZOOM;
        this._tgt = CONF.BASE_ZOOM;
    }

    follow(tx, ty, dt) {
        const k = 1 - Math.pow(0.001, dt);
        this.x = lerp(this.x, tx, k);
        this.y = lerp(this.y, ty, k);
    }

    setTargetZoom(z) { this._tgt = z; }

    updateZoom(dt) {
        this.zoom = lerp(this.zoom, this._tgt, 1 - Math.pow(0.008, dt));
    }

    worldToScreen(wx, wy) {
        return {
            x: (wx - this.x) * this.zoom + CONF.W / 2,
            y: (wy - this.y) * this.zoom + CONF.H / 2,
        };
    }
}

// ── Star field (three parallax layers) ───────────────────────────────────────
class StarField {
    constructor() {
        this.layers = CONF.STAR_LAYERS.map(cfg => {
            const rng   = new SeededRNG(cfg.seed);
            const stars = Array.from({ length: cfg.count }, () => ({
                x: rng.next() * CONF.STAR_TILE,
                y: rng.next() * CONF.STAR_TILE,
            }));
            return { stars, parallax: cfg.parallax, size: cfg.size };
        });
    }

    render(ctx, camX, camY) {
        const W = CONF.W, H = CONF.H, T = CONF.STAR_TILE;
        ctx.fillStyle = '#000';

        for (const layer of this.layers) {
            const vcx = camX * layer.parallax;
            const vcy = camY * layer.parallax;

            for (const star of layer.stars) {
                // Wrap star into [0, T) relative to camera
                const bx = ((star.x - vcx) % T + T) % T;
                const by = ((star.y - vcy) % T + T) % T;

                // 2×2 tiling covers full screen (T=4000 >> W=1280)
                for (let dx = 0; dx <= 1; dx++) {
                    for (let dy = 0; dy <= 1; dy++) {
                        const px = bx - dx * T;
                        const py = by - dy * T;
                        if (px >= -2 && px <= W + 2 && py >= -2 && py <= H + 2)
                            ctx.fillRect(px, py, layer.size, layer.size);
                    }
                }
            }
        }
    }
}

// ── Main renderer ─────────────────────────────────────────────────────────────
class Renderer {
    constructor(game) {
        this.game      = game;
        this.starField = new StarField();
    }

    // ── SPACE view ────────────────────────────────────────────────────────────

    renderSpace(ctx) {
        const { ship, universe, camera } = this.game;
        const W = CONF.W, H = CONF.H;

        this.starField.render(ctx, camera.x, camera.y);

        // World-space pass: stations and AI ships
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.scale(camera.zoom, camera.zoom);
        ctx.translate(-camera.x, -camera.y);

        for (const st of universe.stations)
            this._drawStationBody(ctx, st, st === universe.selectedWaypoint);

        ctx.restore();

        // Screen-space AI ships (fixed 7px size at their screen positions)
        for (const ai of universe.aiShips)
            this._drawAIShipFixed(ctx, ai);

        // Screen-space labels
        for (const st of universe.stations)
            this._drawStationLabel(ctx, st, st === universe.selectedWaypoint);

        // Player ship always at screen centre (camera follows ship with lag)
        this._drawPlayerShipFixed(ctx, ship);
    }

    // Player ship at fixed pixel size, screen-space position
    _drawPlayerShipFixed(ctx, ship) {
        const scr = this.game.camera.worldToScreen(ship.x, ship.y);
        ctx.save();
        ctx.translate(scr.x, scr.y);
        ctx.rotate(ship.angle);

        const s = CONF.SHIP_SIZE;
        ctx.strokeStyle = '#000';
        ctx.lineWidth   = 1.5;
        ctx.fillStyle   = '#fff';

        ctx.beginPath();
        ctx.moveTo(s * 1.6,  0);
        ctx.lineTo(-s, -s * 0.75);
        ctx.lineTo(-s * 0.5,  0);
        ctx.lineTo(-s,  s * 0.75);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (ship.throttle > 0.03) {
            const fl = s * ship.throttle * 2.2;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.moveTo(-s * 0.5,  0);
            ctx.lineTo(-s * 0.5 - fl, -s * 0.20);
            ctx.lineTo(-s * 0.5 - fl,  s * 0.20);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }

    // AI ship at fixed pixel size
    _drawAIShipFixed(ctx, ai) {
        const scr = this.game.camera.worldToScreen(ai.x, ai.y);
        const W = CONF.W, H = CONF.H;
        if (scr.x < -20 || scr.x > W + 20 || scr.y < -20 || scr.y > H + 20) return;

        ctx.save();
        ctx.translate(scr.x, scr.y);
        ctx.rotate(ai.angle);

        const s = 7;
        ctx.strokeStyle = '#000';
        ctx.lineWidth   = 1;
        ctx.fillStyle   = '#ccc';

        ctx.beginPath();
        ctx.moveTo(s,  0);
        ctx.lineTo(-s, -s * 0.6);
        ctx.lineTo(-s * 0.5,  0);
        ctx.lineTo(-s,  s * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    _drawStationBody(ctx, st, isSelected) {
        ctx.save();
        ctx.translate(st.x, st.y);

        const minR  = 5  / this.game.camera.zoom;
        const ringR = Math.max(CONF.DOCK_RING_R, minR * 3);
        const lw    = Math.max(0.5, (isSelected ? 2.5 : 1.5) / this.game.camera.zoom);

        ctx.strokeStyle = '#000';
        ctx.fillStyle   = '#fff';
        ctx.lineWidth   = lw;

        // Station body (rotates with station)
        ctx.rotate(st.angle);
        const bw = ringR * 1.5, bh = ringR * 0.72;
        ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);

        // Docking ring with gap (gap always at local angle 0 = front)
        ctx.lineWidth = Math.max(0.5, (isSelected ? 3 : 2) / this.game.camera.zoom);
        ctx.beginPath();
        const halfGap = CONF.PORT_GAP / 2;
        ctx.arc(0, 0, ringR, halfGap, -halfGap + Math.PI * 2, false);
        ctx.stroke();

        // Small tick marks at gap edges
        ctx.lineWidth = lw * 0.8;
        [halfGap, -halfGap].forEach(a => {
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * ringR * 0.82, Math.sin(a) * ringR * 0.82);
            ctx.lineTo(Math.cos(a) * ringR * 1.18, Math.sin(a) * ringR * 1.18);
            ctx.stroke();
        });

        ctx.restore();
    }

    _drawStationLabel(ctx, st, isSelected) {
        const cam    = this.game.camera;
        const scr    = cam.worldToScreen(st.x, st.y);
        const ringR  = Math.max(CONF.DOCK_RING_R, 5 / cam.zoom);
        const labelY = scr.y - ringR * cam.zoom - 8;

        ctx.save();
        ctx.fillStyle = isSelected ? '#000' : '#666';
        ctx.font = isSelected
            ? 'bold 11px "Courier New", monospace'
            : '10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(st.name, scr.x, labelY);
        ctx.restore();
    }

    // ── APPROACH view ─────────────────────────────────────────────────────────

    renderApproach(ctx) {
        const { ship, docking } = this.game;
        const W = CONF.W, H = CONF.H;
        const st = docking.targetStation;
        if (!st) return;

        // Slow parallax in background
        this.starField.render(ctx, st.x * 0.12, st.y * 0.12);

        const cx = W / 2, cy = H / 2;
        const S  = CONF.APPROACH_SCALE;  // px per world unit

        // Station centred on screen
        ctx.save();
        ctx.translate(cx, cy);
        this._drawStationApproach(ctx, st);
        ctx.restore();

        // Ship at world position relative to station
        const relX = (ship.x - st.x) * S;
        const relY = (ship.y - st.y) * S;

        ctx.save();
        ctx.translate(cx + relX, cy + relY);
        ctx.rotate(ship.angle);

        const s = 9;
        ctx.strokeStyle = '#000';
        ctx.lineWidth   = 1.5;
        ctx.fillStyle   = '#fff';
        ctx.beginPath();
        ctx.moveTo(s * 1.6,  0);
        ctx.lineTo(-s, -s * 0.75);
        ctx.lineTo(-s * 0.5,  0);
        ctx.lineTo(-s,  s * 0.75);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (ship.throttle > 0.03) {
            const fl = s * ship.throttle * 2;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.moveTo(-s * 0.5, 0);
            ctx.lineTo(-s * 0.5 - fl, -s * 0.2);
            ctx.lineTo(-s * 0.5 - fl,  s * 0.2);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();

        // Station name (drawn in screen space, unrotated)
        const pr = CONF.DOCK_RING_R * CONF.APPROACH_SCALE;
        ctx.fillStyle = '#000';
        ctx.font      = 'bold 15px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(st.name, cx, cy - pr - 22);

        // Port status indicator
        const d2st = st.distTo(ship.x, ship.y);
        if (d2st < CONF.DOCK_RING_R * 2.5) {
            const open = st.isPortOpen(ship.x, ship.y);
            ctx.fillStyle  = '#000';
            ctx.font       = 'bold 14px "Courier New", monospace';
            ctx.textAlign  = 'center';
            ctx.fillText(open ? '[ PORT OPEN – ENTER NOW ]' : '[ PORT CLOSED – WAIT ]', W / 2, 56);
        }
    }

    _drawStationApproach(ctx, st) {
        const S  = CONF.APPROACH_SCALE;
        const pr = CONF.DOCK_RING_R * S;        // docking ring radius in pixels
        const bw = pr * 2.42;                   // body width
        const bh = pr * 0.88;                   // body height

        ctx.strokeStyle = '#000';
        ctx.fillStyle   = '#fff';
        ctx.lineWidth   = 2;

        // Rotate entire station
        ctx.rotate(st.angle);

        // Station body
        ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
        ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);

        // Interior grid lines
        ctx.lineWidth = 1;
        for (let i = 1; i < 5; i++) {
            const ix = -bw / 2 + bw / 5 * i;
            ctx.beginPath(); ctx.moveTo(ix, -bh / 2); ctx.lineTo(ix, bh / 2); ctx.stroke();
        }
        for (let i = 1; i < 3; i++) {
            const iy = -bh / 2 + bh / 3 * i;
            ctx.beginPath(); ctx.moveTo(-bw / 2, iy); ctx.lineTo(bw / 2, iy); ctx.stroke();
        }

        // Docking ring (gap at local angle 0)
        ctx.lineWidth = 4;
        ctx.beginPath();
        const halfGap = CONF.PORT_GAP / 2;
        ctx.arc(0, 0, pr, halfGap, -halfGap + Math.PI * 2, false);
        ctx.stroke();

        // Gap edge markers
        ctx.lineWidth = 2;
        [halfGap, -halfGap].forEach(a => {
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * (pr - 16), Math.sin(a) * (pr - 16));
            ctx.lineTo(Math.cos(a) * (pr + 16), Math.sin(a) * (pr + 16));
            ctx.stroke();
        });

    }

    // ── INSIDE view ───────────────────────────────────────────────────────────

    renderInside(ctx) {
        const { docking } = this.game;
        const W = CONF.W, H = CONF.H;
        const cx = W / 2, cy = H / 2;
        const st = docking.targetStation;
        if (!st) return;

        const IW = 548, IH = 444;

        // Interior floor
        ctx.fillStyle   = '#f2f2f2';
        ctx.strokeStyle = '#000';
        ctx.lineWidth   = 3;
        ctx.fillRect(cx - IW / 2, cy - IH / 2, IW, IH);
        ctx.strokeRect(cx - IW / 2, cy - IH / 2, IW, IH);

        // Station name header
        ctx.fillStyle = '#000';
        ctx.font = 'bold 13px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(st.name.toUpperCase(), cx, cy - IH / 2 - 26);
        ctx.fillText('INTERIOR', cx, cy - IH / 2 - 10);

        // Entrance slot at bottom
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 34, cy + IH / 2 - 5, 68, 10);
        ctx.fillStyle = '#aaa';
        ctx.fillRect(cx - 28, cy + IH / 2 - 3, 56, 5);

        // Blinking assigned pad
        const blink = Math.sin(docking._blinkTimer * 4) > 0;

        // Landing pads
        for (const pad of st.pads) {
            const px    = cx + pad.x;
            const py    = cy + pad.y;
            const isSel = docking.assignedPad?.id === pad.id;

            ctx.fillStyle   = isSel ? (blink ? '#cce' : '#dde') : '#e2e2e2';
            ctx.strokeStyle = '#000';
            ctx.lineWidth   = isSel ? 2.5 : 1;
            ctx.fillRect(px - 28, py - 22, 56, 44);
            ctx.strokeRect(px - 28, py - 22, 56, 44);

            // Pad number
            ctx.fillStyle = '#000';
            ctx.font = isSel ? 'bold 18px "Courier New"' : '15px "Courier New"';
            ctx.textAlign = 'center';
            ctx.fillText(pad.id, px, py + 7);

            // Small AI ship silhouette when pad occupied
            if (pad.occupied && pad.shipId !== 'player') {
                ctx.fillStyle = '#555';
                ctx.save();
                ctx.translate(px, py - 10);
                ctx.rotate(-Math.PI / 2);
                const s = 6;
                ctx.beginPath();
                ctx.moveTo(s * 1.4, 0);
                ctx.lineTo(-s, -s * 0.7);
                ctx.lineTo(-s * 0.5, 0);
                ctx.lineTo(-s,  s * 0.7);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        }

        // Player ship inside
        const px = cx + docking.ip.x;
        const py = cy + docking.ip.y;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(docking.ia);

        const s = 8;
        ctx.strokeStyle = '#000';
        ctx.lineWidth   = 1.5;
        ctx.fillStyle   = '#fff';
        ctx.beginPath();
        ctx.moveTo(s * 1.6,  0);
        ctx.lineTo(-s, -s * 0.75);
        ctx.lineTo(-s * 0.5,  0);
        ctx.lineTo(-s,  s * 0.75);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}
