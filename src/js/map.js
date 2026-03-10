// map.js – Galaxy map overlay (press M in space or inside station)

class GalaxyMap {
    constructor(game) {
        this.game     = game;
        this._selIdx  = 0;
        this._prevState = 'SPACE';
    }

    open(fromState) {
        this._prevState = fromState || 'SPACE';
        this._selIdx    = this.game.universe.selectedWaypointIdx;
        this.game.state = 'MAP';
    }

    close() {
        this.game.state = this._prevState;
    }

    handleInput() {
        const inp      = this.game.input;
        const universe = this.game.universe;
        const n        = universe.stations.length;

        if (inp.justDown('KeyM') || inp.justDown('KeyQ') || inp.justDown('Escape'))
            return this.close();

        if (n === 0) return;

        if (inp.justDown('ArrowDown') || inp.justDown('KeyS'))
            this._selIdx = (this._selIdx + 1) % n;
        if (inp.justDown('ArrowUp') || inp.justDown('KeyW'))
            this._selIdx = (this._selIdx - 1 + n) % n;

        // Enter or F – set as navigation waypoint
        if (inp.justDown('Enter') || inp.justDown('KeyF'))
            universe.selectedWaypointIdx = this._selIdx;

        // Tab – also set waypoint and close
        if (inp.justDown('Tab')) {
            universe.selectedWaypointIdx = this._selIdx;
            this.close();
        }
    }

    render(ctx) {
        const W = CONF.W, H = CONF.H;
        const { ship, universe } = this.game;
        const stations = universe.stations;

        // ── Dark space background ─────────────────────────────────────────────
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, W, H);

        // ── Title ─────────────────────────────────────────────────────────────
        ctx.fillStyle = '#aabbff';
        ctx.font = 'bold 20px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('── GALAXY MAP ──', W / 2, 30);

        // ── Layout ────────────────────────────────────────────────────────────
        const LIST_W = 280;
        const mapX   = 12;
        const mapY   = 48;
        const mapW   = W - LIST_W - 30;
        const mapH   = H - 72;

        // Map frame
        ctx.strokeStyle = '#223355';
        ctx.lineWidth   = 1;
        ctx.strokeRect(mapX, mapY, mapW, mapH);

        if (stations.length === 0) {
            ctx.fillStyle = '#556';
            ctx.font = '14px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('No stations discovered yet', mapX + mapW / 2, mapY + mapH / 2);
        } else {
            // Compute world bounds (include player)
            let minX = ship.x, maxX = ship.x, minY = ship.y, maxY = ship.y;
            for (const st of stations) {
                minX = Math.min(minX, st.x); maxX = Math.max(maxX, st.x);
                minY = Math.min(minY, st.y); maxY = Math.max(maxY, st.y);
            }
            const margin = Math.max((maxX - minX) * 0.1, 500);
            minX -= margin; maxX += margin;
            minY -= margin; maxY += margin;

            const wRange = maxX - minX || 1;
            const hRange = maxY - minY || 1;
            const padPx  = 28;
            const scale  = Math.min(
                (mapW - padPx * 2) / wRange,
                (mapH - padPx * 2) / hRange
            );
            // Centre the world in the map area
            const offX = mapX + mapW / 2 - (minX + wRange / 2) * scale;
            const offY = mapY + mapH / 2 - (minY + hRange / 2) * scale;

            const toSX = wx => offX + wx * scale;
            const toSY = wy => offY + wy * scale;

            // Clip to map area
            ctx.save();
            ctx.beginPath();
            ctx.rect(mapX + 1, mapY + 1, mapW - 2, mapH - 2);
            ctx.clip();

            // Subtle grid
            ctx.strokeStyle = '#0d1830';
            ctx.lineWidth   = 0.5;
            const gridStep = [500, 1000, 2000, 5000, 10000, 50000].find(g => g * scale > 40) || 50000;
            const gx0 = Math.floor(minX / gridStep) * gridStep;
            const gy0 = Math.floor(minY / gridStep) * gridStep;
            for (let gx = gx0; gx <= maxX; gx += gridStep) {
                ctx.beginPath();
                ctx.moveTo(toSX(gx), mapY);
                ctx.lineTo(toSX(gx), mapY + mapH);
                ctx.stroke();
            }
            for (let gy = gy0; gy <= maxY; gy += gridStep) {
                ctx.beginPath();
                ctx.moveTo(mapX, toSY(gy));
                ctx.lineTo(mapX + mapW, toSY(gy));
                ctx.stroke();
            }

            // Draw player→waypoint line
            const wp = universe.selectedWaypoint;
            if (wp) {
                ctx.strokeStyle = '#334455';
                ctx.lineWidth   = 1;
                ctx.setLineDash([4, 6]);
                ctx.beginPath();
                ctx.moveTo(toSX(ship.x), toSY(ship.y));
                ctx.lineTo(toSX(wp.x),   toSY(wp.y));
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Draw stations
            for (let i = 0; i < stations.length; i++) {
                const st    = stations[i];
                const sx    = toSX(st.x);
                const sy    = toSY(st.y);
                const isWP  = i === universe.selectedWaypointIdx;
                const isSel = i === this._selIdx;
                const col   = stationTypeColor(st.type);

                // Station dot
                ctx.fillStyle = col;
                ctx.beginPath();
                ctx.arc(sx, sy, isSel || isWP ? 5 : 3, 0, Math.PI * 2);
                ctx.fill();

                // Active waypoint ring (yellow, pulsing)
                if (isWP) {
                    ctx.strokeStyle = '#ffee00';
                    ctx.lineWidth   = 2;
                    ctx.beginPath();
                    ctx.arc(sx, sy, 10, 0, Math.PI * 2);
                    ctx.stroke();
                }

                // Map-cursor ring (cyan)
                if (isSel) {
                    ctx.strokeStyle = '#00ccff';
                    ctx.lineWidth   = 1.5;
                    ctx.beginPath();
                    ctx.arc(sx, sy, isWP ? 15 : 10, 0, Math.PI * 2);
                    ctx.stroke();
                }

                // Label for selection or waypoint
                if (isSel || isWP) {
                    ctx.fillStyle = isSel ? '#00ccff' : '#ffee00';
                    ctx.font      = '9px "Courier New", monospace';
                    ctx.textAlign = 'left';
                    ctx.fillText(st.name, sx + 14, sy + 3);
                }
            }

            // Draw origin marker
            const ox = toSX(0), oy = toSY(0);
            if (ox > mapX && ox < mapX + mapW && oy > mapY && oy < mapY + mapH) {
                ctx.strokeStyle = '#334';
                ctx.lineWidth   = 1;
                ctx.beginPath();
                ctx.moveTo(ox - 5, oy); ctx.lineTo(ox + 5, oy);
                ctx.moveTo(ox, oy - 5); ctx.lineTo(ox, oy + 5);
                ctx.stroke();
            }

            // Draw player ship
            const psx = toSX(ship.x);
            const psy = toSY(ship.y);
            ctx.save();
            ctx.translate(psx, psy);
            ctx.rotate(ship.angle);
            ctx.fillStyle = '#00ff88';
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(-5, -4);
            ctx.lineTo(-3, 0);
            ctx.lineTo(-5, 4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            ctx.restore(); // unclip
        }

        // ── Station list (right panel) ────────────────────────────────────────
        const listX = mapX + mapW + 18;
        const listW = LIST_W - 8;

        ctx.fillStyle = '#aabbff';
        ctx.font = 'bold 12px "Courier New", monospace';
        ctx.textAlign = 'left';
        ctx.fillText('STATIONS', listX, mapY + 14);

        const rowH    = 19;
        const visible = Math.floor((mapH - 24) / rowH);
        const n       = stations.length;
        const start   = Math.max(0, Math.min(this._selIdx - Math.floor(visible / 2), n - visible));

        for (let i = start; i < Math.min(start + visible, n); i++) {
            const st    = stations[i];
            const d     = dist(ship.x, ship.y, st.x, st.y);
            const ry    = mapY + 24 + (i - start) * rowH;
            const isWP  = i === universe.selectedWaypointIdx;
            const isSel = i === this._selIdx;

            if (isSel) {
                ctx.fillStyle = '#152038';
                ctx.fillRect(listX - 4, ry - 13, listW + 4, rowH);
            }

            // Type icon
            const typeIcon = { TRADE: '◆', MILITARY: '★', INDUSTRIAL: '⬡', FUEL_DEPOT: '⊕' }[st.type] || '●';
            ctx.fillStyle = stationTypeColor(st.type);
            ctx.font = '10px "Courier New", monospace';
            ctx.textAlign = 'left';
            ctx.fillText(typeIcon, listX, ry);

            // Name
            const maxLen = 15;
            const name   = st.name.length > maxLen ? st.name.slice(0, maxLen - 1) + '…' : st.name;
            ctx.fillStyle = isWP ? '#ffee00' : isSel ? '#00ccff' : '#778899';
            ctx.font = (isSel || isWP) ? 'bold 10px "Courier New", monospace' : '10px "Courier New", monospace';
            ctx.fillText(name, listX + 14, ry);

            // Distance (right-aligned)
            ctx.fillStyle = '#445566';
            ctx.font = '9px "Courier New", monospace';
            ctx.textAlign = 'right';
            ctx.fillText(formatDist(d), listX + listW, ry);

            // Waypoint indicator
            if (isWP) {
                ctx.fillStyle = '#ffee00';
                ctx.textAlign = 'right';
                ctx.fillText('◈', listX + listW - 40, ry);
            }
            ctx.textAlign = 'left';
        }

        // Scrollbar hint
        if (n > visible) {
            const sbH   = (mapH - 24) * (visible / n);
            const sbTop = mapY + 24 + ((mapH - 24) * start / n);
            ctx.fillStyle = '#223355';
            ctx.fillRect(listX + listW + 2, mapY + 24, 4, mapH - 24);
            ctx.fillStyle = '#446688';
            ctx.fillRect(listX + listW + 2, sbTop, 4, sbH);
        }

        // ── Legend ────────────────────────────────────────────────────────────
        const legY = mapY + mapH + 14;
        ctx.font = '10px "Courier New", monospace';
        ctx.textAlign = 'left';
        [
            ['#88aaff', '◆ TRADE'],
            ['#ff8888', '★ MILITARY'],
            ['#ffaa44', '⬡ INDUSTRIAL'],
            ['#88ff99', '⊕ FUEL DEPOT'],
        ].forEach(([col, label], i) => {
            ctx.fillStyle = col;
            ctx.fillText(label, mapX + i * 135, legY);
        });

        // ── Controls hint ─────────────────────────────────────────────────────
        ctx.fillStyle = '#334466';
        ctx.textAlign = 'center';
        ctx.font = '10px "Courier New", monospace';
        ctx.fillText('[↑↓] BROWSE   [F / ENTER] SET WAYPOINT   [TAB] SET & CLOSE   [M / Q] CLOSE', W / 2, H - 8);
    }
}
