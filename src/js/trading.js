// trading.js – Trading system and market UI
class Trading {
    constructor(game) {
        this.game    = game;
        this.credits = CONF.START_CREDITS;
        this.cargo   = {}; // good name → quantity
        this._row    = 0;
    }

    get cargoSize() { return Object.values(this.cargo).reduce((a, b) => a + b, 0); }
    get freeSpace()  { return CONF.HOLD_CAP - this.cargoSize; }

    buy(good, amount = 1) {
        const st = this.game.docking.targetStation;
        if (!st) return;
        const price = st.prices[good];
        amount = Math.min(amount, st.inventory[good], this.freeSpace, Math.floor(this.credits / price));
        if (amount <= 0) return;
        st.inventory[good]  -= amount;
        this.credits        -= price * amount;
        this.cargo[good]     = (this.cargo[good] || 0) + amount;
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
    }

    // Called every frame when state === 'TRADING'
    handleInput() {
        const inp = this.game.input;
        if (inp.justDown('ArrowUp')   || inp.justDown('KeyW'))
            this._row = (this._row - 1 + GOODS.length) % GOODS.length;
        if (inp.justDown('ArrowDown') || inp.justDown('KeyS'))
            this._row = (this._row + 1) % GOODS.length;
        if (inp.justDown('KeyB')) this.buy(GOODS[this._row]);
        if (inp.justDown('KeyV')) this.sell(GOODS[this._row]);
        if (inp.justDown('KeyQ') || inp.justDown('KeyT'))
            this.game.state = 'LANDED';
    }

    render(ctx) {
        const W = CONF.W, H = CONF.H;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = '#000';
        ctx.lineWidth   = 2;
        ctx.strokeRect(30, 30, W - 60, H - 60);

        const st = this.game.docking.targetStation;
        const stName = st ? st.name.toUpperCase() : '???';

        ctx.fillStyle   = '#000';
        ctx.font        = 'bold 22px "Courier New", monospace';
        ctx.textAlign   = 'center';
        ctx.fillText(`── ${stName} · MARKET ──`, W / 2, 74);

        ctx.font = '13px "Courier New", monospace';
        ctx.fillText(`CREDITS: ${this.credits} Cr   │   CARGO: ${this.cargoSize} / ${CONF.HOLD_CAP}`, W / 2, 100);
        ctx.fillText('[↑↓] SELECT   [B] BUY 1   [V] SELL 1   [Q / T] CLOSE', W / 2, 118);

        // Separator
        ctx.beginPath();
        ctx.moveTo(40, 128); ctx.lineTo(W - 40, 128);
        ctx.stroke();

        // Column headers
        ctx.textAlign = 'left';
        ctx.font = 'bold 13px "Courier New", monospace';
        const col = [60, 290, 400, 510, 620, 730];
        ctx.fillText('COMMODITY',  col[0], 152);
        ctx.fillText('PRICE',      col[1], 152);
        ctx.fillText('STOCK',      col[2], 152);
        ctx.fillText('OWNED',      col[3], 152);
        ctx.fillText('MAX BUY',    col[4], 152);

        ctx.beginPath();
        ctx.moveTo(40, 160); ctx.lineTo(W - 40, 160);
        ctx.stroke();

        if (!st) return;

        ctx.font = '13px "Courier New", monospace';
        for (let i = 0; i < GOODS.length; i++) {
            const g     = GOODS[i];
            const y     = 184 + i * 28;
            const price = st.prices[g];
            const stock = st.inventory[g];
            const owned = this.cargo[g] || 0;
            const maxB  = Math.min(stock, this.freeSpace, Math.floor(this.credits / price));

            if (i === this._row) {
                ctx.fillStyle = '#000';
                ctx.fillRect(40, y - 16, W - 80, 24);
                ctx.fillStyle = '#fff';
            } else {
                ctx.fillStyle = '#000';
            }

            ctx.fillText(g,                        col[0], y);
            ctx.fillText(`${price} Cr`,            col[1], y);
            ctx.fillText(stock,                    col[2], y);
            ctx.fillText(owned,                    col[3], y);
            ctx.fillText(maxB > 0 ? maxB : '─',   col[4], y);
        }
    }
}
