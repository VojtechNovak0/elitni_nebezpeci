// savegame.js – Game save/load system
// 
// Supabase table required: game_saves
// SQL to create:
// CREATE TABLE game_saves (
//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   user_id BIGINT NOT NULL REFERENCES elitni_nebezpeci(id),
//   username TEXT NOT NULL,
//   game_state JSONB NOT NULL,
//   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
//   updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
// );
// CREATE INDEX ON game_saves(user_id);

class SaveGame {
    static STORAGE_TABLE = 'game_saves';

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

    static async save(game) {
        const user = Auth.currentUser;
        if (!user) {
            console.log('[SaveGame] Žádný uživatel přihlášen, ukládám do localStorage');
            this._saveLocal(game);
            return;
        }

        try {
            const data = this.serialize(game);
            const { data: existing, error: checkError } = await supabaseClient
                .from(this.STORAGE_TABLE)
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();

            if (checkError) {
                console.error('[SaveGame] Chyba při kontrole:', checkError);
                this._saveLocal(game);
                return;
            }

            if (existing) {
                // Update existing save
                const { error } = await supabaseClient
                    .from(this.STORAGE_TABLE)
                    .update({ game_state: data, updated_at: new Date().toISOString() })
                    .eq('id', existing.id);

                if (error) {
                    console.error('[SaveGame] Chyba při aktualizaci:', error);
                    this._saveLocal(game);
                } else {
                    console.log('[SaveGame] Stav uložen do Supabase');
                }
            } else {
                // Create new save
                const { error } = await supabaseClient
                    .from(this.STORAGE_TABLE)
                    .insert([{
                        user_id: user.id,
                        username: user.username,
                        game_state: data,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    }]);

                if (error) {
                    console.error('[SaveGame] Chyba při vytváření:', error);
                    this._saveLocal(game);
                } else {
                    console.log('[SaveGame] Nový stav uložen do Supabase');
                }
            }
        } catch (e) {
            console.error('[SaveGame] Chyba:', e);
            this._saveLocal(game);
        }
    }

    static async load() {
        const user = Auth.currentUser;
        if (!user) {
            console.log('[SaveGame] Žádný uživatel, načítám z localStorage');
            return this._loadLocal();
        }

        try {
            const { data, error } = await supabaseClient
                .from(this.STORAGE_TABLE)
                .select('game_state')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) {
                console.error('[SaveGame] Chyba při načítání:', error);
                return this._loadLocal();
            }

            if (data && data.game_state) {
                console.log('[SaveGame] Stav načten ze Supabase');
                return data.game_state;
            }
            return null;
        } catch (e) {
            console.error('[SaveGame] Chyba:', e);
            return this._loadLocal();
        }
    }

    static _saveLocal(game) {
        try {
            const data = this.serialize(game);
            localStorage.setItem('elitni_nebezpeci_save_local', JSON.stringify(data));
            console.log('[SaveGame] Stav uložen do localStorage (offline)');
        } catch (e) {
            console.error('[SaveGame] Chyba při lokálním ukládání:', e);
        }
    }

    static _loadLocal() {
        try {
            const data = localStorage.getItem('elitni_nebezpeci_save_local');
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('[SaveGame] Chyba při lokálním čtení:', e);
            return null;
        }
    }

    static clear() {
        localStorage.removeItem('elitni_nebezpeci_save_local');
        console.log('[SaveGame] Lokální stav smazán');
    }
}
