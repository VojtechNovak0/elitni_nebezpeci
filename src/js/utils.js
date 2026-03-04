// utils.js – Math helpers and utilities

function lerp(a, b, t)       { return a + (b - a) * t; }
function clamp(v, lo, hi)    { return Math.max(lo, Math.min(hi, v)); }
function dist(ax, ay, bx, by){ return Math.hypot(bx - ax, by - ay); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function vecLen(vx, vy)      { return Math.hypot(vx, vy); }

function normalizeAngle(a) {
    while (a >  Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
}

// Logarithmic throttle → acceleration
// throttle [0,1] → [0, CONF.THRUST] on log10 scale
// Gives: low throttle = very responsive, high throttle = diminishing returns
function throttleToAccel(t) {
    if (t <= 0) return 0;
    return CONF.THRUST * Math.log10(1 + t * 9);
}

// Seeded deterministic random number generator (LCG)
class SeededRNG {
    constructor(seed) { this.s = seed >>> 0; }
    next()            {
        this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0;
        return this.s / 0x100000000;
    }
    range(lo, hi) { return lo + this.next() * (hi - lo); }
    int(lo, hi)   { return Math.floor(this.range(lo, hi + 1)); }
}

function formatSpeed(speed) {
    const c = speed / CONF.C;
    if (c < 0.01) return `${speed.toFixed(0)} u/s`;
    if (c < 10)   return `${c.toFixed(2)}c`;
    return `${c.toFixed(0)}c`;
}

function formatDist(d) {
    if (d < 1000)      return `${d.toFixed(0)} u`;
    if (d < 1_000_000) return `${(d / 1000).toFixed(1)}k u`;
    return `${(d / 1_000_000).toFixed(2)}M u`;
}
