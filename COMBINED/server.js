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

// In-memory profiles and leaderboard
// profiles: Map<playerId, { id: playerId, name, points }>
const profiles = new Map();
// sessions: Map<socketId, playerId>
const sessions = new Map();
// global leaderboard (top scores by name)
const leaderboard = new Map(); // name -> points

function getOrCreateProfileById(playerId, name) {
  let profile = profiles.get(playerId);
  if (!profile) {
    profile = { id: playerId, name: name || `Player-${playerId.slice(0,4)}`, points: 1000 };
    profiles.set(playerId, profile);
  } else if (name && profile.name !== name) {
    profile.name = name;
  }
  return profile;
}
function getProfileBySocketId(socketId) {
  const pid = sessions.get(socketId);
  if (!pid) return undefined;
  return profiles.get(pid);
}
function ensurePlayerId(socket) {
  let pid = sessions.get(socket.id);
  if (!pid) {
    pid = uuidv4();
    sessions.set(socket.id, pid);
    getOrCreateProfileById(pid);
  }
  return pid;
}

function updateLeaderboard(name, points) {
  const current = leaderboard.get(name) || 0;
  leaderboard.set(name, Math.max(current, points));
  broadcastLeaderboard();
}

function broadcastLeaderboard() {
  const top = Array.from(leaderboard.entries())
    .map(([name, points]) => ({ name, points }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 20);
  io.emit('leaderboard:update', top);
}

// Root namespace: profile + leaderboard
io.on('connection', (socket) => {
  socket.on('profile:init', (payload) => {
    const { name, playerId } = typeof payload === 'object' ? payload : { name: payload, playerId: undefined };
    const pid = playerId || ensurePlayerId(socket);
    sessions.set(socket.id, pid);
    const p = getOrCreateProfileById(pid, name);
    updateLeaderboard(p.name, p.points);
    socket.emit('profile', p);
    broadcastLeaderboard();
  });

  socket.on('disconnect', () => {
    const pid = sessions.get(socket.id);
    if (pid) {
      const profile = profiles.get(pid);
      if (profile) updateLeaderboard(profile.name, profile.points);
    }
    sessions.delete(socket.id);
  });
});

// ------------- Blackjack implementation (adapted) ------------- //
(function registerBlackjack() {
  const rooms = new Map();

  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  class Card {
    constructor(suit, rank) { this.suit = suit; this.rank = rank; this.value = this.getValue(); }
    getValue() { if (this.rank === 'A') return 11; if (['K', 'Q', 'J'].includes(this.rank)) return 10; return parseInt(this.rank); }
  }
  class Deck {
    constructor() { this.cards = []; this.reset(); }
    reset() { this.cards = []; for (let s of suits) for (let r of ranks) this.cards.push(new Card(s, r)); this.shuffle(); }
    shuffle() { for (let i = this.cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]]; } }
    draw() { return this.cards.pop(); }
  }
  class Player {
    constructor(id, name, isBot = false) { this.id = id; this.name = name; this.isBot = isBot; this.hand = []; this.bet = 0; this.hasStood = false; this.hasBusted = false; this.isDealer = false; }
    getHandValue() { let value = 0, aces = 0; for (let c of this.hand) { value += c.value; if (c.rank === 'A') aces++; } while (value > 21 && aces > 0) { value -= 10; aces--; } return value; }
    canHit() { return !this.hasStood && !this.hasBusted && this.getHandValue() < 21; }
    reset() { this.hand = []; this.bet = 0; this.hasStood = false; this.hasBusted = false; }
  }
  class BlackjackRoom {
    constructor(id, hostId) { this.id = id; this.hostId = hostId; this.players = new Map(); this.dealer = new Player('dealer', 'Dealer', true); this.dealer.isDealer = true; this.deck = new Deck(); this.gameState = 'lobby'; this.currentPlayerIndex = 0; this.maxPlayers = 4; }
    addPlayer(playerId, playerName) { if (this.players.size >= this.maxPlayers) return false; if (this.gameState !== 'lobby') return false; const player = new Player(playerId, playerName); this.players.set(playerId, player); return true; }
    removePlayer(playerId) { this.players.delete(playerId); if (playerId === this.hostId && this.players.size > 0) { this.hostId = Array.from(this.players.keys())[0]; } }
    fillWithBots() { const botNames = ['Bot Alice', 'Bot Bob', 'Bot Charlie', 'Bot Diana']; let i = 0; while (this.players.size < this.maxPlayers && i < botNames.length) { const botId = `bot_${uuidv4()}`; const bot = new Player(botId, botNames[i], true); this.players.set(botId, bot); i++; } }
    startGame() { if (this.gameState !== 'lobby') return false; this.fillWithBots(); this.gameState = 'betting'; this.deck.reset(); this.players.forEach(p => p.reset()); this.dealer.reset(); return true; }
    placeBet(playerId, amount) { const player = this.players.get(playerId); if (!player || amount <= 0) return false; if (this.gameState !== 'betting') return false; const profile = profiles.get(playerId); if (!profile || profile.points < amount) return false; profile.points -= amount; updateLeaderboard(profile.name, profile.points); player.bet = amount; return true; }
    allBetsPlaced() { return Array.from(this.players.values()).every(p => p.isBot ? true : p.bet > 0); }
    dealInitialCards() { this.gameState = 'dealing'; for (let i = 0; i < 2; i++) { this.players.forEach(p => { p.hand.push(this.deck.draw()); }); this.dealer.hand.push(this.deck.draw()); } this.players.forEach(p => { if (p.isBot && p.bet === 0) { p.bet = 25; } }); this.gameState = 'playing'; this.currentPlayerIndex = 0; }
    getCurrentPlayer() { const arr = Array.from(this.players.values()); return arr[this.currentPlayerIndex]; }
    hit(playerId) { const player = this.players.get(playerId); if (!player || !player.canHit()) return false; if (this.getCurrentPlayer().id !== playerId) return false; player.hand.push(this.deck.draw()); if (player.getHandValue() > 21) { player.hasBusted = true; } if (player.hasBusted || player.getHandValue() === 21) { this.nextPlayer(); } return true; }
    stand(playerId) { const player = this.players.get(playerId); if (!player) return false; if (this.getCurrentPlayer().id !== playerId) return false; player.hasStood = true; this.nextPlayer(); return true; }
    nextPlayer() { this.currentPlayerIndex++; const arr = Array.from(this.players.values()); while (this.currentPlayerIndex < arr.length) { const curr = arr[this.currentPlayerIndex]; if (curr.canHit()) { if (curr.isBot) { setTimeout(() => this.playBotTurn(curr), 800); } return; } this.currentPlayerIndex++; } this.playDealerTurn(); }
    playBotTurn(bot) { if (this.gameState !== 'playing') return; const val = bot.getHandValue(); if (val < 17) { this.hit(bot.id); } else { this.stand(bot.id); } }
    playDealerTurn() { while (this.dealer.getHandValue() < 17) { this.dealer.hand.push(this.deck.draw()); } if (this.dealer.getHandValue() > 21) { this.dealer.hasBusted = true; } this.endGame(); }
    endGame() { this.gameState = 'finished'; const dealerValue = this.dealer.getHandValue(); this.players.forEach(p => { const playerValue = p.getHandValue(); let winAmount = 0; if (p.hasBusted) { /* lost */ } else if (this.dealer.hasBusted || playerValue > dealerValue) { winAmount = p.bet * 2; } else if (playerValue === dealerValue) { winAmount = p.bet; } const profile = profiles.get(p.id); if (profile) { profile.points += winAmount; updateLeaderboard(profile.name, profile.points); } }); setTimeout(() => { this.gameState = 'lobby'; this.currentPlayerIndex = 0; }, 4000); }
    getGameState() { return { id: this.id, hostId: this.hostId, gameState: this.gameState, players: Array.from(this.players.values()).map(pl => ({ id: pl.id, name: pl.name, isBot: pl.isBot, balance: profiles.get(pl.id)?.points ?? 0, hand: pl.hand, bet: pl.bet, hasStood: pl.hasStood, hasBusted: pl.hasBusted, handValue: pl.getHandValue() })), dealer: { hand: this.dealer.hand, handValue: this.dealer.getHandValue(), hasBusted: this.dealer.hasBusted }, currentPlayerIndex: this.currentPlayerIndex, currentPlayerId: this.getCurrentPlayer()?.id || null }; }
  }

  const bjNsp = io.of('/blackjack');
  bjNsp.on('connection', (socket) => {
    // Optional: accept profile init on this namespace too
    socket.on('profile:init', (name) => {
      const pid = ensurePlayerId(socket);
      const p = getOrCreateProfileById(pid, name);
      updateLeaderboard(p.name, p.points);
      socket.emit('profile', p);
    });

    socket.on('createRoom', (playerName) => {
      const pid = ensurePlayerId(socket);
      const roomId = uuidv4().substring(0, 8).toUpperCase();
      const room = new BlackjackRoom(roomId, pid);
      room.addPlayer(pid, playerName || profiles.get(pid)?.name || 'Player');
      rooms.set(roomId, room);
      socket.join(roomId);
      socket.emit('roomCreated', { roomId, gameState: room.getGameState() });
    });

    socket.on('joinRoom', ({ roomId, playerName }) => {
      const pid = ensurePlayerId(socket);
      const room = rooms.get(roomId);
      if (!room) { socket.emit('error', 'Room not found'); return; }
      if (room.addPlayer(pid, playerName || profiles.get(pid)?.name || 'Player')) { socket.join(roomId); bjNsp.to(roomId).emit('gameStateUpdate', room.getGameState()); } else { socket.emit('error', 'Cannot join room'); }
    });

    socket.on('startGame', () => {
      const pid = sessions.get(socket.id) || ensurePlayerId(socket);
      const room = Array.from(rooms.values()).find(r => r.hostId === pid);
      if (!room) return;
      if (room.startGame()) bjNsp.to(room.id).emit('gameStateUpdate', room.getGameState());
    });

    socket.on('placeBet', (amount) => {
      const pid = sessions.get(socket.id) || ensurePlayerId(socket);
      const room = Array.from(rooms.values()).find(r => r.players.has(pid));
      if (!room) return;
      if (room.placeBet(pid, amount)) {
        bjNsp.to(room.id).emit('gameStateUpdate', room.getGameState());
        if (room.allBetsPlaced()) setTimeout(() => { room.dealInitialCards(); bjNsp.to(room.id).emit('gameStateUpdate', room.getGameState()); }, 800);
      }
    });

    socket.on('hit', () => {
      const pid = sessions.get(socket.id) || ensurePlayerId(socket);
      const room = Array.from(rooms.values()).find(r => r.players.has(pid));
      if (!room) return; if (room.hit(pid)) bjNsp.to(room.id).emit('gameStateUpdate', room.getGameState());
    });
    socket.on('stand', () => {
      const pid = sessions.get(socket.id) || ensurePlayerId(socket);
      const room = Array.from(rooms.values()).find(r => r.players.has(pid));
      if (!room) return; if (room.stand(pid)) bjNsp.to(room.id).emit('gameStateUpdate', room.getGameState());
    });

    socket.on('disconnect', () => {
      const pid = sessions.get(socket.id);
      rooms.forEach((room, roomId) => {
        if (pid && room.players.has(pid)) {
          room.removePlayer(pid);
          if (room.players.size === 0) rooms.delete(roomId); else bjNsp.to(roomId).emit('gameStateUpdate', room.getGameState());
        }
      });
      const profile = getProfileBySocketId(socket.id);
      if (profile) updateLeaderboard(profile.name, profile.points);
    });
  });
})();

// ------------- Poker implementation (adapted) ------------- //
(function registerPoker() {
  const rooms = new Map();

  class PokerRoom {
    constructor(roomId, hostId) { this.id = roomId; this.hostId = hostId; this.players = []; this.bots = []; this.gameState = 'waiting'; this.currentPlayer = 0; this.pot = 0; this.communityCards = []; this.deck = []; this.currentBet = 0; this.round = 'preflop'; }
    addPlayer(playerId, playerName) { if (this.players.length >= 4) return false; const player = { id: playerId, name: playerName, balance: 0, cards: [], currentBet: 0, folded: false, allIn: false, isBot: false }; this.players.push(player); return true; }
    addBot() { const botNames = ['Bot Alice', 'Bot Bob', 'Bot Charlie']; const botName = botNames[this.bots.length % botNames.length]; const bot = { id: `bot_${Date.now()}_${Math.random()}`, name: botName, balance: 0, cards: [], currentBet: 0, folded: false, allIn: false, isBot: true }; this.bots.push(bot); this.players.push(bot); }
    fillWithBots() { while (this.players.length < 2) this.addBot(); }
    startGame() { this.fillWithBots(); this.gameState = 'playing'; this.initializeDeck(); this.dealCards(); this.currentPlayer = 0; this.currentBet = 0; this.round = 'preflop'; this.pot = 0; this.players.forEach(p => { p.folded = false; p.allIn = false; p.currentBet = 0; }); }
    initializeDeck() { const suits = ['♠', '♥', '♦', '♣']; const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']; this.deck = []; suits.forEach(s => ranks.forEach(r => this.deck.push({ suit: s, rank: r, value: this.getCardValue(r) }))); for (let i = this.deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]]; } }
    getCardValue(rank) { const values = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 }; return values[rank]; }
    dealCards() { this.players.forEach(p => { p.cards = [this.deck.pop(), this.deck.pop()]; }); }
    playerAction(playerId, action, amount = 0) { const player = this.players.find(p => p.id === playerId); if (!player || player.folded) return false; switch(action){ case 'fold': player.folded = true; break; case 'call': { const callAmt = this.currentBet - player.currentBet; const profile = profiles.get(playerId); if (callAmt > 0 && profile && profile.points >= callAmt) { profile.points -= callAmt; updateLeaderboard(profile.name, profile.points); player.currentBet = this.currentBet; this.pot += callAmt; } break; } case 'raise': { if (amount > this.currentBet) { const raiseAmt = amount - player.currentBet; const profile = profiles.get(playerId); if (profile && profile.points >= raiseAmt) { profile.points -= raiseAmt; updateLeaderboard(profile.name, profile.points); player.currentBet = amount; this.currentBet = amount; this.pot += raiseAmt; } } break; } case 'check': default: break; } this.nextPlayer(); return true; }
    nextPlayer() { do { this.currentPlayer = (this.currentPlayer + 1) % this.players.length; } while (this.players[this.currentPlayer].folded); if (this.isRoundComplete()) this.nextRound(); }
    isRoundComplete() { const active = this.players.filter(p => !p.folded); return active.every(p => p.currentBet === this.currentBet); }
    nextRound() { switch (this.round) { case 'preflop': this.round = 'flop'; this.communityCards = [this.deck.pop(), this.deck.pop(), this.deck.pop()]; break; case 'flop': this.round = 'turn'; this.communityCards.push(this.deck.pop()); break; case 'turn': this.round = 'river'; this.communityCards.push(this.deck.pop()); break; case 'river': this.endGame(); return; } this.currentPlayer = 0; this.currentBet = 0; this.players.forEach(p => { p.currentBet = 0; }); }
    endGame() { const active = this.players.filter(p => !p.folded); if (active.length === 1) { const w = active[0]; const prof = profiles.get(w.id); if (prof) { prof.points += this.pot; updateLeaderboard(prof.name, prof.points); } } else { const share = Math.floor(this.pot / active.length); active.forEach(p => { const prof = profiles.get(p.id); if (prof) { prof.points += share; updateLeaderboard(prof.name, prof.points); } }); } this.gameState = 'finished'; setTimeout(() => { this.gameState = 'waiting'; this.communityCards = []; this.pot = 0; }, 4000); }
    processBotTurn() { const cur = this.players[this.currentPlayer]; if (!cur.isBot) return; setTimeout(() => { const actions = ['fold', 'call', 'check']; const a = actions[Math.floor(Math.random() * actions.length)]; if (a === 'call' && this.currentBet > cur.currentBet) this.playerAction(cur.id, 'call'); else if (a === 'check' && this.currentBet === cur.currentBet) this.playerAction(cur.id, 'check'); else this.playerAction(cur.id, 'fold'); pokerNsp.to(this.id).emit('gameState', this.getGameState()); }, 800 + Math.random()*1200); }
    getGameState() { return { roomId: this.id, players: this.players.map(p => ({ id:p.id, name:p.name, balance: profiles.get(p.id)?.points ?? 0, currentBet:p.currentBet, folded:p.folded, allIn:p.allIn, isBot:p.isBot, cards: p.isBot ? [] : p.cards })), communityCards: this.communityCards, pot: this.pot, currentPlayer: this.currentPlayer, currentBet: this.currentBet, round: this.round, gameState: this.gameState }; }
  }

  const pokerNsp = io.of('/poker');
  pokerNsp.on('connection', (socket) => {
    socket.on('profile:init', (name) => {
      const pid = ensurePlayerId(socket);
      const p = getOrCreateProfileById(pid, name);
      updateLeaderboard(p.name, p.points);
      socket.emit('profile', p);
    });

    socket.on('createRoom', (playerName) => {
      const pid = ensurePlayerId(socket);
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const room = new PokerRoom(roomId, pid);
      room.addPlayer(pid, playerName || profiles.get(pid)?.name || 'Player');
      rooms.set(roomId, room);
      socket.join(roomId);
      socket.emit('roomCreated', { roomId, room: room.getGameState() });
    });

    socket.on('joinRoom', ({ roomId, playerName }) => {
      const pid = ensurePlayerId(socket);
      const room = rooms.get(roomId);
      if (room && room.addPlayer(pid, playerName || profiles.get(pid)?.name || 'Player')) {
        socket.join(roomId);
        pokerNsp.to(roomId).emit('playerJoined', room.getGameState());
      } else {
        socket.emit('joinFailed', 'Room full or does not exist');
      }
    });

    socket.on('startGame', (roomId) => {
      const pid = sessions.get(socket.id) || ensurePlayerId(socket);
      const room = rooms.get(roomId);
      if (room && room.hostId === pid) {
        room.startGame();
        pokerNsp.to(roomId).emit('gameStarted', room.getGameState());
        if (room.players[room.currentPlayer]?.isBot) room.processBotTurn();
      }
    });

    socket.on('playerAction', ({ roomId, action, amount }) => {
      const pid = sessions.get(socket.id) || ensurePlayerId(socket);
      const room = rooms.get(roomId);
      if (room && room.players[room.currentPlayer]?.id === pid) {
        room.playerAction(pid, action, amount);
        pokerNsp.to(roomId).emit('gameState', room.getGameState());
        if (room.gameState === 'playing' && room.players[room.currentPlayer]?.isBot) room.processBotTurn();
      }
    });

    socket.on('disconnect', () => {
      const pid = sessions.get(socket.id);
      rooms.forEach((room, roomId) => {
        const idx = room.players.findIndex(p => p.id === pid);
        if (idx !== -1) {
          room.players.splice(idx, 1);
          if (room.players.length === 0) rooms.delete(roomId); else pokerNsp.to(roomId).emit('playerLeft', room.getGameState());
        }
      });
      const profile = getProfileBySocketId(socket.id);
      if (profile) updateLeaderboard(profile.name, profile.points);
    });
  });
})();

// Health route
app.get('/health', (_req, res) => res.json({ ok: true }));

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Combined Casino server running on port ${PORT}`);
});
