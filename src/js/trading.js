// trading.js – Trading system and market UI
class Trading {
    constructor(game) {
        this.game    = game;
        this.credits = CONF.START_CREDITS;
        this.cargo   = {}; // good name → quantity

        // UI state
        this._tab  = 'MARKET';  // 'MARKET' | 'UPGRADES'
        this._row  = 0;
        this._uRow = 0;
    }

    get cargoSize() { return Object.values(this.cargo).reduce((a, b) => a + b, 0); }
    get freeSpace()  { return this.game.ship.holdCap - this.cargoSize; }

    // ── Market: buy/sell goods ─────────────────────────────────────────────────

    buy(good, amount = 1) {
        const st = this.game.docking.targetStation;
        if (!st) return;
        if (st.inventory[good] <= 0) return;

        // Buying Fuel fills the ship tank directly (no cargo slot used)
        if (good === 'Fuel') {
            const ship     = this.game.ship;
            const price    = st.prices[good];
            const canBuy   = Math.floor(this.credits / price);
            // Each unit bought = 5 ship fuel
            const fuelNeed = Math.ceil((ship.maxFuel - ship.fuel) / 5);
            amount = Math.min(amount, st.inventory[good], canBuy, fuelNeed);
            if (amount <= 0) return;
            st.inventory[good] -= amount;
            this.credits       -= price * amount;
            ship.fuel           = Math.min(ship.maxFuel, ship.fuel + amount * 5);
            SaveGame.save(this.game);
            return;
        }

        const price = st.prices[good];
        amount = Math.min(amount, st.inventory[good], this.freeSpace, Math.floor(this.credits / price));
        if (amount <= 0) return;
        st.inventory[good]  -= amount;
        this.credits        -= price * amount;
        this.cargo[good]     = (this.cargo[good] || 0) + amount;
        SaveGame.save(this.game);
    }

    sell(good, amount = 1) {
        const st = this.game.docking.targetStation;
        if (!st) return;
        const owned = this.cargo[good] || 0;
        amount = Math.min(amount, owned);
        if (amount <= 0) return;
        st.inventory[good]  += amount;
        this.credits        += st.prices[good] * amount;
        this.cargo[good]    -= amount;
        if (!this.cargo[good]) delete this.cargo[good];
        SaveGame.save(this.game);
    }

    // ── Upgrades: buy ship upgrades ────────────────────────────────────────────

    buyUpgrade(upgradeId) {
        const ship = this.game.ship;
        const st   = this.game.docking.targetStation;
        const def  = CONF.SHIP_UPGRADES.find(u => u.id === upgradeId);
        if (!def || !st) return 'ERR';
        if (!st.availableUpgrades.includes(upgradeId)) return 'NOT_SOLD';
        if (ship.hasUpgrade(upgradeId)) return 'OWNED';
        if (def.requires && !ship.hasUpgrade(def.requires)) return 'REQ';
        if (this.credits < def.cost) return 'NO_CR';
        this.credits -= def.cost;
        ship.installUpgrade(upgradeId);
        SaveGame.save(this.game);
        return 'OK';
    }

    // ── Fuel: refuel shortcut ──────────────────────────────────────────────────

    refuel(units) {
        const ship  = this.game.ship;
        const st    = this.game.docking.targetStation;
        if (!st) return;
        const maxAdd  = ship.maxFuel - ship.fuel;
        const canPay  = Math.floor(this.credits / st.fuelPrice);
        const unitsOk = Math.min(units, maxAdd, canPay);
        if (unitsOk <= 0) return;
        this.credits -= unitsOk * st.fuelPrice;
        ship.fuel    += unitsOk;
        SaveGame.save(this.game);
    }

    // ── Input ─────────────────────────────────────────────────────────────────

    handleInput() {
        const inp = this.game.input;
        const st  = this.game.docking.targetStation;
        const upgs = st ? CONF.SHIP_UPGRADES.filter(u => st.availableUpgrades.includes(u.id)) : [];

        // Switch tab with Tab key
        if (inp.justDown('Tab')) {
            this._tab  = this._tab === 'MARKET' ? 'UPGRADES' : 'MARKET';
            this._row  = 0;
            this._uRow = 0;
        }

        if (this._tab === 'MARKET') {
            if (inp.justDown('ArrowUp')   || inp.justDown('KeyW'))
                this._row = (this._row - 1 + GOODS.length) % GOODS.length;
            if (inp.justDown('ArrowDown'))
                this._row = (this._row + 1) % GOODS.length;
            if (inp.justDown('KeyB')) this.buy(GOODS[this._row]);
            if (inp.justDown('KeyS')) this.sell(GOODS[this._row]);
            // R = refuel 10 units at a time
            if (inp.justDown('KeyR')) this.refuel(10);
        } else {
            const maxRow = Math.max(0, upgs.length - 1);
            if (inp.justDown('ArrowUp')   || inp.justDown('KeyW'))
                this._uRow = Math.max(0, this._uRow - 1);
            if (inp.justDown('ArrowDown'))
                this._uRow = Math.min(maxRow, this._uRow + 1);
            if (inp.justDown('KeyB') && upgs.length > 0)
                this.buyUpgrade(upgs[this._uRow].id);
        }

        if (inp.justDown('KeyQ') || inp.justDown('Escape'))
            this.game.state = 'LANDED';
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    render(ctx) {
        const W = CONF.W, H = CONF.H;
        const st   = this.game.docking.targetStation;
        const ship = this.game.ship;

        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, W, H);

        // Border
        ctx.strokeStyle = '#000';
        ctx.lineWidth   = 2;
        ctx.strokeRect(30, 30, W - 60, H - 60);

        // Station name + type
        const stName = st ? st.name.toUpperCase() : '???';
        const stType = st ? TYPE_LABEL[st.type] : '';
        ctx.fillStyle = '#000';
        ctx.font = 'bold 22px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`── ${stName} ──`, W / 2, 70);

        if (st) {
            ctx.fillStyle = stationTypeColor(st.type);
            ctx.font = 'bold 12px "Courier New", monospace';
            ctx.fillText(`[ ${stType} ]`, W / 2, 90);
        }

        // Credits / cargo / fuel
        ctx.fillStyle = '#000';
        ctx.font = '13px "Courier New", monospace';
        ctx.fillText(
            `CREDITS: ${this.credits} Cr   │   CARGO: ${this.cargoSize}/${ship.holdCap}   │   FUEL: ${ship.fuel.toFixed(0)}/${ship.maxFuel}`,
            W / 2, 108
        );

        // Tab headers
        const tabY = 128;
        this._drawTab(ctx, W / 2 - 100, tabY, 'MARKET',   this._tab === 'MARKET');
        this._drawTab(ctx, W / 2 +  10, tabY, 'UPGRADES', this._tab === 'UPGRADES');

        // Separator
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, tabY + 14); ctx.lineTo(W - 40, tabY + 14);
        ctx.stroke();

        if (this._tab === 'MARKET') {
            this._renderMarket(ctx, st, ship, tabY + 24);
        } else {
            this._renderUpgrades(ctx, st, ship, tabY + 24);
        }
    }

    _drawTab(ctx, x, y, label, active) {
        ctx.fillStyle   = active ? '#000' : '#aaa';
        ctx.strokeStyle = active ? '#000' : '#ccc';
        ctx.lineWidth   = active ? 2 : 1;
        ctx.font = (active ? 'bold ' : '') + '13px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, x + 45, y);
        if (active) {
            ctx.beginPath();
            ctx.moveTo(x + 3, y + 4); ctx.lineTo(x + 87, y + 4);
            ctx.stroke();
        }
    }

    _renderMarket(ctx, st, ship, startY) {
        const W = CONF.W;
        ctx.fillStyle = '#555';
        ctx.font = '11px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[↑↓] SELECT   [B] BUY 1   [S] SELL 1   [R] REFUEL +10   [TAB] UPGRADES   [Q] CLOSE', W / 2, startY + 2);

        // Fuel refuel info
        if (st) {
            const fuelNeed  = ship.maxFuel - ship.fuel;
            const refuelCr  = Math.ceil(fuelNeed) * st.fuelPrice;
            ctx.fillStyle = fuelNeed < 1 ? '#888' : '#c60';
            ctx.fillText(`FUEL TANK: ${ship.fuel.toFixed(1)}/${ship.maxFuel}  ·  REFUEL COST: ${st.fuelPrice} Cr/unit  ·  FULL TANK ≈ ${refuelCr} Cr`, W / 2, startY + 18);
        }

        const colBase = startY + 36;

        // Column headers
        ctx.textAlign = 'left';
        ctx.font = 'bold 13px "Courier New", monospace';
        ctx.fillStyle = '#000';
        const col = [60, 290, 400, 510, 620, 730];
        ctx.fillText('COMMODITY', col[0], colBase);
        ctx.fillText('PRICE',     col[1], colBase);
        ctx.fillText('STOCK',     col[2], colBase);
        ctx.fillText('OWNED',     col[3], colBase);
        ctx.fillText('MAX BUY',   col[4], colBase);

        ctx.beginPath();
        ctx.moveTo(40, colBase + 8); ctx.lineTo(W - 40, colBase + 8);
        ctx.stroke();

        if (!st) return;

        ctx.font = '13px "Courier New", monospace';
        for (let i = 0; i < GOODS.length; i++) {
            const g     = GOODS[i];
            const y     = colBase + 28 + i * 26;
            const price = st.prices[g];
            const stock = st.inventory[g];
            const excluded = TYPE_EXCLUDED[st.type]?.includes(g);

            // For Fuel: cargo shows fuel refill units, not cargo owned
            let owned, maxB;
            if (g === 'Fuel') {
                const fuelUnits = Math.floor((ship.maxFuel - ship.fuel) / 5);
                owned = `${ship.fuel.toFixed(0)}/${ship.maxFuel}`;
                maxB  = Math.min(stock, fuelUnits, Math.floor(this.credits / price));
            } else {
                owned = this.cargo[g] || 0;
                maxB  = excluded ? 0 : Math.min(stock, this.freeSpace, Math.floor(this.credits / price));
            }

            if (i === this._row) {
                ctx.fillStyle = '#000';
                ctx.fillRect(40, y - 16, W - 80, 22);
                ctx.fillStyle = '#fff';
            } else {
                ctx.fillStyle = excluded ? '#ccc' : '#000';
            }

            ctx.fillText(g,                         col[0], y);
            ctx.fillText(`${price} Cr`,             col[1], y);
            ctx.fillText(excluded ? '─' : stock,   col[2], y);
            ctx.fillText(owned,                     col[3], y);
            ctx.fillText((!excluded && maxB > 0) ? maxB : '─', col[4], y);
        }
    }

    _renderUpgrades(ctx, st, ship, startY) {
        const W   = CONF.W;
        const upgs = st ? CONF.SHIP_UPGRADES.filter(u => st.availableUpgrades.includes(u.id)) : [];

        ctx.fillStyle = '#555';
        ctx.font = '11px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[↑↓] SELECT   [B] BUY UPGRADE   [TAB] MARKET   [Q] CLOSE', W / 2, startY + 2);

        if (!st || upgs.length === 0) {
            ctx.fillStyle = '#888';
            ctx.font = '14px "Courier New", monospace';
            ctx.fillText('No upgrades available at this station.', W / 2, startY + 80);
            return;
        }

        const col = [80, 320, 460, 620];
        const colBase = startY + 24;

        ctx.textAlign = 'left';
        ctx.font = 'bold 13px "Courier New", monospace';
        ctx.fillStyle = '#000';
        ctx.fillText('UPGRADE',     col[0], colBase);
        ctx.fillText('COST',        col[1], colBase);
        ctx.fillText('STATUS',      col[2], colBase);
        ctx.fillText('EFFECT',      col[3], colBase);

        ctx.beginPath();
        ctx.moveTo(40, colBase + 8); ctx.lineTo(W - 40, colBase + 8);
        ctx.stroke();

        ctx.font = '13px "Courier New", monospace';
        for (let i = 0; i < upgs.length; i++) {
            const u   = CONF.SHIP_UPGRADES.find(x => x.id === upgs[i].id);
            const y   = colBase + 28 + i * 30;
            const owned   = ship.hasUpgrade(u.id);
            const canReq  = !u.requires || ship.hasUpgrade(u.requires);
            const canPay  = this.credits >= u.cost;
            const canBuy  = !owned && canReq && canPay;

            if (i === this._uRow) {
                ctx.fillStyle = '#000';
                ctx.fillRect(40, y - 18, W - 80, 26);
                ctx.fillStyle = '#fff';
            } else {
                ctx.fillStyle = owned ? '#888' : (!canReq ? '#bbb' : '#000');
            }

            ctx.fillText(u.name, col[0], y);
            ctx.fillText(`${u.cost} Cr`, col[1], y);

            let status = '─';
            if (owned)       status = '✓ INSTALLED';
            else if (!canReq) status = `REQ: ${u.requires}`;
            else if (!canPay) status = 'NO CR';
            else              status = 'AVAILABLE';

            ctx.fillText(status, col[2], y);
            ctx.fillText(u.desc, col[3], y);
        }
    }
}
