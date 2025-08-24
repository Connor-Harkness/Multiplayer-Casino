const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static('public'));

// Game state
const rooms = new Map();

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

    addPlayer(playerId, playerName) {
        if (this.players.length >= 4) return false;
        
        const player = {
            id: playerId,
            name: playerName,
            balance: 250,
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
        this.currentPlayer = 0;
        this.currentBet = 0;
        this.round = 'preflop';
        this.pot = 0;
        
        // Reset player states
        this.players.forEach(player => {
            player.folded = false;
            player.allIn = false;
            player.currentBet = 0;
        });
    }

    initializeDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        
        this.deck = [];
        suits.forEach(suit => {
            ranks.forEach(rank => {
                this.deck.push({ suit, rank, value: this.getCardValue(rank) });
            });
        });
        
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
        const player = this.players.find(p => p.id === playerId);
        if (!player || player.folded) return false;

        switch (action) {
            case 'fold':
                player.folded = true;
                break;
            case 'call':
                const callAmount = this.currentBet - player.currentBet;
                if (player.balance >= callAmount) {
                    player.balance -= callAmount;
                    player.currentBet = this.currentBet;
                    this.pot += callAmount;
                }
                break;
            case 'raise':
                if (amount > this.currentBet && player.balance >= amount) {
                    const raiseAmount = amount - player.currentBet;
                    player.balance -= raiseAmount;
                    player.currentBet = amount;
                    this.currentBet = amount;
                    this.pot += raiseAmount;
                }
                break;
            case 'check':
                // Only allowed if current bet is 0 or player has matched current bet
                break;
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
        switch (this.round) {
            case 'preflop':
                this.round = 'flop';
                this.communityCards = [this.deck.pop(), this.deck.pop(), this.deck.pop()];
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
        
        this.currentPlayer = 0;
        this.currentBet = 0;
        this.players.forEach(player => {
            player.currentBet = 0;
        });
    }

    endGame() {
        // Simple winner determination (highest card for now)
        const activePlayers = this.players.filter(p => !p.folded);
        if (activePlayers.length === 1) {
            activePlayers[0].balance += this.pot;
        } else {
            // Split pot equally for now (simplified)
            const winnings = Math.floor(this.pot / activePlayers.length);
            activePlayers.forEach(player => {
                player.balance += winnings;
            });
        }
        
        this.gameState = 'finished';
        setTimeout(() => {
            this.gameState = 'waiting';
            this.communityCards = [];
            this.pot = 0;
        }, 5000);
    }

    processBotTurn() {
        const currentPlayerObj = this.players[this.currentPlayer];
        if (!currentPlayerObj.isBot) return;

        // Simple bot AI
        setTimeout(() => {
            const actions = ['fold', 'call', 'check'];
            const randomAction = actions[Math.floor(Math.random() * actions.length)];
            
            if (randomAction === 'call' && this.currentBet > currentPlayerObj.currentBet) {
                this.playerAction(currentPlayerObj.id, 'call');
            } else if (randomAction === 'check' && this.currentBet === currentPlayerObj.currentBet) {
                this.playerAction(currentPlayerObj.id, 'check');
            } else {
                this.playerAction(currentPlayerObj.id, 'fold');
            }
            
            io.to(this.id).emit('gameState', this.getGameState());
        }, 1000 + Math.random() * 2000);
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

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createRoom', (playerName) => {
        const roomId = Math.random().toString(36).substring(2, 8);
        const room = new PokerRoom(roomId, socket.id);
        room.addPlayer(socket.id, playerName);
        rooms.set(roomId, room);
        
        socket.join(roomId);
        socket.emit('roomCreated', { roomId, room: room.getGameState() });
    });

    socket.on('joinRoom', ({ roomId, playerName }) => {
        const room = rooms.get(roomId);
        if (room && room.addPlayer(socket.id, playerName)) {
            socket.join(roomId);
            io.to(roomId).emit('playerJoined', room.getGameState());
        } else {
            socket.emit('joinFailed', 'Room full or does not exist');
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

    socket.on('playerAction', ({ roomId, action, amount }) => {
        const room = rooms.get(roomId);
        if (room && room.players[room.currentPlayer].id === socket.id) {
            room.playerAction(socket.id, action, amount);
            io.to(roomId).emit('gameState', room.getGameState());
            
            // Process bot turn if next player is a bot
            if (room.gameState === 'playing' && room.players[room.currentPlayer].isBot) {
                room.processBotTurn();
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Remove player from rooms and clean up empty rooms
        rooms.forEach((room, roomId) => {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                if (room.players.length === 0) {
                    rooms.delete(roomId);
                } else {
                    io.to(roomId).emit('playerLeft', room.getGameState());
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Poker server running on port ${PORT}`);
});
