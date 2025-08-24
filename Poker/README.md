# 🃏 Multiplayer Poker Game

A real-time multiplayer Texas Hold'em poker game with lobby system and intelligent bot players.

## Features

- **Multiplayer Lobby System**: Support for 1-4 players with real-time updates
- **Smart Bot Players**: Automatically fill empty seats with AI opponents
- **Texas Hold'em Rules**: Complete poker game implementation with all betting rounds
- **Point-Based Betting**: Players start with 250 points and can bet with a slider interface
- **Modern UI**: Responsive design with casino-themed styling
- **Real-time Communication**: Built with Socket.IO for instant game updates

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager

### Installation

1. Clone or download the project to your local machine
2. Navigate to the project directory:
   ```powershell
   cd "c:\Users\conno\Multiplayer-Casino\Poker"
   ```

3. Install dependencies:
   ```powershell
   npm install
   ```

4. Start the server:
   ```powershell
   npm start
   ```

5. Open your web browser and go to:
   ```
   http://localhost:3000
   ```

## How to Play

### Creating a Game
1. Enter your name on the welcome screen
2. Click "Create Room" to start a new game
3. Share the Room ID with other players
4. Click "Start Game" when ready (bots will fill empty seats)

### Joining a Game
1. Enter your name on the welcome screen
2. Click "Join Room" and enter the Room ID
3. Wait for the host to start the game

### Game Controls
- **Fold**: Give up your hand and forfeit any bets
- **Check**: Pass your turn without betting (only when no bet is required)
- **Call**: Match the current bet amount
- **Raise**: Increase the bet using the slider

### Betting System
- All players start with 250 points
- Use the bet slider to set your raise amount
- Points are tracked throughout the game
- Win the pot by having the best hand or making others fold

## Technical Details

### Architecture
- **Backend**: Node.js with Express and Socket.IO
- **Frontend**: Vanilla HTML, CSS, and JavaScript
- **Real-time Communication**: WebSocket connections via Socket.IO
- **Game State**: Server-side management with client synchronization

### File Structure
```
├── server.js          # Main server and game logic
├── public/
│   ├── index.html     # Main game interface
│   ├── style.css      # Game styling and animations
│   └── script.js      # Client-side game logic
├── package.json       # Project dependencies
└── README.md         # This file
```

### Development Commands

```powershell
# Start the development server
npm run dev

# Start the production server
npm start
```

## Game Rules

This implementation follows standard Texas Hold'em poker rules:

1. **Pre-flop**: Each player receives 2 private cards
2. **Flop**: 3 community cards are revealed
3. **Turn**: 1 additional community card is revealed  
4. **River**: Final community card is revealed
5. **Showdown**: Best 5-card hand wins the pot

### Betting Rounds
- Players can fold, check, call, or raise during each round
- Betting continues until all active players have matched the highest bet
- The pot accumulates all bets and goes to the winner

### Bot Behavior
- Bots make decisions based on simple AI logic
- They can fold, call, or check with varying probability
- Bots help ensure games can start even with fewer human players

## Customization

The game can be easily customized by modifying:

- **Starting Balance**: Change the initial 250 points in `server.js`
- **Player Limits**: Adjust maximum players (currently 4)
- **Bot AI**: Enhance bot decision-making logic
- **Styling**: Modify the CSS for different themes
- **Game Variants**: Add different poker variants

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Known Issues

- Hand evaluation is simplified (currently based on highest card)
- Bot AI uses basic random logic
- Mobile responsiveness could be improved

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is open source and available under the ISC License.
