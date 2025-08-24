# Multiplayer Blackjack Casino Game

A real-time multiplayer Blackjack game with lobby system, bot players, and point betting system. Built with Node.js, Express, Socket.IO, and modern web technologies.

## Features

- 🎮 **Multiplayer Support**: 1-4 players per room
- 🤖 **Bot Players**: Empty seats automatically filled with intelligent bots
- 💰 **Point Betting System**: Players start with 250 points and can bet on each hand
- 🏠 **Lobby System**: Create or join rooms with simple room codes
- 🎯 **Real-time Gameplay**: Live updates using WebSocket connections
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎨 **Modern UI**: Clean, dark theme with smooth animations

## How to Play

### Setup
1. Enter your name on the main menu
2. **Create Room** to host a game or **Join Room** with an existing room code
3. The host can start the game when ready

### Gameplay
1. **Betting Phase**: Place your bet (bots will bet automatically)
2. **Dealing**: Each player receives 2 cards, dealer gets 2 (one hidden)
3. **Playing Phase**: Take turns to Hit (draw card) or Stand (keep current hand)
4. **Dealer Turn**: Dealer reveals hidden card and hits until 17+
5. **Results**: Win if your hand beats dealer's without going over 21

### Winning Conditions
- **Blackjack**: 21 with first 2 cards
- **Beat Dealer**: Higher value than dealer without busting
- **Dealer Busts**: Dealer goes over 21 and you don't
- **Push**: Same value as dealer (bet returned)

## Installation & Setup

### Prerequisites
- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Installation Steps

1. **Install Dependencies**:
   ```powershell
   npm install
   ```

2. **Start the Server**:
   ```powershell
   npm start
   ```
   
   Or for development with auto-restart:
   ```powershell
   npm run dev
   ```

3. **Access the Game**:
   Open your web browser and navigate to:
   ```
   http://localhost:3000
   ```

## Game Rules

### Card Values
- **Ace**: 1 or 11 (whichever is better)
- **Face Cards** (K, Q, J): 10
- **Number Cards**: Face value

### Basic Strategy
- Try to get as close to 21 as possible without going over
- If you go over 21, you "bust" and lose automatically
- Dealer must hit on 16 and stand on 17

### Betting
- All players start with 250 points
- Minimum bet: $1
- Maximum bet: Your current balance
- Win 1:1 on regular wins
- Blackjack typically pays 3:2 (implemented as 2:1 for simplicity)

## Technical Details

### Architecture
- **Backend**: Node.js with Express and Socket.IO
- **Frontend**: Vanilla JavaScript with modern CSS
- **Real-time Communication**: WebSocket connections via Socket.IO
- **Game Logic**: Server-side game state management

### Key Files
- `server.js` - Main server and game logic
- `public/index.html` - Game interface
- `public/styles.css` - Modern styling
- `public/script.js` - Client-side game logic
- `package.json` - Dependencies and scripts

### Bot AI
Bots use a simple strategy:
- Hit if hand value < 17
- Stand if hand value >= 17
- Automatically bet $25 or their remaining balance

## Development

### Scripts
- `npm start` - Production server
- `npm run dev` - Development server with nodemon

### Port Configuration
Default port is 3000. To change:
```powershell
$env:PORT=8080; npm start
```

## Troubleshooting

### Common Issues
1. **Port in use**: Change the PORT environment variable
2. **Connection issues**: Make sure firewall allows the port
3. **Cards not showing**: Clear browser cache and refresh

### Browser Compatibility
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Responsive design included

## Future Enhancements
- Multiple deck support
- Split and double down options
- Tournament mode
- Player statistics
- Sound effects
- Private room passwords

---

Enjoy the game! 🎰♠️♥️♦️♣️
