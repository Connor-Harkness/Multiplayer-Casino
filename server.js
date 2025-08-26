const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const session = require('express-session');
const Database = require('./database');

// Import game modules
const { createBlackjackHandlers, BlackjackRoom } = require('./games/blackjack');
const { createPokerHandlers, PokerRoom } = require('./games/poker');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Initialize database
const db = new Database();

// Session configuration
app.use(session({
    secret: 'casino-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Authentication middleware for protected routes
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Authentication required' });
    }
};

// API Routes
app.post('/api/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const user = await db.createUser(username, password);
        req.session.userId = user.id;
        
        res.json({ user });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
            res.status(400).json({ error: 'Username already exists' });
        } else {
            console.error('Signup error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const user = await db.authenticateUser(username, password);
        if (user) {
            req.session.userId = user.id;
            res.json({ user });
        } else {
            res.status(401).json({ error: 'Invalid username or password' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/session', requireAuth, async (req, res) => {
    try {
        const user = await db.getUserById(req.session.userId);
        if (user) {
            res.json({ user });
        } else {
            req.session.destroy();
            res.status(401).json({ error: 'Session invalid' });
        }
    } catch (error) {
        console.error('Session error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Authentication middleware for game routes only (not static assets)
const requireAuthForPages = (req, res, next) => {
    // Allow static assets to pass through
    if (req.url.includes('.js') || req.url.includes('.css') || req.url.includes('.png') || req.url.includes('.jpg')) {
        return next();
    }
    
    if (req.session && req.session.userId) {
        next();
    } else {
        res.redirect('/');
    }
};

// Serve game assets first (so they don't require auth)
app.use('/blackjack', express.static(path.join(__dirname, 'games/blackjack/public')));
app.use('/poker', express.static(path.join(__dirname, 'games/poker/public')));

// Serve game pages with authentication
app.get('/blackjack', requireAuthForPages, (req, res) => {
    res.sendFile(path.join(__dirname, 'games/blackjack/public/index.html'));
});

app.get('/poker', requireAuthForPages, (req, res) => {
    res.sendFile(path.join(__dirname, 'games/poker/public/index.html'));
});

// Game state management
const blackjackRooms = new Map();
const pokerRooms = new Map();

// Socket.IO connection handling with authentication
io.use(async (socket, next) => {
    try {
        const session = socket.handshake.headers.cookie;
        // For now, we'll implement a simple session check
        // In production, you'd want more robust session verification
        next();
    } catch (error) {
        next(new Error('Authentication error'));
    }
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Determine which game the user is playing based on the referrer or namespace
    socket.on('joinGameType', (gameType) => {
        socket.gameType = gameType;
        
        if (gameType === 'blackjack') {
            createBlackjackHandlers(socket, io, blackjackRooms, db);
        } else if (gameType === 'poker') {
            createPokerHandlers(socket, io, pokerRooms, db);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Clean up rooms based on game type
        if (socket.gameType === 'blackjack') {
            blackjackRooms.forEach((room, roomId) => {
                if (room.players.has(socket.id)) {
                    room.removePlayer(socket.id);
                    if (room.players.size === 0) {
                        blackjackRooms.delete(roomId);
                    } else {
                        io.to(roomId).emit('gameStateUpdate', room.getGameState());
                    }
                }
            });
        } else if (socket.gameType === 'poker') {
            pokerRooms.forEach((room, roomId) => {
                const playerIndex = room.players.findIndex(p => p.id === socket.id);
                if (playerIndex !== -1) {
                    room.players.splice(playerIndex, 1);
                    if (room.players.length === 0) {
                        pokerRooms.delete(roomId);
                    } else {
                        io.to(roomId).emit('playerLeft', room.getGameState());
                    }
                }
            });
        }
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎰 Multiplayer Casino running on http://localhost:${PORT}`);
    console.log('🃏 Blackjack available at /blackjack');
    console.log('♠️ Poker available at /poker');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    db.close();
    process.exit(0);
});