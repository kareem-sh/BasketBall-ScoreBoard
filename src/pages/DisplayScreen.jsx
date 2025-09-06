import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { scoreboardState } from "../utils/scoreboardState";
import timeSound from "../assets/sound/time.mp3";

export default function DisplayScreen() {
  const [scoreboardData, setScoreboardData] = useState(
    scoreboardState.getState()
  );
  const [lastUpdate, setLastUpdate] = useState(0);

  // HTMLAudio fallback element
  const audioElRef = useRef(null);

  // WebAudio objects
  const audioCtxRef = useRef(null);
  const audioBufferRef = useRef(null);
  const sourceRef = useRef(null);
  const playStopTimerRef = useRef(null);

  // previous shot value (ms)
  const prevShot = useRef(scoreboardState.getState().shotClock);

  // UI flags
  const [audioBlocked, setAudioBlocked] = useState(false);

  // listen for scoreboard state changes
  useEffect(() => {
    const handleStateChange = (newState) => setScoreboardData(newState);
    scoreboardState.addListener(handleStateChange);
    return () => scoreboardState.removeListener(handleStateChange);
  }, []);

  // tick to update UI regularly
  useEffect(() => {
    const t = setInterval(() => setLastUpdate(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  // Preload + decode audio into AudioBuffer (WebAudio), and create AudioContext.
  useEffect(() => {
    let mounted = true;

    const doPreload = async () => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
          console.warn("Web Audio API not available — using <audio> fallback.");
          return;
        }

        // Create AudioContext but do not rely on it being already resumed (resume may require user gesture)
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;

        // Fetch the audio file (works for bundlers that emit a URL)
        const resp = await fetch(timeSound);
        if (!resp.ok) throw new Error("Failed to fetch audio asset.");
        const arrayBuffer = await resp.arrayBuffer();

        // decode
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        if (mounted) {
          audioBufferRef.current = decoded;
        }

        // pre-warm: play a single-sample silent buffer to warm audio thread (best-effort)
        try {
          if (ctx.state === "running") {
            const silent = ctx.createBufferSource();
            const silentBuf = ctx.createBuffer(1, 1, ctx.sampleRate);
            silent.buffer = silentBuf;
            silent.connect(ctx.destination);
            silent.start();
            // no need to stop; it's a single sample
          }
        } catch (e) {
          // ignore warming errors
        }
      } catch (err) {
        console.warn("WebAudio preload failed:", err);
        // leave audioBufferRef null -> fallback will be used
      }
    };

    doPreload();

    return () => {
      mounted = false;
    };
  }, []);

  // cleanup on unmount
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

  // play segment via WebAudio if available, else fallback to HTMLAudio.
  // startSec and endSec in seconds
  const playSegment = async (startSec = 0.9, endSec = 4.0) => {
    // cleanup existing
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

    // Try WebAudio
    const ctx = audioCtxRef.current;
    const buffer = audioBufferRef.current;
    if (ctx && buffer) {
      try {
        // If suspended, try resume (may require user gesture)
        if (ctx.state === "suspended") {
          try {
            await ctx.resume();
            setAudioBlocked(false);
          } catch (err) {
            // resume blocked; mark blocked so UI prompts user
            setAudioBlocked(true);
            throw err;
          }
        }

        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.start(ctx.currentTime, startSec, duration);
        sourceRef.current = src;

        // schedule cleanup
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

        // success
        setAudioBlocked(false);
        return;
      } catch (err) {
        console.warn("WebAudio play failed, falling back:", err);
        // fall through to HTMLAudio fallback
      }
    }

    // HTMLAudio fallback (may be slower)
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

  // User gesture handler to resume audio context and test buzzer
  const handleEnableSound = async () => {
    try {
      if (audioCtxRef.current && audioCtxRef.current.state !== "running") {
        await audioCtxRef.current.resume();
      }
      setAudioBlocked(false);
      // test play segment (user gesture)
      playSegment(0.9, 4.0);
    } catch (err) {
      console.warn("Enable sound resume failed:", err);
      setAudioBlocked(true);
    }
  };

  // Formatters ----------------------------------------------------------------
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

  // Show "5.0" at exactly 5000ms, then floor tenths for <5000ms (no skip)
  const formatShotClock = (ms) => {
    if (ms > 5000) {
      return Math.ceil(ms / 1000).toString();
    } else {
      const tenths = Math.floor(ms / 100); // e.g. 4999/100 = 49
      const value = tenths / 10;
      return value.toFixed(1);
    }
  };

  // Live values ----------------------------------------------------------------
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

  // Trigger buzzer BEFORE paint with useLayoutEffect, predictive at <= 100ms
  useLayoutEffect(() => {
    // If crossing from >100ms to <=100ms, trigger early so sound and paint align
    const PRE_EMIT_THRESHOLD = 100; // ms
    if (
      prevShot.current > PRE_EMIT_THRESHOLD &&
      shotTime <= PRE_EMIT_THRESHOLD
    ) {
      // attempt instant play (0.9s -> 4.0s)
      playSegment(0.9, 4.0);
    } else if (prevShot.current > 0 && shotTime <= 0) {
      // fallback: if we missed the predictive window, ensure we still trigger on <=0
      playSegment(0.9, 4.0);
    }
    prevShot.current = shotTime;
  }, [shotTime]); // synchronous pre-paint

  // Rest auto-stop
  useEffect(() => {
    if (scoreboardData.restActive && restTime <= 0) {
      scoreboardState.stopRest();
    }
  }, [restTime, scoreboardData.restActive]);

  // Foul lights renderer (unchanged)
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
      {/* HTMLAudio fallback element */}
      <audio ref={audioElRef} src={timeSound} preload="auto" />

      {/* If autoplay / AudioContext blocked, show prompt */}
      {audioBlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
          <div className="bg-black/80 p-6 rounded-lg text-center text-white max-w-sm mx-4">
            <div className="mb-4 text-lg font-bold">Enable Sound</div>
            <div className="mb-4 text-sm">
              Your browser is blocking immediate audio playback. Click below to
              enable buzzer sound (this is a required user gesture for some
              browsers).
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
