class PokerClient {
    constructor() {
        this.socket = io();
        this.currentRoom = null;
        this.playerName = '';
        this.currentUser = null;
        this.isHost = false;
        this.gameState = null;
        
        this.initializeAuth();
        this.initializeElements();
        this.setupEventListeners();
        this.setupSocketEvents();
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
        
        // Tell server this is a poker connection
        this.socket.emit('joinGameType', 'poker');
    }

    initializeElements() {
        // Screen elements
        this.welcomeScreen = document.getElementById('welcome-screen');
        this.lobbyScreen = document.getElementById('lobby-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.winnerScreen = document.getElementById('winner-screen');
        
        // Welcome screen elements
        this.playerNameInput = document.getElementById('player-name');
        this.createRoomBtn = document.getElementById('create-room-btn');
        this.joinRoomBtn = document.getElementById('join-room-btn');
        this.joinRoomForm = document.getElementById('join-room-form');
        this.roomIdInput = document.getElementById('room-id');
        this.joinConfirmBtn = document.getElementById('join-confirm-btn');
        
        // Lobby screen elements
        this.roomIdDisplay = document.getElementById('room-id-display');
        this.copyRoomIdBtn = document.getElementById('copy-room-id');
        this.playerCount = document.getElementById('player-count');
        this.lobbyPlayers = document.getElementById('lobby-players');
        this.startGameBtn = document.getElementById('start-game-btn');
        this.leaveRoomBtn = document.getElementById('leave-room-btn');
        
        // Game screen elements
        this.potAmount = document.getElementById('pot-amount');
        this.currentRound = document.getElementById('current-round');
        this.communityCards = document.getElementById('community-cards');
        this.gamePlayers = document.getElementById('game-players');
        this.playerCards = document.getElementById('player-cards');
        this.betSlider = document.getElementById('bet-slider');
        this.betAmount = document.getElementById('bet-amount');
        this.foldBtn = document.getElementById('fold-btn');
        this.checkBtn = document.getElementById('check-btn');
        this.callBtn = document.getElementById('call-btn');
        this.raiseBtn = document.getElementById('raise-btn');
        this.currentPlayerIndicator = document.getElementById('current-player-indicator');
        this.gameMessages = document.getElementById('game-messages');
    }

    setupEventListeners() {
        // Welcome screen
        this.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.joinRoomBtn.addEventListener('click', () => this.toggleJoinForm());
        this.joinConfirmBtn.addEventListener('click', () => this.joinRoom());
        
        // Lobby screen
        this.copyRoomIdBtn.addEventListener('click', () => this.copyRoomId());
        this.startGameBtn.addEventListener('click', () => this.startGame());
        this.leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
        
        // Game screen
        this.betSlider.addEventListener('input', (e) => this.updateBetAmount(e.target.value));
        this.foldBtn.addEventListener('click', () => this.playerAction('fold'));
        this.checkBtn.addEventListener('click', () => this.playerAction('check'));
        this.callBtn.addEventListener('click', () => this.playerAction('call'));
        this.raiseBtn.addEventListener('click', () => this.playerAction('raise', parseInt(this.betSlider.value)));
        
        // Enter key handling (only if elements exist)
        if (this.roomIdInput) {
            this.roomIdInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.joinRoom();
            });
        }
    }

    setupSocketEvents() {
        this.socket.on('roomCreated', (data) => {
            this.currentRoom = data.roomId;
            this.isHost = true;
            this.showLobby(data.room);
        });

        this.socket.on('playerJoined', (gameState) => {
            this.updateLobby(gameState);
        });

        this.socket.on('playerLeft', (gameState) => {
            this.updateLobby(gameState);
        });

        this.socket.on('gameStarted', (gameState) => {
            this.gameState = gameState;
            this.showGame(gameState);
        });

        this.socket.on('gameState', (gameState) => {
            this.gameState = gameState;
            this.updateGame(gameState);
        });

        this.socket.on('joinFailed', (message) => {
            alert(message);
        });

        this.socket.on('disconnect', () => {
            this.showMessage('Disconnected from server');
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

    toggleJoinForm() {
        this.joinRoomForm.classList.toggle('hidden');
        if (!this.joinRoomForm.classList.contains('hidden')) {
            this.roomIdInput.focus();
        }
    }

    joinRoom() {
        const roomId = this.roomIdInput.value.trim().toUpperCase();
        
        if (!this.currentUser) {
            window.location.href = '/';
            return;
        }
        
        if (!roomId) {
            alert('Please enter room ID');
            return;
        }
        
        this.socket.emit('joinRoom', { 
            roomId, 
            playerName: this.currentUser.username,
            userId: this.currentUser.id
        });
    }

    copyRoomId() {
        navigator.clipboard.writeText(this.currentRoom).then(() => {
            this.showMessage('Room ID copied to clipboard!');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = this.currentRoom;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showMessage('Room ID copied to clipboard!');
        });
    }

    startGame() {
        if (this.isHost && this.currentRoom) {
            this.socket.emit('startGame', this.currentRoom);
        }
    }

    leaveRoom() {
        window.location.href = '/';
    }

    playerAction(action, amount = 0) {
        if (this.currentRoom && this.gameState && this.currentUser) {
            this.socket.emit('playerAction', {
                roomId: this.currentRoom,
                action,
                amount,
                userId: this.currentUser.id
            });
        }
    }

    updateBetAmount(value) {
        this.betAmount.textContent = value;
    }

    showWelcome() {
        this.hideAllScreens();
        this.welcomeScreen.classList.remove('hidden');
    }

    showLobby(gameState) {
        this.hideAllScreens();
        this.lobbyScreen.classList.remove('hidden');
        this.roomIdDisplay.textContent = this.currentRoom;
        this.updateLobby(gameState);
    }

    showGame(gameState) {
        this.hideAllScreens();
        this.gameScreen.classList.remove('hidden');
        this.updateGame(gameState);
    }

    showWinner(winnerData) {
        this.hideAllScreens();
        this.winnerScreen.classList.remove('hidden');
        document.getElementById('winner-info').innerHTML = winnerData;
    }

    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
    }

    updateLobby(gameState) {
        this.playerCount.textContent = gameState.players.length;
        this.lobbyPlayers.innerHTML = '';
        
        gameState.players.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = 'player-item';
            playerElement.innerHTML = `
                <div class="player-status ${player.isBot ? 'bot' : ''}"></div>
                <span>${player.name}</span>
                ${player.isBot ? '<span style="font-size: 0.8em; opacity: 0.7;">(Bot)</span>' : ''}
            `;
            this.lobbyPlayers.appendChild(playerElement);
        });
        
        // Enable start game button if host and at least 2 players
        if (this.isHost) {
            if (gameState.players.length >= 1) {
                this.startGameBtn.classList.remove('disabled');
            } else {
                this.startGameBtn.classList.add('disabled');
            }
        } else {
            this.startGameBtn.style.display = 'none';
        }
    }

    updateGame(gameState) {
        // Update pot and round
        this.potAmount.textContent = `$${gameState.pot}`;
        this.currentRound.textContent = this.formatRound(gameState.round);
        
        // Update community cards
        this.updateCommunityCards(gameState.communityCards);
        
        // Update players
        this.updateGamePlayers(gameState.players, gameState.currentPlayer);
        
        // Update player's hand
        this.updatePlayerHand(gameState);
        
        // Update controls
        this.updateGameControls(gameState);
        
        // Update current player indicator
        if (gameState.players[gameState.currentPlayer]) {
            this.currentPlayerIndicator.textContent = 
                `Current turn: ${gameState.players[gameState.currentPlayer].name}`;
        }
        
        // Check for game end
        if (gameState.gameState === 'finished') {
            setTimeout(() => {
                this.showLobby(gameState);
            }, 3000);
        }
    }

    formatRound(round) {
        const rounds = {
            'preflop': 'Pre-flop',
            'flop': 'Flop',
            'turn': 'Turn',
            'river': 'River'
        };
        return rounds[round] || round;
    }

    updateCommunityCards(cards) {
        this.communityCards.innerHTML = '';
        cards.forEach((card, index) => {
            const cardElement = this.createCardElement(card);
            cardElement.classList.add('dealing');
            setTimeout(() => {
                cardElement.classList.remove('dealing');
            }, 100 * index);
            this.communityCards.appendChild(cardElement);
        });
    }

    updateGamePlayers(players, currentPlayerIndex) {
        this.gamePlayers.innerHTML = '';
        
        players.forEach((player, index) => {
            const playerElement = document.createElement('div');
            playerElement.className = `game-player ${index === currentPlayerIndex ? 'current-turn' : ''} ${player.folded ? 'folded' : ''}`;
            
            const cardsHtml = player.isBot ? 
                '<div class="card card-back">🂠</div><div class="card card-back">🂠</div>' :
                player.cards.map(card => this.createCardElement(card).outerHTML).join('');
            
            playerElement.innerHTML = `
                <div class="player-name">${player.name}</div>
                <div class="player-balance">Balance: $${player.balance}</div>
                <div class="player-bet">Bet: $${player.currentBet}</div>
                <div class="player-cards-game">
                    ${cardsHtml}
                </div>
                ${player.folded ? '<div style="color: #f44336; font-weight: bold;">FOLDED</div>' : ''}
            `;
            
            this.gamePlayers.appendChild(playerElement);
        });
    }

    updatePlayerHand(gameState) {
        const currentPlayer = gameState.players.find(p => p.id === this.socket.id);
        if (currentPlayer && currentPlayer.cards) {
            this.playerCards.innerHTML = '';
            currentPlayer.cards.forEach(card => {
                this.playerCards.appendChild(this.createCardElement(card));
            });
        }
    }

    updateGameControls(gameState) {
        const currentPlayer = gameState.players.find(p => p.id === this.socket.id);
        const isPlayerTurn = gameState.players[gameState.currentPlayer]?.id === this.socket.id;
        
        if (currentPlayer) {
            this.betSlider.max = currentPlayer.balance;
            this.betSlider.min = gameState.currentBet;
        }
        
        // Enable/disable buttons based on turn
        const buttons = [this.foldBtn, this.checkBtn, this.callBtn, this.raiseBtn];
        buttons.forEach(btn => {
            btn.disabled = !isPlayerTurn || currentPlayer?.folded;
        });
        
        // Show/hide buttons based on game state
        if (gameState.currentBet > 0 && currentPlayer) {
            this.checkBtn.style.display = gameState.currentBet === currentPlayer.currentBet ? 'block' : 'none';
            this.callBtn.style.display = gameState.currentBet > currentPlayer.currentBet ? 'block' : 'none';
            this.callBtn.textContent = `Call $${gameState.currentBet - currentPlayer.currentBet}`;
        } else {
            this.checkBtn.style.display = 'block';
            this.callBtn.style.display = 'none';
        }
    }

    createCardElement(card) {
        const cardElement = document.createElement('div');
        cardElement.className = `card ${card.suit === '♥' || card.suit === '♦' ? 'red' : ''}`;
        
        cardElement.innerHTML = `
            <div class="card-rank">${card.rank}</div>
            <div class="card-suit">${card.suit}</div>
            <div class="card-rank-bottom">${card.rank}</div>
        `;
        
        return cardElement;
    }

    showMessage(message) {
        if (this.gameMessages) {
            this.gameMessages.textContent = message;
            setTimeout(() => {
                this.gameMessages.textContent = '';
            }, 3000);
        } else {
            console.log(message);
        }
    }
}

// Initialize the poker client when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new PokerClient();
});
