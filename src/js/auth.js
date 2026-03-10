<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
=======
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
<<<<<<< HEAD
// auth.js – Supabase inicializace a přihlášení (vlastní tabulka users)

const SUPABASE_URL = 'https://txzvsyfwfbvlxmadfbja.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4enZzeWZ3ZmJ2bHhtYWRmYmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MDI2NzUsImV4cCI6MjA4ODE3ODY3NX0.a-_FS9e1Pu4BnS8mE2S4QGxOjGt2dQulxk2Rb-nkZGc';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const SESSION_KEY = 'elitni_user';

// Vrátí přihlášeného uživatele z sessionStorage nebo null
function getCurrentUser() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
}

// Přihlášení uživatelským jménem + heslem
async function loginUser(username, password) {
    const { data, error } = await supabase
        .from('users')
        .select('id, username')
        .eq('username', username)
        .eq('password', password)
        .maybeSingle();

    if (error) {
        console.error('Supabase login error:', error);
        throw new Error(error.message || 'Chyba dotazu na databázi');
    }
    if (!data) throw new Error('Špatné uživatelské jméno nebo heslo');
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    return data;
}

// Registrace nového uživatele
async function registerUser(username, password) {
    // Zkontroluj zda jméno již existuje
    const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .maybeSingle();

    if (existing) throw new Error('Uživatelské jméno je již obsazeno');

    const { data, error } = await supabase
        .from('users')
        .insert({ username, password })
        .select('id, username')
        .single();

    if (error) {
        console.error('Supabase register error:', error);
        throw new Error(error.message || 'Registrace selhala');
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    return data;
}

// Odhlášení
function logoutUser() {
    sessionStorage.removeItem(SESSION_KEY);
}
=======
<<<<<<< Updated upstream
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
// auth.js – Registrace a přihlášení přes vlastní tabulku elitni_nebezeci

const Auth = {
    overlay: null,
    currentUser: null,

    init() {
        this.overlay = document.getElementById('authOverlay');
        this._bindEvents();
    },

    _bindEvents() {
        document.getElementById('authSubmit').addEventListener('click', () => this._handleSubmit());
        document.getElementById('authToggle').addEventListener('click', () => this._toggleMode());
        document.getElementById('authForm').addEventListener('keydown', e => {
            if (e.key === 'Enter') this._handleSubmit();
        });
    },

    _isRegisterMode() {
        return document.getElementById('authOverlay').dataset.mode === 'register';
    },

    _toggleMode() {
        const overlay = document.getElementById('authOverlay');
        const isRegister = this._isRegisterMode();
        overlay.dataset.mode = isRegister ? 'login' : 'register';
        document.getElementById('authTitle').textContent   = isRegister ? 'Přihlášení' : 'Registrace';
        document.getElementById('authSubmit').textContent  = isRegister ? 'Přihlásit se' : 'Registrovat se';
        document.getElementById('authToggle').textContent  = isRegister
            ? 'Nemáš účet? Registruj se'
            : 'Máš účet? Přihlas se';
        this._setMessage('');
    },

    async _handleSubmit() {
        const usernameEl = document.getElementById('authUsername');
        const passwordEl = document.getElementById('authPassword');

        if (!usernameEl || !passwordEl) {
            console.error('[Auth] Formulářové elementy nenalezeny – zkus Ctrl+Shift+R');
            return;
        }

        const username = usernameEl.value.trim();
        const password = passwordEl.value;

        if (!username || !password) {
            this._setMessage('Vyplň uživatelské jméno a heslo.', 'error');
            return;
        }

        this._setLoading(true);

        if (this._isRegisterMode()) {
            await this._register(username, password);
        } else {
            await this._login(username, password);
        }

        this._setLoading(false);
    },

    async _register(username, password) {
        // maybeSingle() vrátí null (bez error) pokud uživatel neexistuje
        const { data: existing, error: checkError } = await supabaseClient
            .from('elitni_nebezpeci')
            .select('id')
            .eq('username', username)
            .maybeSingle();

        console.log('[Auth] register check:', { existing, checkError });

        if (existing) {
            this._setMessage('Toto uživatelské jméno je již obsazeno.', 'error');
            return;
        }

        const { data: inserted, error } = await supabaseClient
            .from('elitni_nebezpeci')
            .insert([{ id: Date.now(), username, password }])
            .select();

        console.log('[Auth] insert result:', { inserted, error });

        if (error) {
            this._setMessage('Chyba: ' + error.message, 'error');
            return;
        }

        this._setMessage('Registrace úspěšná! Přihlas se.', 'success');
        document.getElementById('authOverlay').dataset.mode = 'login';
        document.getElementById('authTitle').textContent    = 'Přihlášení';
        document.getElementById('authSubmit').textContent   = 'Přihlásit se';
        document.getElementById('authToggle').textContent   = 'Nemáš účet? Registruj se';
    },

    async _login(username, password) {
        const { data, error } = await supabaseClient
            .from('elitni_nebezpeci')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .maybeSingle();

        console.log('[Auth] login result:', { data, error });

        if (error) {
            this._setMessage('Chyba: ' + error.message, 'error');
            return;
        }

        if (!data) {
            this._setMessage('Špatné uživatelské jméno nebo heslo.', 'error');
            return;
        }

        this._onSuccess(data);
    },

    _onSuccess(user) {
        this.currentUser = user;
        this.overlay.style.display = 'none';
        new Game().start();
    },

    _setMessage(msg, type = 'error') {
        const el = document.getElementById('authMessage');
        el.textContent   = msg;
        el.style.color   = type === 'error' ? '#ff4444' : '#44ff88';
    },

    _setLoading(loading) {
        const btn = document.getElementById('authSubmit');
        btn.disabled    = loading;
        btn.textContent = loading
            ? 'Načítám...'
            : (this._isRegisterMode() ? 'Registrovat se' : 'Přihlásit se');
    }
};

<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
=======
>>>>>>> 616b55d6d65a9a66123e566934806b6857a6f18a
>>>>>>> Stashed changes
=======
>>>>>>> 616b55d6d65a9a66123e566934806b6857a6f18a
>>>>>>> Stashed changes
=======
>>>>>>> 616b55d6d65a9a66123e566934806b6857a6f18a
>>>>>>> Stashed changes
