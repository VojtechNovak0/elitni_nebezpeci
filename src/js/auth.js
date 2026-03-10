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

