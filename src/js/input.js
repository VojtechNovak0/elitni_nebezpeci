// input.js – Keyboard input handler
class Input {
    constructor() {
        this.keys = {};
        this.prev = {};
        const CAPTURE = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab','Space'];
        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            if (CAPTURE.includes(e.code)) e.preventDefault();
        });
        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
        });
    }

    // Must be called once per frame (at the top of update)
    update() { this.prev = { ...this.keys }; }

    isDown(code)   { return !!this.keys[code]; }
    justDown(code) { return !!this.keys[code] && !this.prev[code]; }
    justUp(code)   { return !this.keys[code]  && !!this.prev[code]; }
}
