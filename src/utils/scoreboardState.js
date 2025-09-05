class ScoreboardState {
    constructor() {
        this.listeners = new Set();
        this.state = {
            gameTime: 720000,
            quarter: 1,
            shotClock: 24000,
            teamAScore: 0,
            teamBScore: 0,
            teamAFouls: 0,
            teamBFouls: 0,
            teamATimeouts: 2,
            teamBTimeouts: 2,
            isTimeoutActive: false,
            timeoutTeam: null,
            timeoutTimeLeft: 0,
            isRunning: false,
            isShotRunning: false,
            teamAName: "Home Team",
            teamBName: "Away Team",
            teamAColor: "#1e40af",
            teamBColor: "#dc2626",
            possession: "A",
            timeoutDuration: 60,
            restBetweenQuarters: 120,
            defaultGameTime: 720000,
            timeoutsPerTeam: 3, // NEW: configurable default number of timeouts per team
            // rest state:
            restActive: false,
            restTimeLeft: 0, // ms
            restLastUpdate: Date.now(),
            lastUpdate: Date.now(),
            // optional: foulLimit could be added here if desired
        };

        this.loadFromStorage();
        window.addEventListener("storage", this.handleStorageEvent.bind(this));
        this.setupKeyboardEvents();
    }

    setupKeyboardEvents() {
        this.handleKeyDown = this.handleKeyDown.bind(this);
        window.addEventListener("keydown", this.handleKeyDown);
    }

    getCurrentTimes() {
        const now = Date.now();
        const elapsed = now - this.state.lastUpdate;

        const gameTime = this.state.isRunning
            ? Math.max(0, this.state.gameTime - elapsed)
            : this.state.gameTime;

        const shotClock = this.state.isShotRunning
            ? Math.max(0, this.state.shotClock - elapsed)
            : this.state.shotClock;

        return { gameTime, shotClock, now };
    }

    // compute current rest time (ms)
    getCurrentRest() {
        if (!this.state.restActive) return { restTimeLeft: this.state.restTimeLeft, now: Date.now() };
        const now = Date.now();
        const elapsed = now - (this.state.restLastUpdate || this.state.lastUpdate || now);
        const restTimeLeft = Math.max(0, (this.state.restTimeLeft || 0) - elapsed);
        return { restTimeLeft, now };
    }

    handleKeyDown(event) {
        // If user is typing in an input/select/textarea or contentEditable, ignore global shortcuts.
        const target = event.target;
        const tag = target && target.tagName;
        if (
            tag === "INPUT" ||
            tag === "TEXTAREA" ||
            tag === "SELECT" ||
            (target && target.isContentEditable)
        ) {
            return;
        }

        // SPACE → toggle both if both on, else just game
        if (event.code === "Space") {
            event.preventDefault();
            const { gameTime, shotClock, now } = this.getCurrentTimes();

            if (this.state.isRunning && this.state.isShotRunning) {
                this.updateState({
                    isRunning: false,
                    isShotRunning: false,
                    gameTime,
                    shotClock,
                    lastUpdate: now,
                });
            } else {
                this.updateState({
                    isRunning: !this.state.isRunning,
                    gameTime,
                    shotClock,
                    lastUpdate: now,
                });
            }
            return;
        }

        // CTRL (but ignore Ctrl+Alt or Ctrl+Shift combos) → toggle both if both off, else just shot
        if (event.ctrlKey && !event.altKey && !event.shiftKey) {
            // don't hijack Ctrl+V / Ctrl+C / Ctrl+X when focus is in input since we returned earlier.
            // But when focus isn't in an input, handle the shortcut.
            event.preventDefault();
            const { gameTime, shotClock, now } = this.getCurrentTimes();

            if (!this.state.isRunning && !this.state.isShotRunning) {
                this.updateState({
                    isRunning: true,
                    isShotRunning: true,
                    gameTime,
                    shotClock,
                    lastUpdate: now,
                });
            } else {
                this.updateState({
                    isShotRunning: !this.state.isShotRunning,
                    gameTime,
                    shotClock,
                    lastUpdate: now,
                });
            }
            return;
        }
    }

    startBothClocks() {
        const { gameTime, shotClock, now } = this.getCurrentTimes();
        this.updateState({
            isRunning: true,
            isShotRunning: true,
            gameTime,
            shotClock,
            lastUpdate: now,
        });
    }

    stopBothClocks() {
        const { gameTime, shotClock, now } = this.getCurrentTimes();
        this.updateState({
            isRunning: false,
            isShotRunning: false,
            gameTime,
            shotClock,
            lastUpdate: now,
        });
    }

    toggleGameClock() {
        const { gameTime, shotClock, now } = this.getCurrentTimes();
        this.updateState({
            isRunning: !this.state.isRunning,
            gameTime,
            shotClock,
            lastUpdate: now,
        });
    }

    toggleShotClock() {
        const { gameTime, shotClock, now } = this.getCurrentTimes();
        this.updateState({
            isShotRunning: !this.state.isShotRunning,
            gameTime,
            shotClock,
            lastUpdate: now,
        });
    }

    resetShotClock(seconds = 24) {
        const { gameTime, now } = this.getCurrentTimes();
        this.updateState({
            shotClock: seconds * 1000,
            isShotRunning: true,
            // leave isRunning as it was
            gameTime,
            lastUpdate: now,
        });
    }

    // start rest period for seconds (integer)
    startRest(seconds = 60) {
        const ms = Math.max(0, Number(seconds) || 0) * 1000;
        this.updateState({
            restActive: true,
            restTimeLeft: ms,
            restLastUpdate: Date.now(),
            // pause main clocks
            isRunning: false,
            isShotRunning: false,
            lastUpdate: Date.now(),
        });
    }

    // stop rest immediately
    stopRest() {
        this.updateState({
            restActive: false,
            restTimeLeft: 0,
            restLastUpdate: Date.now(),
        });
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem("scoreboardData");
            if (saved) {
                this.state = { ...this.state, ...JSON.parse(saved) };
                this.notifyListeners();
            }
        } catch (e) {
            console.error("Failed to load from localStorage:", e);
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem("scoreboardData", JSON.stringify(this.state));
            // Broadcast storage event for other windows
            window.dispatchEvent(
                new StorageEvent("storage", {
                    key: "scoreboardData",
                    newValue: JSON.stringify(this.state),
                })
            );
        } catch (e) {
            console.error("Failed to save to localStorage:", e);
        }
    }

    handleStorageEvent(event) {
        if (event.key === "scoreboardData" && event.newValue) {
            try {
                this.state = { ...this.state, ...JSON.parse(event.newValue) };
                this.notifyListeners();
            } catch (e) {
                console.error("Failed to parse storage data:", e);
            }
        }
    }

    updateState(updates) {
        this.state = { ...this.state, ...updates };
        this.saveToStorage();
        this.notifyListeners();
    }

    getState() {
        return this.state;
    }
    addListener(listener) {
        this.listeners.add(listener);
    }
    removeListener(listener) {
        this.listeners.delete(listener);
    }
    notifyListeners() {
        this.listeners.forEach((l) => l(this.state));
    }

    destroy() {
        window.removeEventListener("storage", this.handleStorageEvent);
        window.removeEventListener("keydown", this.handleKeyDown);
    }
}

export const scoreboardState = new ScoreboardState();
