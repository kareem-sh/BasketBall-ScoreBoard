import React, { useState, useEffect, useRef } from "react";
import { scoreboardState } from "../utils/scoreboardState";
import {
  Settings,
  Pause,
  Bell,
  Plus,
  Minus,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import timeSound from "../assets/sound/time.mp3";

export default function ControlScreen() {
  const [scoreboardData, setScoreboardData] = useState(
    scoreboardState.getState()
  );
  const audioRef = useRef(null);
  const buzzerTimer = useRef(null);

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
  const [tempTotalQuarters, setTempTotalQuarters] = useState(4);
  const [tempOvertimeMinutes, setTempOvertimeMinutes] = useState(5);
  const [tempOvertimeSeconds, setTempOvertimeSeconds] = useState(0);

  const [editingClock, setEditingClock] = useState(null);
  const [editMinutes, setEditMinutes] = useState(0);
  const [editSeconds, setEditSeconds] = useState(0);
  const [editShotSeconds, setEditShotSeconds] = useState(0);

  const [confirmNext, setConfirmNext] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const listener = (state) => setScoreboardData({ ...state });
    scoreboardState.addListener(listener);

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

  const timeoutRemaining = getTimeoutRemainingSec();

  useEffect(() => {
    if (scoreboardData.isTimeoutActive && timeoutRemaining <= 0) {
      playBuzzerSegment();
      endTimeout();
    }
    if (scoreboardData.restActive && scoreboardData.restTimeLeft <= 0) {
      playBuzzerSegment();
      scoreboardState.stopRest();
    }
  }, [
    scoreboardData.isTimeoutActive,
    scoreboardData.restActive,
    scoreboardData.restTimeLeft,
    timeoutRemaining,
  ]);

  useEffect(() => {
    return () => {
      if (buzzerTimer.current) {
        clearTimeout(buzzerTimer.current);
        buzzerTimer.current = null;
      }
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (e) {
          /* ignore */
        }
      }
    };
  }, []);

  const playBuzzerSegment = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (buzzerTimer.current) {
      clearTimeout(buzzerTimer.current);
      buzzerTimer.current = null;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (e) {
        console.log("Error stopping buzzer:", e);
      }
      return;
    }

    // MATCH DisplayScreen default: start at 0.9s
    const startSec = 0.9;
    const endSec = 4;
    const msDuration = (endSec - startSec) * 1000;

    const startAndPlay = () => {
      try {
        audio.currentTime = startSec;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch((e) => {
            console.log("Play failed:", e);
          });
        }
      } catch (e) {
        console.log("Audio play error:", e);
      }

      buzzerTimer.current = setTimeout(() => {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch (e) {
          console.log("Error pausing buzzer:", e);
        }
        buzzerTimer.current = null;
      }, msDuration);
    };

    if (audio.readyState > 0) {
      startAndPlay();
    } else {
      const onLoaded = () => {
        audio.removeEventListener("loadedmetadata", onLoaded);
        startAndPlay();
      };
      audio.addEventListener("loadedmetadata", onLoaded);
      try {
        audio.load();
      } catch (e) {
        /* ignore */
      }
    }
  };

  const handleSpaceClick = () => {
    const { gameTime, shotClock, now } = scoreboardState.getCurrentTimes();
    const st = scoreboardState.getState();

    if (st.isRunning && st.isShotRunning) {
      scoreboardState.updateState({
        isRunning: false,
        isShotRunning: false,
        gameTime,
        shotClock,
        lastUpdate: now,
      });
    } else {
      scoreboardState.updateState({
        isRunning: !st.isRunning,
        gameTime,
        shotClock,
        lastUpdate: now,
      });
    }
  };

  const handleCtrlClick = () => {
    const { gameTime, shotClock, now } = scoreboardState.getCurrentTimes();
    const st = scoreboardState.getState();

    if (!st.isRunning && !st.isShotRunning) {
      scoreboardState.updateState({
        isRunning: true,
        isShotRunning: true,
        gameTime,
        shotClock,
        lastUpdate: now,
      });
    } else {
      scoreboardState.updateState({
        isShotRunning: !st.isShotRunning,
        gameTime,
        shotClock,
        lastUpdate: now,
      });
    }
  };

  const pad = (n) => String(n).padStart(2, "0");
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${pad(seconds)}`;
  };

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
    setTempTotalQuarters(Number(scoreboardData.totalQuarters ?? 4));

    const otMs = scoreboardData.overtimeDuration ?? 300000;
    const otTotal = Math.floor(otMs / 1000);
    setTempOvertimeMinutes(Math.floor(otTotal / 60));
    setTempOvertimeSeconds(otTotal % 60);

    setShowSettings(true);
  };

  const saveSettings = () => {
    const defTotalSeconds = Math.max(
      0,
      (Number(tempDefaultGameMinutes) || 0) * 60 +
        (Number(tempDefaultGameSeconds) || 0)
    );
    const newTimeouts = Number(tempTimeoutsPerTeam || 0);
    const overtimeSecondsTotal = Math.max(
      0,
      (Number(tempOvertimeMinutes) || 0) * 60 +
        (Number(tempOvertimeSeconds) || 0)
    );
    scoreboardState.updateState({
      teamAName: tempTeamAName,
      teamBName: tempTeamBName,
      teamAColor: tempTeamAColor,
      teamBColor: tempTeamBColor,
      timeoutDuration: Number(tempTimeoutDuration) || 0,
      restBetweenQuarters: Number(tempRestBetweenQuarters) || 0,
      defaultGameTime: defTotalSeconds * 1000,
      timeoutsPerTeam: newTimeouts,
      totalQuarters: Number(tempTotalQuarters) || 4,
      overtimeDuration: overtimeSecondsTotal * 1000,
    });
    setShowSettings(false);
  };

  const cancelSettings = () => setShowSettings(false);

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

  const adjustTime = (clock, amount) => {
    const { gameTime, shotClock, now } = scoreboardState.getCurrentTimes();
    const st = scoreboardState.getState();
    if (clock === "game") {
      const newGameTime = Math.min(
        st.defaultGameTime,
        Math.max(0, gameTime + amount)
      );
      scoreboardState.updateState({ gameTime: newGameTime, lastUpdate: now });
    } else if (clock === "shot") {
      const newShotClock = Math.min(24000, Math.max(0, shotClock + amount));
      scoreboardState.updateState({ shotClock: newShotClock, lastUpdate: now });
    }
  };

  const applyGameEdit = () => {
    const st = scoreboardState.getState();
    const total = Math.max(
      0,
      (Number(editMinutes) || 0) * 60 + (Number(editSeconds) || 0)
    );
    const newTime = Math.min(st.defaultGameTime, total * 1000);
    scoreboardState.updateState({
      gameTime: newTime,
      lastUpdate: Date.now(),
    });
    setEditingClock(null);
  };

  const applyShotEdit = () => {
    const sec = Math.min(24, Math.max(0, Number(editShotSeconds) || 0));
    scoreboardState.updateState({
      shotClock: sec * 1000,
      lastUpdate: Date.now(),
    });
    setEditingClock(null);
  };

  const changeScore = (team, delta) => {
    const current = scoreboardState.getState();
    const key = team === "A" ? "teamAScore" : "teamBScore";
    const newScore = Math.max(0, (current[key] || 0) + delta);
    scoreboardState.updateState({ [key]: newScore });
  };

  // internal possession mapping: "left" -> team B, "right" -> team A
  const setPossessionBySide = (side) => {
    const st = scoreboardState.getState();
    const mapped = side === "left" ? "B" : "A";
    const newPossession = st.possession === mapped ? null : mapped;
    scoreboardState.updateState({
      possession: newPossession,
      lastUpdate: Date.now(),
    });
  };

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

  const endTimeout = () => {
    scoreboardState.updateState({
      isTimeoutActive: false,
      timeoutTeam: null,
      timeoutTimeLeft: 0,
      timeoutLastUpdate: null,
    });
  };

  const handleNextQuarterClicked = () => setConfirmNext(true);
  const confirmNextQuarter = () => {
    scoreboardState.advanceQuarter();
    setConfirmNext(false);
  };

  const resetQuarter = () => {
    scoreboardState.resetQuarter();
  };

  const handleResetGameClicked = () => setConfirmReset(true);
  const confirmResetGame = () => {
    scoreboardState.resetGame();
    setConfirmReset(false);
  };

  const changeFouls = (team, delta) => {
    const key = team === "A" ? "teamAFouls" : "teamBFouls";
    const newFouls = Math.max(0, (scoreboardData[key] || 0) + delta);
    scoreboardState.updateState({ [key]: newFouls });
  };

  const changeTimeouts = (team, delta) => {
    const key = team === "A" ? "teamATimeouts" : "teamBTimeouts";
    const newTimeouts = Math.max(0, (scoreboardData[key] || 0) + delta);
    scoreboardState.updateState({ [key]: newTimeouts });
  };

  const formatRest = (ms) => {
    const s = Math.ceil((ms || 0) / 1000);
    return `${s}s`;
  };

  const formatTimeoutMMSS = (seconds) => {
    const mm = Math.floor(seconds / 60);
    const ss = seconds % 60;
    return `${mm}:${String(ss).padStart(2, "0")}`;
  };

  const TimeAdjuster = ({ onUp, onDown }) => (
    <div className="flex flex-col items-center justify-center ml-2">
      <button onClick={onUp} className="text-gray-400 hover:text-white">
        <ChevronUp size={20} />
      </button>
      <button onClick={onDown} className="text-gray-400 hover:text-white">
        <ChevronDown size={20} />
      </button>
    </div>
  );

  // --- helper: getQuarterName ---
  const getQuarterName = (state) => {
    const quarter = Number(state?.quarter ?? 1);
    const total = Number(state?.totalQuarters ?? 4);
    return quarter > total ? `OT${quarter - total}` : `Q${quarter}`;
  };

  const quarterName = getQuarterName(scoreboardData);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-3xl font-bold">Basketball Scoreboard Control</h1>
          <div className="text-sm text-gray-300 mt-2">
            {scoreboardData.teamAName}{" "}
            <span className="font-bold">{scoreboardData.teamAScore}</span>
            {" - "}
            <span className="font-bold">{scoreboardData.teamBScore}</span>{" "}
            {scoreboardData.teamBName}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quarter display */}
          <div className="text-center mr-3">
            <div className="text-sm text-gray-300">Quarter</div>
            <div className="text-xl font-bold">{quarterName}</div>
          </div>

          <div className="flex items-center">
            <audio ref={audioRef} src={timeSound} preload="auto" />
            <button
              onClick={playBuzzerSegment}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 mr-2"
              title="Play buzzer segment (0.9s → 4s)"
            >
              <Bell className="w-5 h-5" /> Buzzer
            </button>
          </div>

          <button
            className="p-2 bg-gray-700 rounded hover:bg-gray-600"
            onClick={openSettings}
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Timeout Banner */}
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
                onClick={() => {
                  playBuzzerSegment();
                  endTimeout();
                }}
              >
                <Pause size={16} /> End Timeout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rest Banner */}
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
            <button
              className="bg-red-600 px-3 py-1 rounded flex items-center gap-1"
              onClick={() => {
                playBuzzerSegment();
                scoreboardState.stopRest();
              }}
            >
              <Pause size={16} /> End Rest
            </button>
          </div>
        </div>
      )}

      {/* main UI (Game Clock + Shot Clock side-by-side) */}
      <div className="flex justify-center gap-8 mb-4">
        <div className="bg-gray-800 p-4 rounded-lg text-center">
          <h2 className="text-lg">Game Clock</h2>
          <div className="flex items-center justify-center">
            <TimeAdjuster
              onUp={() => adjustTime("game", 60000)}
              onDown={() => adjustTime("game", -60000)}
            />
            <p
              className="text-4xl font-mono hover:text-yellow-400 select-none cursor-pointer mx-2"
              onClick={() => openEditDialog("game")}
              role="button"
              tabIndex={0}
            >
              {formatTime(scoreboardData.gameTime)}
            </p>
            <TimeAdjuster
              onUp={() => adjustTime("game", 1000)}
              onDown={() => adjustTime("game", -1000)}
            />
          </div>
          <button
            className={`mt-2 ${
              scoreboardData.isRunning ? "bg-red-600" : "bg-blue-600"
            } px-4 py-2 rounded`}
            onClick={handleSpaceClick}
          >
            {scoreboardData.isRunning ? "Pause" : "Start"}
          </button>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg text-center">
          <h2 className="text-lg">Shot Clock</h2>
          <div className="flex items-center justify-center">
            <p
              className="text-4xl font-mono hover:text-yellow-400 select-none cursor-pointer"
              onClick={() => openEditDialog("shot")}
              role="button"
              tabIndex={0}
            >
              {Math.ceil(scoreboardData.shotClock / 1000)}
            </p>
            <TimeAdjuster
              onUp={() => adjustTime("shot", 1000)}
              onDown={() => adjustTime("shot", -1000)}
            />
          </div>
          <div className="mt-2 flex gap-2 justify-center">
            <button
              className={` ${
                scoreboardData.isShotRunning ? "bg-red-600" : "bg-blue-600"
              } px-4 py-2 rounded`}
              onClick={handleCtrlClick}
            >
              {scoreboardData.isShotRunning ? "Pause" : "Start"}
            </button>
            <button
              className="bg-gray-600 px-4 py-2 rounded"
              onClick={() => scoreboardState.resetShotClock(24)}
            >
              24
            </button>
            <button
              className="bg-gray-600 px-4 py-2 rounded"
              onClick={() => scoreboardState.resetShotClock(14)}
            >
              14
            </button>
          </div>
        </div>
      </div>

      {/* Possession container centered under the clocks (no labels, no Clear button) */}
      <div className="flex justify-center mb-6">
        <div className="bg-gray-800 p-3 rounded-lg shadow-md flex items-center gap-6">
          <button
            onClick={() => setPossessionBySide("left")}
            className={`px-6 py-2 rounded text-3xl ${
              scoreboardData.possession === "B"
                ? "bg-yellow-400 text-black"
                : "bg-gray-700"
            }`}
            title="Set possession to LEFT (team on left)"
          >
            ⬅
          </button>

          {/* visual arrow between */}
          <div className="text-2xl text-gray-400 select-none">⇄</div>

          <button
            onClick={() => setPossessionBySide("right")}
            className={`px-6 py-2 rounded text-3xl ${
              scoreboardData.possession === "A"
                ? "bg-yellow-400 text-black"
                : "bg-gray-700"
            }`}
            title="Set possession to RIGHT (team on right)"
          >
            ➡
          </button>
        </div>
      </div>

      {/* team panels (no per-team possession buttons here) */}
      <div className="grid grid-cols-2 gap-6 mb-6 relative">
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
            <div className="text-sm">
              Fouls:{" "}
              <span className="font-bold">
                {team === "A"
                  ? scoreboardData.teamAFouls
                  : scoreboardData.teamBFouls}
              </span>
            </div>
            <div className="flex justify-center gap-2 mt-2 mb-4">
              <button
                className="bg-red-600 p-2 rounded-full"
                onClick={() => changeFouls(team, -1)}
                aria-label="Remove Foul"
              >
                <Minus size={20} />
              </button>
              <button
                className="bg-yellow-600 p-2 rounded-full"
                onClick={() => changeFouls(team, 1)}
                aria-label="Add Foul"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="text-sm">
              Timeouts:{" "}
              <span className="font-bold">
                {team === "A"
                  ? scoreboardData.teamATimeouts
                  : scoreboardData.teamBTimeouts}
              </span>
            </div>
            <div className="flex justify-center items-center gap-4 mt-2">
              <button
                className="bg-blue-600 px-3 py-1 rounded"
                onClick={() => useTimeout(team)}
              >
                Use Timeout
              </button>

              <div className="flex gap-2">
                <button
                  className="bg-gray-600 p-2 rounded-full"
                  onClick={() => changeTimeouts(team, -1)}
                >
                  <Minus size={16} />
                </button>
                <button
                  className="bg-gray-600 p-2 rounded-full"
                  onClick={() => changeTimeouts(team, 1)}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* bottom controls (Next Quarter & Reset) */}
      <div className="mt-8 pt-6 border-t border-gray-700 flex flex-wrap justify-center items-start gap-6">
        <div className="bg-gray-800 p-4 rounded-lg text-center">
          <div className="text-sm mb-2">Game Flow</div>
          {!confirmNext ? (
            <button
              onClick={handleNextQuarterClicked}
              disabled={
                scoreboardData.quarter >= scoreboardData.totalQuarters &&
                (scoreboardData.teamAScore || 0) !==
                  (scoreboardData.teamBScore || 0)
              }
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              Next Quarter
            </button>
          ) : (
            <div className="flex gap-2 bg-gray-700 p-2 rounded-lg items-center">
              <span className="text-yellow-400 font-semibold">
                Are you sure?
              </span>
              <button
                onClick={() => setConfirmNext(false)}
                className="bg-gray-500 hover:bg-gray-400 px-3 py-1 rounded"
              >
                Cancel
              </button>
              <button
                onClick={confirmNextQuarter}
                className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded"
              >
                Confirm
              </button>
            </div>
          )}
        </div>

        <div className="bg-gray-800 p-4 rounded-lg text-center">
          <div className="text-sm mb-2">Reset Options</div>
          <div className="flex flex-col gap-3">
            <button
              onClick={resetQuarter}
              className="bg-yellow-700 hover:bg-yellow-600 px-4 py-2 rounded"
            >
              Reset Current Quarter
            </button>
            {!confirmReset ? (
              <button
                onClick={handleResetGameClicked}
                className="bg-red-800 hover:bg-red-700 px-4 py-2 rounded"
              >
                Reset Full Game
              </button>
            ) : (
              <div className="flex gap-2 bg-gray-700 p-2 rounded-lg items-center">
                <span className="text-red-400 font-semibold">Reset Game?</span>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="bg-gray-500 hover:bg-gray-400 px-3 py-1 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmResetGame}
                  className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded"
                >
                  Confirm
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* edit clock modal */}
      {editingClock && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-center">
            <h3 className="text-xl mb-4">
              Edit {editingClock === "game" ? "Game Clock" : "Shot Clock"}
            </h3>
            {editingClock === "game" ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={pad(editMinutes)}
                  onChange={(e) => setEditMinutes(parseInt(e.target.value))}
                  className="w-24 text-4xl text-center bg-gray-700 rounded p-2"
                />
                <span className="text-4xl">:</span>
                <input
                  type="number"
                  value={pad(editSeconds)}
                  onChange={(e) => setEditSeconds(parseInt(e.target.value))}
                  className="w-24 text-4xl text-center bg-gray-700 rounded p-2"
                />
              </div>
            ) : (
              <input
                type="number"
                value={editShotSeconds}
                onChange={(e) => setEditShotSeconds(parseInt(e.target.value))}
                className="w-24 text-4xl text-center bg-gray-700 rounded p-2"
              />
            )}
            <div className="mt-6 flex justify-center gap-4">
              <button
                onClick={() => setEditingClock(null)}
                className="px-4 py-2 bg-gray-600 rounded"
              >
                Cancel
              </button>
              <button
                onClick={
                  editingClock === "game" ? applyGameEdit : applyShotEdit
                }
                className="px-4 py-2 bg-blue-600 rounded"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* settings modal (includes overtime inputs) */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-xl mb-6 font-bold">Settings</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1">Home Team Name</label>
                  <input
                    type="text"
                    value={tempTeamAName}
                    onChange={(e) => setTempTeamAName(e.target.value)}
                    className="w-full bg-gray-700 p-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Home Team Color</label>
                  <input
                    type="color"
                    value={tempTeamAColor}
                    onChange={(e) => setTempTeamAColor(e.target.value)}
                    className="w-full h-10 bg-gray-700 p-1 rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1">Away Team Name</label>
                  <input
                    type="text"
                    value={tempTeamBName}
                    onChange={(e) => setTempTeamBName(e.target.value)}
                    className="w-full bg-gray-700 p-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Away Team Color</label>
                  <input
                    type="color"
                    value={tempTeamBColor}
                    onChange={(e) => setTempTeamBColor(e.target.value)}
                    className="w-full h-10 bg-gray-700 p-1 rounded"
                  />
                </div>
              </div>

              <hr className="border-gray-600" />

              <div>
                <label className="block text-sm mb-1">Default Game Time</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={tempDefaultGameMinutes}
                    onChange={(e) => setTempDefaultGameMinutes(e.target.value)}
                    className="w-full bg-gray-700 p-2 rounded"
                    placeholder="Mins"
                  />
                  <input
                    type="number"
                    value={tempDefaultGameSeconds}
                    onChange={(e) => setTempDefaultGameSeconds(e.target.value)}
                    className="w-full bg-gray-700 p-2 rounded"
                    placeholder="Secs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1">
                    Timeouts Per Team
                  </label>
                  <input
                    type="number"
                    value={tempTimeoutsPerTeam}
                    onChange={(e) => setTempTimeoutsPerTeam(e.target.value)}
                    className="w-full bg-gray-700 p-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Total Quarters</label>
                  <input
                    type="number"
                    value={tempTotalQuarters}
                    onChange={(e) => setTempTotalQuarters(e.target.value)}
                    className="w-full bg-gray-700 p-2 rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1">
                    Timeout Duration (s)
                  </label>
                  <input
                    type="number"
                    value={tempTimeoutDuration}
                    onChange={(e) => setTempTimeoutDuration(e.target.value)}
                    className="w-full bg-gray-700 p-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">
                    Rest Between Quarters (s)
                  </label>
                  <input
                    type="number"
                    value={tempRestBetweenQuarters}
                    onChange={(e) => setTempRestBetweenQuarters(e.target.value)}
                    className="w-full bg-gray-700 p-2 rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1">Overtime Duration</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={tempOvertimeMinutes}
                    onChange={(e) => setTempOvertimeMinutes(e.target.value)}
                    className="w-full bg-gray-700 p-2 rounded"
                    placeholder="Mins"
                  />
                  <input
                    type="number"
                    value={tempOvertimeSeconds}
                    onChange={(e) => setTempOvertimeSeconds(e.target.value)}
                    className="w-full bg-gray-700 p-2 rounded"
                    placeholder="Secs"
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Enter minutes and seconds for each overtime period (e.g.
                  5:00).
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-4">
              <button
                onClick={cancelSettings}
                className="px-4 py-2 bg-gray-600 rounded"
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                className="px-4 py-2 bg-blue-600 rounded"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
