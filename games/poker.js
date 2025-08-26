class PokerRoom {
    constructor(roomId, hostId) {
        this.id = roomId;
        this.hostId = hostId;
        this.players = [];
        this.bots = [];
        this.gameState = 'waiting'; // waiting, playing, finished
        this.currentPlayer = 0;
        this.pot = 0;
        this.communityCards = [];
        this.deck = [];
        this.currentBet = 0;
        this.round = 'preflop'; // preflop, flop, turn, river
    }

    addPlayer(playerId, playerName, balance = 250) {
        if (this.players.length >= 4) return false;
        
        const player = {
            id: playerId,
            name: playerName,
            balance: balance, // Use actual user balance
            cards: [],
            currentBet: 0,
            folded: false,
            allIn: false,
            isBot: false
        };
        
        this.players.push(player);
        return true;
    }

    addBot() {
        const botNames = ['Bot Alice', 'Bot Bob', 'Bot Charlie'];
        const botName = botNames[this.bots.length % botNames.length];
        
        const bot = {
            id: `bot_${Date.now()}_${Math.random()}`,
            name: botName,
            balance: 250,
            cards: [],
            currentBet: 0,
            folded: false,
            allIn: false,
            isBot: true
        };
        
        this.bots.push(bot);
        this.players.push(bot);
    }

    fillWithBots() {
        while (this.players.length < 2) {
            this.addBot();
        }
    }

    startGame() {
        this.fillWithBots();
        this.gameState = 'playing';
        this.initializeDeck();
        this.dealCards();
        this.round = 'preflop';
        this.currentPlayer = 0;
        this.currentBet = 0;
        this.pot = 0;
        this.communityCards = [];

        // Reset player state
        this.players.forEach(player => {
            player.cards = [];
            player.currentBet = 0;
            player.folded = false;
            player.allIn = false;
        });

        this.dealCards();
    }

    initializeDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        
        this.deck = [];
        for (let suit of suits) {
            for (let rank of ranks) {
                this.deck.push({ suit, rank });
            }
        }
        
        // Shuffle deck
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    getCardValue(rank) {
        const values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
        return values[rank];
    }

    dealCards() {
        // Deal 2 cards to each player
        this.players.forEach(player => {
            player.cards = [this.deck.pop(), this.deck.pop()];
        });
    }

    playerAction(playerId, action, amount = 0) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex !== this.currentPlayer) return false;
        
        const player = this.players[playerIndex];
        if (player.folded || player.allIn) return false;

        switch (action) {
            case 'fold':
                player.folded = true;
                break;
                
            case 'check':
                if (this.currentBet > player.currentBet) return false;
                break;
                
            case 'call':
                const callAmount = this.currentBet - player.currentBet;
                if (callAmount > player.balance) {
                    // All in
                    this.pot += player.balance;
                    player.currentBet += player.balance;
                    player.balance = 0;
                    player.allIn = true;
                } else {
                    this.pot += callAmount;
                    player.balance -= callAmount;
                    player.currentBet = this.currentBet;
                }
                break;
                
            case 'raise':
                if (amount < this.currentBet * 2) return false;
                const raiseAmount = amount - player.currentBet;
                if (raiseAmount > player.balance) {
                    // All in
                    this.pot += player.balance;
                    player.currentBet += player.balance;
                    this.currentBet = player.currentBet;
                    player.balance = 0;
                    player.allIn = true;
                } else {
                    this.pot += raiseAmount;
                    player.balance -= raiseAmount;
                    player.currentBet = amount;
                    this.currentBet = amount;
                }
                break;
                
            default:
                return false;
        }

        this.nextPlayer();
        return true;
    }

    nextPlayer() {
        do {
            this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
        } while (this.players[this.currentPlayer].folded);

        // Check if we need to move to next round
        if (this.isRoundComplete()) {
            this.nextRound();
        }
    }

    isRoundComplete() {
        const activePlayers = this.players.filter(p => !p.folded);
        return activePlayers.every(p => p.currentBet === this.currentBet || p.allIn);
    }

    nextRound() {
        // Reset current bets for next round
        this.players.forEach(player => {
            player.currentBet = 0;
        });
        this.currentBet = 0;

        switch (this.round) {
            case 'preflop':
                this.round = 'flop';
                this.communityCards.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
                break;
            case 'flop':
                this.round = 'turn';
                this.communityCards.push(this.deck.pop());
                break;
            case 'turn':
                this.round = 'river';
                this.communityCards.push(this.deck.pop());
                break;
            case 'river':
                this.endGame();
                return;
        }

        // Find first active player
        this.currentPlayer = 0;
        while (this.players[this.currentPlayer].folded) {
            this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
        }
    }

    endGame() {
        this.gameState = 'finished';
        
        // Simple winner determination (highest card for now)
        const activePlayers = this.players.filter(p => !p.folded);
        let winner = activePlayers[0];
        
        activePlayers.forEach(player => {
            const playerHighCard = Math.max(...player.cards.map(card => this.getCardValue(card.rank)));
            const winnerHighCard = Math.max(...winner.cards.map(card => this.getCardValue(card.rank)));
            
            if (playerHighCard > winnerHighCard) {
                winner = player;
            }
        });

        // Award pot to winner
        winner.balance += this.pot;

        // Reset game state
        setTimeout(() => {
            this.gameState = 'waiting';
            this.pot = 0;
            this.communityCards = [];
            this.currentPlayer = 0;
            this.currentBet = 0;
            this.round = 'preflop';
        }, 5000);
    }

    processBotTurn() {
        const currentPlayer = this.players[this.currentPlayer];
        if (!currentPlayer || !currentPlayer.isBot) return;

        // Simple bot AI
        setTimeout(() => {
            const actions = ['fold', 'check', 'call'];
            const randomAction = actions[Math.floor(Math.random() * actions.length)];
            
            // Bots are more likely to fold if they have low cards
            const highCard = Math.max(...currentPlayer.cards.map(card => this.getCardValue(card.rank)));
            if (highCard < 8 && Math.random() < 0.7) {
                this.playerAction(currentPlayer.id, 'fold');
            } else if (this.currentBet === 0) {
                this.playerAction(currentPlayer.id, 'check');
            } else {
                this.playerAction(currentPlayer.id, 'call');
            }
        }, 1500);
    }

    getGameState() {
        return {
            roomId: this.id,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                balance: p.balance,
                currentBet: p.currentBet,
                folded: p.folded,
                allIn: p.allIn,
                isBot: p.isBot,
                cards: p.isBot ? [] : p.cards // Don't show bot cards to clients
            })),
            communityCards: this.communityCards,
            pot: this.pot,
            currentPlayer: this.currentPlayer,
            currentBet: this.currentBet,
            round: this.round,
            gameState: this.gameState
        };
    }
}

function createPokerHandlers(socket, io, rooms, db) {
    socket.on('createRoom', async (data) => {
        try {
            const { playerName, userId } = data;
            const user = await db.getUserById(userId);
            
            if (!user) {
                socket.emit('error', 'User not found');
                return;
            }

            const roomId = Math.random().toString(36).substring(2, 8);
            const room = new PokerRoom(roomId, socket.id);
            room.addPlayer(socket.id, playerName, user.balance);
            rooms.set(roomId, room);
            
            socket.join(roomId);
            socket.emit('roomCreated', { roomId, room: room.getGameState() });
        } catch (error) {
            console.error('Create room error:', error);
            socket.emit('error', 'Failed to create room');
        }
    });

    socket.on('joinRoom', async (data) => {
        try {
            const { roomId, playerName, userId } = data;
            const room = rooms.get(roomId);
            const user = await db.getUserById(userId);
            
            if (!room) {
                socket.emit('joinFailed', 'Room not found');
                return;
            }
            
            if (!user) {
                socket.emit('joinFailed', 'User not found');
                return;
            }

            if (room.addPlayer(socket.id, playerName, user.balance)) {
                socket.join(roomId);
                io.to(roomId).emit('playerJoined', room.getGameState());
            } else {
                socket.emit('joinFailed', 'Room full or does not exist');
            }
        } catch (error) {
            console.error('Join room error:', error);
            socket.emit('joinFailed', 'Failed to join room');
        }
    });

    socket.on('startGame', (roomId) => {
        const room = rooms.get(roomId);
        if (room && room.hostId === socket.id) {
            room.startGame();
            io.to(roomId).emit('gameStarted', room.getGameState());
            
            // Start bot turns if needed
            if (room.players[room.currentPlayer].isBot) {
                room.processBotTurn();
            }
        }
    });

    socket.on('playerAction', async (data) => {
        try {
            const { roomId, action, amount, userId } = data;
            const room = rooms.get(roomId);
            
            if (room && room.players[room.currentPlayer].id === socket.id) {
                room.playerAction(socket.id, action, amount);
                io.to(roomId).emit('gameState', room.getGameState());
                
                // Update user balance in database
                const player = room.players.find(p => p.id === socket.id);
                if (player && userId) {
                    await db.updateUserBalance(userId, player.balance);
                }
                
                // Process bot turn if next player is a bot
                if (room.gameState === 'playing' && room.players[room.currentPlayer].isBot) {
                    room.processBotTurn();
                }
            }
        } catch (error) {
            console.error('Player action error:', error);
        }
    });
}

module.exports = { createPokerHandlers, PokerRoom };