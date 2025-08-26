const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

class Database {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, 'casino.db'));
        this.initializeTables();
    }

    initializeTables() {
        // Users table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                balance INTEGER DEFAULT 250,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Game sessions table for tracking activity
        this.db.run(`
            CREATE TABLE IF NOT EXISTS game_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                game_type TEXT NOT NULL,
                balance_change INTEGER,
                session_start DATETIME DEFAULT CURRENT_TIMESTAMP,
                session_end DATETIME,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);
    }

    // User authentication methods
    async createUser(username, password) {
        return new Promise((resolve, reject) => {
            const passwordHash = bcrypt.hashSync(password, 10);
            this.db.run(
                'INSERT INTO users (username, password_hash) VALUES (?, ?)',
                [username, passwordHash],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID, username, balance: 250 });
                    }
                }
            );
        });
    }

    async authenticateUser(username, password) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE username = ?',
                [username],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (!row) {
                        resolve(null);
                    } else {
                        const isValid = bcrypt.compareSync(password, row.password_hash);
                        if (isValid) {
                            resolve({
                                id: row.id,
                                username: row.username,
                                balance: row.balance
                            });
                        } else {
                            resolve(null);
                        }
                    }
                }
            );
        });
    }

    async getUserById(id) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT id, username, balance FROM users WHERE id = ?',
                [id],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    async updateUserBalance(userId, newBalance) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET balance = ? WHERE id = ?',
                [newBalance, userId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ changed: this.changes });
                    }
                }
            );
        });
    }

    async logGameSession(userId, gameType, balanceChange) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO game_sessions (user_id, game_type, balance_change) VALUES (?, ?, ?)',
                [userId, gameType, balanceChange],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID });
                    }
                }
            );
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = Database;