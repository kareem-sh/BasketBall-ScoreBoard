import React, { useState, useEffect, useRef } from "react";
import { scoreboardState } from "../utils/scoreboardState";
import timeSound from "../assets/sound/time.mp3";

export default function DisplayScreen() {
  const [scoreboardData, setScoreboardData] = useState(
    scoreboardState.getState()
  );
  const [lastUpdate, setLastUpdate] = useState(0);
  const audioRef = useRef(null);
  const prevShot = useRef(scoreboardData.shotClock);

  useEffect(() => {
    const handleStateChange = (newState) => setScoreboardData(newState);
    scoreboardState.addListener(handleStateChange);

    return () => {
      scoreboardState.removeListener(handleStateChange);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setLastUpdate(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);

  // === FORMATTERS ===
  const formatGameTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds >= 60) {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    } else {
      const seconds = (ms / 1000).toFixed(1);
      return seconds;
    }
  };

  const formatRestTime = (ms) => {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const formatShotClock = (ms) => {
    const totalSeconds = Math.ceil(ms / 1000);
    if (totalSeconds >= 5) {
      return totalSeconds.toString();
    } else {
      return (ms / 1000).toFixed(1);
    }
  };

  // === LIVE VALUES ===
  const getCurrentGameTime = () => {
    if (!scoreboardData.isRunning) return scoreboardData.gameTime;
    const elapsed = Date.now() - scoreboardData.lastUpdate;
    return Math.max(0, scoreboardData.gameTime - elapsed);
  };
  const getCurrentShotClock = () => {
    if (!scoreboardData.isShotRunning) return scoreboardData.shotClock;
    const elapsed = Date.now() - scoreboardData.lastUpdate;
    return Math.max(0, scoreboardData.shotClock - elapsed);
  };
  const getCurrentRest = () => {
    if (!scoreboardData.restActive) return scoreboardData.restTimeLeft || 0;
    const elapsed =
      Date.now() -
      (scoreboardData.restLastUpdate ||
        scoreboardData.lastUpdate ||
        Date.now());
    return Math.max(0, (scoreboardData.restTimeLeft || 0) - elapsed);
  };

  const gameTime = getCurrentGameTime();
  const shotTime = getCurrentShotClock();
  const restTime = getCurrentRest();

  // === SOUND TRIGGER ===
  useEffect(() => {
    if (prevShot.current > 0 && shotTime <= 0) {
      if (audioRef.current) {
        try {
          audioRef.current.currentTime = 0;
          audioRef.current
            .play()
            .catch((e) => console.log("Audio play failed:", e));
        } catch (error) {
          console.log("Audio error:", error);
        }
      }
    }
    prevShot.current = shotTime;
  }, [shotTime]);

  // rest auto-stop
  useEffect(() => {
    if (scoreboardData.restActive && restTime <= 0) {
      scoreboardState.stopRest();
    }
  }, [restTime, scoreboardData.restActive]);

  // --- Foul lights renderer ---
  const renderFoulLights = (count) => {
    const foulLimit = Number(scoreboardData.foulLimit ?? 5);
    const maxLights = 6;
    const filled = Math.min(count, maxLights);
    const lights = [];
    for (let i = 0; i < maxLights; i++) {
      const isFilled = i < filled;
      const inBonus = count > foulLimit;
      lights.push(
        <div
          key={i}
          aria-hidden
          className={`w-6 h-6 rounded-full border-2 ${
            isFilled
              ? "bg-red-500 border-red-600"
              : "bg-transparent border-gray-600"
          } ${inBonus && isFilled ? "ring-2 ring-yellow-400" : ""}`}
          title={`${i + 1} ${i < filled ? "foul" : ""}`}
        />
      );
    }
    return (
      <div className="flex gap-2 items-center justify-center">
        {lights}
        {count > foulLimit && (
          <div className="ml-4 text-yellow-300 font-bold flex items-center gap-2">
            <span className="px-2 py-1 rounded bg-yellow-600 text-black">
              BONUS
            </span>
            <span className="text-sm text-gray-300">2 FTs</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-4 flex justify-center items-center">
      {/* buzzer */}
      <audio ref={audioRef} src={timeSound} preload="auto" />

      <div
        className={`max-w-6xl w-full rounded-2xl p-8 shadow-2xl border-8 transition-all duration-500
          ${
            shotTime <= 0
              ? "bg-red-900 border-red-600 shadow-[0_0_40px_15px_rgba(255,0,0,0.8)] animate-pulse"
              : "bg-black border-yellow-500"
          }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="text-4xl font-bold">Q{scoreboardData.quarter}</div>

          {/* Clocks side by side */}
          <div className="flex gap-6">
            {/* Game Clock */}
            <div className="text-center">
              <div className="text-sm text-gray-300">GAME</div>
              <div
                className={`text-5xl md:text-6xl font-mono font-extrabold px-6 py-2 rounded ${
                  gameTime < 60000 ? "bg-yellow-600 text-black" : ""
                }`}
              >
                {formatGameTime(gameTime)}
              </div>
            </div>

            {/* Shot Clock */}
            {!scoreboardData.restActive && (
              <div
                className={`px-6 py-3 rounded-2xl text-center shadow-lg ${
                  shotTime < 5000 ? "bg-red-700" : "bg-red-600"
                }`}
              >
                <div className="text-sm">SHOT</div>
                <div className="text-5xl md:text-6xl font-mono font-extrabold">
                  {formatShotClock(shotTime)}
                </div>
              </div>
            )}
          </div>

          <div className="text-right">
            <div className="mt-2 text-sm text-gray-300">
              Possession:{" "}
              <span className="font-bold">
                {scoreboardData.possession === "A"
                  ? scoreboardData.teamAName
                  : scoreboardData.teamBName}
              </span>
            </div>
          </div>
        </div>

        {/* Rest Banner */}
        {scoreboardData.restActive && (
          <div className="text-center px-6 py-4 bg-blue-700/90 rounded-2xl shadow-md mb-8">
            <div className="text-sm uppercase tracking-wider text-blue-100">
              Rest
            </div>
            <div className="text-3xl md:text-4xl font-mono font-extrabold text-white mt-1">
              {formatRestTime(restTime)}
            </div>
            <div className="text-xs text-blue-100/80 mt-1">
              break between quarters
            </div>
          </div>
        )}

        {/* Teams */}
        <div className="grid grid-cols-2 gap-12">
          {/* Team A */}
          <div
            className="text-center relative"
            style={{ color: scoreboardData.teamAColor }}
          >
            {scoreboardData.possession === "A" && (
              <div className="absolute right-6 top-[150px] transform -translate-y-1/2 text-yellow-400 text-6xl animate-pulse pointer-events-none">
                ➡
              </div>
            )}
            <div className="text-5xl font-bold mb-4">
              {scoreboardData.teamAName}
            </div>
            <div className="text-9xl font-extrabold bg-gray-800 py-6 rounded-xl shadow-inner mb-6">
              {scoreboardData.teamAScore}
            </div>
            <div className="mb-4">
              <div className="text-sm mb-2">FOULS</div>
              {renderFoulLights(scoreboardData.teamAFouls || 0)}
            </div>
            <div className="bg-gray-800 p-4 rounded-lg shadow inline-block">
              <div className="text-sm">TO</div>
              <div className="text-4xl font-bold">
                {scoreboardData.teamATimeouts}
              </div>
            </div>
          </div>

          {/* Team B */}
          <div
            className="text-center relative"
            style={{ color: scoreboardData.teamBColor }}
          >
            {scoreboardData.possession === "B" && (
              <div className="absolute left-6 top-[150px] transform -translate-y-1/2 text-yellow-400 text-6xl animate-pulse pointer-events-none">
                ⬅
              </div>
            )}
            <div className="text-5xl font-bold mb-4">
              {scoreboardData.teamBName}
            </div>
            <div className="text-9xl font-extrabold bg-gray-800 py-6 rounded-xl shadow-inner mb-6">
              {scoreboardData.teamBScore}
            </div>
            <div className="mb-4">
              <div className="text-sm mb-2">FOULS</div>
              {renderFoulLights(scoreboardData.teamBFouls || 0)}
            </div>
            <div className="bg-gray-800 p-4 rounded-lg shadow inline-block">
              <div className="text-sm">TO</div>
              <div className="text-4xl font-bold">
                {scoreboardData.teamBTimeouts}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
