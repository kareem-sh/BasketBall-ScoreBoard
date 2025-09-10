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
        if (!AudioContext) {
          // No WebAudio support — we'll rely on <audio> element fallback.
        } else {
          const ctx = new AudioContext();
          audioCtxRef.current = ctx;
        }

        const resp = await fetch(timeSound);
        if (!resp.ok) throw new Error("Failed to fetch audio asset.");
        const arrayBuffer = await resp.arrayBuffer();

        // If we have an AudioContext, decode into buffer:
        if (audioCtxRef.current) {
          const decoded = await audioCtxRef.current.decodeAudioData(
            arrayBuffer
          );
          if (mounted) {
            audioBufferRef.current = decoded;
          }
        } else {
          // No AudioContext; preload into the <audio> element by creating an object URL
          if (mounted && audioElRef.current) {
            try {
              // attempt to load into the <audio> element (browser will handle caching)
              audioElRef.current.src = timeSound;
              audioElRef.current.load();
            } catch (e) {
              // ignore
            }
          }
        }

        // --- NEW: detect if audio is blocked and show dialog when needed ---
        // Slight timeout to let browser settle
        setTimeout(() => {
          if (!mounted) return;
          if (audioCtxRef.current) {
            // If the AudioContext exists but is suspended -> browser needs gesture
            if (audioCtxRef.current.state === "suspended") {
              setAudioBlocked(true);
            }
          } else {
            // No AudioContext: try a gentle play() test on the <audio> element to detect autoplay block.
            const audioEl = audioElRef.current;
            if (audioEl && typeof audioEl.play === "function") {
              const p = audioEl.play();
              if (p && typeof p.then === "function") {
                p.then(() => {
                  // autoplay succeeded — pause immediately (we don't want sound right now)
                  try {
                    audioEl.pause();
                    audioEl.currentTime = 0;
                  } catch (e) {
                    /* ignore */
                  }
                }).catch(() => {
                  // play was blocked
                  setAudioBlocked(true);
                });
              }
            }
          }
        }, 50);
      } catch (err) {
        console.warn("WebAudio preload failed:", err);
        // If preload fails, best to show enable dialog so user can try manually
        setAudioBlocked(true);
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
    const maxLights = 4;
    const filled = Math.min(count, maxLights);
    const lights = [];
    for (let i = 0; i < maxLights; i++) {
      const isFilled = i < filled;
      lights.push(
        <div
          key={i}
          aria-hidden
          className={`w-12 h-12 rounded-full border-2 ${
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
    <div className="min-h-screen flex justify-center items-center bg-gray-900/10">
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
        className={`max-w-8xl w-full h-auto rounded-2xl p-5 shadow-2xl border-8 transition-all duration-500
          ${
            shotTime <= 0
              ? "bg-red-900 border-red-600 shadow-[0_0_40px_15px_rgba(255,0,0,0.8)] animate-pulse"
              : "bg-white border-yellow-500"
          }`}
      >
        {/* Top: big game time (or REST) */}
        <div className="flex justify-center">
          <div className="text-center">
            {scoreboardData.restActive ? (
              <>
                <div className="text-6xl text-gray-500">REST</div>
                <div className="text-8xl md:text-[250px] font-extrabold text-blue-600">
                  {formatRestTime(restTime)}
                </div>
              </>
            ) : (
              <>
                <div
                  className={`text-8xl md:text-[220px] font-extrabold ${
                    gameTime < 60000 ? "text-red-600" : ""
                  }`}
                >
                  {formatGameTime(gameTime)}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Quarter indicator */}
        <div className="text-8xl font-bold text-center mt-6">
          {scoreboardData.quarter > scoreboardData.totalQuarters
            ? `OT${scoreboardData.quarter - scoreboardData.totalQuarters}`
            : `Q${scoreboardData.quarter}`}
        </div>

        {/* Grid: Team A | Shot Clock (big) | Team B */}
        <div className="grid grid-cols-3 gap-6 relative mt-8">
          {/* Team A */}
          <div
            className="text-center flex flex-col items-center justify-center"
            style={{ color: scoreboardData.teamAColor }}
          >
            <div className="text-5xl md:text-[120px] font-bold -mt-[250px]">
              {scoreboardData.teamAName}
            </div>

            <div className="text-[120px] sm:text-[160px] md:text-[220px] lg:text-[180px] font-extrabold leading-none">
              {scoreboardData.teamAScore}
            </div>

            <div className="mb-2">
              <div className="text-2xl md:text-5xl mb-2">FOULS</div>
              {renderFoulLights(scoreboardData.teamAFouls || 0)}
            </div>

            <div className="p-3 md:p-4 rounded-lg shadow inline-block mt-3">
              <div className="text-2xl md:text-5xl">TO</div>
              <div className="text-4xl md:text-8xl font-bold">
                {scoreboardData.teamATimeouts}
              </div>
            </div>
          </div>

          {/* Shot Clock — always present, BIG, centered between scores */}
          <div className="flex items-center justify-center ">
            <div
              className={`flex items-center justify-center rounded-3xl shadow-2xl px-3 py-5 min-w-[350px] -mt-[100px] ${
                shotTime < 5000 ? "bg-red-700" : "bg-red-600"
              }`}
            >
              <div className="text-[170px] sm:text-[160px] md:text-[2500px] lg:text-[150px] font-extrabold text-white leading-none">
                {formatShotClock(shotTime)}
              </div>
            </div>
          </div>

          {/* Team B */}
          <div
            className="text-center flex flex-col items-center justify-center"
            style={{ color: scoreboardData.teamBColor }}
          >
            <div className="text-5xl md:text-[120px] font-bold -mt-[250px]">
              {scoreboardData.teamBName}
            </div>

            <div className="text-[120px] sm:text-[160px] md:text-[220px] lg:text-[180px] font-extrabold leading-none">
              {scoreboardData.teamBScore}
            </div>

            <div className="mb-2">
              <div className="text-2xl md:text-5xl mb-2">FOULS</div>
              {renderFoulLights(scoreboardData.teamBFouls || 0)}
            </div>

            <div className="p-3 md:p-4 rounded-lg shadow inline-block mt-3">
              <div className="text-2xl md:text-5xl">TO</div>
              <div className="text-4xl md:text-8xl font-bold">
                {scoreboardData.teamBTimeouts}
              </div>
            </div>
          </div>
        </div>

        {/* Possession Arrow */}
        {scoreboardData.possession && (
          <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-[120px] pointer-events-none">
            <div className="text-9xl text-yellow-400 animate-pulse">
              {scoreboardData.possession === "A" ? "⬅" : "➡"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
