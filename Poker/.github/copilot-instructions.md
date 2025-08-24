<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

This is a multiplayer poker game project built with Node.js, Express, and Socket.IO.

## Key Features:
- Texas Hold'em poker game
- Lobby system supporting 1-4 players
- Automatic bot players to fill empty seats
- Real-time multiplayer communication via Socket.IO
- Point-based betting system with 250 starting balance
- Modern responsive web UI

## Architecture:
- Backend: Node.js with Express server and Socket.IO for real-time communication
- Frontend: Vanilla HTML, CSS, and JavaScript with Socket.IO client
- Game logic: Server-side poker game state management with bot AI

## Code Style:
- Use modern JavaScript ES6+ features
- Follow consistent naming conventions (camelCase for variables/functions)
- Add comprehensive error handling
- Keep game logic modular and well-documented
- Ensure PowerShell-compatible terminal commands for Windows development

## Game Rules:
- Texas Hold'em poker variant
- Players start with 250 points
- Minimum 1 human player, maximum 4 total players
- Bots automatically fill empty seats when game starts
- Standard poker betting rounds: pre-flop, flop, turn, river
