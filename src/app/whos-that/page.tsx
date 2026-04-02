"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Pokemon } from "@/lib/types";
import { fetchPokemon, formatPokemonName, getPokemonImageUrl } from "@/lib/api";
import TypeBadge from "@/components/TypeBadge";
import { typeColors } from "@/lib/typeColors";

const MAX_ID = 905;
const TIMER_DURATION = 15;

function randId() {
  return Math.floor(Math.random() * MAX_ID) + 1;
}

type Phase = "idle" | "guessing" | "correct" | "wrong" | "timeout";

export default function WhosThatPage() {
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [nextPokemon, setNextPokemon] = useState<Pokemon | null>(null);
  const [guess, setGuess] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [total, setTotal] = useState(0);
  const [timer, setTimer] = useState(TIMER_DURATION);
  const [timerMode, setTimerMode] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const preloadNext = useCallback(async () => {
    try {
      const p = await fetchPokemon(randId());
      setNextPokemon(p);
    } catch {
      // silent
    }
  }, []);

  const startRound = useCallback(
    async (usePreloaded?: Pokemon) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setLoading(true);
      setGuess("");
      setShowHint(false);
      setTimer(TIMER_DURATION);

      try {
        const poke: Pokemon = usePreloaded ?? (await fetchPokemon(randId()));
        setPokemon(poke);
        setPhase("guessing");
        setTimeout(() => inputRef.current?.focus(), 100);
        preloadNext();
      } catch {
        setPhase("idle");
      } finally {
        setLoading(false);
      }
    },
    [preloadNext]
  );

  // Timer countdown
  useEffect(() => {
    if (phase === "guessing" && timerMode) {
      timerRef.current = setInterval(() => {
        setTimer((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            setPhase("timeout");
            setStreak(0);
            setTotal((x) => x + 1);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, timerMode]);

  const submitGuess = useCallback(() => {
    if (!pokemon || phase !== "guessing") return;
    if (timerRef.current) clearInterval(timerRef.current);

    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const correct = norm(guess) === norm(pokemon.name);

    setTotal((x) => x + 1);
    if (correct) {
      setPhase("correct");
      const pts = timerMode ? Math.max(10, timer * 10) : 100;
      setScore((s) => s + pts);
      setStreak((s) => {
        const ns = s + 1;
        setBest((b) => Math.max(b, ns));
        return ns;
      });
    } else {
      setPhase("wrong");
      setStreak(0);
    }
  }, [pokemon, phase, guess, timer, timerMode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submitGuess();
  };

  const nextRound = () => {
    startRound(nextPokemon || undefined);
  };

  const reset = () => {
    setScore(0);
    setStreak(0);
    setTotal(0);
    setBest(0);
    setPokemon(null);
    setPhase("idle");
  };

  const timerPct = (timer / TIMER_DURATION) * 100;
  const timerColor =
    timer > 10 ? "#22C55E" : timer > 5 ? "#EAB308" : "#EF4444";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">❓ Who's That Pokémon?</h1>
          <p className="text-white/30 text-sm">Guess from the silhouette</p>
        </div>
        <button
          onClick={reset}
          className="text-xs text-white/30 hover:text-white/60 transition-colors mt-1"
        >
          Reset
        </button>
      </div>

      {/* Score bar */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { label: "Score", value: score.toLocaleString(), color: "#EAB308" },
          { label: "Streak", value: streak, color: "#22C55E" },
          { label: "Best", value: best, color: "#EC4899" },
          { label: "Played", value: total, color: "#818CF8" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl border border-white/5 bg-[#111120] p-3 text-center"
          >
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
              {label}
            </p>
            <p className="text-lg font-black" style={{ color }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Main game area */}
      <div className="rounded-2xl border border-white/5 bg-[#111120] overflow-hidden mb-5">
        {phase === "idle" ? (
          /* Start screen */
          <div className="p-10 flex flex-col items-center text-center">
            <div className="text-6xl mb-6 opacity-60">❓</div>
            <h2 className="text-xl font-bold text-white mb-2">Ready to Play?</h2>
            <p className="text-white/35 text-sm mb-8 max-w-xs">
              A Pokémon silhouette will appear. Type the name to guess. Covers
              Gen 1–8.
            </p>

            {/* Timer mode toggle */}
            <div className="flex items-center gap-3 mb-8">
              <span className="text-sm text-white/50">Timer Mode</span>
              <button
                onClick={() => setTimerMode(!timerMode)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  timerMode ? "bg-[#dc2626]" : "bg-white/10"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                    timerMode ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
              <span className="text-sm text-white/30">15s per round</span>
            </div>

            <button
              onClick={() => startRound()}
              disabled={loading}
              className="px-10 py-3.5 bg-[#dc2626] hover:bg-[#ef4444] text-white font-bold rounded-xl transition-colors disabled:opacity-50 text-sm"
            >
              {loading ? "Loading…" : "Start Game"}
            </button>
          </div>
        ) : (
          <div>
            {/* Timer bar */}
            {timerMode && (
              <div className="h-1 bg-white/5">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${timerPct}%`,
                    backgroundColor: timerColor,
                    transitionDuration: "1s",
                  }}
                />
              </div>
            )}

            <div className="p-8">
              {/* Silhouette / reveal */}
              <div className="flex justify-center mb-6">
                <div className="relative w-48 h-48">
                  {pokemon && (
                    <>
                      <img
                        src={getPokemonImageUrl(pokemon.id)}
                        alt="???"
                        className="w-full h-full object-contain drop-shadow-2xl transition-all duration-500"
                        style={
                          phase === "guessing" || phase === "timeout"
                            ? { filter: "brightness(0)", transform: "scale(1)" }
                            : phase === "correct"
                            ? {
                                filter: "drop-shadow(0 0 20px rgba(34,197,94,0.6))",
                                transform: "scale(1.05)",
                              }
                            : {
                                filter: "drop-shadow(0 0 20px rgba(239,68,68,0.5))",
                              }
                        }
                      />
                      {/* Question mark overlay */}
                      {(phase === "guessing" || phase === "timeout") && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-5xl font-black text-white/10">?</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Timer display */}
              {timerMode && phase === "guessing" && (
                <div className="text-center mb-4">
                  <span
                    className="text-2xl font-black transition-colors"
                    style={{ color: timerColor }}
                  >
                    {timer}
                  </span>
                  <span className="text-white/30 text-sm ml-1">s</span>
                </div>
              )}

              {/* Hint */}
              {phase === "guessing" && pokemon && (
                <div className="text-center mb-4">
                  {showHint ? (
                    <div className="flex justify-center gap-2">
                      {pokemon.types.map(({ type }) => (
                        <TypeBadge key={type.name} type={type.name} size="md" />
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowHint(true)}
                      className="text-xs text-white/25 hover:text-white/50 transition-colors"
                    >
                      Show type hint
                    </button>
                  )}
                </div>
              )}

              {/* Answer reveal */}
              {(phase === "correct" || phase === "wrong" || phase === "timeout") &&
                pokemon && (
                  <div className="text-center mb-6">
                    <div
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-3 ${
                        phase === "correct"
                          ? "bg-green-500/15 text-green-400 border border-green-500/25"
                          : "bg-red-500/15 text-red-400 border border-red-500/25"
                      }`}
                    >
                      {phase === "correct" ? "✓ Correct!" : phase === "timeout" ? "⏰ Time's up!" : "✗ Wrong!"}
                    </div>
                    <p className="text-xl font-black text-white mb-2">
                      {formatPokemonName(pokemon.name)}
                    </p>
                    <div className="flex justify-center gap-2">
                      {pokemon.types.map(({ type }) => (
                        <TypeBadge key={type.name} type={type.name} />
                      ))}
                    </div>
                    {phase === "correct" && timerMode && (
                      <p className="text-xs text-white/30 mt-2">
                        +{Math.max(10, timer * 10)} points
                      </p>
                    )}
                  </div>
                )}

              {/* Input */}
              {phase === "guessing" && (
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Who's that Pokémon?"
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:border-[#dc2626]/40 text-sm"
                  />
                  <button
                    onClick={submitGuess}
                    disabled={!guess.trim()}
                    className="px-5 py-3 bg-[#dc2626] hover:bg-[#ef4444] text-white font-semibold rounded-xl transition-colors disabled:opacity-40 text-sm"
                  >
                    Guess
                  </button>
                </div>
              )}

              {/* Next button */}
              {(phase === "correct" || phase === "wrong" || phase === "timeout") && (
                <div className="flex justify-center">
                  <button
                    onClick={nextRound}
                    className="px-8 py-3 bg-[#dc2626] hover:bg-[#ef4444] text-white font-semibold rounded-xl transition-colors text-sm"
                  >
                    Next Pokémon →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Settings row (outside game) */}
      {phase === "idle" ? null : (
        <div className="flex justify-center">
          <button
            onClick={() => setTimerMode(!timerMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs border transition-all ${
              timerMode
                ? "bg-[#dc2626]/10 text-[#dc2626] border-[#dc2626]/25"
                : "bg-white/3 text-white/30 border-white/8 hover:text-white/50"
            }`}
          >
            ⏱ Timer Mode: {timerMode ? "On" : "Off"}
          </button>
        </div>
      )}
    </div>
  );
}