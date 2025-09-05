import React, { useState, useEffect } from "react";
import { scoreboardState } from "../utils/scoreboardState";
import { Settings } from "lucide-react";

export default function ControlScreen() {
  const [scoreboardData, setScoreboardData] = useState(scoreboardState.getState());

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
  const [editingClock, setEditingClock] = useState(null); // "game" | "shot" | null
  const [editMinutes, setEditMinutes] = useState(0);
  const [editSeconds, setEditSeconds] = useState(0);
  const [editShotSeconds, setEditShotSeconds] = useState(0);

  // Next quarter confirm + rest modal
  const [confirmNext, setConfirmNext] = useState(false);
  const [showRestModal, setShowRestModal] = useState(false);

  useEffect(() => {
    const listener = (state) => setScoreboardData({ ...state });
    scoreboardState.addListener(listener);

    // live update (game/shot/rest/timeout countdown)
    const interval = setInterval(() => {
      const { gameTime, shotClock } = scoreboardState.getCurrentTimes();
      const { restTimeLeft } = scoreboardState.getCurrentRest();
      const fresh = scoreboardState.getState();
      setScoreboardData((prev) => ({ ...fresh, gameTime, shotClock, restTimeLeft }));
    }, 150);

    return () => {
      scoreboardState.removeListener(listener);
      clearInterval(interval);
    };
  }, []);

  // helpers
  const pad = (n) => String(n).padStart(2, "0");
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${pad(seconds)}`;
  };

  // Timeout remaining in seconds (computed from timeoutTimeLeft (seconds) and timeoutLastUpdate timestamp)
  const getTimeoutRemainingSec = () => {
    if (!scoreboardData.isTimeoutActive) return 0;
    const last = scoreboardData.timeoutLastUpdate || scoreboardData.lastUpdate || Date.now();
    const elapsedSec = Math.floor((Date.now() - last) / 1000);
    const remaining = Math.max(0, (Number(scoreboardData.timeoutTimeLeft) || 0) - elapsedSec);
    return remaining;
  };

  // ensure timeout vanishes immediately when it reaches zero
  useEffect(() => {
    if (scoreboardData.isTimeoutActive) {
      const rem = getTimeoutRemainingSec();
      if (rem <= 0) {
        // clear timeout state centrally so dialog vanishes
        scoreboardState.updateState({
          isTimeoutActive: false,
          timeoutTeam: null,
          timeoutTimeLeft: 0,
          timeoutLastUpdate: null,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreboardData.timeoutTimeLeft, scoreboardData.timeoutLastUpdate, scoreboardData.isTimeoutActive, scoreboardData.lastUpdate, scoreboardData.teamATimeouts, scoreboardData.teamBtimeouts]);

  // open settings and populate temp fields
  const openSettings = () => {
    setTempTeamAName(scoreboardData.teamAName || "");
    setTempTeamBName(scoreboardData.teamBName || "");
    setTempTeamAColor(scoreboardData.teamAColor || "#1e40af");
    setTempTeamBColor(scoreboardData.teamBColor || "#dc2626");
    setTempTimeoutDuration(scoreboardData.timeoutDuration ?? 60);
    setTempRestBetweenQuarters(scoreboardData.restBetweenQuarters ?? 60);

    // defaultGameTime ms -> minutes/seconds
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
        (Number(tempDefaultGameMinutes) || 0) * 60 + (Number(tempDefaultGameSeconds) || 0)
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
      // apply configured timeouts to the teams immediately
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
    const total = Math.max(0, (Number(editMinutes) || 0) * 60 + (Number(editSeconds) || 0));
    scoreboardState.updateState({ gameTime: total * 1000, lastUpdate: Date.now() });
    setEditingClock(null);
  };
  const applyShotEdit = () => {
    const sec = Math.max(0, Number(editShotSeconds) || 0);
    scoreboardState.updateState({ shotClock: sec * 1000, lastUpdate: Date.now() });
    setEditingClock(null);
  };

  // keyboard handlers that don't block paste or spaces (Ctrl+V)
  const onGameMinutesKeyDown = (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const delta = e.key === "ArrowUp" ? 1 : -1;
      setEditMinutes((m) => Math.max(0, (Number(m) || 0) + delta));
    } else if (e.key.toLowerCase() === "a" && e.ctrlKey) {
      e.preventDefault();
      e.currentTarget.select?.();
    } else if (e.key === "Enter") {
      applyGameEdit();
    }
  };
  const onGameSecondsKeyDown = (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const delta = e.key === "ArrowUp" ? 1 : -1;
      setEditSeconds((s) => {
        let sec = Number(s) || 0;
        sec += delta;
        if (sec >= 60) {
          setEditMinutes((m) => (Number(m) || 0) + 1);
          return sec - 60;
        } else if (sec < 0) {
          if ((Number(editMinutes) || 0) > 0) {
            setEditMinutes((m) => Math.max(0, (Number(m) || 0) - 1));
            return 59;
          }
          return 0;
        }
        return sec;
      });
    } else if (e.key.toLowerCase() === "a" && e.ctrlKey) {
      e.preventDefault();
      e.currentTarget.select?.();
    } else if (e.key === "Enter") {
      applyGameEdit();
    }
  };
  const onShotKeyDown = (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const delta = e.key === "ArrowUp" ? 1 : -1;
      setEditShotSeconds((v) => Math.max(0, (Number(v) || 0) + delta));
    } else if (e.key.toLowerCase() === "a" && e.ctrlKey) {
      e.preventDefault();
      e.currentTarget.select?.();
    } else if (e.key === "Enter") applyShotEdit();
  };

  // Score change helper: auto-transfer possession on positive scoring
  const changeScore = (team, delta) => {
    const current = scoreboardState.getState();
    const key = team === "A" ? "teamAScore" : "teamBScore";
    const newScore = Math.max(0, (current[key] || 0) + delta);
    const updates = { [key]: newScore };

    // If scoring positive (basket), transfer possession to the other team
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

  // Use Timeout: sets timeout fields and records timeoutLastUpdate so countdown works
  const useTimeout = (team) => {
    const tKey = team === "A" ? "teamATimeouts" : "teamBTimeouts";
    if ((scoreboardData[tKey] || 0) <= 0) return;
    scoreboardState.updateState({
      isTimeoutActive: true,
      timeoutTeam: team,
      timeoutTimeLeft: Number(scoreboardData.timeoutDuration) || 60, // seconds
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

  // Next Quarter flow: show confirm → on confirm swap & start rest
  const handleNextQuarterClicked = () => setConfirmNext(true);

  const confirmNextQuarter = () => {
    const state = scoreboardState.getState();

    // Determine resets
    const defaultGame = state.defaultGameTime ?? 720000;
    const timeoutsCount = Number(state.timeoutsPerTeam ?? state.teamATimeouts ?? 3);

    const swapAndReset = {
      quarter: (state.quarter || scoreboardData.quarter) + 1,

      // swap visible sides/names/colors & scores
      teamAName: state.teamBName,
      teamBName: state.teamAName,
      teamAColor: state.teamBColor,
      teamBColor: state.teamAColor,
      teamAScore: state.teamBScore,
      teamBScore: state.teamAScore,

      // RESET fouls to 0
      teamAFouls: 0,
      teamBFouls: 0,

      // RESET timeouts to configured per-team value
      teamATimeouts: timeoutsCount,
      teamBTimeouts: timeoutsCount,

      // clear any active timeout
      isTimeoutActive: false,
      timeoutTeam: null,
      timeoutTimeLeft: 0,
      timeoutLastUpdate: null,

      // reset clocks: set game time to defaults and shot to 24s
      gameTime: defaultGame,
      shotClock: 24000,

      // pause clocks during rest
      isRunning: false,
      isShotRunning: false,
      lastUpdate: Date.now(),
    };

    // apply swap + reset before starting rest
    scoreboardState.updateState(swapAndReset);

    // start rest using setting or default 60 seconds
    const restSec = state.restBetweenQuarters ?? 60;
    scoreboardState.startRest(restSec);

    setConfirmNext(false);
    setShowRestModal(true);
  };

  // Close rest early
  const stopRestEarly = () => {
    scoreboardState.stopRest();
    setShowRestModal(false);
  };

  // Watch restTimeLeft and auto-close rest modal when it reaches 0
  useEffect(() => {
    if (!showRestModal && scoreboardData.restActive) {
      setShowRestModal(true);
    }
    if (showRestModal && !scoreboardData.restActive) {
      setShowRestModal(false);
    }
  }, [scoreboardData.restActive, scoreboardData.restTimeLeft, showRestModal]);

  // format rest seconds
  const formatRest = (ms) => {
    const s = Math.ceil((ms || 0) / 1000);
    return `${s}s`;
  };

  // helper to format timeout mm:ss
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

            {/* summary score */}
            <div className="text-sm text-gray-300 mt-2">
              {scoreboardData.teamAName} <span className="font-bold">{scoreboardData.teamAScore}</span>
              {"  -  "}
              <span className="font-bold">{scoreboardData.teamBScore}</span> {scoreboardData.teamBName}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-lg">Quarter</div>
              <div className="text-2xl font-bold">Q{scoreboardData.quarter}</div>
            </div>

            <button className="p-2 bg-gray-700 rounded hover:bg-gray-600" onClick={openSettings}>
              <Settings className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Timeout dialog under title */}
        {scoreboardData.isTimeoutActive && (
            <div className="max-w-2xl mx-auto mb-6">
              <div className="bg-blue-800/90 p-3 rounded-lg flex items-center justify-between shadow-md">
                <div>
                  <div className="text-sm text-blue-100 uppercase tracking-wide">Timeout</div>
                  <div className="text-lg font-bold text-white mt-1">
                    {scoreboardData.timeoutTeam === "A" ? scoreboardData.teamAName : scoreboardData.teamBName}
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-sm text-blue-100">Remaining</div>
                  <div className="text-2xl font-mono font-extrabold">{formatTimeoutMMSS(timeoutRemaining)}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                      className="bg-red-600 px-3 py-1 rounded"
                      onClick={() => endTimeout()}
                  >
                    End Timeout
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openEditDialog("game");
                  }
                }}
            >
              {formatTime(scoreboardData.gameTime)}
            </p>
            <button className="mt-2 bg-blue-600 px-4 py-2 rounded" onClick={() => scoreboardState.toggleGameClock()}>
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openEditDialog("shot");
                  }
                }}
            >
              {Math.ceil(scoreboardData.shotClock / 1000)}
            </p>

            <div className="mt-2 flex gap-2 justify-center">
              <button className="bg-blue-600 px-4 py-2 rounded" onClick={() => scoreboardState.toggleShotClock()}>
                {scoreboardData.isShotRunning ? "Pause" : "Start"}
              </button>
              <button className="bg-red-600 px-8 py-4 text-2xl rounded shadow" onClick={() => scoreboardState.resetShotClock(24)}>
                24
              </button>
              <button className="bg-orange-600 px-8 py-4 text-2xl rounded shadow" onClick={() => scoreboardState.resetShotClock(14)}>
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
                  className={`px-4 py-2 rounded ${scoreboardData.possession === "A" ? "bg-yellow-500 text-black" : "bg-gray-700"}`}
              >
                {scoreboardData.teamAName}
              </button>
              <button
                  onClick={() => setPossession("B")}
                  className={`px-4 py-2 rounded ${scoreboardData.possession === "B" ? "bg-yellow-500 text-black" : "bg-gray-700"}`}
              >
                {scoreboardData.teamBName}
              </button>
              <button onClick={flipPossession} className="ml-2 px-3 py-2 bg-red-600 rounded">Turnover</button>
            </div>
          </div>
        </div>

        {/* Teams */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {[
            ["A", scoreboardData.teamAName, scoreboardData.teamAColor],
            ["B", scoreboardData.teamBName, scoreboardData.teamBColor],
          ].map(([team, name, color]) => (
              <div key={team} className="bg-gray-800 p-4 rounded-lg text-center" style={{ borderTop: `4px solid ${color}` }}>
                <h2 className="text-xl font-bold mb-2">{name}</h2>

                {/* Big score card above add/remove */}
                <div className="bg-gray-900 rounded-lg p-4 mb-4">
                  <div className="text-sm text-gray-400">Score</div>
                  <div className="text-5xl font-extrabold">{team === "A" ? scoreboardData.teamAScore : scoreboardData.teamBScore}</div>
                </div>

                {/* Big add buttons */}
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

                {/* Minus buttons under */}
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

                <p>Fouls: {team === "A" ? scoreboardData.teamAFouls : scoreboardData.teamBFouls}</p>
                <button className="bg-yellow-600 px-3 py-1 rounded mt-2" onClick={() => scoreboardState.updateState({
                  [team === "A" ? "teamAFouls" : "teamBFouls"]: (team === "A" ? scoreboardData.teamAFouls : scoreboardData.teamBFouls) + 1,
                })}>
                  Add Foul
                </button>

                <p className="mt-2">Timeouts: {team === "A" ? scoreboardData.teamATimeouts : scoreboardData.teamBTimeouts}</p>
                <button className="bg-purple-600 px-3 py-1 rounded mt-2" onClick={() => useTimeout(team)}>
                  Use Timeout
                </button>
              </div>
          ))}
        </div>

        {/* Bottom controls */}
        <div className="flex justify-center gap-4 mb-8">
          <button className="bg-blue-600 px-4 py-2 rounded" onClick={handleNextQuarterClicked}>Next Quarter</button>

          <button className="bg-red-600 px-4 py-2 rounded" onClick={() => {
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
          }}>Reset Game</button>
        </div>

        {/* Confirm next quarter */}
        {confirmNext && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
              <div className="bg-white text-black p-6 rounded-lg w-80">
                <h2 className="text-xl font-bold mb-4">Confirm Next Quarter</h2>
                <p className="mb-4">Are you sure you want to advance to the next quarter and swap sides?</p>
                <div className="flex justify-end gap-2">
                  <button className="bg-gray-500 px-4 py-2 rounded text-white" onClick={() => setConfirmNext(false)}>Cancel</button>
                  <button className="bg-blue-600 px-4 py-2 rounded text-white" onClick={confirmNextQuarter}>Confirm</button>
                </div>
              </div>
            </div>
        )}

        {/* Rest modal (shows when restActive) */}
        {showRestModal && scoreboardData.restActive && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
              <div className="bg-white text-black p-6 rounded-lg w-80 text-center">
                <h2 className="text-xl font-bold mb-2">Rest Between Quarters</h2>
                <div className="text-4xl font-mono my-4">{formatRest(scoreboardData.restTimeLeft)}</div>
                <p className="text-sm text-gray-600 mb-4">Rest time remaining</p>
                <div className="flex justify-center gap-2">
                  <button className="bg-gray-500 px-4 py-2 rounded text-white" onClick={stopRestEarly}>Skip Rest</button>
                </div>
              </div>
            </div>
        )}

        {/* Settings modal */}
        {showSettings && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
              <div className="bg-white text-black p-6 rounded-lg w-96">
                <h2 className="text-xl font-bold mb-4">Settings</h2>

                <label className="block mb-2">Team A Name</label>
                <input
                    type="text"
                    className="w-full border px-2 py-1 mb-2"
                    value={tempTeamAName}
                    onChange={(e) => setTempTeamAName(e.target.value)}
                    onKeyDown={(e) => { if (e.ctrlKey && e.key.toLowerCase() === "a") { e.preventDefault(); e.currentTarget.select(); } }}
                />

                <label className="block mb-2">Team A Color</label>
                <input type="color" className="mb-4" value={tempTeamAColor} onChange={(e) => setTempTeamAColor(e.target.value)} />

                <label className="block mb-2">Team B Name</label>
                <input
                    type="text"
                    className="w-full border px-2 py-1 mb-2"
                    value={tempTeamBName}
                    onChange={(e) => setTempTeamBName(e.target.value)}
                    onKeyDown={(e) => { if (e.ctrlKey && e.key.toLowerCase() === "a") { e.preventDefault(); e.currentTarget.select(); } }}
                />

                <label className="block mb-2">Team B Color</label>
                <input type="color" className="mb-4" value={tempTeamBColor} onChange={(e) => setTempTeamBColor(e.target.value)} />

                <label className="block mb-2">Timeout Duration (seconds)</label>
                <input
                    type="number"
                    className="w-full border px-2 py-1 mb-4"
                    value={tempTimeoutDuration}
                    onChange={(e) => setTempTimeoutDuration(Number(e.target.value || 0))}
                    onKeyDown={(e) => { if (e.ctrlKey && e.key.toLowerCase() === "a") { e.preventDefault(); e.currentTarget.select(); } }}
                />

                <label className="block mb-2">Timeouts per team</label>
                <input
                    type="number"
                    className="w-full border px-2 py-1 mb-4"
                    value={tempTimeoutsPerTeam}
                    onChange={(e) => setTempTimeoutsPerTeam(Math.max(0, Number(e.target.value || 0)))}
                    onKeyDown={(e) => { if (e.ctrlKey && e.key.toLowerCase() === "a") { e.preventDefault(); e.currentTarget.select(); } }}
                />

                <label className="block mb-2">Rest Between Quarters (seconds)</label>
                <input
                    type="number"
                    className="w-full border px-2 py-1 mb-4"
                    value={tempRestBetweenQuarters}
                    onChange={(e) => setTempRestBetweenQuarters(Number(e.target.value || 0))}
                    onKeyDown={(e) => { if (e.ctrlKey && e.key.toLowerCase() === "a") { e.preventDefault(); e.currentTarget.select(); } }}
                />

                <label className="block mb-2">Default Game Time (MM : SS)</label>
                <div className="flex gap-2 items-center mb-4">
                  <input
                      type="number"
                      className="w-24 border px-2 py-1 text-center"
                      value={tempDefaultGameMinutes}
                      onChange={(e) => setTempDefaultGameMinutes(Math.max(0, Number(e.target.value || 0)))}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                          e.preventDefault();
                          const delta = e.key === "ArrowUp" ? 1 : -1;
                          setTempDefaultGameMinutes((m) => Math.max(0, (Number(m) || 0) + delta));
                        } else if (e.ctrlKey && e.key.toLowerCase() === "a") {
                          e.preventDefault();
                          e.currentTarget.select?.();
                        }
                      }}
                  />
                  <span>:</span>
                  <input
                      type="number"
                      className="w-24 border px-2 py-1 text-center"
                      value={pad(tempDefaultGameSeconds)}
                      onChange={(e) => {
                        let val = parseInt(String(e.target.value).replace(/\D/g, "") || "0");
                        if (isNaN(val)) val = 0;
                        if (val >= 60) {
                          const extra = Math.floor(val / 60);
                          setTempDefaultGameMinutes((m) => (Number(m) || 0) + extra);
                          val = val % 60;
                        }
                        setTempDefaultGameSeconds(val);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                          e.preventDefault();
                          const delta = e.key === "ArrowUp" ? 1 : -1;
                          setTempDefaultGameSeconds((s) => {
                            let sec = Number(s) || 0;
                            sec += delta;
                            if (sec >= 60) {
                              setTempDefaultGameMinutes((m) => (Number(m) || 0) + 1);
                              return sec - 60;
                            } else if (sec < 0) {
                              return 0;
                            }
                            return sec;
                          });
                        } else if (e.ctrlKey && e.key.toLowerCase() === "a") {
                          e.preventDefault();
                          e.currentTarget.select?.();
                        }
                      }}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button className="bg-gray-500 px-4 py-2 rounded text-white" onClick={cancelSettings}>Cancel</button>
                  <button className="bg-green-600 px-4 py-2 rounded text-white" onClick={saveSettings}>Save</button>
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
                        onChange={(e) => setEditMinutes(Math.max(0, parseInt(e.target.value || "0")))}
                        onKeyDown={onGameMinutesKeyDown}
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
                          let val = parseInt(String(e.target.value).replace(/\D/g, "") || "0");
                          if (isNaN(val)) val = 0;
                          if (val >= 60) {
                            const extra = Math.floor(val / 60);
                            setEditMinutes((m) => (Number(m) || 0) + extra);
                            val = val % 60;
                          }
                          setEditSeconds(Math.max(0, val));
                        }}
                        onKeyDown={onGameSecondsKeyDown}
                    />
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-4">Use ↑/↓ arrows (single-step) or type manually. Enter applies.</p>

                <div className="flex justify-end gap-2">
                  <button className="bg-gray-500 px-4 py-2 rounded text-white" onClick={() => setEditingClock(null)}>Cancel</button>
                  <button className="bg-blue-600 px-4 py-2 rounded text-white" onClick={applyGameEdit}>Apply</button>
                </div>
              </div>
            </div>
        )}

        {/* Edit shot clock modal */}
        {editingClock === "shot" && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
              <div className="bg-white text-black p-6 rounded-lg w-72">
                <h2 className="text-xl font-bold mb-4">Edit Shot Clock (seconds)</h2>

                <input
                    type="number"
                    className="w-full border px-2 py-3 text-center text-2xl mb-2"
                    value={editShotSeconds}
                    onChange={(e) => setEditShotSeconds(Math.max(0, parseInt(e.target.value || "0")))}
                    onKeyDown={onShotKeyDown}
                />

                <p className="text-sm text-gray-600 mb-4">Use ↑/↓ arrows (single-step) or type manually. Enter applies.</p>

                <div className="flex justify-end gap-2">
                  <button className="bg-gray-500 px-4 py-2 rounded text-white" onClick={() => setEditingClock(null)}>Cancel</button>
                  <button className="bg-blue-600 px-4 py-2 rounded text-white" onClick={applyShotEdit}>Apply</button>
                </div>
              </div>
            </div>
        )}
      </div>
  );
}
