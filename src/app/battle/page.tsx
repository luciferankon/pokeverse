"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  BattlePokemon,
  BattleMove,
  Difficulty,
  calcHp,
  calcStat,
  calculateDamage,
  checkAccuracy,
  checkStatusBlock,
  applyStatusDamage,
  getEffectiveSpeed,
  aiSelectMove,
  formatName,
} from "@/lib/battleEngine";
import { fetchPokemon, fetchMove, getPokemonImageUrl } from "@/lib/api";

// ── Type colors ──────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  normal: "#A8A878", fire: "#F08030", water: "#6890F0", electric: "#F8D030",
  grass: "#78C850", ice: "#98D8D8", fighting: "#C03028", poison: "#A040A0",
  ground: "#E0C068", flying: "#A890F0", psychic: "#F85888", bug: "#A8B820",
  rock: "#B8A038", ghost: "#705898", dragon: "#7038F8", dark: "#705848",
  steel: "#B8B8D0", fairy: "#EE99AC",
};

// ── Phases ───────────────────────────────────────────────────────────
type Phase = "select" | "loading" | "battle" | "switching" | "result";

// ── Build a BattlePokemon from PokéAPI data ─────────────────────────
async function buildBattlePokemon(id: number, isPlayer: boolean): Promise<BattlePokemon> {
  const data = await fetchPokemon(id);

  // Pick moves: fetch up to 12 random move details, keep best 4 damaging
  const allMoveEntries = data.moves || [];
  const shuffled = [...allMoveEntries].sort(() => Math.random() - 0.5).slice(0, 12);

  const moveDetails: BattleMove[] = [];
  for (const entry of shuffled) {
    try {
      const md = await fetchMove(entry.move.name);
      moveDetails.push({
        name: md.name,
        type: md.type.name,
        damageClass: md.damage_class.name,
        power: md.power,
        accuracy: md.accuracy,
        pp: md.pp ?? 10,
        maxPp: md.pp ?? 10,
        priority: md.priority ?? 0,
      });
    } catch {
      // skip failed fetches
    }
  }

  // Prefer damaging moves, fill with status if needed
  const damaging = moveDetails.filter((m) => m.power && m.power > 0);
  const status = moveDetails.filter((m) => !m.power || m.power === 0);
  damaging.sort((a, b) => (b.power || 0) - (a.power || 0));

  let finalMoves: BattleMove[];
  if (damaging.length >= 4) {
    finalMoves = damaging.slice(0, 4);
  } else {
    finalMoves = [...damaging, ...status].slice(0, 4);
  }

  // Ensure at least one move
  if (finalMoves.length === 0) {
    finalMoves = [{ name: "Struggle", type: "normal", damageClass: "physical", power: 50, accuracy: null, pp: 99, maxPp: 99, priority: 0 }];
  }

  const stats = {
    hp: calcHp(data.stats[0].base_stat),
    attack: calcStat(data.stats[1].base_stat),
    defense: calcStat(data.stats[2].base_stat),
    spAtk: calcStat(data.stats[3].base_stat),
    spDef: calcStat(data.stats[4].base_stat),
    speed: calcStat(data.stats[5].base_stat),
  };

  return {
    id: data.id,
    name: data.name,
    types: data.types.map((t: { type: { name: string } }) => t.type.name),
    stats,
    currentHp: stats.hp,
    maxHp: stats.hp,
    moves: finalMoves,
    status: null,
    statusTurns: 0,
    sprite: getPokemonImageUrl(data.id),
    isPlayer,
  };
}

// ── Main Component ───────────────────────────────────────────────────
export default function BattlePage() {
  const [phase, setPhase] = useState<Phase>("select");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");

  // Teams
  const [playerTeam, setPlayerTeam] = useState<BattlePokemon[]>([]);
  const [aiTeam, setAiTeam] = useState<BattlePokemon[]>([]);
  const [activePlayer, setActivePlayer] = useState(0);
  const [activeAi, setActiveAi] = useState(0);

  // Custom team selection
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchResults, setSearchResults] = useState<{ id: number; name: string }[]>([]);
  const [searching, setSearching] = useState(false);

  // Battle state
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [winner, setWinner] = useState<"player" | "ai" | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const [turnCount, setTurnCount] = useState(0);

  // Loading
  const [loadingMsg, setLoadingMsg] = useState("");

  // Auto-scroll battle log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [battleLog]);

  // ── Search Pokémon ─────────────────────────────────────────────────
  const searchPokemon = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      // Try exact match first
      const numId = parseInt(q);
      if (!isNaN(numId) && numId >= 1 && numId <= 1025) {
        const p = await fetchPokemon(numId);
        setSearchResults([{ id: p.id, name: p.name }]);
      } else {
        // Try name search
        try {
          const p = await fetchPokemon(q.toLowerCase().trim());
          setSearchResults([{ id: p.id, name: p.name }]);
        } catch {
          // Fetch a list and filter
          const res = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=1025`);
          const data = await res.json();
          const matches = data.results
            .filter((r: { name: string }) => r.name.includes(q.toLowerCase().trim()))
            .slice(0, 8)
            .map((r: { name: string; url: string }) => ({
              name: r.name,
              id: parseInt(r.url.split("/").filter(Boolean).pop() || "0"),
            }));
          setSearchResults(matches);
        }
      }
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }, []);

  // ── Start Quick Battle ─────────────────────────────────────────────
  const startQuickBattle = async () => {
    setPhase("loading");
    setLoadingMsg("Building random teams...");
    try {
      const usedIds = new Set<number>();
      const getRandomId = () => {
        let id;
        do { id = Math.floor(Math.random() * 898) + 1; } while (usedIds.has(id));
        usedIds.add(id);
        return id;
      };

      const pIds = [getRandomId(), getRandomId(), getRandomId()];
      const aIds = [getRandomId(), getRandomId(), getRandomId()];

      setLoadingMsg(`Loading your team: #${pIds.join(", #")}...`);
      const pTeam = await Promise.all(pIds.map((id) => buildBattlePokemon(id, true)));
      setLoadingMsg(`Loading opponent: #${aIds.join(", #")}...`);
      const aTeam = await Promise.all(aIds.map((id) => buildBattlePokemon(id, false)));

      setPlayerTeam(pTeam);
      setAiTeam(aTeam);
      setActivePlayer(0);
      setActiveAi(0);
      setBattleLog([
        `\u2694\ufe0f Battle Start!`,
        `You sent out ${formatName(pTeam[0].name)}!`,
        `Opponent sent out ${formatName(aTeam[0].name)}!`,
      ]);
      setTurnCount(1);
      setWinner(null);
      setPhase("battle");
    } catch (err) {
      setLoadingMsg("Error building teams. Try again.");
      setTimeout(() => setPhase("select"), 2000);
    }
  };

  // ── Start Custom Battle ────────────────────────────────────────────
  const startCustomBattle = async () => {
    if (selectedIds.length < 1) return;
    setPhase("loading");
    setLoadingMsg("Building your team...");
    try {
      const pTeam = await Promise.all(selectedIds.map((id) => buildBattlePokemon(id, true)));

      // Random AI team
      const usedIds = new Set(selectedIds);
      const getRandomId = () => {
        let id;
        do { id = Math.floor(Math.random() * 898) + 1; } while (usedIds.has(id));
        usedIds.add(id);
        return id;
      };
      const aIds = Array.from({ length: pTeam.length }, getRandomId);
      setLoadingMsg("Loading opponent...");
      const aTeam = await Promise.all(aIds.map((id) => buildBattlePokemon(id, false)));

      setPlayerTeam(pTeam);
      setAiTeam(aTeam);
      setActivePlayer(0);
      setActiveAi(0);
      setBattleLog([
        `\u2694\ufe0f Battle Start!`,
        `You sent out ${formatName(pTeam[0].name)}!`,
        `Opponent sent out ${formatName(aTeam[0].name)}!`,
      ]);
      setTurnCount(1);
      setWinner(null);
      setPhase("battle");
    } catch {
      setLoadingMsg("Error building teams. Try again.");
      setTimeout(() => setPhase("select"), 2000);
    }
  };

  // ── Execute a Turn ─────────────────────────────────────────────────
  const executeTurn = async (playerMoveIndex: number) => {
    if (isAnimating || winner) return;
    setIsAnimating(true);

    const player = { ...playerTeam[activePlayer] };
    const ai = { ...aiTeam[activeAi] };
    const playerMove = player.moves[playerMoveIndex];
    const aiMove = aiSelectMove(ai, player, difficulty);

    // Deduct PP
    playerMove.pp = Math.max(0, playerMove.pp - 1);

    const aiMoveRef = ai.moves.find((m) => m.name === aiMove.name);
    if (aiMoveRef) aiMoveRef.pp = Math.max(0, aiMoveRef.pp - 1);

    const newLog: string[] = [];
    newLog.push(`\u2500\u2500 Turn ${turnCount} \u2500\u2500`);

    // Determine order: priority first, then speed
    let playerFirst = true;
    if (playerMove.priority !== aiMove.priority) {
      playerFirst = playerMove.priority > aiMove.priority;
    } else {
      const pSpd = getEffectiveSpeed(player);
      const aSpd = getEffectiveSpeed(ai);
      playerFirst = pSpd >= aSpd ? (pSpd === aSpd ? Math.random() > 0.5 : true) : false;
    }

    const attackers = playerFirst ? [{ atk: player, def: ai, move: playerMove, isP: true }, { atk: ai, def: player, move: aiMove, isP: false }]
      : [{ atk: ai, def: player, move: aiMove, isP: false }, { atk: player, def: ai, move: playerMove, isP: true }];

    for (const turn of attackers) {
      // Skip if attacker fainted
      if (turn.atk.currentHp <= 0) continue;

      // Status block check
      const statusCheck = checkStatusBlock(turn.atk);
      if (statusCheck.cured) {
        turn.atk.status = null;
        turn.atk.statusTurns = 0;
        newLog.push(statusCheck.message);
      }
      if (statusCheck.blocked) {
        if (!statusCheck.cured) newLog.push(statusCheck.message);
        // Decrement sleep turns
        if (turn.atk.status === "sleep") turn.atk.statusTurns--;
        continue;
      }

      const atkName = formatName(turn.atk.name);
      const moveName = formatName(turn.move.name);
      newLog.push(`${atkName} used ${moveName}!`);

      // Accuracy check
      if (!checkAccuracy(turn.move)) {
        newLog.push(`${atkName}'s attack missed!`);
        continue;
      }

      // Calculate damage
      const result = calculateDamage(turn.atk, turn.def, turn.move);
      if (result.message) newLog.push(result.message);

      if (result.damage > 0) {
        turn.def.currentHp = Math.max(0, turn.def.currentHp - result.damage);
        const pct = Math.round((result.damage / turn.def.maxHp) * 100);
        newLog.push(`${formatName(turn.def.name)} took ${result.damage} damage (${pct}%)!`);

        if (turn.def.currentHp <= 0) {
          newLog.push(`${formatName(turn.def.name)} fainted!`);
        }
      }
    }

    // End-of-turn status damage
    for (const pkmn of [player, ai]) {
      if (pkmn.currentHp > 0) {
        const statusDmg = applyStatusDamage(pkmn);
        if (statusDmg) {
          pkmn.currentHp = Math.max(0, pkmn.currentHp - statusDmg.damage);
          newLog.push(statusDmg.message);
          if (pkmn.currentHp <= 0) {
            newLog.push(`${formatName(pkmn.name)} fainted!`);
          }
        }
      }
    }

    // Update state
    const newPlayerTeam = [...playerTeam];
    newPlayerTeam[activePlayer] = player;
    const newAiTeam = [...aiTeam];
    newAiTeam[activeAi] = ai;
    setPlayerTeam(newPlayerTeam);
    setAiTeam(newAiTeam);

    // Add log messages with delay
    for (let i = 0; i < newLog.length; i++) {
      await new Promise((r) => setTimeout(r, 350));
      setBattleLog((prev) => [...prev, newLog[i]]);
    }

    setTurnCount((t) => t + 1);

    // Check for faints and switches
    await new Promise((r) => setTimeout(r, 300));

    if (ai.currentHp <= 0) {
      const nextAi = newAiTeam.findIndex((p, i) => i !== activeAi && p.currentHp > 0);
      if (nextAi === -1) {
        setWinner("player");
        setBattleLog((prev) => [...prev, "\ud83c\udf89 You win the battle!"]);
        setPhase("result");
        setIsAnimating(false);
        return;
      } else {
        setActiveAi(nextAi);
        setBattleLog((prev) => [...prev, `Opponent sent out ${formatName(newAiTeam[nextAi].name)}!`]);
      }
    }

    if (player.currentHp <= 0) {
      const nextPlayer = newPlayerTeam.findIndex((p, i) => i !== activePlayer && p.currentHp > 0);
      if (nextPlayer === -1) {
        setWinner("ai");
        setBattleLog((prev) => [...prev, "\ud83d\udc80 You lost the battle..."]);
        setPhase("result");
        setIsAnimating(false);
        return;
      } else {
        // Need to switch
        setPhase("switching");
        setIsAnimating(false);
        return;
      }
    }

    setIsAnimating(false);
  };

  // ── Switch Pokémon ─────────────────────────────────────────────────
  const switchPokemon = (index: number) => {
    if (index === activePlayer || playerTeam[index].currentHp <= 0) return;
    setActivePlayer(index);
    setBattleLog((prev) => [...prev, `Go, ${formatName(playerTeam[index].name)}!`]);
    setPhase("battle");
  };

  // ── Voluntary Switch (uses your turn) ──────────────────────────────
  const voluntarySwitch = async (index: number) => {
    if (index === activePlayer || playerTeam[index].currentHp <= 0 || isAnimating || winner) return;
    setIsAnimating(true);
    setActivePlayer(index);

    const newLog: string[] = [];
    newLog.push(`\u2500\u2500 Turn ${turnCount} \u2500\u2500`);
    newLog.push(`Come back! Go, ${formatName(playerTeam[index].name)}!`);

    // AI still attacks
    const ai = { ...aiTeam[activeAi] };
    const target = { ...playerTeam[index] };
    const aiMove = aiSelectMove(ai, target, difficulty);
    const aiMoveRef = ai.moves.find((m) => m.name === aiMove.name);
    if (aiMoveRef) aiMoveRef.pp = Math.max(0, aiMoveRef.pp - 1);

    const statusCheck = checkStatusBlock(ai);
    if (statusCheck.cured) {
      ai.status = null;
      ai.statusTurns = 0;
      newLog.push(statusCheck.message);
    }
    if (!statusCheck.blocked) {
      newLog.push(`${formatName(ai.name)} used ${formatName(aiMove.name)}!`);
      if (checkAccuracy(aiMove)) {
        const result = calculateDamage(ai, target, aiMove);
        if (result.message) newLog.push(result.message);
        if (result.damage > 0) {
          target.currentHp = Math.max(0, target.currentHp - result.damage);
          newLog.push(`${formatName(target.name)} took ${result.damage} damage!`);
          if (target.currentHp <= 0) newLog.push(`${formatName(target.name)} fainted!`);
        }
      } else {
        newLog.push(`${formatName(ai.name)}'s attack missed!`);
      }
    } else if (!statusCheck.cured) {
      newLog.push(statusCheck.message);
    }

    const newPlayerTeam = [...playerTeam];
    newPlayerTeam[index] = target;
    const newAiTeam = [...aiTeam];
    newAiTeam[activeAi] = ai;
    setPlayerTeam(newPlayerTeam);
    setAiTeam(newAiTeam);

    for (let i = 0; i < newLog.length; i++) {
      await new Promise((r) => setTimeout(r, 350));
      setBattleLog((prev) => [...prev, newLog[i]]);
    }

    setTurnCount((t) => t + 1);

    if (target.currentHp <= 0) {
      const nextPlayer = newPlayerTeam.findIndex((p, i) => i !== index && p.currentHp > 0);
      if (nextPlayer === -1) {
        setWinner("ai");
        setBattleLog((prev) => [...prev, "\ud83d\udc80 You lost the battle..."]);
        setPhase("result");
        setIsAnimating(false);
        return;
      }
      setPhase("switching");
      setIsAnimating(false);
      return;
    }

    setIsAnimating(false);
  };

  // ── HP Bar Color ───────────────────────────────────────────────────
  const hpColor = (current: number, max: number) => {
    const pct = current / max;
    if (pct > 0.5) return "#22C55E";
    if (pct > 0.25) return "#EAB308";
    return "#EF4444";
  };

  // ── Render ─────────────────────────────────────────────────────────

  // ── SELECT PHASE ───────────────────────────────────────────────────
  if (phase === "select") {
    return (
      <div className="min-h-screen bg-[#080810] text-white pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold mb-2">\u2694\ufe0f Battle Simulator</h1>
            <p className="text-white/50">Build a team and battle with real damage formulas, type matchups & AI opponents</p>
          </div>

          {/* Difficulty */}
          <div className="mb-8 text-center">
            <h3 className="text-sm font-medium text-white/40 mb-3 uppercase tracking-wider">Difficulty</h3>
            <div className="flex justify-center gap-3">
              {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold capitalize transition-all ${
                    difficulty === d
                      ? d === "easy" ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/40"
                        : d === "normal" ? "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40"
                        : "bg-red-500/20 text-red-400 ring-1 ring-red-500/40"
                      : "bg-white/5 text-white/40 hover:bg-white/10"
                  }`}
                >
                  {d === "easy" ? "\ud83c\udf31 Easy" : d === "normal" ? "\u26a1 Normal" : "\ud83d\udd25 Hard"}
                </button>
              ))}
            </div>
            <p className="text-xs text-white/30 mt-2">
              {difficulty === "easy" ? "AI picks moves randomly" : difficulty === "normal" ? "AI weighs moves by power & effectiveness" : "AI always picks the optimal move"}
            </p>
          </div>

          {/* Quick Battle */}
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-bold mb-2">\ud83c\udfb2 Quick Battle</h2>
            <p className="text-white/40 text-sm mb-4">Random teams of 3 Pok\u00e9mon each. Jump right in!</p>
            <button
              onClick={startQuickBattle}
              className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold py-3 px-8 rounded-xl transition-all text-lg"
            >
              Start Quick Battle
            </button>
          </div>

          {/* Custom Battle */}
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-2">\ud83c\udfaf Custom Battle</h2>
            <p className="text-white/40 text-sm mb-4">Choose up to 3 Pok\u00e9mon for your team</p>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchPokemon(searchQuery)}
                placeholder="Search by name or ID..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/20"
              />
              <button
                onClick={() => searchPokemon(searchQuery)}
                disabled={searching}
                className="bg-white/10 hover:bg-white/15 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              >
                {searching ? "..." : "Search"}
              </button>
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      if (selectedIds.length < 3 && !selectedIds.includes(r.id)) {
                        setSelectedIds([...selectedIds, r.id]);
                      }
                    }}
                    disabled={selectedIds.includes(r.id) || selectedIds.length >= 3}
                    className={`flex items-center gap-2 p-2 rounded-xl text-sm transition-all ${
                      selectedIds.includes(r.id) ? "bg-green-500/20 text-green-400" : "bg-white/5 hover:bg-white/10 text-white/70"
                    }`}
                  >
                    <img src={getPokemonImageUrl(r.id)} alt="" className="w-8 h-8" />
                    <span className="capitalize truncate">{formatName(r.name)}</span>
                    <span className="text-white/30 text-xs">#{r.id}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected team */}
            {selectedIds.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-white/40 mb-2">Your Team ({selectedIds.length}/3)</h3>
                <div className="flex gap-3">
                  {selectedIds.map((id) => (
                    <div key={id} className="relative bg-white/5 rounded-xl p-3 text-center">
                      <button
                        onClick={() => setSelectedIds(selectedIds.filter((i) => i !== id))}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center"
                      >
                        \u00d7
                      </button>
                      <img src={getPokemonImageUrl(id)} alt="" className="w-16 h-16 mx-auto" />
                      <p className="text-xs text-white/60 mt-1">#{id}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={startCustomBattle}
              disabled={selectedIds.length === 0}
              className="bg-[#dc2626] hover:bg-[#b91c1c] disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-xl transition-all"
            >
              Start Battle ({selectedIds.length}/3)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── LOADING PHASE ──────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-[#080810] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#dc2626] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60">{loadingMsg}</p>
        </div>
      </div>
    );
  }

  // ── SWITCHING PHASE ────────────────────────────────────────────────
  if (phase === "switching") {
    return (
      <div className="min-h-screen bg-[#080810] text-white pt-24 pb-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-2">Choose your next Pok\u00e9mon!</h2>
          <p className="text-white/40 mb-8">Your active Pok\u00e9mon fainted. Send out another!</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {playerTeam.map((p, i) => (
              <button
                key={i}
                onClick={() => switchPokemon(i)}
                disabled={p.currentHp <= 0 || i === activePlayer}
                className={`p-4 rounded-2xl border transition-all ${
                  p.currentHp <= 0
                    ? "border-red-500/20 bg-red-500/5 opacity-40 cursor-not-allowed"
                    : i === activePlayer
                    ? "border-white/20 bg-white/5 opacity-40 cursor-not-allowed"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 cursor-pointer"
                }`}
              >
                <img src={p.sprite} alt={p.name} className="w-20 h-20 mx-auto" />
                <p className="font-bold mt-2">{formatName(p.name)}</p>
                <div className="flex items-center gap-1 mt-1 justify-center">
                  {p.types.map((t) => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${TYPE_COLORS[t]}33`, color: TYPE_COLORS[t] }}>
                      {t}
                    </span>
                  ))}
                </div>
                <div className="mt-2">
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${(p.currentHp / p.maxHp) * 100}%`, background: hpColor(p.currentHp, p.maxHp) }}
                    />
                  </div>
                  <p className="text-xs text-white/40 mt-1">{p.currentHp}/{p.maxHp} HP</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── RESULT PHASE ───────────────────────────────────────────────────
  if (phase === "result") {
    return (
      <div className="min-h-screen bg-[#080810] text-white pt-24 pb-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-7xl mb-4">{winner === "player" ? "\ud83c\udfc6" : "\ud83d\udc80"}</div>
          <h1 className="text-4xl font-bold mb-2">
            {winner === "player" ? "Victory!" : "Defeat..."}
          </h1>
          <p className="text-white/50 mb-8">
            {winner === "player"
              ? "Your team emerged victorious!"
              : "Your team was defeated. Train harder and try again!"}
          </p>

          {/* Team summary */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <h3 className="text-sm font-medium text-white/40 mb-3">Your Team</h3>
              {playerTeam.map((p, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <img src={p.sprite} alt="" className="w-8 h-8" style={p.currentHp <= 0 ? { filter: "grayscale(1)", opacity: 0.4 } : {}} />
                  <span className={p.currentHp <= 0 ? "text-white/30 line-through" : ""}>{formatName(p.name)}</span>
                  <span className="text-xs text-white/30 ml-auto">{p.currentHp}/{p.maxHp}</span>
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-sm font-medium text-white/40 mb-3">Opponent</h3>
              {aiTeam.map((p, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <img src={p.sprite} alt="" className="w-8 h-8" style={p.currentHp <= 0 ? { filter: "grayscale(1)", opacity: 0.4 } : {}} />
                  <span className={p.currentHp <= 0 ? "text-white/30 line-through" : ""}>{formatName(p.name)}</span>
                  <span className="text-xs text-white/30 ml-auto">{p.currentHp}/{p.maxHp}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setPhase("select"); setWinner(null); setSelectedIds([]); setSearchResults([]); setSearchQuery(""); }}
              className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold py-3 px-8 rounded-xl transition-all"
            >
              Battle Again
            </button>
            <Link
              href="/dex"
              className="bg-white/10 hover:bg-white/15 text-white font-bold py-3 px-8 rounded-xl transition-all"
            >
              Back to Dex
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── BATTLE PHASE ───────────────────────────────────────────────────
  const player = playerTeam[activePlayer];
  const ai = aiTeam[activeAi];

  return (
    <div className="min-h-screen bg-[#080810] text-white pt-20 pb-4 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Battle Field */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Opponent side */}
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-lg">{formatName(ai.name)}</h3>
                <div className="flex gap-1 mt-0.5">
                  {ai.types.map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${TYPE_COLORS[t]}33`, color: TYPE_COLORS[t] }}>
                      {t}
                    </span>
                  ))}
                  {ai.status && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-400 uppercase">
                      {ai.status.slice(0, 3)}
                    </span>
                  )}
                </div>
              </div>
              {/* AI team indicators */}
              <div className="flex gap-1">
                {aiTeam.map((p, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full ${
                      p.currentHp <= 0 ? "bg-red-500/40" : i === activeAi ? "bg-green-400" : "bg-white/20"
                    }`}
                  />
                ))}
              </div>
            </div>
            {/* HP bar */}
            <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-1">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(ai.currentHp / ai.maxHp) * 100}%`, background: hpColor(ai.currentHp, ai.maxHp) }}
              />
            </div>
            <p className="text-xs text-white/40">{ai.currentHp}/{ai.maxHp} HP</p>
            <img src={ai.sprite} alt={ai.name} className="w-32 h-32 mx-auto mt-2 drop-shadow-lg" />
          </div>

          {/* Player side */}
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-lg">{formatName(player.name)}</h3>
                <div className="flex gap-1 mt-0.5">
                  {player.types.map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${TYPE_COLORS[t]}33`, color: TYPE_COLORS[t] }}>
                      {t}
                    </span>
                  ))}
                  {player.status && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-400 uppercase">
                      {player.status.slice(0, 3)}
                    </span>
                  )}
                </div>
              </div>
              {/* Player team indicators */}
              <div className="flex gap-1">
                {playerTeam.map((p, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full ${
                      p.currentHp <= 0 ? "bg-red-500/40" : i === activePlayer ? "bg-green-400" : "bg-white/20"
                    }`}
                  />
                ))}
              </div>
            </div>
            {/* HP bar */}
            <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-1">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(player.currentHp / player.maxHp) * 100}%`, background: hpColor(player.currentHp, player.maxHp) }}
              />
            </div>
            <p className="text-xs text-white/40">{player.currentHp}/{player.maxHp} HP</p>
            <img src={player.sprite} alt={player.name} className="w-32 h-32 mx-auto mt-2 drop-shadow-lg" />
          </div>
        </div>

        {/* Battle Log */}
        <div
          ref={logRef}
          className="bg-white/[0.02] border border-white/5 rounded-xl p-3 h-32 overflow-y-auto mb-4 font-mono text-sm"
        >
          {battleLog.map((msg, i) => (
            <p key={i} className={`${msg.startsWith("\u2500\u2500") ? "text-white/30 mt-1" : msg.includes("super effective") || msg.includes("critical") ? "text-yellow-400" : msg.includes("fainted") ? "text-red-400" : msg.includes("win") ? "text-green-400 font-bold" : "text-white/70"}`}>
              {msg}
            </p>
          ))}
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Moves */}
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
            <h3 className="text-xs font-medium text-white/30 mb-2 uppercase tracking-wider">Moves</h3>
            <div className="grid grid-cols-2 gap-2">
              {player.moves.map((m, i) => (
                <button
                  key={i}
                  onClick={() => executeTurn(i)}
                  disabled={isAnimating || m.pp <= 0 || !!winner}
                  className="p-3 rounded-xl text-left transition-all hover:scale-[1.02] disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    background: `${TYPE_COLORS[m.type] || "#666"}22`,
                    borderWidth: 1,
                    borderColor: `${TYPE_COLORS[m.type] || "#666"}44`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">{formatName(m.name)}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${TYPE_COLORS[m.type]}44`, color: TYPE_COLORS[m.type] }}>
                      {m.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-white/40">
                    {m.power && <span>Pwr {m.power}</span>}
                    {m.accuracy && <span>Acc {m.accuracy}</span>}
                    <span className="ml-auto">{m.pp}/{m.maxPp} PP</span>
                  </div>
                  <div className="text-[10px] text-white/25 mt-0.5 capitalize">{m.damageClass}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Team / Switch */}
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
            <h3 className="text-xs font-medium text-white/30 mb-2 uppercase tracking-wider">Team \u2014 click to switch</h3>
            <div className="space-y-2">
              {playerTeam.map((p, i) => (
                <button
                  key={i}
                  onClick={() => i !== activePlayer && p.currentHp > 0 && voluntarySwitch(i)}
                  disabled={i === activePlayer || p.currentHp <= 0 || isAnimating || !!winner}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                    i === activePlayer
                      ? "bg-white/10 ring-1 ring-white/20"
                      : p.currentHp <= 0
                      ? "bg-red-500/5 opacity-40 cursor-not-allowed"
                      : "bg-white/[0.03] hover:bg-white/[0.08] cursor-pointer"
                  }`}
                >
                  <img src={p.sprite} alt="" className="w-10 h-10" style={p.currentHp <= 0 ? { filter: "grayscale(1)" } : {}} />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{formatName(p.name)}</span>
                      {i === activePlayer && <span className="text-[10px] text-green-400">Active</span>}
                      {p.status && <span className="text-[10px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-400 uppercase">{p.status.slice(0,3)}</span>}
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(p.currentHp / p.maxHp) * 100}%`, background: hpColor(p.currentHp, p.maxHp) }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-white/30">{p.currentHp}/{p.maxHp}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => { setPhase("select"); setWinner(null); }}
              className="mt-3 w-full text-center text-xs text-white/30 hover:text-white/50 py-2 transition-all"
            >
              \ud83c\udff3\ufe0f Forfeit Battle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
