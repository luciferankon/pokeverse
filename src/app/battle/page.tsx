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

/* ================================================================
   CONSTANTS
   ================================================================ */

const TYPE_CLR: Record<string, string> = {
  normal:"#9DA0AA",fire:"#FF9741",water:"#3692DC",electric:"#FBD100",
  grass:"#38BF4B",ice:"#4CD1C0",fighting:"#E0306A",poison:"#B567CE",
  ground:"#E87236",flying:"#89AAE3",psychic:"#FF6568",bug:"#83C300",
  rock:"#C8B686",ghost:"#4C6AB2",dragon:"#006FC9",dark:"#5B5466",
  steel:"#5A8EA2",fairy:"#FB89EB",
};

const STATUS_CLR: Record<string, string> = {
  burn:"#FF6B35",paralyze:"#F7D02C",poison:"#A552CC",sleep:"#7C8A99",freeze:"#7DD3FC",
};

const DMG_CLASS_ICON: Record<string, string> = {
  physical: "ATK",
  special: "SpA",
  status: "STS",
};

/* ================================================================
   ITEMS SYSTEM
   ================================================================ */
interface BattleItem {
  id: string;
  name: string;
  desc: string;
  qty: number;
  icon: string;
  use: (target: BattlePokemon) => { healed: number; cured: boolean; revived: boolean; msg: string } | null;
}

function createBag(): BattleItem[] {
  return [
    {
      id: "potion", name: "Potion", desc: "Restores 20 HP to one Pokemon.",
      qty: 3, icon: String.fromCodePoint(0x1F48A),
      use: (t) => {
        if (t.currentHp <= 0 || t.currentHp >= t.maxHp) return null;
        const heal = Math.min(20, t.maxHp - t.currentHp);
        t.currentHp = Math.min(t.maxHp, t.currentHp + 20);
        return { healed: heal, cured: false, revived: false, msg: `${formatName(t.name)} recovered ${heal} HP!` };
      },
    },
    {
      id: "super-potion", name: "Super Potion", desc: "Restores 60 HP to one Pokemon.",
      qty: 2, icon: String.fromCodePoint(0x1F48A),
      use: (t) => {
        if (t.currentHp <= 0 || t.currentHp >= t.maxHp) return null;
        const heal = Math.min(60, t.maxHp - t.currentHp);
        t.currentHp = Math.min(t.maxHp, t.currentHp + 60);
        return { healed: heal, cured: false, revived: false, msg: `${formatName(t.name)} recovered ${heal} HP!` };
      },
    },
    {
      id: "hyper-potion", name: "Hyper Potion", desc: "Restores 120 HP to one Pokemon.",
      qty: 1, icon: String.fromCodePoint(0x1F48A),
      use: (t) => {
        if (t.currentHp <= 0 || t.currentHp >= t.maxHp) return null;
        const heal = Math.min(120, t.maxHp - t.currentHp);
        t.currentHp = Math.min(t.maxHp, t.currentHp + 120);
        return { healed: heal, cured: false, revived: false, msg: `${formatName(t.name)} recovered ${heal} HP!` };
      },
    },
    {
      id: "full-heal", name: "Full Heal", desc: "Cures all status conditions.",
      qty: 2, icon: String.fromCodePoint(0x2728),
      use: (t) => {
        if (t.currentHp <= 0 || !t.status) return null;
        const old = t.status;
        t.status = null; t.statusTurns = 0;
        return { healed: 0, cured: true, revived: false, msg: `${formatName(t.name)} was cured of ${old}!` };
      },
    },
    {
      id: "revive", name: "Revive", desc: "Revives a fainted Pokemon with 50% HP.",
      qty: 1, icon: String.fromCodePoint(0x1F31F),
      use: (t) => {
        if (t.currentHp > 0) return null;
        const hp = Math.floor(t.maxHp / 2);
        t.currentHp = hp;
        return { healed: hp, cured: false, revived: true, msg: `${formatName(t.name)} was revived!` };
      },
    },
  ];
}

/* ================================================================
   CSS ANIMATIONS
   ================================================================ */
const STYLE_ID = "pv-battle-css";
function injectCSS() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
    @keyframes pv-bob{0%,100%{transform:translateY(0) scaleX(-1)}50%{transform:translateY(-4px) scaleX(-1)}}
    @keyframes pv-bob-opp{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
    @keyframes pv-atk-r{0%{transform:translateX(0) scaleX(-1)}25%{transform:translateX(40px) scaleX(-1)}50%{transform:translateX(40px) scaleX(-1) scale(1.05)}100%{transform:translateX(0) scaleX(-1)}}
    @keyframes pv-atk-l{0%{transform:translateX(0)}25%{transform:translateX(-40px)}50%{transform:translateX(-40px) scale(1.05)}100%{transform:translateX(0)}}
    @keyframes pv-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
    @keyframes pv-shake-p{0%,100%{transform:translateX(0) scaleX(-1)}20%{transform:translateX(-6px) scaleX(-1)}40%{transform:translateX(6px) scaleX(-1)}60%{transform:translateX(-4px) scaleX(-1)}80%{transform:translateX(4px) scaleX(-1)}}
    @keyframes pv-faint{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(30px)}}
    @keyframes pv-faint-p{0%{opacity:1;transform:translateY(0) scaleX(-1)}100%{opacity:0;transform:translateY(30px) scaleX(-1)}}
    @keyframes pv-enter{0%{opacity:0;transform:scale(.4)}60%{transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
    @keyframes pv-enter-p{0%{opacity:0;transform:scale(.4) scaleX(-1)}60%{transform:scale(1.08) scaleX(-1)}100%{opacity:1;transform:scale(1) scaleX(-1)}}
    @keyframes pv-flash{0%,100%{opacity:1}50%{opacity:.25}}
    @keyframes pv-flash-p{0%,100%{opacity:1;transform:scaleX(-1)}50%{opacity:.25;transform:scaleX(-1)}}
    .pv-bob{animation:pv-bob 2s ease-in-out infinite}
    .pv-bob-opp{animation:pv-bob-opp 2s ease-in-out infinite}
    .pv-atk-r{animation:pv-atk-r .45s ease-in-out}
    .pv-atk-l{animation:pv-atk-l .45s ease-in-out}
    .pv-shake{animation:pv-shake .35s ease-in-out}
    .pv-shake-p{animation:pv-shake-p .35s ease-in-out}
    .pv-faint{animation:pv-faint .7s ease-in forwards}
    .pv-faint-p{animation:pv-faint-p .7s ease-in forwards}
    .pv-enter{animation:pv-enter .5s ease-out}
    .pv-enter-p{animation:pv-enter-p .5s ease-out}
    .pv-flash{animation:pv-flash .12s ease-in-out 3}
    .pv-flash-p{animation:pv-flash-p .12s ease-in-out 3}
  `;
  document.head.appendChild(el);
}

/* ================================================================
   TYPES & HELPERS
   ================================================================ */
type Phase = "menu" | "loading" | "battle" | "switch-forced" | "result";
type Anim = "idle" | "atk" | "hit" | "faint" | "enter" | "flash" | "none";
type BottomPanel = "fight" | "bag" | "team" | "inspect-team";

async function buildPokemon(id: number, isPlayer: boolean): Promise<BattlePokemon> {
  const d = await fetchPokemon(id);
  const pool = [...(d.moves || [])].sort(() => Math.random() - .5).slice(0, 12);
  const details: BattleMove[] = [];
  for (const e of pool) {
    try {
      const m = await fetchMove(e.move.name);
      details.push({
        name: m.name, type: m.type.name, damageClass: m.damage_class.name,
        power: m.power, accuracy: m.accuracy, pp: m.pp ?? 10, maxPp: m.pp ?? 10,
        priority: m.priority ?? 0,
      });
    } catch {}
  }
  const dmg = details.filter(m => m.power && m.power > 0).sort((a, b) => (b.power || 0) - (a.power || 0));
  const status = details.filter(m => !m.power || m.power === 0);
  let moves = dmg.length >= 4 ? dmg.slice(0, 4) : [...dmg, ...status].slice(0, 4);
  if (!moves.length) moves = [{ name: "Struggle", type: "normal", damageClass: "physical", power: 50, accuracy: null, pp: 99, maxPp: 99, priority: 0 }];
  const s = {
    hp: calcHp(d.stats[0].base_stat), attack: calcStat(d.stats[1].base_stat),
    defense: calcStat(d.stats[2].base_stat), spAtk: calcStat(d.stats[3].base_stat),
    spDef: calcStat(d.stats[4].base_stat), speed: calcStat(d.stats[5].base_stat),
  };
  return {
    id: d.id, name: d.name,
    types: d.types.map((t: { type: { name: string } }) => t.type.name),
    stats: s, currentHp: s.hp, maxHp: s.hp, moves, status: null, statusTurns: 0,
    sprite: getPokemonImageUrl(d.id), isPlayer,
  };
}

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

const hpColor = (pct: number) => pct > .5 ? "#4ADE80" : pct > .25 ? "#FACC15" : "#EF4444";
const hpPct = (cur: number, max: number) => Math.max(0, Math.min(100, (cur / max) * 100));

const animClassPlayer = (a: Anim) => {
  if (a === "idle") return "pv-bob";
  if (a === "atk") return "pv-atk-r";
  if (a === "hit") return "pv-shake-p";
  if (a === "faint") return "pv-faint-p";
  if (a === "enter") return "pv-enter-p";
  if (a === "flash") return "pv-flash-p";
  return "";
};

const animClassOpp = (a: Anim) => {
  if (a === "idle") return "pv-bob-opp";
  if (a === "atk") return "pv-atk-l";
  if (a === "hit") return "pv-shake";
  if (a === "faint") return "pv-faint";
  if (a === "enter") return "pv-enter";
  if (a === "flash") return "pv-flash";
  return "";
};

/* ================================================================
   COMPONENTS
   ================================================================ */

/* -- HP Bar -- */
function HPBar({ cur, max, showText }: { cur: number; max: number; showText?: boolean }) {
  const pct = hpPct(cur, max);
  const clr = hpColor(cur / max);
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold text-yellow-300/80 tracking-wider">HP</span>
        <div className="flex-1 h-[6px] bg-[#1a1a2e] rounded-full overflow-hidden border border-white/5">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, background: `linear-gradient(180deg, ${clr}, ${clr}cc)` }}
          />
        </div>
      </div>
      {showText && (
        <p className="text-right text-[11px] font-mono text-white/40 mt-0.5">
          {Math.max(0, cur)} / {max}
        </p>
      )}
    </div>
  );
}

/* -- Type Badge -- */
function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className="inline-block text-[9px] font-bold uppercase px-2 py-[2px] rounded tracking-wide"
      style={{ background: TYPE_CLR[type] || "#666", color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,.4)" }}
    >
      {type}
    </span>
  );
}

/* -- Status Badge -- */
function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const label = status.slice(0, 3).toUpperCase();
  return (
    <span
      className="inline-block text-[9px] font-bold uppercase px-2 py-[2px] rounded ml-1 tracking-wide"
      style={{ background: STATUS_CLR[status] || "#888", color: "#fff" }}
    >
      {label}
    </span>
  );
}

/* -- Nameplate -- */
function Nameplate({
  pokemon, displayHp, isPlayer, teamDots,
}: {
  pokemon: BattlePokemon; displayHp: number; isPlayer: boolean;
  teamDots: { alive: boolean; active: boolean }[];
}) {
  return (
    <div className={`
      relative px-4 py-2.5 rounded-xl
      bg-gradient-to-b from-[#1e293b] to-[#0f172a]
      border border-white/10 shadow-lg shadow-black/30
      ${isPlayer ? "min-w-[240px]" : "min-w-[220px]"}
    `}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-[15px] text-white tracking-wide">
          {formatName(pokemon.name)}
        </span>
        <span className="text-[10px] text-white/30 font-mono">Lv50</span>
      </div>

      <div className="flex items-center gap-1 mb-2">
        {pokemon.types.map(t => <TypeBadge key={t} type={t} />)}
        <StatusBadge status={pokemon.status} />
      </div>

      {/* Always show HP text on both sides */}
      <HPBar cur={displayHp} max={pokemon.maxHp} showText={true} />

      <div className={`flex gap-1 mt-1.5 ${isPlayer ? "justify-end" : "justify-start"}`}>
        {teamDots.map((d, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              d.active ? "bg-green-400 shadow-sm shadow-green-400/50"
              : d.alive ? "bg-white/25"
              : "bg-red-500/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/* -- Move Detail Tooltip -- */
function MoveTooltip({ move }: { move: BattleMove }) {
  const clr = TYPE_CLR[move.type] || "#666";
  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 p-3 rounded-xl shadow-xl pointer-events-none"
      style={{ background: "#1a1f2e", border: `1px solid ${clr}55` }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-sm text-white">{formatName(move.name)}</span>
        <TypeBadge type={move.type} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center mb-2">
        <div className="bg-white/5 rounded-md py-1">
          <p className="text-[8px] text-white/30 uppercase">Power</p>
          <p className="text-sm font-bold text-white/80">{move.power || "-"}</p>
        </div>
        <div className="bg-white/5 rounded-md py-1">
          <p className="text-[8px] text-white/30 uppercase">Accuracy</p>
          <p className="text-sm font-bold text-white/80">{move.accuracy || "-"}</p>
        </div>
        <div className="bg-white/5 rounded-md py-1">
          <p className="text-[8px] text-white/30 uppercase">Class</p>
          <p className="text-sm font-bold text-white/80">{DMG_CLASS_ICON[move.damageClass] || "?"}</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-white/30">PP: {move.pp}/{move.maxPp}</span>
        <span className="capitalize text-white/25">{move.damageClass}</span>
      </div>
      {/* Arrow */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px]" style={{ borderTopColor: "#1a1f2e" }} />
    </div>
  );
}

/* ================================================================
   MAIN PAGE COMPONENT
   ================================================================ */
export default function BattlePage() {

  /* --- state --- */
  const [phase, setPhase] = useState<Phase>("menu");
  const [diff, setDiff] = useState<Difficulty>("normal");
  const [pTeam, setPTeam] = useState<BattlePokemon[]>([]);
  const [aTeam, setATeam] = useState<BattlePokemon[]>([]);
  const [pIdx, setPIdx] = useState(0);
  const [aIdx, setAIdx] = useState(0);
  const [pAnim, setPAnim] = useState<Anim>("idle");
  const [aAnim, setAAnim] = useState<Anim>("idle");
  const [dpHp, setDpHp] = useState(0);
  const [daHp, setDaHp] = useState(0);
  const [msg, setMsg] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [winner, setWinner] = useState<"p" | "a" | null>(null);
  const [turn, setTurn] = useState(0);
  const [showLog, setShowLog] = useState(false);
  const [panel, setPanel] = useState<BottomPanel>("fight");
  const [hoveredMove, setHoveredMove] = useState<number | null>(null);
  const [bag, setBag] = useState<BattleItem[]>([]);
  const [bagTarget, setBagTarget] = useState<{ itemIdx: number } | null>(null);
  const [inspectIdx, setInspectIdx] = useState<number | null>(null);

  /* menu state */
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: number; name: string }[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");

  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => { injectCSS(); }, []);
  useEffect(() => { if (pTeam[pIdx]) setDpHp(pTeam[pIdx].currentHp); }, [pTeam, pIdx]);
  useEffect(() => { if (aTeam[aIdx]) setDaHp(aTeam[aIdx].currentHp); }, [aTeam, aIdx]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  /* --- helpers --- */
  const drainHp = (setter: (v: number) => void, from: number, to: number) =>
    new Promise<void>(res => {
      const steps = 20; const d = from - to; let s = 0;
      const iv = setInterval(() => { s++; setter(Math.round(from - d * s / steps)); if (s >= steps) { clearInterval(iv); setter(to); res(); } }, 30);
    });

  const say = (m: string) => new Promise<void>(res => {
    setMsg(m);
    setLog(p => [...p, m]);
    setTimeout(res, Math.max(700, m.length * 25 + 300));
  });

  /* --- search --- */
  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const n = parseInt(q);
      if (!isNaN(n) && n >= 1 && n <= 1025) {
        const p = await fetchPokemon(n);
        setResults([{ id: p.id, name: p.name }]);
      } else {
        try {
          const p = await fetchPokemon(q.toLowerCase().trim());
          setResults([{ id: p.id, name: p.name }]);
        } catch {
          const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=1025");
          const data = await res.json();
          setResults(
            data.results
              .filter((r: { name: string }) => r.name.includes(q.toLowerCase().trim()))
              .slice(0, 8)
              .map((r: { name: string; url: string }) => ({
                name: r.name,
                id: parseInt(r.url.split("/").filter(Boolean).pop() || "0"),
              }))
          );
        }
      }
    } catch { setResults([]); }
    setSearching(false);
  }, []);

  /* --- start --- */
  const startBattle = async (playerIds: number[], aiIds: number[]) => {
    setPhase("loading");
    setLoadMsg("Preparing battle...");
    try {
      setLoadMsg("Loading your team...");
      const pt = await Promise.all(playerIds.map(id => buildPokemon(id, true)));
      setLoadMsg("Loading opponent...");
      const at = await Promise.all(aiIds.map(id => buildPokemon(id, false)));
      setPTeam(pt); setATeam(at);
      setPIdx(0); setAIdx(0);
      setDpHp(pt[0].maxHp); setDaHp(at[0].maxHp);
      setTurn(1); setWinner(null); setLog([]); setShowLog(false);
      setPanel("fight"); setBag(createBag()); setBagTarget(null); setInspectIdx(null);
      setPhase("battle");

      await wait(300);
      setPAnim("enter");
      await say(`Go, ${formatName(pt[0].name)}!`);
      setPAnim("idle");
      setAAnim("enter");
      await say(`Opponent sent out ${formatName(at[0].name)}!`);
      setAAnim("idle");
      await wait(150);
      setMsg("What will you do?");
    } catch {
      setLoadMsg("Error loading. Retrying...");
      setTimeout(() => setPhase("menu"), 2000);
    }
  };

  const quickBattle = () => {
    const used = new Set<number>();
    const r = () => { let id; do { id = Math.floor(Math.random() * 898) + 1; } while (used.has(id)); used.add(id); return id; };
    startBattle([r(), r(), r()], [r(), r(), r()]);
  };

  const customBattle = () => {
    if (!picked.length) return;
    const used = new Set(picked);
    const r = () => { let id; do { id = Math.floor(Math.random() * 898) + 1; } while (used.has(id)); used.add(id); return id; };
    startBattle(picked, Array.from({ length: picked.length }, r));
  };

  /* --- AI takes a free turn (after switch or item) --- */
  const aiFreeTurn = async (targetIdx: number) => {
    const ai = { ...aTeam[aIdx] };
    const target = { ...pTeam[targetIdx] };
    const aMove = aiSelectMove(ai, target, diff);
    const ar = ai.moves.find(m => m.name === aMove.name);
    if (ar) ar.pp = Math.max(0, ar.pp - 1);

    const sc = checkStatusBlock(ai);
    if (sc.cured) { ai.status = null; ai.statusTurns = 0; await say(sc.message); }
    if (!sc.blocked) {
      await say(`${formatName(ai.name)} used ${formatName(aMove.name)}!`);
      setAAnim("atk"); await wait(250);
      if (checkAccuracy(aMove)) {
        const res = calculateDamage(ai, target, aMove);
        setPAnim("hit"); setAAnim("idle"); await wait(350);
        if (res.message) await say(res.message);
        if (res.damage > 0) {
          const old = target.currentHp;
          target.currentHp = Math.max(0, target.currentHp - res.damage);
          await drainHp(setDpHp, old, target.currentHp);
          setPAnim(target.currentHp <= 0 ? "faint" : "idle");
          await say(`${formatName(target.name)} lost ${Math.round(res.damage / target.maxHp * 100)}% HP!`);
          if (target.currentHp <= 0) await say(`${formatName(target.name)} fainted!`);
        } else { setPAnim("idle"); }
      } else { setAAnim("idle"); await say("But it missed!"); }
    } else if (!sc.cured) { setAAnim("flash"); await say(sc.message); setAAnim("idle"); }

    // Apply status damage to AI
    if (ai.currentHp > 0) {
      const sd = applyStatusDamage(ai);
      if (sd) {
        const old = ai.currentHp;
        ai.currentHp = Math.max(0, ai.currentHp - sd.damage);
        setAAnim("flash"); await drainHp(setDaHp, old, ai.currentHp); setAAnim(ai.currentHp <= 0 ? "faint" : "idle");
        await say(sd.message);
        if (ai.currentHp <= 0) await say(`${formatName(ai.name)} fainted!`);
      }
    }

    const npt = [...pTeam]; npt[targetIdx] = target;
    const nat = [...aTeam]; nat[aIdx] = ai;
    setPTeam(npt); setATeam(nat); setTurn(t2 => t2 + 1);

    // Check AI fainted
    if (ai.currentHp <= 0) {
      const next = nat.findIndex((p, i) => i !== aIdx && p.currentHp > 0);
      if (next === -1) { setWinner("p"); await say("You won the battle!"); setPhase("result"); return false; }
      await wait(300); setAIdx(next); setDaHp(nat[next].currentHp);
      setAAnim("enter"); await say(`Opponent sent out ${formatName(nat[next].name)}!`); setAAnim("idle");
    }

    if (target.currentHp <= 0) {
      const next = npt.findIndex((p, i) => i !== targetIdx && p.currentHp > 0);
      if (next === -1) { setWinner("a"); await say("You lost the battle..."); setPhase("result"); return false; }
      setPhase("switch-forced"); return false;
    }
    return true;
  };

  /* --- use item --- */
  const useItem = async (itemIdx: number, targetIdx: number) => {
    if (busy || winner) return;
    setBusy(true);
    setPanel("fight");
    setBagTarget(null);

    const item = bag[itemIdx];
    const target = { ...pTeam[targetIdx] };
    const result = item.use(target);
    if (!result) { setBusy(false); return; }

    // Deduct item
    const nb = [...bag]; nb[itemIdx] = { ...nb[itemIdx], qty: nb[itemIdx].qty - 1 }; setBag(nb);

    // Apply to team
    const npt = [...pTeam]; npt[targetIdx] = target; setPTeam(npt);
    if (targetIdx === pIdx) {
      if (result.revived) { setPAnim("enter"); }
      else { setPAnim("flash"); }
      await drainHp(setDpHp, dpHp, target.currentHp);
    }
    await say(`Used ${item.name}! ${result.msg}`);
    if (targetIdx === pIdx) setPAnim("idle");

    // AI gets a free turn
    const cont = await aiFreeTurn(targetIdx === pIdx ? targetIdx : pIdx);
    if (!cont) { setBusy(false); return; }

    setMsg("What will you do?");
    setBusy(false);
  };

  /* --- execute turn --- */
  const doTurn = async (moveIdx: number) => {
    if (busy || winner) return;
    setBusy(true);
    setPanel("fight");

    const player = { ...pTeam[pIdx] };
    const ai = { ...aTeam[aIdx] };
    const pMove = player.moves[moveIdx];
    const aMove = aiSelectMove(ai, player, diff);
    pMove.pp = Math.max(0, pMove.pp - 1);
    const ar = ai.moves.find(m => m.name === aMove.name);
    if (ar) ar.pp = Math.max(0, ar.pp - 1);

    let playerFirst = true;
    if (pMove.priority !== aMove.priority) playerFirst = pMove.priority > aMove.priority;
    else {
      const ps = getEffectiveSpeed(player), as2 = getEffectiveSpeed(ai);
      playerFirst = ps > as2 ? true : ps < as2 ? false : Math.random() > .5;
    }

    const turns = playerFirst
      ? [{ atk: player, def: ai, mv: pMove, isP: true }, { atk: ai, def: player, mv: aMove, isP: false }]
      : [{ atk: ai, def: player, mv: aMove, isP: false }, { atk: player, def: ai, mv: pMove, isP: true }];

    for (const t of turns) {
      if (t.atk.currentHp <= 0) continue;

      const sc = checkStatusBlock(t.atk);
      if (sc.cured) { t.atk.status = null; t.atk.statusTurns = 0; await say(sc.message); }
      if (sc.blocked) {
        if (!sc.cured) { (t.isP ? setPAnim : setAAnim)(t.isP ? "flash" : "flash"); await say(sc.message); (t.isP ? setPAnim : setAAnim)("idle"); }
        if (t.atk.status === "sleep") t.atk.statusTurns--;
        continue;
      }

      await say(`${formatName(t.atk.name)} used ${formatName(t.mv.name)}!`);
      (t.isP ? setPAnim : setAAnim)("atk");
      await wait(250);

      if (!checkAccuracy(t.mv)) {
        (t.isP ? setPAnim : setAAnim)("idle");
        await say("But it missed!");
        continue;
      }

      const res = calculateDamage(t.atk, t.def, t.mv);
      await wait(150);
      (t.isP ? setAAnim : setPAnim)("hit");
      (t.isP ? setPAnim : setAAnim)("idle");
      await wait(350);

      if (res.message) await say(res.message);

      if (res.damage > 0) {
        const old = t.def.currentHp;
        t.def.currentHp = Math.max(0, t.def.currentHp - res.damage);
        if (t.isP) { await drainHp(setDaHp, old, t.def.currentHp); setAAnim(t.def.currentHp <= 0 ? "faint" : "idle"); }
        else { await drainHp(setDpHp, old, t.def.currentHp); setPAnim(t.def.currentHp <= 0 ? "faint" : "idle"); }

        const pctDmg = Math.round((res.damage / t.def.maxHp) * 100);
        await say(`${formatName(t.def.name)} lost ${pctDmg}% HP!`);
        if (t.def.currentHp <= 0) { await wait(500); await say(`${formatName(t.def.name)} fainted!`); }
      } else {
        (t.isP ? setAAnim : setPAnim)("idle");
      }
    }

    // end-of-turn status
    for (const pk of [player, ai]) {
      if (pk.currentHp > 0) {
        const sd = applyStatusDamage(pk);
        if (sd) {
          const old = pk.currentHp;
          pk.currentHp = Math.max(0, pk.currentHp - sd.damage);
          if (pk.isPlayer) { setPAnim("flash"); await drainHp(setDpHp, old, pk.currentHp); setPAnim(pk.currentHp <= 0 ? "faint" : "idle"); }
          else { setAAnim("flash"); await drainHp(setDaHp, old, pk.currentHp); setAAnim(pk.currentHp <= 0 ? "faint" : "idle"); }
          await say(sd.message);
          if (pk.currentHp <= 0) await say(`${formatName(pk.name)} fainted!`);
        }
      }
    }

    // commit
    const npt = [...pTeam]; npt[pIdx] = player;
    const nat = [...aTeam]; nat[aIdx] = ai;
    setPTeam(npt); setATeam(nat); setTurn(t2 => t2 + 1);

    // faint checks
    if (ai.currentHp <= 0) {
      const next = nat.findIndex((p, i) => i !== aIdx && p.currentHp > 0);
      if (next === -1) { setWinner("p"); await say("You won the battle!"); setPhase("result"); setBusy(false); return; }
      await wait(300); setAIdx(next); setDaHp(nat[next].currentHp);
      setAAnim("enter"); await say(`Opponent sent out ${formatName(nat[next].name)}!`); setAAnim("idle");
    }

    if (player.currentHp <= 0) {
      const next = npt.findIndex((p, i) => i !== pIdx && p.currentHp > 0);
      if (next === -1) { setWinner("a"); await say("You lost the battle..."); setPhase("result"); setBusy(false); return; }
      setPhase("switch-forced"); setBusy(false); return;
    }

    setMsg("What will you do?");
    setBusy(false);
  };

  /* --- switching --- */
  const doSwitch = async (idx: number, forced: boolean) => {
    if (idx === pIdx || pTeam[idx].currentHp <= 0 || (busy && !forced)) return;
    if (!forced) setBusy(true);
    setPanel("fight");

    if (!forced) {
      setPAnim("faint");
      await say(`Come back, ${formatName(pTeam[pIdx].name)}!`);
    }

    setPIdx(idx); setDpHp(pTeam[idx].currentHp);
    setPAnim("enter");
    if (forced) setPhase("battle");
    await say(`Go, ${formatName(pTeam[idx].name)}!`);
    setPAnim("idle");

    // if voluntary switch, AI gets free turn
    if (!forced) {
      const cont = await aiFreeTurn(idx);
      if (!cont) { setBusy(false); return; }
    }

    setMsg("What will you do?");
    setBusy(false);
  };

  /* ================================================================
     RENDER: MENU / TEAM SELECT
     ================================================================ */
  if (phase === "menu") {
    return (
      <div className="min-h-screen bg-[#0a0a1a] text-white pt-24 pb-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-extrabold mb-2">
              <span className="bg-gradient-to-r from-red-500 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
                Battle Simulator
              </span>
            </h1>
            <p className="text-white/30 text-sm">Gen V damage formulas | 18-type chart | 3v3 teams | AI difficulty</p>
          </div>

          <div className="flex justify-center gap-2 mb-8">
            {(["easy", "normal", "hard"] as Difficulty[]).map(d => (
              <button
                key={d}
                onClick={() => setDiff(d)}
                className={`px-5 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
                  diff === d
                    ? "bg-white/10 text-white ring-1 ring-white/20"
                    : "text-white/30 hover:text-white/50"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <button
            onClick={quickBattle}
            className="w-full mb-4 py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 transition-all shadow-lg shadow-red-900/30 active:scale-[.98]"
          >
            Quick Battle - Random 3v3
          </button>

          <div className="bg-white/[.03] border border-white/5 rounded-xl p-5">
            <h2 className="font-bold text-sm text-white/50 uppercase tracking-wider mb-3">Custom Team</h2>
            <div className="flex gap-2 mb-3">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && search(query)}
                placeholder="Search by name or ID..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-white/25"
              />
              <button
                onClick={() => search(query)}
                disabled={searching}
                className="bg-white/10 hover:bg-white/15 px-5 py-2 rounded-lg text-sm font-medium"
              >
                {searching ? "..." : "Search"}
              </button>
            </div>

            {results.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {results.map(r => (
                  <button
                    key={r.id}
                    onClick={() => { if (picked.length < 3 && !picked.includes(r.id)) setPicked([...picked, r.id]); }}
                    disabled={picked.includes(r.id) || picked.length >= 3}
                    className={`flex items-center gap-2 p-2 rounded-lg text-sm transition-all ${
                      picked.includes(r.id)
                        ? "bg-green-500/15 text-green-400"
                        : "bg-white/5 hover:bg-white/10 text-white/60"
                    }`}
                  >
                    <img src={getPokemonImageUrl(r.id)} alt="" className="w-8 h-8" />
                    <span className="capitalize truncate">{formatName(r.name)}</span>
                  </button>
                ))}
              </div>
            )}

            {picked.length > 0 && (
              <div className="flex gap-3 mb-4">
                {picked.map(id => (
                  <div key={id} className="relative bg-white/5 rounded-lg p-2 text-center group">
                    <button
                      onClick={() => setPicked(picked.filter(i => i !== id))}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center opacity-60 group-hover:opacity-100"
                    >
                      x
                    </button>
                    <img src={getPokemonImageUrl(id)} alt="" className="w-14 h-14 mx-auto" />
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={customBattle}
              disabled={!picked.length}
              className="w-full py-3 rounded-lg font-bold bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              Start Custom Battle ({picked.length}/3)
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================
     RENDER: LOADING
     ================================================================ */
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a1a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-white/10 border-t-red-500 animate-spin" />
          <p className="text-white/40 animate-pulse">{loadMsg}</p>
        </div>
      </div>
    );
  }

  /* ================================================================
     RENDER: FORCED SWITCH
     ================================================================ */
  if (phase === "switch-forced") {
    return (
      <div className="min-h-screen bg-[#0a0a1a] text-white pt-24 pb-12 px-4">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-1">Send out your next Pokemon!</h2>
          <p className="text-white/30 text-sm mb-8">Your active Pokemon fainted.</p>
          <div className="grid grid-cols-3 gap-4">
            {pTeam.map((p, i) => (
              <button
                key={i}
                onClick={() => doSwitch(i, true)}
                disabled={p.currentHp <= 0 || i === pIdx}
                className={`p-4 rounded-xl border transition-all ${
                  p.currentHp <= 0 ? "border-red-500/10 opacity-20 cursor-not-allowed"
                  : i === pIdx ? "border-white/10 opacity-20 cursor-not-allowed"
                  : "border-white/10 hover:border-white/25 hover:bg-white/5 cursor-pointer"
                }`}
              >
                <img
                  src={p.sprite} alt={p.name}
                  className="w-20 h-20 mx-auto"
                  style={p.currentHp <= 0 ? { filter: "grayscale(1)", opacity: .3 } : {}}
                />
                <p className="font-bold text-sm mt-2">{formatName(p.name)}</p>
                <HPBar cur={p.currentHp} max={p.maxHp} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================
     RENDER: RESULT
     ================================================================ */
  if (phase === "result") {
    return (
      <div className="min-h-screen bg-[#0a0a1a] text-white pt-24 pb-12 px-4">
        <div className="max-w-lg mx-auto text-center">
          <div className="text-6xl mb-4">{winner === "p" ? String.fromCodePoint(0x1F3C6) : String.fromCodePoint(0x1F614)}</div>
          <h1 className="text-4xl font-extrabold mb-2">
            {winner === "p" ? "Victory!" : "Defeat"}
          </h1>
          <p className="text-white/30 mb-8">
            {winner === "p" ? "Your team emerged victorious!" : "Better luck next time."}
          </p>

          <div className="grid grid-cols-2 gap-6 mb-8 text-left">
            {[{ label: "Your Team", team: pTeam }, { label: "Opponent", team: aTeam }].map(({ label, team }) => (
              <div key={label}>
                <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">{label}</p>
                {team.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1.5">
                    <img src={p.sprite} alt="" className="w-7 h-7" style={p.currentHp <= 0 ? { filter: "grayscale(1)", opacity: .3 } : {}} />
                    <span className={`text-sm ${p.currentHp <= 0 ? "text-white/20 line-through" : ""}`}>{formatName(p.name)}</span>
                    <span className="text-[10px] text-white/20 ml-auto font-mono">{Math.max(0, p.currentHp)}/{p.maxHp}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setPhase("menu"); setWinner(null); setPicked([]); setResults([]); setQuery(""); }}
              className="py-3 px-8 rounded-xl font-bold bg-gradient-to-r from-red-600 to-orange-500 shadow-lg shadow-red-900/30"
            >
              Battle Again
            </button>
            <Link href="/dex" className="py-3 px-8 rounded-xl font-bold bg-white/10 hover:bg-white/15">
              Back to Dex
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================
     RENDER: BATTLE SCREEN
     ================================================================ */
  const player = pTeam[pIdx];
  const ai = aTeam[aIdx];
  if (!player || !ai) return null;

  const pDots = pTeam.map((p, i) => ({ alive: p.currentHp > 0, active: i === pIdx }));
  const aDots = aTeam.map((p, i) => ({ alive: p.currentHp > 0, active: i === aIdx }));

  return (
    <div className="h-screen bg-[#0a0a1a] text-white flex flex-col overflow-hidden">

      {/* === BATTLEFIELD - compact height === */}
      <div className="relative overflow-hidden" style={{ height: "46vh", minHeight: 280, maxHeight: 420 }}>

        {/* Sky + ground gradient */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(180deg, #0f1729 0%, #162033 30%, #1a3a25 50%, #254a1d 75%, #1e3a18 100%)",
        }} />

        {/* Subtle ground texture */}
        <div className="absolute bottom-0 left-0 right-0 h-[55%] opacity-15" style={{
          background: "repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,.03) 2px, rgba(255,255,255,.03) 4px)",
        }} />

        {/* --- Opponent (top-right) --- */}
        <div className="absolute top-4 right-4 z-10">
          <Nameplate pokemon={ai} displayHp={daHp} isPlayer={false} teamDots={aDots} />
        </div>
        <div className="absolute z-[5]" style={{ top: "12%", right: "8%" }}>
          <img
            src={ai.sprite} alt={ai.name}
            className={`w-48 h-48 drop-shadow-[0_8px_24px_rgba(0,0,0,.5)] ${animClassOpp(aAnim)}`}
            style={aAnim === "faint" ? { filter: "grayscale(.7)" } : {}}
          />
          <div className="mx-auto mt-[-6px] w-24 h-4 rounded-[50%] bg-black/25 blur-[4px]" />
        </div>

        {/* --- Player (bottom-left) - sprite faces RIGHT (toward opponent) --- */}
        <div className="absolute bottom-4 left-4 z-10">
          <Nameplate pokemon={player} displayHp={dpHp} isPlayer={true} teamDots={pDots} />
        </div>
        <div className="absolute z-[5]" style={{ bottom: "8%", left: "5%" }}>
          <img
            src={player.sprite} alt={player.name}
            className={`w-56 h-56 drop-shadow-[0_8px_24px_rgba(0,0,0,.5)] ${animClassPlayer(pAnim)}`}
            style={{
              ...(pAnim === "faint" ? { filter: "grayscale(.7)" } : {}),
              ...(pAnim === "idle" ? {} : {}),
            }}
          />
          <div className="mx-auto mt-[-6px] w-28 h-4 rounded-[50%] bg-black/25 blur-[4px]" />
        </div>

        {/* Turn counter */}
        <div className="absolute top-3 left-3 text-xs text-white/25 font-mono z-10 bg-black/20 px-2 py-0.5 rounded">
          Turn {turn}
        </div>
      </div>

      {/* === BOTTOM: Controls === */}
      <div className="flex-1 bg-[#0f1219] border-t border-white/5 flex flex-col min-h-0">

        {/* Message box */}
        <div className="border-b border-white/5 px-5 py-3 min-h-[48px] flex items-center justify-between flex-shrink-0">
          <p className="text-[15px] text-white/80 font-medium flex-1">{msg}</p>
          <button
            onClick={() => setShowLog(!showLog)}
            className="text-[10px] text-white/20 hover:text-white/40 ml-3 flex-shrink-0"
          >
            {showLog ? "Hide" : "Log"}
          </button>
        </div>

        {/* Battle log */}
        {showLog && (
          <div ref={logRef} className="max-h-24 overflow-y-auto px-5 py-2 border-b border-white/5 space-y-0.5 flex-shrink-0">
            {log.map((m, i) => (
              <p key={i} className={`text-[11px] ${
                m.includes("super effective") || m.includes("critical") ? "text-yellow-400"
                : m.includes("fainted") ? "text-red-400"
                : m.includes("won") ? "text-green-400"
                : "text-white/25"
              }`}>
                {m}
              </p>
            ))}
          </div>
        )}

        {/* Action tabs: Fight / Bag / Team */}
        <div className="flex border-b border-white/5 flex-shrink-0">
          {(["fight", "bag", "team"] as BottomPanel[]).map(tab => (
            <button
              key={tab}
              onClick={() => { setPanel(tab); setBagTarget(null); setInspectIdx(null); }}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                panel === tab
                  ? "text-white border-b-2 border-red-500 bg-white/[.03]"
                  : "text-white/25 hover:text-white/40"
              }`}
            >
              {tab === "fight" ? "Fight" : tab === "bag" ? (String.fromCodePoint(0x1F392) + " Bag") : (String.fromCodePoint(0x1F465) + " Party")}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto p-3">

          {/* === FIGHT PANEL === */}
          {panel === "fight" && (
            <>
              {!busy && !winner ? (
                <div className="grid grid-cols-2 gap-2">
                  {player.moves.map((m, i) => {
                    const clr = TYPE_CLR[m.type] || "#666";
                    return (
                      <div key={i} className="relative">
                        {hoveredMove === i && <MoveTooltip move={m} />}
                        <button
                          onClick={() => doTurn(i)}
                          onMouseEnter={() => setHoveredMove(i)}
                          onMouseLeave={() => setHoveredMove(null)}
                          disabled={m.pp <= 0}
                          className="w-full relative p-3 rounded-lg text-left transition-all hover:brightness-125 active:scale-[.97] disabled:opacity-20 disabled:cursor-not-allowed overflow-hidden"
                          style={{ background: `${clr}18`, border: `1px solid ${clr}33` }}
                        >
                          <div className="absolute top-0 left-0 w-1 h-full rounded-l" style={{ background: clr }} />
                          <div className="flex items-center justify-between mb-1 pl-2">
                            <span className="font-bold text-sm text-white/90">{formatName(m.name)}</span>
                            <TypeBadge type={m.type} />
                          </div>
                          <div className="flex items-center gap-3 pl-2 text-[10px] text-white/30 font-mono">
                            {m.power && <span>PWR {m.power}</span>}
                            {m.accuracy && <span>ACC {m.accuracy}</span>}
                            <span className="ml-auto">{m.pp}/{m.maxPp}</span>
                            <span className="uppercase text-white/15">{m.damageClass.slice(0, 4)}</span>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-white/15 text-sm py-6">
                  {winner ? "Battle over" : "Waiting..."}
                </div>
              )}
            </>
          )}

          {/* === BAG PANEL === */}
          {panel === "bag" && (
            <>
              {bagTarget ? (
                /* Target selection for item */
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => setBagTarget(null)} className="text-xs text-white/30 hover:text-white/50">
                      {String.fromCodePoint(0x2190)} Back
                    </button>
                    <span className="text-sm text-white/60">Use {bag[bagTarget.itemIdx].name} on which Pokemon?</span>
                  </div>
                  <div className="space-y-1.5">
                    {pTeam.map((p, i) => {
                      const item = bag[bagTarget.itemIdx];
                      const canUse = item.id === "revive" ? p.currentHp <= 0 : (p.currentHp > 0 && (item.id === "full-heal" ? !!p.status : p.currentHp < p.maxHp));
                      return (
                        <button
                          key={i}
                          onClick={() => canUse && useItem(bagTarget.itemIdx, i)}
                          disabled={!canUse || busy}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all ${
                            canUse ? "bg-white/5 hover:bg-white/10 cursor-pointer" : "opacity-25 cursor-not-allowed"
                          }`}
                        >
                          <img src={p.sprite} alt="" className="w-10 h-10" style={p.currentHp <= 0 ? { filter: "grayscale(1)" } : {}} />
                          <div className="flex-1 text-left">
                            <p className="font-bold text-sm">{formatName(p.name)}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {p.types.map(t => <TypeBadge key={t} type={t} />)}
                              <StatusBadge status={p.status} />
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-mono text-white/40">{Math.max(0, p.currentHp)}/{p.maxHp}</p>
                            <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                              <div className="h-full rounded-full" style={{ width: `${hpPct(p.currentHp, p.maxHp)}%`, background: hpColor(p.currentHp / p.maxHp) }} />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Item list */
                <div className="space-y-1.5">
                  {bag.map((item, i) => (
                    <button
                      key={item.id}
                      onClick={() => item.qty > 0 && !busy && !winner && setBagTarget({ itemIdx: i })}
                      disabled={item.qty <= 0 || busy || !!winner}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                        item.qty > 0 && !busy ? "bg-white/[.04] hover:bg-white/[.08] cursor-pointer" : "opacity-20 cursor-not-allowed"
                      }`}
                    >
                      <span className="text-xl">{item.icon}</span>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-white/90">{item.name}</p>
                        <p className="text-[11px] text-white/30">{item.desc}</p>
                      </div>
                      <span className="text-sm font-mono text-white/40">x{item.qty}</span>
                    </button>
                  ))}
                  {bag.every(b => b.qty <= 0) && (
                    <p className="text-center text-sm text-white/20 py-4">Bag is empty!</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* === TEAM/PARTY PANEL === */}
          {panel === "team" && (
            <>
              {inspectIdx !== null ? (
                /* Inspect a specific team member */
                <div>
                  <button onClick={() => setInspectIdx(null)} className="text-xs text-white/30 hover:text-white/50 mb-3">
                    {String.fromCodePoint(0x2190)} Back to party
                  </button>
                  {(() => {
                    const p = pTeam[inspectIdx];
                    if (!p) return null;
                    return (
                      <div className="bg-white/[.03] rounded-xl p-4 border border-white/5">
                        <div className="flex items-center gap-4 mb-4">
                          <img src={p.sprite} alt="" className="w-16 h-16" style={p.currentHp <= 0 ? { filter: "grayscale(1)", opacity: .4 } : {}} />
                          <div className="flex-1">
                            <p className="font-bold text-lg">{formatName(p.name)}</p>
                            <div className="flex items-center gap-1 mt-1">
                              {p.types.map(t => <TypeBadge key={t} type={t} />)}
                              <StatusBadge status={p.status} />
                            </div>
                            <p className="text-xs font-mono text-white/30 mt-1">{Math.max(0, p.currentHp)} / {p.maxHp} HP</p>
                          </div>
                        </div>

                        {/* Stats */}
                        <p className="text-[9px] text-white/20 uppercase tracking-wider mb-1.5 font-bold">Stats</p>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          {(["attack", "defense", "spAtk", "spDef", "speed"] as const).map(stat => (
                            <div key={stat} className="bg-white/5 rounded-md px-2 py-1.5 text-center">
                              <p className="text-[8px] text-white/25 uppercase">{stat === "spAtk" ? "Sp.Atk" : stat === "spDef" ? "Sp.Def" : stat.charAt(0).toUpperCase() + stat.slice(1)}</p>
                              <p className="text-sm font-bold text-white/70">{p.stats[stat]}</p>
                            </div>
                          ))}
                        </div>

                        {/* Moves */}
                        <p className="text-[9px] text-white/20 uppercase tracking-wider mb-1.5 font-bold">Moves</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {p.moves.map((m, mi) => {
                            const clr = TYPE_CLR[m.type] || "#666";
                            return (
                              <div key={mi} className="p-2 rounded-lg" style={{ background: `${clr}15`, border: `1px solid ${clr}25` }}>
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-xs font-bold text-white/80">{formatName(m.name)}</span>
                                  <TypeBadge type={m.type} />
                                </div>
                                <div className="flex gap-2 text-[9px] text-white/25 font-mono">
                                  {m.power && <span>PWR {m.power}</span>}
                                  {m.accuracy && <span>ACC {m.accuracy}</span>}
                                  <span className="ml-auto">{m.pp}/{m.maxPp}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Switch button */}
                        {inspectIdx !== pIdx && p.currentHp > 0 && !busy && !winner && (
                          <button
                            onClick={() => { setInspectIdx(null); doSwitch(inspectIdx, false); }}
                            className="mt-3 w-full py-2 rounded-lg font-bold text-sm bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 transition-all"
                          >
                            Switch to {formatName(p.name)}
                          </button>
                        )}
                        {inspectIdx === pIdx && (
                          <p className="mt-3 text-center text-xs text-green-400/60">Currently active</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* Party list */
                <div className="space-y-1.5">
                  {pTeam.map((p, i) => (
                    <div key={i} className="flex gap-1.5">
                      {/* Main party row - clickable to inspect */}
                      <button
                        onClick={() => setInspectIdx(i)}
                        className={`flex-1 flex items-center gap-3 p-2.5 rounded-lg transition-all text-left ${
                          i === pIdx ? "bg-white/[.06] ring-1 ring-white/10"
                          : p.currentHp <= 0 ? "opacity-25"
                          : "bg-white/[.03] hover:bg-white/[.06]"
                        }`}
                      >
                        <img src={p.sprite} alt="" className="w-10 h-10" style={p.currentHp <= 0 ? { filter: "grayscale(1)" } : {}} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold truncate">{formatName(p.name)}</span>
                            {i === pIdx && <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {p.types.map(t => <TypeBadge key={t} type={t} />)}
                            <StatusBadge status={p.status} />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[10px] font-mono text-white/30">{Math.max(0, p.currentHp)}/{p.maxHp}</p>
                          <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                            <div className="h-full rounded-full" style={{ width: `${hpPct(p.currentHp, p.maxHp)}%`, background: hpColor(p.currentHp / p.maxHp) }} />
                          </div>
                        </div>
                      </button>
                      {/* Quick switch button */}
                      {i !== pIdx && p.currentHp > 0 && !busy && !winner && (
                        <button
                          onClick={() => doSwitch(i, false)}
                          className="px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-[10px] font-bold uppercase transition-all"
                          title={`Switch to ${formatName(p.name)}`}
                        >
                          Switch
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => { setPhase("menu"); setWinner(null); }}
                    className="mt-3 w-full text-center text-[10px] text-white/15 hover:text-red-400/60 py-1.5 transition-all"
                  >
                    Forfeit Battle
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
