import React, { useState, useEffect } from "react";
import { scoreboardState } from "../utils/scoreboardState";
import { Settings, Play, Pause, SkipForward } from "lucide-react";

export default function ControlScreen() {
  const [scoreboardData, setScoreboardData] = useState(
    scoreboardState.getState()
  );

  // Settings modal (temp values)
  const [showSettings, setShowSettings] = useState(false);
  const [tempTeamAName, setTempTeamAName] = useState("");
  const [tempTeamBName, setTempTeamBName] = useState("");
  const [tempTeamAColor, setTempTeamAColor] = useState("#1e40af");
  const [tempTeamBColor, setTempTeamBColor] = useState("#dc2626");
  const [tempTimeoutDuration, setTempTimeoutDuration] = useState(60);
  const [tempRestBetweenQuarters, setTempRestBetweenQuarters] = useState(60);
  const [tempDefaultGameMinutes, setTempDefaultGameMinutes] = useState(12);
  const [tempDefaultGameSeconds, setTempDefaultGameSeconds] = useState(0);
  const [tempTimeoutsPerTeam, setTempTimeoutsPerTeam] = useState(3);

  // Edit clocks
  const [editingClock, setEditingClock] = useState(null);
  const [editMinutes, setEditMinutes] = useState(0);
  const [editSeconds, setEditSeconds] = useState(0);
  const [editShotSeconds, setEditShotSeconds] = useState(0);

  // Next quarter confirm
  const [confirmNext, setConfirmNext] = useState(false);

  useEffect(() => {
    const listener = (state) => setScoreboardData({ ...state });
    scoreboardState.addListener(listener);

    // Live update (game/shot/rest/timeout countdown)
    const interval = setInterval(() => {
      const { gameTime, shotClock } = scoreboardState.getCurrentTimes();
      const { restTimeLeft } = scoreboardState.getCurrentRest();
      const fresh = scoreboardState.getState();
      setScoreboardData((prev) => ({
        ...fresh,
        gameTime,
        shotClock,
        restTimeLeft,
      }));
    }, 150);

    return () => {
      scoreboardState.removeListener(listener);
      clearInterval(interval);
    };
  }, []);

  // Helpers
  const pad = (n) => String(n).padStart(2, "0");
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${pad(seconds)}`;
  };

  // Timeout remaining in seconds
  const getTimeoutRemainingSec = () => {
    if (!scoreboardData.isTimeoutActive) return 0;
    const last =
      scoreboardData.timeoutLastUpdate ||
      scoreboardData.lastUpdate ||
      Date.now();
    const elapsedSec = Math.floor((Date.now() - last) / 1000);
    const remaining = Math.max(
      0,
      (Number(scoreboardData.timeoutTimeLeft) || 0) - elapsedSec
    );
    return remaining;
  };

  // Ensure timeout vanishes immediately when it reaches zero
  useEffect(() => {
    if (scoreboardData.isTimeoutActive) {
      const rem = getTimeoutRemainingSec();
      if (rem <= 0) {
        scoreboardState.updateState({
          isTimeoutActive: false,
          timeoutTeam: null,
          timeoutTimeLeft: 0,
          timeoutLastUpdate: null,
        });
      }
    }
  }, [
    scoreboardData.timeoutTimeLeft,
    scoreboardData.timeoutLastUpdate,
    scoreboardData.isTimeoutActive,
    scoreboardData.lastUpdate,
    scoreboardData.teamATimeouts,
    scoreboardData.teamBtimeouts,
  ]);

  // Open settings and populate temp fields
  const openSettings = () => {
    setTempTeamAName(scoreboardData.teamAName || "");
    setTempTeamBName(scoreboardData.teamBName || "");
    setTempTeamAColor(scoreboardData.teamAColor || "#1e40af");
    setTempTeamBColor(scoreboardData.teamBColor || "#dc2626");
    setTempTimeoutDuration(scoreboardData.timeoutDuration ?? 60);
    setTempRestBetweenQuarters(scoreboardData.restBetweenQuarters ?? 60);

    const defMs = scoreboardData.defaultGameTime ?? 720000;
    const total = Math.floor(defMs / 1000);
    setTempDefaultGameMinutes(Math.floor(total / 60));
    setTempDefaultGameSeconds(total % 60);

    setTempTimeoutsPerTeam(Number(scoreboardData.timeoutsPerTeam ?? 3));
    setShowSettings(true);
  };

  const saveSettings = () => {
    const defTotalSeconds = Math.max(
      0,
      (Number(tempDefaultGameMinutes) || 0) * 60 +
        (Number(tempDefaultGameSeconds) || 0)
    );

    const newTimeouts = Number(tempTimeoutsPerTeam || 0);

    scoreboardState.updateState({
      teamAName: tempTeamAName,
      teamBName: tempTeamBName,
      teamAColor: tempTeamAColor,
      teamBColor: tempTeamBColor,
      timeoutDuration: Number(tempTimeoutDuration) || 0,
      restBetweenQuarters: Number(tempRestBetweenQuarters) || 0,
      defaultGameTime: defTotalSeconds * 1000,
      timeoutsPerTeam: newTimeouts,
      teamATimeouts: newTimeouts,
      teamBTimeouts: newTimeouts,
    });

    setShowSettings(false);
  };

  const cancelSettings = () => setShowSettings(false);

  // Edit clocks
  const openEditDialog = (type) => {
    setEditingClock(type);
    if (type === "game") {
      const totalSeconds = Math.floor(scoreboardData.gameTime / 1000);
      setEditMinutes(Math.floor(totalSeconds / 60));
      setEditSeconds(totalSeconds % 60);
    } else {
      setEditShotSeconds(Math.ceil(scoreboardData.shotClock / 1000));
    }
  };

  const applyGameEdit = () => {
    const total = Math.max(
      0,
      (Number(editMinutes) || 0) * 60 + (Number(editSeconds) || 0)
    );
    scoreboardState.updateState({
      gameTime: total * 1000,
      lastUpdate: Date.now(),
    });
    setEditingClock(null);
  };

  const applyShotEdit = () => {
    const sec = Math.max(0, Number(editShotSeconds) || 0);
    scoreboardState.updateState({
      shotClock: sec * 1000,
      lastUpdate: Date.now(),
    });
    setEditingClock(null);
  };

  // Score change helper
  const changeScore = (team, delta) => {
    const current = scoreboardState.getState();
    const key = team === "A" ? "teamAScore" : "teamBScore";
    const newScore = Math.max(0, (current[key] || 0) + delta);
    const updates = { [key]: newScore };

    if (delta > 0) {
      updates.possession = team === "A" ? "B" : "A";
    }

    scoreboardState.updateState(updates);
  };

  // Manual possession controls
  const setPossession = (team) => {
    scoreboardState.updateState({ possession: team });
  };

  const flipPossession = () => {
    const cur = scoreboardState.getState().possession;
    const other = cur === "A" ? "B" : "A";
    scoreboardState.updateState({ possession: other });
  };

  // Use Timeout
  const useTimeout = (team) => {
    const tKey = team === "A" ? "teamATimeouts" : "teamBTimeouts";
    if ((scoreboardData[tKey] || 0) <= 0) return;
    scoreboardState.updateState({
      isTimeoutActive: true,
      timeoutTeam: team,
      timeoutTimeLeft: Number(scoreboardData.timeoutDuration) || 60,
      timeoutLastUpdate: Date.now(),
      [tKey]: scoreboardData[tKey] - 1,
    });
  };

  // End timeout early
  const endTimeout = () => {
    scoreboardState.updateState({
      isTimeoutActive: false,
      timeoutTeam: null,
      timeoutTimeLeft: 0,
      timeoutLastUpdate: null,
    });
  };

  // Next Quarter flow
  const handleNextQuarterClicked = () => setConfirmNext(true);

  const confirmNextQuarter = () => {
    const state = scoreboardState.getState();
    const defaultGame = state.defaultGameTime ?? 720000;
    const timeoutsCount = Number(
      state.timeoutsPerTeam ?? state.teamATimeouts ?? 3
    );

    const swapAndReset = {
      quarter: (state.quarter || scoreboardData.quarter) + 1,
      teamAName: state.teamBName,
      teamBName: state.teamAName,
      teamAColor: state.teamBColor,
      teamBColor: state.teamAColor,
      teamAScore: state.teamBScore,
      teamBScore: state.teamAScore,
      teamAFouls: 0,
      teamBFouls: 0,
      teamATimeouts: timeoutsCount,
      teamBTimeouts: timeoutsCount,
      isTimeoutActive: false,
      timeoutTeam: null,
      timeoutTimeLeft: 0,
      timeoutLastUpdate: null,
      gameTime: defaultGame,
      shotClock: 24000,
      isRunning: false,
      isShotRunning: false,
      lastUpdate: Date.now(),
    };

    scoreboardState.updateState(swapAndReset);
    const restSec = state.restBetweenQuarters ?? 60;
    scoreboardState.startRest(restSec);
    setConfirmNext(false);
  };

  // Toggle rest timer
  const toggleRestTimer = () => {
    if (scoreboardData.restRunning) {
      scoreboardState.pauseRest();
    } else {
      scoreboardState.resumeRest();
    }
  };

  // Close rest early
  const stopRestEarly = () => {
    scoreboardState.stopRest();
  };

  // Format rest seconds
  const formatRest = (ms) => {
    const s = Math.ceil((ms || 0) / 1000);
    return `${s}s`;
  };

  // Helper to format timeout mm:ss
  const formatTimeoutMMSS = (seconds) => {
    const mm = Math.floor(seconds / 60);
    const ss = seconds % 60;
    return `${mm}:${String(ss).padStart(2, "0")}`;
  };

  const timeoutRemaining = getTimeoutRemainingSec();

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-3xl font-bold">Basketball Scoreboard Control</h1>
          <div className="text-sm text-gray-300 mt-2">
            {scoreboardData.teamAName}{" "}
            <span className="font-bold">{scoreboardData.teamAScore}</span>
            {"  -  "}
            <span className="font-bold">{scoreboardData.teamBScore}</span>{" "}
            {scoreboardData.teamBName}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-lg">Quarter</div>
            <div className="text-2xl font-bold">Q{scoreboardData.quarter}</div>
          </div>

          <button
            className="p-2 bg-gray-700 rounded hover:bg-gray-600"
            onClick={openSettings}
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Timeout banner */}
      {scoreboardData.isTimeoutActive && (
        <div className="max-w-2xl mx-auto mb-6">
          <div className="bg-blue-800/90 p-3 rounded-lg flex items-center justify-between shadow-md">
            <div>
              <div className="text-sm text-blue-100 uppercase tracking-wide">
                Timeout
              </div>
              <div className="text-lg font-bold text-white mt-1">
                {scoreboardData.timeoutTeam === "A"
                  ? scoreboardData.teamAName
                  : scoreboardData.teamBName}
              </div>
            </div>

            <div className="text-center">
              <div className="text-sm text-blue-100">Remaining</div>
              <div className="text-2xl font-mono font-extrabold">
                {formatTimeoutMMSS(timeoutRemaining)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="bg-red-600 px-3 py-1 rounded flex items-center gap-1"
                onClick={() => endTimeout()}
              >
                <Pause size={16} />
                End Timeout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rest banner */}
      {scoreboardData.restActive && (
        <div className="max-w-2xl mx-auto mb-6">
          <div className="bg-purple-800/90 p-3 rounded-lg flex items-center justify-between shadow-md">
            <div>
              <div className="text-sm text-purple-100 uppercase tracking-wide">
                Rest Period
              </div>
              <div className="text-lg font-bold text-white mt-1">
                Between Quarters
              </div>
            </div>

            <div className="text-center">
              <div className="text-sm text-purple-100">Remaining</div>
              <div className="text-2xl font-mono font-extrabold">
                {formatRest(scoreboardData.restTimeLeft)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className={`px-3 py-1 rounded flex items-center gap-1 ${
                  scoreboardData.restRunning ? "bg-red-600" : "bg-green-600"
                }`}
                onClick={toggleRestTimer}
              >
                {scoreboardData.restRunning ? (
                  <Pause size={16} />
                ) : (
                  <Play size={16} />
                )}
                {scoreboardData.restRunning ? "Pause" : "Start"}
              </button>
              <button
                className="bg-gray-600 px-3 py-1 rounded flex items-center gap-1"
                onClick={stopRestEarly}
              >
                <SkipForward size={16} />
                Skip Rest
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clocks */}
      <div className="flex justify-center gap-8 mb-6">
        <div className="bg-gray-800 p-4 rounded-lg text-center cursor-pointer">
          <h2 className="text-lg">Game Clock</h2>
          <p
            className="text-4xl font-mono hover:text-yellow-400 select-none"
            onClick={() => openEditDialog("game")}
            role="button"
            tabIndex={0}
          >
            {formatTime(scoreboardData.gameTime)}
          </p>
          <button
            className={`mt-2 ${
              scoreboardData.isRunning ? "bg-red-600" : "bg-blue-600"
            } px-4 py-2 rounded`}
            onClick={() => scoreboardState.toggleGameClock()}
          >
            {scoreboardData.isRunning ? "Pause" : "Start"}
          </button>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg text-center cursor-pointer">
          <h2 className="text-lg">Shot Clock</h2>
          <p
            className="text-4xl font-mono hover:text-yellow-400 select-none"
            onClick={() => openEditDialog("shot")}
            role="button"
            tabIndex={0}
          >
            {Math.ceil(scoreboardData.shotClock / 1000)}
          </p>

          <div className="mt-2 flex gap-2 justify-center">
            <button
              className={`mt-2 ${
                scoreboardData.isShotRunning ? "bg-red-600" : "bg-blue-600"
              } px-4 py-2 rounded`}
              onClick={() => scoreboardState.toggleShotClock()}
            >
              {scoreboardData.isShotRunning ? "Pause" : "Start"}
            </button>
            <button
              className="bg-red-600 px-8 py-4 text-2xl rounded shadow"
              onClick={() => scoreboardState.resetShotClock(24)}
            >
              24
            </button>
            <button
              className="bg-orange-600 px-8 py-4 text-2xl rounded shadow"
              onClick={() => scoreboardState.resetShotClock(14)}
            >
              14
            </button>
          </div>
        </div>
      </div>

      {/* Possession controls */}
      <div className="flex justify-center gap-4 mb-6">
        <div className="bg-gray-800 p-3 rounded-lg text-center">
          <div className="text-sm">Possession</div>
          <div className="flex gap-2 items-center mt-2">
            <button
              onClick={() => setPossession("A")}
              className={`px-4 py-2 rounded ${
                scoreboardData.possession === "A"
                  ? "bg-yellow-500 text-black"
                  : "bg-gray-700"
              }`}
            >
              {scoreboardData.teamAName}
            </button>
            <button
              onClick={() => setPossession("B")}
              className={`px-4 py-2 rounded ${
                scoreboardData.possession === "B"
                  ? "bg-yellow-500 text-black"
                  : "bg-gray-700"
              }`}
            >
              {scoreboardData.teamBName}
            </button>
            <button
              onClick={flipPossession}
              className="ml-2 px-3 py-2 bg-red-600 rounded"
            >
              Turnover
            </button>
          </div>
        </div>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {[
          ["A", scoreboardData.teamAName, scoreboardData.teamAColor],
          ["B", scoreboardData.teamBName, scoreboardData.teamBColor],
        ].map(([team, name, color]) => (
          <div
            key={team}
            className="bg-gray-800 p-4 rounded-lg text-center"
            style={{ borderTop: `4px solid ${color}` }}
          >
            <h2 className="text-xl font-bold mb-2">{name}</h2>

            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <div className="text-sm text-gray-400">Score</div>
              <div className="text-5xl font-extrabold">
                {team === "A"
                  ? scoreboardData.teamAScore
                  : scoreboardData.teamBScore}
              </div>
            </div>

            <div className="flex justify-center gap-3 mb-3">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  className="bg-green-600 px-8 py-4 text-2xl rounded shadow"
                  onClick={() => changeScore(team, n)}
                >
                  +{n}
                </button>
              ))}
            </div>

            <div className="flex justify-center gap-3 mb-4">
              {[-1, -2, -3].map((n) => (
                <button
                  key={n}
                  className="bg-red-600 px-6 py-3 text-lg rounded"
                  onClick={() => changeScore(team, n)}
                >
                  {n}
                </button>
              ))}
            </div>

            <p>
              Fouls:{" "}
              {team === "A"
                ? scoreboardData.teamAFouls
                : scoreboardData.teamBFouls}
            </p>
            <button
              className="bg-yellow-600 px-3 py-1 rounded mt-2"
              onClick={() =>
                scoreboardState.updateState({
                  [team === "A" ? "teamAFouls" : "teamBFouls"]:
                    (team === "A"
                      ? scoreboardData.teamAFouls
                      : scoreboardData.teamBFouls) + 1,
                })
              }
            >
              Add Foul
            </button>

            <p className="mt-2">
              Timeouts:{" "}
              {team === "A"
                ? scoreboardData.teamATimeouts
                : scoreboardData.teamBTimeouts}
            </p>
            <button
              className="bg-purple-600 px-3 py-1 rounded mt-2"
              onClick={() => useTimeout(team)}
            >
              Use Timeout
            </button>
          </div>
        ))}
      </div>

      {/* Bottom controls */}
      <div className="flex justify-center gap-4 mb-8">
        <button
          className="bg-blue-600 px-4 py-2 rounded"
          onClick={handleNextQuarterClicked}
        >
          Next Quarter
        </button>

        <button
          className="bg-red-600 px-4 py-2 rounded"
          onClick={() => {
            const def = scoreboardData.defaultGameTime ?? 720000;
            const t = scoreboardData.timeoutsPerTeam ?? 3;
            scoreboardState.updateState({
              gameTime: def,
              quarter: 1,
              shotClock: 24000,
              teamAScore: 0,
              teamBScore: 0,
              teamAFouls: 0,
              teamBFouls: 0,
              teamATimeouts: t,
              teamBTimeouts: t,
              isTimeoutActive: false,
              timeoutTeam: null,
              timeoutTimeLeft: 0,
              timeoutLastUpdate: null,
              isRunning: false,
              isShotRunning: false,
              possession: "A",
              lastUpdate: Date.now(),
            });
          }}
        >
          Reset Game
        </button>
      </div>

      {/* Confirm next quarter */}
      {confirmNext && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white text-black p-6 rounded-lg w-80">
            <h2 className="text-xl font-bold mb-4">Confirm Next Quarter</h2>
            <p className="mb-4">
              Are you sure you want to advance to the next quarter and swap
              sides?
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="bg-gray-500 px-4 py-2 rounded text-white"
                onClick={() => setConfirmNext(false)}
              >
                Cancel
              </button>
              <button
                className="bg-blue-600 px-4 py-2 rounded text-white"
                onClick={confirmNextQuarter}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white text-black p-6 rounded-lg w-96 max-h-screen overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Settings</h2>

            <label className="block mb-2">Team A Name</label>
            <input
              type="text"
              className="w-full border px-2 py-1 mb-2"
              value={tempTeamAName}
              onChange={(e) => setTempTeamAName(e.target.value)}
            />

            <label className="block mb-2">Team A Color</label>
            <input
              type="color"
              className="mb-4"
              value={tempTeamAColor}
              onChange={(e) => setTempTeamAColor(e.target.value)}
            />

            <label className="block mb-2">Team B Name</label>
            <input
              type="text"
              className="w-full border px-2 py-1 mb-2"
              value={tempTeamBName}
              onChange={(e) => setTempTeamBName(e.target.value)}
            />

            <label className="block mb-2">Team B Color</label>
            <input
              type="color"
              className="mb-4"
              value={tempTeamBColor}
              onChange={(e) => setTempTeamBColor(e.target.value)}
            />

            <label className="block mb-2">Timeout Duration (seconds)</label>
            <input
              type="number"
              className="w-full border px-2 py-1 mb-4"
              value={tempTimeoutDuration}
              onChange={(e) =>
                setTempTimeoutDuration(Number(e.target.value || 0))
              }
            />

            <label className="block mb-2">Timeouts per team</label>
            <input
              type="number"
              className="w-full border px-2 py-1 mb-4"
              value={tempTimeoutsPerTeam}
              onChange={(e) =>
                setTempTimeoutsPerTeam(Math.max(0, Number(e.target.value || 0)))
              }
            />

            <label className="block mb-2">
              Rest Between Quarters (seconds)
            </label>
            <input
              type="number"
              className="w-full border px-2 py-1 mb-4"
              value={tempRestBetweenQuarters}
              onChange={(e) =>
                setTempRestBetweenQuarters(Number(e.target.value || 0))
              }
            />

            <label className="block mb-2">Default Game Time (MM : SS)</label>
            <div className="flex gap-2 items-center mb-4">
              <input
                type="number"
                className="w-24 border px-2 py-1 text-center"
                value={tempDefaultGameMinutes}
                onChange={(e) =>
                  setTempDefaultGameMinutes(
                    Math.max(0, Number(e.target.value || 0))
                  )
                }
              />
              <span>:</span>
              <input
                type="number"
                className="w-24 border px-2 py-1 text-center"
                value={pad(tempDefaultGameSeconds)}
                onChange={(e) => {
                  let val = parseInt(
                    String(e.target.value).replace(/\D/g, "") || "0"
                  );
                  if (isNaN(val)) val = 0;
                  if (val >= 60) {
                    const extra = Math.floor(val / 60);
                    setTempDefaultGameMinutes((m) => (Number(m) || 0) + extra);
                    val = val % 60;
                  }
                  setTempDefaultGameSeconds(val);
                }}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                className="bg-gray-500 px-4 py-2 rounded text-white"
                onClick={cancelSettings}
              >
                Cancel
              </button>
              <button
                className="bg-green-600 px-4 py-2 rounded text-white"
                onClick={saveSettings}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit game clock modal */}
      {editingClock === "game" && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white text-black p-6 rounded-lg w-80">
            <h2 className="text-xl font-bold mb-4">Edit Game Clock</h2>

            <div className="flex gap-2 items-center justify-center mb-2">
              <div className="text-center">
                <label className="block text-sm mb-1">Minutes</label>
                <input
                  type="number"
                  className="w-24 border px-2 py-2 text-center text-2xl"
                  value={editMinutes}
                  onChange={(e) =>
                    setEditMinutes(Math.max(0, parseInt(e.target.value || "0")))
                  }
                />
              </div>

              <div className="text-2xl font-bold">:</div>

              <div className="text-center">
                <label className="block text-sm mb-1">Seconds</label>
                <input
                  type="number"
                  className="w-24 border px-2 py-2 text-center text-2xl"
                  value={pad(editSeconds)}
                  onChange={(e) => {
                    let val = parseInt(
                      String(e.target.value).replace(/\D/g, "") || "0"
                    );
                    if (isNaN(val)) val = 0;
                    if (val >= 60) {
                      const extra = Math.floor(val / 60);
                      setEditMinutes((m) => (Number(m) || 0) + extra);
                      val = val % 60;
                    }
                    setEditSeconds(Math.max(0, val));
                  }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                className="bg-gray-500 px-4 py-2 rounded text-white"
                onClick={() => setEditingClock(null)}
              >
                Cancel
              </button>
              <button
                className="bg-blue-600 px-4 py-2 rounded text-white"
                onClick={applyGameEdit}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit shot clock modal */}
      {editingClock === "shot" && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white text-black p-6 rounded-lg w-72">
            <h2 className="text-xl font-bold mb-4">
              Edit Shot Clock (seconds)
            </h2>

            <input
              type="number"
              className="w-full border px-2 py-3 text-center text-2xl mb-2"
              value={editShotSeconds}
              onChange={(e) =>
                setEditShotSeconds(Math.max(0, parseInt(e.target.value || "0")))
              }
            />

            <div className="flex justify-end gap-2">
              <button
                className="bg-gray-500 px-4 py-2 rounded text-white"
                onClick={() => setEditingClock(null)}
              >
                Cancel
              </button>
              <button
                className="bg-blue-600 px-4 py-2 rounded text-white"
                onClick={applyShotEdit}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
