const { v4: uuidv4 } = require('uuid');

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

    addCard(card) {
        this.hand.push(card);
        if (this.getHandValue() > 21) {
            this.hasBusted = true;
        }
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

    addPlayer(playerId, playerName, balance = 250) {
        if (this.players.size >= this.maxPlayers) return false;
        if (this.gameState !== 'lobby') return false;

        const player = new Player(playerId, playerName);
        player.balance = balance; // Use actual user balance
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
        const botNames = ['Bot Alice', 'Bot Bob', 'Bot Charlie'];
        while (this.players.size < 2) {
            const botName = botNames[this.players.size - 1] || `Bot ${this.players.size}`;
            const botId = `bot_${Date.now()}_${Math.random()}`;
            const bot = new Player(botId, botName, true);
            this.players.set(botId, bot);
        }
    }

    startGame() {
        if (this.gameState !== 'lobby' || this.players.size === 0) return false;

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
        if (!player || this.gameState !== 'betting') return false;
        if (amount > player.balance || amount <= 0) return false;

        player.bet = amount;
        player.balance -= amount;

        // Auto-bet for bots
        this.players.forEach(p => {
            if (p.isBot && p.bet === 0) {
                const botBet = Math.min(25, p.balance);
                p.bet = botBet;
                p.balance -= botBet;
            }
        });

        if (this.allBetsPlaced()) {
            this.dealInitialCards();
        }

        return true;
    }

    allBetsPlaced() {
        return Array.from(this.players.values()).every(player => player.bet > 0);
    }

    dealInitialCards() {
        this.gameState = 'dealing';
        
        // Deal 2 cards to each player
        this.players.forEach(player => {
            player.addCard(this.deck.draw());
            player.addCard(this.deck.draw());
        });

        // Deal 2 cards to dealer (one hidden)
        this.dealer.addCard(this.deck.draw());
        this.dealer.addCard(this.deck.draw());

        this.gameState = 'playing';
        this.currentPlayerIndex = 0;
    }

    getCurrentPlayer() {
        const playerArray = Array.from(this.players.values());
        return playerArray[this.currentPlayerIndex];
    }

    hit(playerId) {
        const player = this.players.get(playerId);
        const currentPlayer = this.getCurrentPlayer();
        
        if (!player || player !== currentPlayer || !player.canHit()) return false;

        player.addCard(this.deck.draw());

        if (player.hasBusted || player.getHandValue() === 21) {
            this.nextPlayer();
        }

        return true;
    }

    stand(playerId) {
        const player = this.players.get(playerId);
        const currentPlayer = this.getCurrentPlayer();
        
        if (!player || player !== currentPlayer) return false;

        player.hasStood = true;
        this.nextPlayer();
        return true;
    }

    nextPlayer() {
        const playerArray = Array.from(this.players.values());
        
        do {
            this.currentPlayerIndex++;
            if (this.currentPlayerIndex >= playerArray.length) {
                // All players done, play dealer turn
                this.playDealerTurn();
                return;
            }
        } while (playerArray[this.currentPlayerIndex].hasStood || playerArray[this.currentPlayerIndex].hasBusted);

        // If current player is bot, play bot turn
        const currentPlayer = this.getCurrentPlayer();
        if (currentPlayer && currentPlayer.isBot) {
            setTimeout(() => this.playBotTurn(currentPlayer), 1500);
        }
    }

    playBotTurn(bot) {
        if (bot.getHandValue() < 17) {
            bot.addCard(this.deck.draw());
            if (bot.hasBusted || bot.getHandValue() >= 17) {
                this.nextPlayer();
            } else {
                setTimeout(() => this.playBotTurn(bot), 1000);
            }
        } else {
            bot.hasStood = true;
            this.nextPlayer();
        }
    }

    playDealerTurn() {
        const dealerTurn = () => {
            if (this.dealer.getHandValue() < 17) {
                this.dealer.addCard(this.deck.draw());
                setTimeout(dealerTurn, 1000);
            } else {
                this.endGame();
            }
        };
        dealerTurn();
    }

    endGame() {
        this.gameState = 'finished';
        const dealerValue = this.dealer.getHandValue();
        const dealerBusted = dealerValue > 21;

        // Calculate winnings for each player
        this.players.forEach(player => {
            const playerValue = player.getHandValue();
            const playerBusted = playerValue > 21;

            if (playerBusted) {
                // Player loses, bet already taken
            } else if (dealerBusted || playerValue > dealerValue) {
                // Player wins
                if (playerValue === 21 && player.hand.length === 2) {
                    // Blackjack pays 3:2
                    player.balance += Math.floor(player.bet * 2.5);
                } else {
                    // Regular win pays 2:1
                    player.balance += player.bet * 2;
                }
            } else if (playerValue === dealerValue) {
                // Push - return bet
                player.balance += player.bet;
            }
            // If dealer wins, bet stays with house
        });

        // Reset for next game
        setTimeout(() => {
            this.gameState = 'lobby';
        }, 5000);
    }

    getGameState() {
        const playerArray = Array.from(this.players.values()).map(player => ({
            id: player.id,
            name: player.name,
            balance: player.balance,
            bet: player.bet,
            hand: player.hand,
            handValue: player.getHandValue(),
            hasStood: player.hasStood,
            hasBusted: player.hasBusted,
            isBot: player.isBot
        }));

        return {
            roomId: this.id,
            hostId: this.hostId,
            gameState: this.gameState,
            players: playerArray,
            dealer: {
                hand: this.dealer.hand,
                handValue: this.dealer.getHandValue(),
                // Hide dealer's second card during playing
                hiddenCard: this.gameState === 'playing'
            },
            currentPlayerIndex: this.currentPlayerIndex,
            maxPlayers: this.maxPlayers
        };
    }
}

function createBlackjackHandlers(socket, io, rooms, db) {
    socket.on('createRoom', async (data) => {
        try {
            const { playerName, userId } = data;
            const user = await db.getUserById(userId);
            
            if (!user) {
                socket.emit('error', 'User not found');
                return;
            }

            const roomId = uuidv4().substring(0, 8);
            const room = new BlackjackRoom(roomId, socket.id);
            room.addPlayer(socket.id, playerName, user.balance);
            rooms.set(roomId, room);

            socket.join(roomId);
            socket.emit('roomCreated', { roomId, gameState: room.getGameState() });
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
                socket.emit('error', 'Room not found');
                return;
            }
            
            if (!user) {
                socket.emit('error', 'User not found');
                return;
            }

            if (room.addPlayer(socket.id, playerName, user.balance)) {
                socket.join(roomId);
                io.to(roomId).emit('gameStateUpdate', room.getGameState());
            } else {
                socket.emit('error', 'Cannot join room');
            }
        } catch (error) {
            console.error('Join room error:', error);
            socket.emit('error', 'Failed to join room');
        }
    });

    socket.on('startGame', () => {
        const room = Array.from(rooms.values()).find(r => r.hostId === socket.id);
        if (!room) return;

        if (room.startGame()) {
            io.to(room.id).emit('gameStateUpdate', room.getGameState());
        }
    });

    socket.on('placeBet', async (data) => {
        try {
            const { amount, userId } = data;
            const room = Array.from(rooms.values()).find(r => r.players.has(socket.id));
            
            if (!room) return;

            if (room.placeBet(socket.id, amount)) {
                io.to(room.id).emit('gameStateUpdate', room.getGameState());
                
                // Update user balance in database
                const player = room.players.get(socket.id);
                await db.updateUserBalance(userId, player.balance);
            }
        } catch (error) {
            console.error('Place bet error:', error);
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
}

module.exports = { createBlackjackHandlers, BlackjackRoom };