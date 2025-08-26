class CasinoMain {
    constructor() {
        this.currentUser = null;
        this.initializeElements();
        this.setupEventListeners();
        this.checkSession();
    }

    initializeElements() {
        // Screens
        this.loginScreen = document.getElementById('loginScreen');
        this.casinoLobby = document.getElementById('casinoLobby');

        // Auth elements
        this.loginTab = document.getElementById('loginTab');
        this.signupTab = document.getElementById('signupTab');
        this.loginForm = document.getElementById('loginForm');
        this.signupForm = document.getElementById('signupForm');

        // User info
        this.currentUsername = document.getElementById('currentUsername');
        this.currentBalance = document.getElementById('currentBalance');
        this.logoutBtn = document.getElementById('logoutBtn');

        // Game buttons
        this.playBlackjack = document.getElementById('playBlackjack');
        this.playPoker = document.getElementById('playPoker');

        // Error modal
        this.errorModal = document.getElementById('errorModal');
        this.errorMessage = document.getElementById('errorMessage');
        this.closeError = document.getElementById('closeError');
    }

    setupEventListeners() {
        // Auth tabs
        this.loginTab.addEventListener('click', () => this.showLoginTab());
        this.signupTab.addEventListener('click', () => this.showSignupTab());

        // Auth forms
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.signupForm.addEventListener('submit', (e) => this.handleSignup(e));

        // Logout
        this.logoutBtn.addEventListener('click', () => this.handleLogout());

        // Game navigation
        this.playBlackjack.addEventListener('click', () => this.navigateToGame('blackjack'));
        this.playPoker.addEventListener('click', () => this.navigateToGame('poker'));

        // Modal
        this.closeError.addEventListener('click', () => this.hideErrorModal());
        this.errorModal.addEventListener('click', (e) => {
            if (e.target === this.errorModal) this.hideErrorModal();
        });
    }

    showLoginTab() {
        this.loginTab.classList.add('active');
        this.signupTab.classList.remove('active');
        this.loginForm.classList.add('active');
        this.signupForm.classList.remove('active');
    }

    showSignupTab() {
        this.signupTab.classList.add('active');
        this.loginTab.classList.remove('active');
        this.signupForm.classList.add('active');
        this.loginForm.classList.remove('active');
    }

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.currentUser = data.user;
                this.showCasinoLobby();
            } else {
                this.showError(data.error);
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        const username = document.getElementById('signupUsername').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }

        if (password.length < 4) {
            this.showError('Password must be at least 4 characters long');
            return;
        }

        try {
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.currentUser = data.user;
                this.showCasinoLobby();
            } else {
                this.showError(data.error);
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        }
    }

    async handleLogout() {
        try {
            await fetch('/api/logout', { method: 'POST' });
            this.currentUser = null;
            this.showLoginScreen();
        } catch (error) {
            console.error('Logout error:', error);
            // Even if logout fails, show login screen
            this.currentUser = null;
            this.showLoginScreen();
        }
    }

    async checkSession() {
        try {
            const response = await fetch('/api/session');
            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                this.showCasinoLobby();
            } else {
                this.showLoginScreen();
            }
        } catch (error) {
            this.showLoginScreen();
        }
    }

    showLoginScreen() {
        this.loginScreen.classList.add('active');
        this.casinoLobby.classList.remove('active');
        this.clearForms();
    }

    showCasinoLobby() {
        this.loginScreen.classList.remove('active');
        this.casinoLobby.classList.add('active');
        this.updateUserInfo();
    }

    updateUserInfo() {
        if (this.currentUser) {
            this.currentUsername.textContent = this.currentUser.username;
            this.currentBalance.textContent = this.currentUser.balance;
        }
    }

    clearForms() {
        this.loginForm.reset();
        this.signupForm.reset();
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorModal.classList.add('active');
    }

    hideErrorModal() {
        this.errorModal.classList.remove('active');
    }

    navigateToGame(gameType) {
        if (gameType === 'blackjack') {
            window.location.href = '/blackjack';
        } else if (gameType === 'poker') {
            window.location.href = '/poker';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CasinoMain();
});