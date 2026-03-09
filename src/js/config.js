// config.js – All game constants
const CONF = {
    W: 1280, H: 720,

    // ── Ship ──────────────────────────────────────────────────────
    SHIP_SIZE:      12,       // fixed pixel half-size for rendering
    THRUST:         1800,     // max acceleration (units/s²)
    ROT_SPEED:      2.4,      // rotation (rad/s)
    MAX_SPEED:      120000,   // hard speed cap (units/s)
    THROTTLE_RATE:  1.5,      // throttle change per second

    // ── Camera ────────────────────────────────────────────────────
    BASE_ZOOM:      0.10,     // px/unit at 0 speed  (see ≈10k units wide)
    MIN_ZOOM:       0.000008, // fully zoomed out
    ZOOM_SPEED_SCALE: 12000,  // speed at which zoom halves

    // ── Universe ──────────────────────────────────────────────────
    INIT_STATIONS:     10,
    STATION_SPREAD:    8000,  // initial universe radius (units)
    STATION_MIN_GAP:   1500,  // minimum gap between stations
    EXPAND_THRESHOLD:  0.65,
    EXPAND_ADD:        5,

    // ── Speed display ─────────────────────────────────────────────
    C: 120,   // "speed of light" = 120 units/s for display

    // ── Docking ───────────────────────────────────────────────────
    APPROACH_RANGE:     520,   // world units – triggers approach mode
    APPROACH_MAX_SPEED: 1200,  // max speed to start docking
    DOCK_HOLD_TIME:     2.0,   // seconds to hold low speed
    DOCK_RING_R:        176,   // docking ring radius (world units)
    PORT_GAP:           0.50,  // gap angle in docking ring (rad)
    PORT_TOLERANCE:     0.14,  // extra angular tolerance
    APPROACH_SCALE:     0.875, // px per world unit in approach view

    // ── Station ───────────────────────────────────────────────────
    STATION_ROT_SPEED: 0.42,   // rad/s

    // ── Stars (parallax layers) ───────────────────────────────────
    STAR_TILE: 4000,
    STAR_LAYERS: [
        { count: 90,  parallax: 0.04, size: 1,   seed: 1337 },
        { count: 140, parallax: 0.18, size: 1.5, seed: 2674 },
        { count: 70,  parallax: 0.45, size: 2,   seed: 4011 },
    ],

    // ── Trade ─────────────────────────────────────────────────────
    HOLD_CAP:      40,
    START_CREDITS: 1200,

    // ── AI ────────────────────────────────────────────────────────
    AI_PER_STATION: 2,
};
