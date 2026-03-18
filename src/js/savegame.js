// savegame.js – Game save/load system

class SaveGame {
    static STORAGE_KEY = 'elitni_nebezpeci_save';

    static serialize(game) {
        const { ship, universe, trading, docking } = game;
        
        return {
            // Ship state
            ship: {
                x: ship.x,
                y: ship.y,
                vx: ship.vx,
                vy: ship.vy,
                angle: ship.angle,
                throttle: ship.throttle,
                hull: ship.hull,
                shields: ship.shields,
                fuel: ship.fuel,
                upgrades: Array.from(ship.upgrades),
            },
            // Trading state
            trading: {
                credits: trading.credits,
                cargo: { ...trading.cargo },
            },
            // Universe state
            universe: {
                generatedRadius: universe.generatedRadius,
                _nameIdx: universe._nameIdx,
                _rngSeed: universe._rng.s,
                selectedWaypointIdx: universe.selectedWaypointIdx,
                stations: universe.stations.map(st => ({
                    x: st.x,
                    y: st.y,
                    name: st.name,
                    seed: st.seed,
                    type: st.type,
                    angle: st.angle,
                    inventory: { ...st.inventory },
                    prices: { ...st.prices },
                    fuelPrice: st.fuelPrice,
                    availableUpgrades: [...st.availableUpgrades],
                    pads: st.pads.map(p => ({
                        id: p.id,
                        occupied: p.occupied,
                        shipId: p.shipId,
                    })),
                })),
                aiShips: universe.aiShips.map(a => ({
                    x: a.x,
                    y: a.y,
                    vx: a.vx,
                    vy: a.vy,
                    angle: a.angle,
                    targetStationId: a.targetStation ? universe.stations.indexOf(a.targetStation) : -1,
                })),
            },
        };
    }

    static deserialize(game, data) {
        if (!data) return false;

        const { ship, universe, trading } = game;

        // Restore ship
        if (data.ship) {
            const s = data.ship;
            ship.x = s.x;
            ship.y = s.y;
            ship.vx = s.vx;
            ship.vy = s.vy;
            ship.angle = s.angle;
            ship.throttle = s.throttle;
            ship.hull = s.hull;
            ship.shields = s.shields;
            ship.fuel = s.fuel;
            ship.upgrades = new Set(s.upgrades || []);
        }

        // Restore trading
        if (data.trading) {
            const t = data.trading;
            trading.credits = t.credits;
            trading.cargo = { ...t.cargo };
        }

        // Restore universe
        if (data.universe) {
            const u = data.universe;
            universe.generatedRadius = u.generatedRadius;
            universe._nameIdx = u._nameIdx;
            universe.selectedWaypointIdx = u.selectedWaypointIdx;
            // Restore RNG state
            if (u._rngSeed !== undefined) {
                universe._rng.s = u._rngSeed;
            }
            
            // Clear existing
            universe.stations = [];
            universe.aiShips = [];

            // Restore stations
            for (const stData of (u.stations || [])) {
                const st = new Station(stData.x, stData.y, stData.name, stData.seed);
                st.angle = stData.angle;
                st.inventory = { ...stData.inventory };
                st.prices = { ...stData.prices };
                st.fuelPrice = stData.fuelPrice;
                st.availableUpgrades = [...stData.availableUpgrades];
                st.pads = stData.pads.map(p => ({
                    ...p,
                }));
                universe.stations.push(st);
            }

            // Restore AI ships
            for (const aData of (u.aiShips || [])) {
                const targetStation = aData.targetStationId >= 0 ? universe.stations[aData.targetStationId] : null;
                const a = new AIShip(aData.x, aData.y, targetStation, universe);
                a.vx = aData.vx;
                a.vy = aData.vy;
                a.angle = aData.angle;
                universe.aiShips.push(a);
            }
        }

        return true;
    }

    static save(game) {
        try {
            const data = this.serialize(game);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            console.log('[SaveGame] Stav uložen');
        } catch (e) {
            console.error('[SaveGame] Chyba při ukládání:', e);
        }
    }

    static load() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('[SaveGame] Chyba při čtení:', e);
            return null;
        }
    }

    static clear() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            console.log('[SaveGame] Stav smazán');
        } catch (e) {
            console.error('[SaveGame] Chyba při mazání:', e);
        }
    }
}
