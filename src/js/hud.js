// hud.js – Heads-up display overlay
class HUD {
    constructor(game) { this.game = game; }

    // ── Space HUD ─────────────────────────────────────────────────────────────
    render(ctx) {
        const { ship, universe, docking, trading } = this.game;
        const W = CONF.W, H = CONF.H;
        ctx.save();

        const FONT  = '13px "Courier New", monospace';
        const FONTB = 'bold 13px "Courier New", monospace';
        ctx.font = FONT;

        // ── Left: flight data ────────────────────────────────────────────────
        ctx.fillStyle = '#000';
        ctx.textAlign = 'left';
        ctx.fillText(`SPD: ${formatSpeed(ship.speed)}`, 16, 26);
        ctx.fillText(`THR: ${(ship.throttle * 100).toFixed(0).padStart(3)}%`, 16, 44);
        ctx.fillText(`HDG: ${((ship.angle * 180 / Math.PI % 360 + 360) % 360).toFixed(0).padStart(3)}°`, 16, 62);

        // Logarithmic speed bar
        this._logBar(ctx, 16, 70, 160, 9, ship.speed, CONF.MAX_SPEED);

        // Hull & shields
        ctx.fillText('HUL', 16, 100);
        this._bar(ctx, 50, 91, 130, 9, ship.hull,    100);
        ctx.fillText('SHD', 16, 118);
        this._bar(ctx, 50, 109, 130, 9, ship.shields, 100);

        // ── Right: credits + cargo ────────────────────────────────────────────
        ctx.textAlign = 'right';
        ctx.fillText(`${trading.credits} Cr`,             W - 16, 26);
        ctx.fillText(`CARGO ${trading.cargoSize}/${CONF.HOLD_CAP}`, W - 16, 44);
        ctx.textAlign = 'left';

        // ── Centre top: selected waypoint ─────────────────────────────────────
        const wp = universe.selectedWaypoint;
        if (wp) {
            const d = dist(ship.x, ship.y, wp.x, wp.y);
            const a = angleTo(ship.x, ship.y, wp.x, wp.y);
            ctx.textAlign = 'center';
            ctx.font = FONTB;
            ctx.fillText(`◈ ${wp.name}`, W / 2, 24);
            ctx.font = FONT;
            ctx.fillText(formatDist(d), W / 2, 42);
            this._arrow(ctx, W / 2 + 84, 30, a - ship.angle + Math.PI / 2, 11);
            ctx.textAlign = 'left';
        }

        // ── Off-screen station markers ────────────────────────────────────────
        this._offScreenMarkers(ctx);

        // ── Speed gauge (bottom-right) ────────────────────────────────────────
        this._speedGauge(ctx);

        // ── Docking notification ──────────────────────────────────────────────
        if (docking.msgTimer > 0) {
            ctx.textAlign = 'center';
            ctx.font = 'bold 16px "Courier New", monospace';
            ctx.fillText(docking.msg, W / 2, H - 52);
            ctx.font = FONT;
            ctx.textAlign = 'left';
        }

        // ── Bottom hint ───────────────────────────────────────────────────────
        ctx.textAlign = 'center';
        ctx.fillStyle = '#777';
        ctx.font = '11px "Courier New", monospace';
        ctx.fillText('← → ROTATE   ↑ ↓ / SCROLL THROTTLE   X CUT ENGINE   TAB WAYPOINT', W / 2, H - 10);
        ctx.restore();
    }

    // ── Approach HUD ──────────────────────────────────────────────────────────
    renderApproach(ctx) {
        const { ship, docking } = this.game;
        const W = CONF.W, H = CONF.H;
        ctx.save();
        ctx.font = '13px "Courier New", monospace';
        ctx.fillStyle = '#000';

        ctx.textAlign = 'left';
        ctx.fillText(`SPD: ${formatSpeed(ship.speed)}`, 16, 26);
        ctx.fillText(`THR: ${(ship.throttle * 100).toFixed(0)}%`, 16, 44);
        if (docking.targetStation) {
            const d = docking.targetStation.distTo(ship.x, ship.y);
            ctx.fillText(`DIST: ${formatDist(d)}`, 16, 62);
        }

        if (docking.msgTimer > 0) {
            ctx.textAlign = 'center';
            ctx.font = 'bold 15px "Courier New", monospace';
            ctx.fillText(docking.msg, W / 2, H - 52);
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = '#777';
        ctx.font = '11px "Courier New", monospace';
        ctx.fillText('FLY INTO THE DOCKING RING TO ENTER   [Q] ABORT', W / 2, H - 10);
        ctx.restore();
    }

    // ── Inside / Landed HUD ───────────────────────────────────────────────────
    renderInside(ctx) {
        const { ship, docking, trading } = this.game;
        const W = CONF.W, H = CONF.H;
        ctx.save();
        ctx.font = '13px "Courier New", monospace';
        ctx.fillStyle = '#000';

        const spd = vecLen(docking.iv.x, docking.iv.y);
        ctx.textAlign = 'left';
        ctx.fillText(`SPD: ${spd.toFixed(0)} u/s`, 16, 26);
        ctx.fillText(`THR: ${(ship.throttle * 100).toFixed(0)}%`, 16, 44);
        if (docking.assignedPad)
            ctx.fillText(`TARGET PAD: ${docking.assignedPad.id}`, 16, 62);

        ctx.textAlign = 'right';
        ctx.fillText(`${trading.credits} Cr`, W - 16, 26);

        if (docking.msgTimer > 0) {
            ctx.textAlign = 'center';
            ctx.font = 'bold 15px "Courier New", monospace';
            ctx.fillText(docking.msg, W / 2, H - 52);
        }

        const hint = this.game.state === 'LANDED'
            ? '[T] TRADE   [Q] TAKE OFF'
            : 'FLY TO A LANDING PAD   [Q] EXIT STATION';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#777';
        ctx.font = '11px "Courier New", monospace';
        ctx.fillText(hint, W / 2, H - 10);
        ctx.restore();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    _speedGauge(ctx) {
        const { ship } = this.game;
        const W = CONF.W, H = CONF.H;

        // Semi-circle gauge in bottom-right corner, opening faces down
        const cx = W - 90;
        const cy = H - 38;
        const r  = 58;

        // Logarithmic speed ratio (0–1)
        const speedRatio = ship.speed > 0
            ? Math.log10(1 + ship.speed) / Math.log10(1 + CONF.MAX_SPEED)
            : 0;
        const thrRatio = ship.throttle;

        // Arc runs counter-clockwise from 180° (left) to 0° (right) = top half
        const arcStart = Math.PI;       // 180° – zero end
        const arcEnd   = 0;             // 0°   – max end

        ctx.save();
        ctx.lineCap = 'butt';

        // ── Outer speed arc ───────────────────────────────────────────────────
        // Background track
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth   = 9;
        ctx.beginPath();
        ctx.arc(cx, cy, r, arcStart, arcEnd, true);
        ctx.stroke();

        // Filled portion (counter-clockwise from start to (1-ratio) fraction)
        if (speedRatio > 0) {
            const fillEnd = Math.PI * (1 - speedRatio);
            ctx.strokeStyle = '#000';
            ctx.lineWidth   = 9;
            ctx.beginPath();
            ctx.arc(cx, cy, r, arcStart, fillEnd, true);
            ctx.stroke();
        }

        // ── Inner throttle arc ────────────────────────────────────────────────
        const ri = r - 16;
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth   = 5;
        ctx.beginPath();
        ctx.arc(cx, cy, ri, arcStart, arcEnd, true);
        ctx.stroke();

        if (thrRatio > 0) {
            const fillEnd = Math.PI * (1 - thrRatio);
            ctx.strokeStyle = '#555';
            ctx.lineWidth   = 5;
            ctx.beginPath();
            ctx.arc(cx, cy, ri, arcStart, fillEnd, true);
            ctx.stroke();
        }

        // ── Tick marks at 0%, 25%, 50%, 75%, 100% ────────────────────────────
        ctx.strokeStyle = '#000';
        ctx.lineWidth   = 1.5;
        for (let i = 0; i <= 4; i++) {
            const frac  = i / 4;
            const tickA = Math.PI * (1 - frac);   // angle at this fraction
            const cos   = Math.cos(tickA);
            const sin   = Math.sin(tickA);
            ctx.beginPath();
            ctx.moveTo(cx + cos * (r - 13), cy + sin * (r - 13));
            ctx.lineTo(cx + cos * (r + 2),  cy + sin * (r + 2));
            ctx.stroke();
        }

        // ── Needle ────────────────────────────────────────────────────────────
        const needleA = Math.PI * (1 - speedRatio);
        ctx.strokeStyle = '#000';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(needleA) * (r - 4), cy + Math.sin(needleA) * (r - 4));
        ctx.stroke();

        // Centre dot
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();

        // ── Labels ────────────────────────────────────────────────────────────
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.font      = 'bold 11px "Courier New", monospace';
        ctx.fillText(formatSpeed(ship.speed), cx, cy - 6);
        ctx.font      = '9px "Courier New", monospace';
        ctx.fillText('SPEED', cx, cy + 6);
        ctx.fillText(`THR ${(ship.throttle * 100).toFixed(0)}%`, cx, cy + 17);

        ctx.restore();
    }

    _logBar(ctx, x, y, w, h, value, max) {
        const ratio = value > 0 ? Math.log10(1 + value) / Math.log10(1 + max) : 0;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
        ctx.fillRect(x, y, w * ratio, h);
    }

    _bar(ctx, x, y, w, h, value, max) {
        const ratio = clamp(value / max, 0, 1);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
        ctx.fillRect(x, y, w * ratio, h);
    }

    _arrow(ctx, x, y, angle, size) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(-size * 0.55, size * 0.6);
        ctx.lineTo(0, size * 0.2);
        ctx.lineTo(size * 0.55, size * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    _offScreenMarkers(ctx) {
        const { universe } = this.game;
        const W = CONF.W, H = CONF.H;
        const cam = this.game.camera;
        const MARGIN = 22;

        for (const st of universe.stations) {
            const sx = (st.x - cam.x) * cam.zoom + W / 2;
            const sy = (st.y - cam.y) * cam.zoom + H / 2;
            if (sx > -10 && sx < W + 10 && sy > -10 && sy < H + 10) continue;

            const a  = angleTo(W / 2, H / 2, sx, sy);
            const ex = clamp(W / 2 + Math.cos(a) * (W / 2 - MARGIN), MARGIN, W - MARGIN);
            const ey = clamp(H / 2 + Math.sin(a) * (H / 2 - MARGIN), MARGIN, H - MARGIN);

            const isSel = st === universe.selectedWaypoint;
            ctx.save();
            ctx.translate(ex, ey);
            ctx.rotate(a + Math.PI / 2);
            ctx.strokeStyle = isSel ? '#000' : '#aaa';
            ctx.lineWidth   = isSel ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(0, -8);
            ctx.lineTo(-5, 5);
            ctx.lineTo(5, 5);
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        }
    }
}
