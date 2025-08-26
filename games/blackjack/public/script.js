class BlackjackClient {
    constructor() {
        this.socket = io();
        this.currentRoom = null;
        this.playerId = null;
        this.playerName = '';
        this.currentUser = null;
        
        this.initializeAuth();
        this.initializeElements();
        this.attachEventListeners();
        this.setupSocketListeners();
    }

    async initializeAuth() {
        try {
            const response = await fetch('/api/session');
            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                this.playerName = data.user.username;
            } else {
                window.location.href = '/';
                return;
            }
        } catch (error) {
            console.error('Auth error:', error);
            window.location.href = '/';
            return;
        }
        
        // Tell server this is a blackjack connection
        this.socket.emit('joinGameType', 'blackjack');
    }

    initializeElements() {
        // Screens
        this.mainMenu = document.getElementById('mainMenu');
        this.gameScreen = document.getElementById('gameScreen');
        
        // Main menu elements
        this.playerNameInput = document.getElementById('playerName');
        this.createRoomBtn = document.getElementById('createRoomBtn');
        this.joinRoomBtn = document.getElementById('joinRoomBtn');
        
        // Join room dialog
        this.joinRoomDialog = document.getElementById('joinRoomDialog');
        this.roomIdInput = document.getElementById('roomId');
        this.confirmJoinBtn = document.getElementById('confirmJoinBtn');
        this.cancelJoinBtn = document.getElementById('cancelJoinBtn');
        this.closeJoinDialog = document.getElementById('closeJoinDialog');
        
        // Game screen elements
        this.currentRoomCode = document.getElementById('currentRoomCode');
        this.gameStateDisplay = document.getElementById('gameStateDisplay');
        this.leaveRoomBtn = document.getElementById('leaveRoomBtn');
        
        // Dealer section
        this.dealerValue = document.getElementById('dealerValue');
        this.dealerCards = document.getElementById('dealerCards');
        
        // Players section
        this.playersGrid = document.getElementById('playersGrid');
        
        // Game controls
        this.lobbyControls = document.getElementById('lobbyControls');
        this.bettingControls = document.getElementById('bettingControls');
        this.playingControls = document.getElementById('playingControls');
        
        // Game screen elements (make them optional)
        this.leaveRoomBtn = document.getElementById('leaveRoomBtn');
        this.startGameBtn = document.getElementById('startGameBtn');
        
        // Betting elements
        this.betButtons = document.querySelectorAll('.bet-btn');
        this.placeBetBtn = document.getElementById('placeBetBtn');
        this.customBetInput = document.getElementById('customBet');
        
        // Playing elements
        this.hitBtn = document.getElementById('hitBtn');
        this.standBtn = document.getElementById('standBtn');
        this.turnIndicator = document.getElementById('turnIndicator');
    }

    attachEventListeners() {
        // Main menu
        this.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.joinRoomBtn.addEventListener('click', () => this.showJoinDialog());
        
        // Join room dialog
        this.confirmJoinBtn.addEventListener('click', () => this.joinRoom());
        this.cancelJoinBtn.addEventListener('click', () => this.hideJoinDialog());
        this.closeJoinDialog.addEventListener('click', () => this.hideJoinDialog());
        this.roomIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        
        // Game screen
        if (this.leaveRoomBtn) this.leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
        if (this.startGameBtn) this.startGameBtn.addEventListener('click', () => this.startGame());
        
        // Betting
        if (this.betButtons) {
            this.betButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const amount = parseInt(btn.dataset.amount);
                    this.placeBet(amount);
                });
            });
        }
        
        if (this.placeBetBtn) {
            this.placeBetBtn.addEventListener('click', () => {
                const amount = parseInt(this.customBetInput.value);
                if (amount && amount > 0) {
                    this.placeBet(amount);
                }
            });
        }
        
        // Playing
        if (this.hitBtn) this.hitBtn.addEventListener('click', () => this.hit());
        if (this.standBtn) this.standBtn.addEventListener('click', () => this.stand());
        
        // Enter key listeners (only if elements exist)
        if (this.customBetInput) {
            this.customBetInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const amount = parseInt(this.customBetInput.value);
                    if (amount && amount > 0) {
                        this.placeBet(amount);
                    }
                }
            });
        }
    }

    setupSocketListeners() {
        this.socket.on('roomCreated', (data) => {
            this.currentRoom = data.roomId;
            this.playerId = this.socket.id;
            this.showGameScreen();
            this.updateGameState(data.gameState);
        });

        this.socket.on('gameStateUpdate', (gameState) => {
            this.updateGameState(gameState);
        });

        this.socket.on('error', (message) => {
            this.showError(message);
        });
    }

    createRoom() {
        if (!this.currentUser) {
            window.location.href = '/';
            return;
        }

        this.socket.emit('createRoom', {
            playerName: this.currentUser.username,
            userId: this.currentUser.id
        });
    }

    showJoinDialog() {
        if (!this.currentUser) {
            window.location.href = '/';
            return;
        }

        this.joinRoomDialog.classList.add('active');
        this.roomIdInput.focus();
    }

    hideJoinDialog() {
        this.joinRoomDialog.classList.remove('active');
        this.roomIdInput.value = '';
    }

    joinRoom() {
        const roomId = this.roomIdInput.value.trim().toUpperCase();
        if (!roomId) {
            this.showError('Please enter a room code');
            return;
        }

        if (!this.currentUser) {
            window.location.href = '/';
            return;
        }

        this.socket.emit('joinRoom', {
            roomId: roomId,
            playerName: this.currentUser.username,
            userId: this.currentUser.id
        });

        this.hideJoinDialog();
        this.currentRoom = roomId;
        this.playerId = this.socket.id;
        this.showGameScreen();
    }

    leaveRoom() {
        window.location.href = '/';
    }

    startGame() {
        this.socket.emit('startGame');
    }

    placeBet(amount) {
        this.socket.emit('placeBet', {
            amount: amount,
            userId: this.currentUser ? this.currentUser.id : null
        });
        this.customBetInput.value = '';
    }

    hit() {
        this.socket.emit('hit');
    }

    stand() {
        this.socket.emit('stand');
    }

    showMainMenu() {
        this.mainMenu.classList.add('active');
        this.gameScreen.classList.remove('active');
    }

    showGameScreen() {
        this.mainMenu.classList.remove('active');
        this.gameScreen.classList.add('active');
    }

    updateGameState(gameState) {
        this.currentRoomCode.textContent = gameState.id;
        
        // Update game state display
        const stateTexts = {
            'lobby': 'Waiting in lobby...',
            'betting': 'Placing bets...',
            'dealing': 'Dealing cards...',
            'playing': 'Game in progress...',
            'finished': 'Game finished!'
        };
        this.gameStateDisplay.textContent = stateTexts[gameState.gameState] || gameState.gameState;

        // Update dealer
        this.updateDealer(gameState.dealer, gameState.gameState);

        // Update players
        this.updatePlayers(gameState.players, gameState);

        // Update controls
        this.updateControls(gameState);
    }

    updateDealer(dealer, gameState) {
        // Clear dealer cards
        this.dealerCards.innerHTML = '';

        // Show dealer hand value only after dealing
        if (gameState === 'finished' || gameState === 'playing') {
            if (gameState === 'finished') {
                this.dealerValue.textContent = `Value: ${dealer.handValue}`;
                if (dealer.hasBusted) {
                    this.dealerValue.textContent += ' (BUST!)';
                    this.dealerValue.className = 'hand-value bust';
                } else {
                    this.dealerValue.className = 'hand-value';
                }
            } else {
                // During play, hide dealer's hole card value
                this.dealerValue.textContent = `Value: ?`;
                this.dealerValue.className = 'hand-value';
            }
        } else {
            this.dealerValue.textContent = '';
        }

        // Render dealer cards
        dealer.hand.forEach((card, index) => {
            const cardElement = this.createCardElement(card, gameState === 'playing' && index === 1);
            this.dealerCards.appendChild(cardElement);
        });
    }

    updatePlayers(players, gameState) {
        this.playersGrid.innerHTML = '';

        players.forEach(player => {
            const playerCard = this.createPlayerCard(player, gameState);
            this.playersGrid.appendChild(playerCard);
        });

        // Update start game button
        const isHost = gameState.hostId === this.playerId;
        const canStart = gameState.gameState === 'lobby' && players.length > 0;
        this.startGameBtn.disabled = !isHost || !canStart;
        
        if (isHost) {
            this.startGameBtn.textContent = 'Start Game';
        } else {
            this.startGameBtn.textContent = 'Waiting for host...';
            this.startGameBtn.disabled = true;
        }
    }

    createPlayerCard(player, gameState) {
        const div = document.createElement('div');
        div.className = 'player-card';
        
        // Add current turn highlight
        if (gameState.currentPlayerId === player.id && gameState.gameState === 'playing') {
            div.classList.add('current-turn');
        }
        
        // Add busted status
        if (player.hasBusted) {
            div.classList.add('busted');
        }

        const playerInfo = document.createElement('div');
        playerInfo.className = 'player-info';

        const playerName = document.createElement('div');
        playerName.className = `player-name ${player.isBot ? 'bot' : ''}`;
        playerName.textContent = player.name;
        if (player.isBot) {
            playerName.textContent += ' 🤖';
        }
        if (gameState.hostId === player.id) {
            playerName.textContent += ' 👑';
        }

        const playerStats = document.createElement('div');
        playerStats.className = 'player-stats';
        
        const balance = document.createElement('div');
        balance.className = 'balance';
        balance.textContent = `$${player.balance}`;
        
        const bet = document.createElement('div');
        bet.className = 'bet';
        bet.textContent = player.bet > 0 ? `Bet: $${player.bet}` : 'No bet';

        playerStats.appendChild(balance);
        playerStats.appendChild(bet);
        
        playerInfo.appendChild(playerName);
        playerInfo.appendChild(playerStats);

        // Player hand
        const playerHand = document.createElement('div');
        playerHand.className = 'player-hand';

        if (player.hand.length > 0) {
            const handInfo = document.createElement('div');
            handInfo.className = 'hand-info';

            const handValue = document.createElement('div');
            handValue.className = 'hand-value';
            
            if (player.hasBusted) {
                handValue.textContent = `${player.handValue} (BUST!)`;
                handValue.classList.add('bust');
            } else if (player.handValue === 21 && player.hand.length === 2) {
                handValue.textContent = `${player.handValue} (BLACKJACK!)`;
                handValue.classList.add('blackjack');
            } else {
                handValue.textContent = `Value: ${player.handValue}`;
            }

            const status = document.createElement('div');
            status.className = 'status';
            if (player.hasStood) {
                status.textContent = 'STAND';
            } else if (player.hasBusted) {
                status.textContent = 'BUST';
            } else if (gameState.currentPlayerId === player.id && gameState.gameState === 'playing') {
                status.textContent = player.isBot ? 'Bot thinking...' : 'Your turn';
            }

            handInfo.appendChild(handValue);
            handInfo.appendChild(status);

            const cards = document.createElement('div');
            cards.className = 'cards';

            player.hand.forEach(card => {
                const cardElement = this.createCardElement(card);
                cards.appendChild(cardElement);
            });

            playerHand.appendChild(handInfo);
            playerHand.appendChild(cards);
        }

        div.appendChild(playerInfo);
        div.appendChild(playerHand);

        return div;
    }

    createCardElement(card, isHidden = false) {
        const div = document.createElement('div');
        div.className = 'card';

        if (isHidden) {
            div.classList.add('hidden');
            div.textContent = '?';
        } else {
            if (card.suit === '♥' || card.suit === '♦') {
                div.classList.add('red');
            }

            const rank = document.createElement('div');
            rank.className = 'card-rank';
            rank.textContent = card.rank;

            const suit = document.createElement('div');
            suit.className = 'card-suit';
            suit.textContent = card.suit;

            div.appendChild(rank);
            div.appendChild(suit);
        }

        return div;
    }

    updateControls(gameState) {
        // Hide all control groups
        this.lobbyControls.classList.remove('active');
        this.bettingControls.classList.remove('active');
        this.playingControls.classList.remove('active');

        const currentPlayer = gameState.players.find(p => p.id === this.playerId);

        switch (gameState.gameState) {
            case 'lobby':
                this.lobbyControls.classList.add('active');
                break;

            case 'betting':
                if (currentPlayer && !currentPlayer.isBot && currentPlayer.bet === 0) {
                    this.bettingControls.classList.add('active');
                    
                    // Update bet buttons based on balance
                    this.betButtons.forEach(btn => {
                        const amount = parseInt(btn.dataset.amount);
                        btn.disabled = amount > currentPlayer.balance;
                    });
                    
                    this.customBetInput.max = currentPlayer.balance;
                }
                break;

            case 'playing':
                if (currentPlayer && !currentPlayer.isBot && gameState.currentPlayerId === this.playerId) {
                    this.playingControls.classList.add('active');
                    
                    const canHit = currentPlayer.handValue < 21 && !currentPlayer.hasStood && !currentPlayer.hasBusted;
                    this.hitBtn.disabled = !canHit;
                    this.standBtn.disabled = currentPlayer.hasStood || currentPlayer.hasBusted;
                    
                    this.turnIndicator.textContent = 'It\'s your turn!';
                } else {
                    this.playingControls.classList.add('active');
                    this.hitBtn.disabled = true;
                    this.standBtn.disabled = true;
                    
                    if (gameState.currentPlayerId) {
                        const currentGamePlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
                        if (currentGamePlayer) {
                            this.turnIndicator.textContent = `${currentGamePlayer.name}'s turn`;
                        }
                    } else {
                        this.turnIndicator.textContent = 'Dealer\'s turn';
                    }
                }
                break;

            case 'finished':
                this.playingControls.classList.add('active');
                this.hitBtn.disabled = true;
                this.standBtn.disabled = true;
                this.turnIndicator.textContent = 'Game finished! Returning to lobby...';
                break;
        }
    }

    showError(message) {
        // Create a temporary error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'status-message status-error';
        errorDiv.textContent = message;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new BlackjackClient();
});

// Prevent zoom on double tap for mobile
let lastTouchEnd = 0;
document.addEventListener('touchend', function (event) {
    var now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);
