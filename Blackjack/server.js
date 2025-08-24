const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game state
const rooms = new Map();

// Card deck
const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.value = this.getValue();
    }

    getValue() {
        if (this.rank === 'A') return 11;
        if (['K', 'Q', 'J'].includes(this.rank)) return 10;
        return parseInt(this.rank);
    }

    toString() {
        return `${this.rank}${this.suit}`;
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.reset();
    }

    reset() {
        this.cards = [];
        for (let suit of suits) {
            for (let rank of ranks) {
                this.cards.push(new Card(suit, rank));
            }
        }
        this.shuffle();
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    draw() {
        return this.cards.pop();
    }
}

class Player {
    constructor(id, name, isBot = false) {
        this.id = id;
        this.name = name;
        this.isBot = isBot;
        this.balance = 250;
        this.hand = [];
        this.bet = 0;
        this.hasStood = false;
        this.hasBusted = false;
        this.isDealer = false;
    }

    getHandValue() {
        let value = 0;
        let aces = 0;

        for (let card of this.hand) {
            value += card.value;
            if (card.rank === 'A') aces++;
        }

        // Adjust for aces
        while (value > 21 && aces > 0) {
            value -= 10;
            aces--;
        }

        return value;
    }

    canHit() {
        return !this.hasStood && !this.hasBusted && this.getHandValue() < 21;
    }

    reset() {
        this.hand = [];
        this.bet = 0;
        this.hasStood = false;
        this.hasBusted = false;
    }
}

class BlackjackRoom {
    constructor(id, hostId) {
        this.id = id;
        this.hostId = hostId;
        this.players = new Map();
        this.dealer = new Player('dealer', 'Dealer', true);
        this.dealer.isDealer = true;
        this.deck = new Deck();
        this.gameState = 'lobby'; // lobby, betting, dealing, playing, finished
        this.currentPlayerIndex = 0;
        this.maxPlayers = 4;
    }

    addPlayer(playerId, playerName) {
        if (this.players.size >= this.maxPlayers) return false;
        if (this.gameState !== 'lobby') return false;

        const player = new Player(playerId, playerName);
        this.players.set(playerId, player);
        return true;
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        if (playerId === this.hostId && this.players.size > 0) {
            this.hostId = Array.from(this.players.keys())[0];
        }
    }

    fillWithBots() {
        const botNames = ['Bot Alice', 'Bot Bob', 'Bot Charlie', 'Bot Diana'];
        let botIndex = 0;

        while (this.players.size < this.maxPlayers && botIndex < botNames.length) {
            const botId = `bot_${uuidv4()}`;
            const bot = new Player(botId, botNames[botIndex], true);
            this.players.set(botId, bot);
            botIndex++;
        }
    }

    startGame() {
        if (this.gameState !== 'lobby') return false;

        this.fillWithBots();
        this.gameState = 'betting';
        this.deck.reset();
        
        // Reset all players
        this.players.forEach(player => player.reset());
        this.dealer.reset();

        return true;
    }

    placeBet(playerId, amount) {
        const player = this.players.get(playerId);
        if (!player || player.balance < amount || amount <= 0) return false;
        if (this.gameState !== 'betting') return false;

        player.bet = amount;
        player.balance -= amount;
        return true;
    }

    allBetsPlaced() {
        return Array.from(this.players.values()).every(player => 
            player.isBot ? true : player.bet > 0
        );
    }

    dealInitialCards() {
        this.gameState = 'dealing';

        // Deal 2 cards to each player
        for (let i = 0; i < 2; i++) {
            this.players.forEach(player => {
                player.hand.push(this.deck.draw());
            });
            this.dealer.hand.push(this.deck.draw());
        }

        // Place bot bets
        this.players.forEach(player => {
            if (player.isBot && player.bet === 0) {
                const betAmount = Math.min(25, player.balance);
                this.placeBet(player.id, betAmount);
            }
        });

        this.gameState = 'playing';
        this.currentPlayerIndex = 0;
    }

    getCurrentPlayer() {
        const playerArray = Array.from(this.players.values());
        return playerArray[this.currentPlayerIndex];
    }

    hit(playerId) {
        const player = this.players.get(playerId);
        if (!player || !player.canHit()) return false;
        if (this.getCurrentPlayer().id !== playerId) return false;

        player.hand.push(this.deck.draw());
        
        if (player.getHandValue() > 21) {
            player.hasBusted = true;
        }

        if (player.hasBusted || player.getHandValue() === 21) {
            this.nextPlayer();
        }

        return true;
    }

    stand(playerId) {
        const player = this.players.get(playerId);
        if (!player) return false;
        if (this.getCurrentPlayer().id !== playerId) return false;

        player.hasStood = true;
        this.nextPlayer();
        return true;
    }

    nextPlayer() {
        this.currentPlayerIndex++;
        const playerArray = Array.from(this.players.values());

        // Skip players who have busted or stood
        while (this.currentPlayerIndex < playerArray.length) {
            const currentPlayer = playerArray[this.currentPlayerIndex];
            if (currentPlayer.canHit()) {
                if (currentPlayer.isBot) {
                    setTimeout(() => this.playBotTurn(currentPlayer), 1000);
                }
                return;
            }
            this.currentPlayerIndex++;
        }

        // All players done, dealer's turn
        this.playDealerTurn();
    }

    playBotTurn(bot) {
        if (this.gameState !== 'playing') return;

        const handValue = bot.getHandValue();
        
        // Simple bot strategy: hit if less than 17, stand otherwise
        if (handValue < 17) {
            this.hit(bot.id);
        } else {
            this.stand(bot.id);
        }
    }

    playDealerTurn() {
        // Dealer hits until 17 or higher
        while (this.dealer.getHandValue() < 17) {
            this.dealer.hand.push(this.deck.draw());
        }

        if (this.dealer.getHandValue() > 21) {
            this.dealer.hasBusted = true;
        }

        this.endGame();
    }

    endGame() {
        this.gameState = 'finished';
        const dealerValue = this.dealer.getHandValue();

        this.players.forEach(player => {
            const playerValue = player.getHandValue();
            let winAmount = 0;

            if (player.hasBusted) {
                // Player loses bet (already deducted)
            } else if (this.dealer.hasBusted || playerValue > dealerValue) {
                // Player wins
                winAmount = player.bet * 2;
            } else if (playerValue === dealerValue) {
                // Push (tie)
                winAmount = player.bet;
            }
            // Else player loses (bet already deducted)

            player.balance += winAmount;
        });

        // Return to lobby after 5 seconds
        setTimeout(() => {
            this.gameState = 'lobby';
            this.currentPlayerIndex = 0;
        }, 5000);
    }

    getGameState() {
        return {
            id: this.id,
            hostId: this.hostId,
            gameState: this.gameState,
            players: Array.from(this.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                isBot: p.isBot,
                balance: p.balance,
                hand: p.hand,
                bet: p.bet,
                hasStood: p.hasStood,
                hasBusted: p.hasBusted,
                handValue: p.getHandValue()
            })),
            dealer: {
                hand: this.dealer.hand,
                handValue: this.dealer.getHandValue(),
                hasBusted: this.dealer.hasBusted
            },
            currentPlayerIndex: this.currentPlayerIndex,
            currentPlayerId: this.getCurrentPlayer()?.id || null
        };
    }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createRoom', (playerName) => {
        const roomId = uuidv4().substring(0, 8);
        const room = new BlackjackRoom(roomId, socket.id);
        room.addPlayer(socket.id, playerName);
        rooms.set(roomId, room);

        socket.join(roomId);
        socket.emit('roomCreated', { roomId, gameState: room.getGameState() });
    });

    socket.on('joinRoom', ({ roomId, playerName }) => {
        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }

        if (room.addPlayer(socket.id, playerName)) {
            socket.join(roomId);
            io.to(roomId).emit('gameStateUpdate', room.getGameState());
        } else {
            socket.emit('error', 'Cannot join room');
        }
    });

    socket.on('startGame', () => {
        const room = Array.from(rooms.values()).find(r => r.hostId === socket.id);
        if (!room) return;

        if (room.startGame()) {
            io.to(room.id).emit('gameStateUpdate', room.getGameState());
        }
    });

    socket.on('placeBet', (amount) => {
        const room = Array.from(rooms.values()).find(r => r.players.has(socket.id));
        if (!room) return;

        if (room.placeBet(socket.id, amount)) {
            io.to(room.id).emit('gameStateUpdate', room.getGameState());

            // Check if all bets are placed
            if (room.allBetsPlaced()) {
                setTimeout(() => {
                    room.dealInitialCards();
                    io.to(room.id).emit('gameStateUpdate', room.getGameState());
                }, 1000);
            }
        }
    });

    socket.on('hit', () => {
        const room = Array.from(rooms.values()).find(r => r.players.has(socket.id));
        if (!room) return;

        if (room.hit(socket.id)) {
            io.to(room.id).emit('gameStateUpdate', room.getGameState());
        }
    });

    socket.on('stand', () => {
        const room = Array.from(rooms.values()).find(r => r.players.has(socket.id));
        if (!room) return;

        if (room.stand(socket.id)) {
            io.to(room.id).emit('gameStateUpdate', room.getGameState());
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Remove player from any room they were in
        rooms.forEach((room, roomId) => {
            if (room.players.has(socket.id)) {
                room.removePlayer(socket.id);
                
                if (room.players.size === 0) {
                    rooms.delete(roomId);
                } else {
                    io.to(roomId).emit('gameStateUpdate', room.getGameState());
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
