class ScoreboardState {
  constructor() {
    this.listeners = new Set();
    this.state = {
      gameTime: 720000,
      quarter: 1,
      totalQuarters: 4,
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
      timeoutsPerTeam: 3,
      restActive: false,
      restTimeLeft: 0,
      restLastUpdate: Date.now(),
      lastUpdate: Date.now(),
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

  getCurrentRest() {
    if (!this.state.restActive)
      return { restTimeLeft: this.state.restTimeLeft, now: Date.now() };
    const now = Date.now();
    const elapsed =
      now - (this.state.restLastUpdate || this.state.lastUpdate || now);
    const restTimeLeft = Math.max(0, (this.state.restTimeLeft || 0) - elapsed);
    return { restTimeLeft, now };
  }

  handleKeyDown(event) {
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

    if (event.ctrlKey && !event.altKey && !event.shiftKey) {
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
      gameTime,
      lastUpdate: now,
    });
  }

  startRest(seconds = 60) {
    const ms = Math.max(0, Number(seconds) || 0) * 1000;
    this.updateState({
      restActive: true,
      restTimeLeft: ms,
      restLastUpdate: Date.now(),
      isRunning: false,
      isShotRunning: false,
      lastUpdate: Date.now(),
    });
  }

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

  resetGame() {
    const defaults = {
      gameTime: this.state.defaultGameTime,
      quarter: 1,
      shotClock: 24000,
      teamAScore: 0,
      teamBScore: 0,
      teamAFouls: 0,
      teamBFouls: 0,
      teamATimeouts: this.state.timeoutsPerTeam,
      teamBTimeouts: this.state.timeoutsPerTeam,
      isTimeoutActive: false,
      timeoutTeam: null,
      timeoutTimeLeft: 0,
      isRunning: false,
      isShotRunning: false,
      possession: "A",
      restActive: false,
      restTimeLeft: 0,
      lastUpdate: Date.now(),
    };
    this.updateState(defaults);
  }

  resetQuarter() {
    const defaults = {
      gameTime: this.state.defaultGameTime,
      shotClock: 24000,
      teamAFouls: 0,
      teamBFouls: 0,
      isRunning: false,
      isShotRunning: false,
      restActive: false,
      restTimeLeft: 0,
      lastUpdate: Date.now(),
    };
    this.updateState(defaults);
  }

  advanceQuarter() {
    const state = this.getState();
    if (state.quarter >= state.totalQuarters) return;

    const updates = {
      quarter: state.quarter + 1,
      gameTime: state.defaultGameTime,
      shotClock: 24000,
      teamAFouls: 0,
      teamBFouls: 0,
      isRunning: false,
      isShotRunning: false,
      isTimeoutActive: false,
      timeoutTeam: null,
      timeoutTimeLeft: 0,
      lastUpdate: Date.now(),
    };
    this.updateState(updates);
    this.startRest(state.restBetweenQuarters);
  }
}
export const scoreboardState = new ScoreboardState();
