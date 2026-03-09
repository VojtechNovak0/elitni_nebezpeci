// input.js – Keyboard input handler
class Input {
    constructor() {
        this.keys = {};
        this.prev = {};
        this._wheelAcc  = 0;   // accumulated raw deltaY between frames
        this.wheelDelta = 0;   // exposed per-frame wheel delta (reset each update)

        const CAPTURE = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab','Space'];
        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            if (CAPTURE.includes(e.code)) e.preventDefault();
        });
        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
        });
        window.addEventListener('wheel', e => {
            this._wheelAcc += e.deltaY;
            e.preventDefault();
        }, { passive: false });
    }

    // Must be called once per frame (at the top of update)
    update() {
        this.prev       = { ...this.keys };
        this.wheelDelta = this._wheelAcc;
        this._wheelAcc  = 0;
    }

    isDown(code)   { return !!this.keys[code]; }
    justDown(code) { return !!this.keys[code] && !this.prev[code]; }
    justUp(code)   { return !this.keys[code]  && !!this.prev[code]; }
}
