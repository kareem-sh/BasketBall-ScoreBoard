import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { scoreboardState } from "../utils/scoreboardState";
import timeSound from "../assets/sound/time.mp3";

export default function DisplayScreen() {
  const [scoreboardData, setScoreboardData] = useState(
    scoreboardState.getState()
  );
  const [lastUpdate, setLastUpdate] = useState(0);

  const audioElRef = useRef(null);
  const audioCtxRef = useRef(null);
  const audioBufferRef = useRef(null);
  const sourceRef = useRef(null);
  const playStopTimerRef = useRef(null);
  const prevShot = useRef(scoreboardState.getState().shotClock);
  const prevGameTime = useRef(scoreboardState.getState().gameTime);
  const [audioBlocked, setAudioBlocked] = useState(false);

  useEffect(() => {
    const handleStateChange = (newState) => setScoreboardData(newState);
    scoreboardState.addListener(handleStateChange);
    return () => scoreboardState.removeListener(handleStateChange);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setLastUpdate(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let mounted = true;

    const doPreload = async () => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();
        audioCtxRef.current = ctx;

        const resp = await fetch(timeSound);
        if (!resp.ok) throw new Error("Failed to fetch audio asset.");
        const arrayBuffer = await resp.arrayBuffer();

        const decoded = await ctx.decodeAudioData(arrayBuffer);
        if (mounted) {
          audioBufferRef.current = decoded;
        }

        try {
          if (ctx.state === "running") {
            const silent = ctx.createBufferSource();
            const silentBuf = ctx.createBuffer(1, 1, ctx.sampleRate);
            silent.buffer = silentBuf;
            silent.connect(ctx.destination);
            silent.start();
          }
        } catch (e) {}
      } catch (err) {
        console.warn("WebAudio preload failed:", err);
      }
    };

    doPreload();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      try {
        if (sourceRef.current) {
          sourceRef.current.stop();
          sourceRef.current.disconnect();
          sourceRef.current = null;
        }
      } catch (e) {}
      if (playStopTimerRef.current) {
        clearTimeout(playStopTimerRef.current);
        playStopTimerRef.current = null;
      }
      try {
        if (
          audioCtxRef.current &&
          typeof audioCtxRef.current.close === "function"
        ) {
          audioCtxRef.current.close();
          audioCtxRef.current = null;
        }
      } catch (e) {}
    };
  }, []);

  const playSegment = async (startSec = 0.9, endSec = 4.0) => {
    if (playStopTimerRef.current) {
      clearTimeout(playStopTimerRef.current);
      playStopTimerRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      } catch (e) {}
      sourceRef.current = null;
    }

    const duration = Math.max(0, endSec - startSec);

    const ctx = audioCtxRef.current;
    const buffer = audioBufferRef.current;
    if (ctx && buffer) {
      try {
        if (ctx.state === "suspended") {
          try {
            await ctx.resume();
            setAudioBlocked(false);
          } catch (err) {
            setAudioBlocked(true);
            throw err;
          }
        }

        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.start(ctx.currentTime, startSec, duration);
        sourceRef.current = src;

        playStopTimerRef.current = setTimeout(() => {
          try {
            if (sourceRef.current) {
              sourceRef.current.stop();
              sourceRef.current.disconnect();
              sourceRef.current = null;
            }
          } catch (e) {}
          playStopTimerRef.current = null;
        }, Math.ceil(duration * 1000) + 50);

        setAudioBlocked(false);
        return;
      } catch (err) {
        console.warn("WebAudio play failed, falling back:", err);
      }
    }

    try {
      const audioEl = audioElRef.current;
      if (!audioEl) return;
      audioEl.pause();
      audioEl.currentTime = Math.max(0, startSec);
      const p = audioEl.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          setAudioBlocked(false);
        }).catch((err) => {
          console.warn("Fallback audio play blocked:", err);
          setAudioBlocked(true);
        });
      }
      playStopTimerRef.current = setTimeout(() => {
        try {
          audioEl.pause();
          audioEl.currentTime = 0;
        } catch (e) {}
        playStopTimerRef.current = null;
      }, Math.ceil(duration * 1000) + 50);
    } catch (err) {
      console.warn("Fallback audio error:", err);
      setAudioBlocked(true);
    }
  };

  const handleEnableSound = async () => {
    try {
      if (audioCtxRef.current && audioCtxRef.current.state !== "running") {
        await audioCtxRef.current.resume();
      }
      setAudioBlocked(false);
      playSegment(0.9, 4.0);
    } catch (err) {
      console.warn("Enable sound resume failed:", err);
      setAudioBlocked(true);
    }
  };

  const formatGameTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds >= 60) {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    } else {
      return (ms / 1000).toFixed(1);
    }
  };

  const formatRestTime = (ms) => {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const formatShotClock = (ms) => {
    if (ms > 5000) {
      return Math.ceil(ms / 1000).toString();
    } else {
      const tenths = Math.floor(ms / 100);
      const value = tenths / 10;
      return value.toFixed(1);
    }
  };

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

  useLayoutEffect(() => {
    // Shot clock buzzer
    const PRE_EMIT_THRESHOLD = 100;
    if (
      scoreboardData.isShotRunning &&
      prevShot.current > PRE_EMIT_THRESHOLD &&
      shotTime <= PRE_EMIT_THRESHOLD
    ) {
      playSegment(0.9, 4.0);
    } else if (
      scoreboardData.isShotRunning &&
      prevShot.current > 0 &&
      shotTime <= 0
    ) {
      playSegment(0.9, 4.0);
    }
    prevShot.current = shotTime;

    // Game clock buzzer
    if (scoreboardData.isRunning && prevGameTime.current > 0 && gameTime <= 0) {
      playSegment(0.9, 4.0);
    }
    prevGameTime.current = gameTime;
  }, [
    shotTime,
    gameTime,
    scoreboardData.isShotRunning,
    scoreboardData.isRunning,
  ]);

  useEffect(() => {
    if (scoreboardData.restActive && restTime <= 0) {
      scoreboardState.stopRest();
    }
  }, [restTime, scoreboardData.restActive]);

  const renderFoulLights = (count) => {
    const maxLights = 4; // Changed from 6 to 4
    const filled = Math.min(count, maxLights);
    const lights = [];
    for (let i = 0; i < maxLights; i++) {
      const isFilled = i < filled;
      lights.push(
        <div
          key={i}
          aria-hidden
          className={`w-6 h-6 rounded-full border-2 ${
            isFilled
              ? "bg-red-500 border-red-600"
              : "bg-transparent border-gray-600"
          }`}
          title={`${i + 1} ${i < filled ? "foul" : ""}`}
        />
      );
    }
    return (
      <div className="flex gap-2 items-center justify-center">{lights}</div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-4 flex justify-center items-center">
      <audio ref={audioElRef} src={timeSound} preload="auto" />

      {audioBlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
          <div className="bg-black/80 p-6 rounded-lg text-center text-white max-w-sm mx-4">
            <div className="mb-4 text-lg font-bold">Enable Sound</div>
            <div className="mb-4 text-sm">
              Your browser is blocking immediate audio playback. Click below to
              enable buzzer sound.
            </div>
            <div className="flex justify-center gap-2">
              <button
                className="bg-green-600 px-4 py-2 rounded"
                onClick={handleEnableSound}
              >
                Enable Sound & Test Buzzer
              </button>
            </div>
          </div>
        </div>
      )}

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

          <div className="flex gap-6">
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

          {/* Possession is removed */}
        </div>

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

        {/* Teams with possession arrow in the middle */}
        <div className="grid grid-cols-2 gap-12 relative">
          {/* Team A */}
          <div
            className="text-center"
            style={{ color: scoreboardData.teamAColor }}
          >
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
            className="text-center"
            style={{ color: scoreboardData.teamBColor }}
          >
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

          {/* Possession Arrow in the Middle */}
          {scoreboardData.possession && (
            <div className="absolute left-1/2 bottom-[80px] transform -translate-x-1/2 -translate-y-1/10">
              <div className="text-6xl text-yellow-400 animate-pulse pointer-events-none">
                {scoreboardData.possession === "A" ? "➡" : "⬅"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
