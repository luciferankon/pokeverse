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

/* ─── type colours ─────────────────────────────────────────────── */
const TC: Record<string, string> = {
  normal:"#A8A878",fire:"#F08030",water:"#6890F0",electric:"#F8D030",
  grass:"#78C850",ice:"#98D8D8",fighting:"#C03028",poison:"#A040A0",
  ground:"#E0C068",flying:"#A890F0",psychic:"#F85888",bug:"#A8B820",
  rock:"#B8A038",ghost:"#705898",dragon:"#7038F8",dark:"#705848",
  steel:"#B8B8D0",fairy:"#EE99AC",
};

/* ─── CSS keyframes (injected once) ────────────────────────────── */
const STYLE_ID = "battle-anims";
function injectStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes b-idle{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    @keyframes b-atk-player{0%{transform:translate(0,0)}30%{transform:translate(60px,-30px) scale(1.08)}60%{transform:translate(60px,-30px) scale(1.08)}100%{transform:translate(0,0)}}
    @keyframes b-atk-ai{0%{transform:translate(0,0)}30%{transform:translate(-60px,30px) scale(1.08)}60%{transform:translate(-60px,30px) scale(1.08)}100%{transform:translate(0,0)}}
    @keyframes b-hit{0%{filter:brightness(1)}15%{filter:brightness(3)}30%{filter:brightness(1);transform:translateX(8px)}45%{transform:translateX(-8px)}60%{transform:translateX(6px)}75%{transform:translateX(-4px)}100%{filter:brightness(1);transform:translateX(0)}}
    @keyframes b-faint{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(40px)}}
    @keyframes b-enter{0%{opacity:0;transform:scale(0.3) translateY(20px)}60%{opacity:1;transform:scale(1.1) translateY(-5px)}100%{transform:scale(1) translateY(0)}}
    @keyframes b-flash{0%,100%{opacity:1}50%{opacity:0.2}}
    @keyframes b-super{0%{box-shadow:0 0 0 0 rgba(250,204,21,0.6)}100%{box-shadow:0 0 40px 20px rgba(250,204,21,0)}}
    @keyframes b-shake-screen{0%,100%{transform:translate(0,0)}10%{transform:translate(-3px,2px)}20%{transform:translate(4px,-2px)}30%{transform:translate(-2px,3px)}40%{transform:translate(3px,-1px)}50%{transform:translate(-1px,2px)}60%{transform:translate(2px,-3px)}70%{transform:translate(-3px,1px)}80%{transform:translate(1px,-2px)}90%{transform:translate(-2px,3px)}}
    @keyframes b-hp-drain{0%{filter:brightness(1.3)}100%{filter:brightness(1)}}
    @keyframes b-pokeball-open{0%{transform:scale(1) rotate(0deg);opacity:1}50%{transform:scale(1.3) rotate(180deg);opacity:1}100%{transform:scale(0) rotate(360deg);opacity:0}}
    @keyframes b-type-pulse{0%{transform:scale(1)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
    .anim-idle{animation:b-idle 2.5s ease-in-out infinite}
    .anim-atk-player{animation:b-atk-player 0.6s ease-in-out forwards}
    .anim-atk-ai{animation:b-atk-ai 0.6s ease-in-out forwards}
    .anim-hit{animation:b-hit 0.5s ease-out forwards}
    .anim-faint{animation:b-faint 0.8s ease-in forwards}
    .anim-enter{animation:b-enter 0.6s ease-out forwards}
    .anim-flash{animation:b-flash 0.15s ease-in-out 3}
    .anim-super{animation:b-super 0.6s ease-out}
    .anim-shake-screen{animation:b-shake-screen 0.4s ease-in-out}
    .anim-hp-drain{animation:b-hp-drain 0.3s ease-out}
    .anim-pokeball{animation:b-pokeball-open 0.5s ease-in-out forwards}
    .anim-type-pulse{animation:b-type-pulse 0.3s ease-in-out}
  `;
  document.head.appendChild(s);
}

/* ─── phases ───────────────────────────────────────────────────── */
type Phase = "select" | "loading" | "battle" | "switching" | "result";

/* ─── sprite animation state ───────────────────────────────────── */
type SpriteAnim = "idle" | "attack" | "hit" | "faint" | "enter" | "flash" | "none";

/* ─── build a BattlePokemon ────────────────────────────────────── */
async function buildBattlePokemon(id: number, isPlayer: boolean): Promise<BattlePokemon> {
  const data = await fetchPokemon(id);
  const allMoves = data.moves || [];
  const shuffled = [...allMoves].sort(() => Math.random() - 0.5).slice(0, 12);
  const moveDetails: BattleMove[] = [];
  for (const entry of shuffled) {
    try {
      const md = await fetchMove(entry.move.name);
      moveDetails.push({ name:md.name, type:md.type.name, damageClass:md.damage_class.name, power:md.power, accuracy:md.accuracy, pp:md.pp??10, maxPp:md.pp??10, priority:md.priority??0 });
    } catch {}
  }
  const dmg = moveDetails.filter(m=>m.power&&m.power>0).sort((a,b)=>(b.power||0)-(a.power||0));
  const sts = moveDetails.filter(m=>!m.power||m.power===0);
  let moves = dmg.length>=4 ? dmg.slice(0,4) : [...dmg,...sts].slice(0,4);
  if(!moves.length) moves=[{name:"Struggle",type:"normal",damageClass:"physical",power:50,accuracy:null,pp:99,maxPp:99,priority:0}];
  const stats = { hp:calcHp(data.stats[0].base_stat), attack:calcStat(data.stats[1].base_stat), defense:calcStat(data.stats[2].base_stat), spAtk:calcStat(data.stats[3].base_stat), spDef:calcStat(data.stats[4].base_stat), speed:calcStat(data.stats[5].base_stat) };
  return { id:data.id, name:data.name, types:data.types.map((t:{type:{name:string}})=>t.type.name), stats, currentHp:stats.hp, maxHp:stats.hp, moves, status:null, statusTurns:0, sprite:getPokemonImageUrl(data.id), isPlayer };
}

/* ─── delay helper ─────────────────────────────────────────────── */
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/* ─── typewriter component ─────────────────────────────────────── */
function TypewriterText({ text, speed = 25, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const idx = useRef(0);
  useEffect(() => {
    setDisplayed("");
    idx.current = 0;
    const iv = setInterval(() => {
      idx.current++;
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) { clearInterval(iv); onDone?.(); }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);
  return <>{displayed}<span className="animate-pulse">|</span></>;
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function BattlePage() {
  const [phase, setPhase] = useState<Phase>("select");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");

  const [playerTeam, setPlayerTeam] = useState<BattlePokemon[]>([]);
  const [aiTeam, setAiTeam] = useState<BattlePokemon[]>([]);
  const [activePlayer, setActivePlayer] = useState(0);
  const [activeAi, setActiveAi] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchResults, setSearchResults] = useState<{id:number;name:string}[]>([]);
  const [searching, setSearching] = useState(false);

  // battle UI state
  const [messageQueue, setMessageQueue] = useState<string[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const [winner, setWinner] = useState<"player"|"ai"|null>(null);
  const [turnCount, setTurnCount] = useState(0);
  const [showMoves, setShowMoves] = useState(true);

  // animation state
  const [playerAnim, setPlayerAnim] = useState<SpriteAnim>("idle");
  const [aiAnim, setAiAnim] = useState<SpriteAnim>("idle");
  const [screenShake, setScreenShake] = useState(false);
  const [superFlash, setSuperFlash] = useState(false);

  // HP display (for smooth drain)
  const [displayPlayerHp, setDisplayPlayerHp] = useState(0);
  const [displayAiHp, setDisplayAiHp] = useState(0);

  // loading
  const [loadingMsg, setLoadingMsg] = useState("");

  // full battle log
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => { injectStyles(); }, []);

  // sync display HP
  useEffect(() => {
    if (playerTeam[activePlayer]) setDisplayPlayerHp(playerTeam[activePlayer].currentHp);
  }, [playerTeam, activePlayer]);
  useEffect(() => {
    if (aiTeam[activeAi]) setDisplayAiHp(aiTeam[activeAi].currentHp);
  }, [aiTeam, activeAi]);

  // auto scroll log
  useEffect(() => { if(logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [battleLog]);

  /* ─── animated HP drain ──────────────────────────────────── */
  const drainHp = (setter: (v:number)=>void, from: number, to: number) => {
    return new Promise<void>(resolve => {
      const steps = 20;
      const diff = from - to;
      let step = 0;
      const iv = setInterval(() => {
        step++;
        setter(Math.round(from - (diff * step / steps)));
        if (step >= steps) { clearInterval(iv); setter(to); resolve(); }
      }, 30);
    });
  };

  /* ─── show message with typewriter ───────────────────────── */
  const showMessage = (msg: string) => {
    return new Promise<void>(resolve => {
      setCurrentMessage(msg);
      setBattleLog(prev => [...prev, msg]);
      setTimeout(resolve, Math.max(800, msg.length * 30 + 400));
    });
  };

  /* ─── search ─────────────────────────────────────────────── */
  const searchPokemon = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const numId = parseInt(q);
      if (!isNaN(numId) && numId >= 1 && numId <= 1025) {
        const p = await fetchPokemon(numId);
        setSearchResults([{ id: p.id, name: p.name }]);
      } else {
        try {
          const p = await fetchPokemon(q.toLowerCase().trim());
          setSearchResults([{ id: p.id, name: p.name }]);
        } catch {
          const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=1025");
          const data = await res.json();
          setSearchResults(data.results
            .filter((r:{name:string}) => r.name.includes(q.toLowerCase().trim()))
            .slice(0, 8)
            .map((r:{name:string;url:string}) => ({ name:r.name, id:parseInt(r.url.split("/").filter(Boolean).pop()||"0") })));
        }
      }
    } catch { setSearchResults([]); }
    setSearching(false);
  }, []);

  /* ─── start battles ──────────────────────────────────────── */
  const startBattle = async (pIds: number[], aIds: number[]) => {
    setPhase("loading");
    setLoadingMsg("Building teams...");
    try {
      setLoadingMsg("Loading your team...");
      const pTeam = await Promise.all(pIds.map(id => buildBattlePokemon(id, true)));
      setLoadingMsg("Loading opponent...");
      const aTeam = await Promise.all(aIds.map(id => buildBattlePokemon(id, false)));
      setPlayerTeam(pTeam);
      setAiTeam(aTeam);
      setActivePlayer(0);
      setActiveAi(0);
      setDisplayPlayerHp(pTeam[0].maxHp);
      setDisplayAiHp(aTeam[0].maxHp);
      setTurnCount(1);
      setWinner(null);
      setBattleLog([]);
      setShowLog(false);
      setShowMoves(false);

      setPhase("battle");

      // entry sequence
      await wait(300);
      setPlayerAnim("enter");
      await showMessage(`Go, ${formatName(pTeam[0].name)}!`);
      setPlayerAnim("idle");
      setAiAnim("enter");
      await showMessage(`Opponent sent out ${formatName(aTeam[0].name)}!`);
      setAiAnim("idle");
      await wait(200);
      setCurrentMessage("What will you do?");
      setShowMoves(true);
    } catch {
      setLoadingMsg("Error building teams.");
      setTimeout(() => setPhase("select"), 2000);
    }
  };

  const startQuickBattle = () => {
    const used = new Set<number>();
    const rnd = () => { let id; do { id = Math.floor(Math.random()*898)+1; } while(used.has(id)); used.add(id); return id; };
    startBattle([rnd(),rnd(),rnd()], [rnd(),rnd(),rnd()]);
  };

  const startCustomBattle = () => {
    if (!selectedIds.length) return;
    const used = new Set(selectedIds);
    const rnd = () => { let id; do { id = Math.floor(Math.random()*898)+1; } while(used.has(id)); used.add(id); return id; };
    startBattle(selectedIds, Array.from({length:selectedIds.length}, rnd));
  };

  /* ─── execute turn (animated) ────────────────────────────── */
  const executeTurn = async (playerMoveIndex: number) => {
    if (isAnimating || winner) return;
    setIsAnimating(true);
    setShowMoves(false);

    const player = { ...playerTeam[activePlayer] };
    const ai = { ...aiTeam[activeAi] };
    const playerMove = player.moves[playerMoveIndex];
    const aiMove = aiSelectMove(ai, player, difficulty);

    playerMove.pp = Math.max(0, playerMove.pp - 1);
    const aiRef = ai.moves.find(m => m.name === aiMove.name);
    if (aiRef) aiRef.pp = Math.max(0, aiRef.pp - 1);

    // determine order
    let playerFirst = true;
    if (playerMove.priority !== aiMove.priority) {
      playerFirst = playerMove.priority > aiMove.priority;
    } else {
      const pS = getEffectiveSpeed(player);
      const aS = getEffectiveSpeed(ai);
      playerFirst = pS > aS ? true : pS < aS ? false : Math.random() > 0.5;
    }

    const turns = playerFirst
      ? [{ atk: player, def: ai, move: playerMove, isP: true }, { atk: ai, def: player, move: aiMove, isP: false }]
      : [{ atk: ai, def: player, move: aiMove, isP: false }, { atk: player, def: ai, move: playerMove, isP: true }];

    for (const turn of turns) {
      if (turn.atk.currentHp <= 0) continue;

      // status block
      const sc = checkStatusBlock(turn.atk);
      if (sc.cured) { turn.atk.status = null; turn.atk.statusTurns = 0; await showMessage(sc.message); }
      if (sc.blocked) {
        if (!sc.cured) {
          if (turn.isP) { setPlayerAnim("flash"); } else { setAiAnim("flash"); }
          await showMessage(sc.message);
          if (turn.isP) setPlayerAnim("idle"); else setAiAnim("idle");
        }
        if (turn.atk.status === "sleep") turn.atk.statusTurns--;
        continue;
      }

      // attack animation
      await showMessage(`${formatName(turn.atk.name)} used ${formatName(turn.move.name)}!`);

      if (turn.isP) { setPlayerAnim("attack"); } else { setAiAnim("attack"); }
      await wait(300);

      // accuracy
      if (!checkAccuracy(turn.move)) {
        if (turn.isP) setPlayerAnim("idle"); else setAiAnim("idle");
        await showMessage(`${formatName(turn.atk.name)}'s attack missed!`);
        continue;
      }

      // damage
      const result = calculateDamage(turn.atk, turn.def, turn.move);

      // hit animation on defender
      await wait(200);
      if (turn.isP) { setAiAnim("hit"); setPlayerAnim("idle"); } else { setPlayerAnim("hit"); setAiAnim("idle"); }

      // screen shake on super effective
      if (result.effectiveness >= 2) {
        setScreenShake(true);
        setSuperFlash(true);
        setTimeout(() => { setScreenShake(false); setSuperFlash(false); }, 500);
      }
      await wait(400);

      if (result.message) await showMessage(result.message);

      if (result.damage > 0) {
        const oldHp = turn.def.currentHp;
        turn.def.currentHp = Math.max(0, turn.def.currentHp - result.damage);

        // animate HP drain
        if (turn.isP) {
          await drainHp(setDisplayAiHp, oldHp, turn.def.currentHp);
          setAiAnim(turn.def.currentHp <= 0 ? "faint" : "idle");
        } else {
          await drainHp(setDisplayPlayerHp, oldHp, turn.def.currentHp);
          setPlayerAnim(turn.def.currentHp <= 0 ? "faint" : "idle");
        }

        const pct = Math.round((result.damage / turn.def.maxHp) * 100);
        await showMessage(`${formatName(turn.def.name)} took ${result.damage} damage (${pct}%)!`);

        if (turn.def.currentHp <= 0) {
          await wait(600);
          await showMessage(`${formatName(turn.def.name)} fainted!`);
        }
      } else {
        if (turn.isP) setAiAnim("idle"); else setPlayerAnim("idle");
      }
    }

    // end-of-turn status damage
    for (const pkmn of [player, ai]) {
      if (pkmn.currentHp > 0) {
        const sd = applyStatusDamage(pkmn);
        if (sd) {
          const oldHp = pkmn.currentHp;
          pkmn.currentHp = Math.max(0, pkmn.currentHp - sd.damage);
          if (pkmn.isPlayer) {
            setPlayerAnim("flash");
            await drainHp(setDisplayPlayerHp, oldHp, pkmn.currentHp);
            setPlayerAnim(pkmn.currentHp <= 0 ? "faint" : "idle");
          } else {
            setAiAnim("flash");
            await drainHp(setDisplayAiHp, oldHp, pkmn.currentHp);
            setAiAnim(pkmn.currentHp <= 0 ? "faint" : "idle");
          }
          await showMessage(sd.message);
          if (pkmn.currentHp <= 0) await showMessage(`${formatName(pkmn.name)} fainted!`);
        }
      }
    }

    // update state
    const nPT = [...playerTeam]; nPT[activePlayer] = player;
    const nAT = [...aiTeam]; nAT[activeAi] = ai;
    setPlayerTeam(nPT);
    setAiTeam(nAT);
    setTurnCount(t => t + 1);

    // check faints
    if (ai.currentHp <= 0) {
      const next = nAT.findIndex((p, i) => i !== activeAi && p.currentHp > 0);
      if (next === -1) {
        await wait(500);
        setWinner("player");
        await showMessage("You win the battle!");
        setPhase("result");
        setIsAnimating(false);
        return;
      }
      await wait(400);
      setActiveAi(next);
      setDisplayAiHp(nAT[next].currentHp);
      setAiAnim("enter");
      await showMessage(`Opponent sent out ${formatName(nAT[next].name)}!`);
      setAiAnim("idle");
    }

    if (player.currentHp <= 0) {
      const next = nPT.findIndex((p, i) => i !== activePlayer && p.currentHp > 0);
      if (next === -1) {
        await wait(500);
        setWinner("ai");
        await showMessage("You lost the battle...");
        setPhase("result");
        setIsAnimating(false);
        return;
      }
      setPhase("switching");
      setIsAnimating(false);
      return;
    }

    setCurrentMessage("What will you do?");
    setShowMoves(true);
    setIsAnimating(false);
  };

  /* ─── switch (forced) ────────────────────────────────────── */
  const switchPokemon = async (index: number) => {
    if (index === activePlayer || playerTeam[index].currentHp <= 0) return;
    setActivePlayer(index);
    setDisplayPlayerHp(playerTeam[index].currentHp);
    setPlayerAnim("enter");
    setPhase("battle");
    setShowMoves(false);
    await showMessage(`Go, ${formatName(playerTeam[index].name)}!`);
    setPlayerAnim("idle");
    setCurrentMessage("What will you do?");
    setShowMoves(true);
  };

  /* ─── voluntary switch ───────────────────────────────────── */
  const voluntarySwitch = async (index: number) => {
    if (index === activePlayer || playerTeam[index].currentHp <= 0 || isAnimating || winner) return;
    setIsAnimating(true);
    setShowMoves(false);

    // recall current
    setPlayerAnim("faint"); // reuse faint anim for recall
    await showMessage(`Come back, ${formatName(playerTeam[activePlayer].name)}!`);

    setActivePlayer(index);
    setDisplayPlayerHp(playerTeam[index].currentHp);
    setPlayerAnim("enter");
    await showMessage(`Go, ${formatName(playerTeam[index].name)}!`);
    setPlayerAnim("idle");

    // AI attacks
    const ai = { ...aiTeam[activeAi] };
    const target = { ...playerTeam[index] };
    const aiMove = aiSelectMove(ai, target, difficulty);
    const aiRef = ai.moves.find(m => m.name === aiMove.name);
    if (aiRef) aiRef.pp = Math.max(0, aiRef.pp - 1);

    const sc = checkStatusBlock(ai);
    if (sc.cured) { ai.status = null; ai.statusTurns = 0; await showMessage(sc.message); }
    if (!sc.blocked) {
      await showMessage(`${formatName(ai.name)} used ${formatName(aiMove.name)}!`);
      setAiAnim("attack");
      await wait(300);

      if (checkAccuracy(aiMove)) {
        const result = calculateDamage(ai, target, aiMove);
        setPlayerAnim("hit");
        setAiAnim("idle");
        if (result.effectiveness >= 2) { setScreenShake(true); setSuperFlash(true); setTimeout(() => { setScreenShake(false); setSuperFlash(false); }, 500); }
        await wait(400);
        if (result.message) await showMessage(result.message);
        if (result.damage > 0) {
          const oldHp = target.currentHp;
          target.currentHp = Math.max(0, target.currentHp - result.damage);
          await drainHp(setDisplayPlayerHp, oldHp, target.currentHp);
          setPlayerAnim(target.currentHp <= 0 ? "faint" : "idle");
          await showMessage(`${formatName(target.name)} took ${result.damage} damage!`);
          if (target.currentHp <= 0) await showMessage(`${formatName(target.name)} fainted!`);
        } else {
          setPlayerAnim("idle");
        }
      } else {
        setAiAnim("idle");
        await showMessage(`${formatName(ai.name)}'s attack missed!`);
      }
    } else if (!sc.cured) { setAiAnim("flash"); await showMessage(sc.message); setAiAnim("idle"); }

    const nPT = [...playerTeam]; nPT[index] = target;
    const nAT = [...aiTeam]; nAT[activeAi] = ai;
    setPlayerTeam(nPT); setAiTeam(nAT);
    setTurnCount(t => t + 1);

    if (target.currentHp <= 0) {
      const next = nPT.findIndex((p, i) => i !== index && p.currentHp > 0);
      if (next === -1) { setWinner("ai"); await showMessage("You lost the battle..."); setPhase("result"); setIsAnimating(false); return; }
      setPhase("switching"); setIsAnimating(false); return;
    }

    setCurrentMessage("What will you do?");
    setShowMoves(true);
    setIsAnimating(false);
  };

  /* ─── HP bar colour ──────────────────────────────────────── */
  const hpCol = (c: number, m: number) => { const p=c/m; return p>0.5?"#22C55E":p>0.25?"#EAB308":"#EF4444"; };
  const hpPct = (c: number, m: number) => Math.max(0, Math.min(100, (c/m)*100));

  /* ─── sprite class ───────────────────────────────────────── */
  const spriteClass = (anim: SpriteAnim, isPlayer: boolean) => {
    switch(anim) {
      case "idle": return "anim-idle";
      case "attack": return isPlayer ? "anim-atk-player" : "anim-atk-ai";
      case "hit": return "anim-hit";
      case "faint": return "anim-faint";
      case "enter": return "anim-enter";
      case "flash": return "anim-flash";
      default: return "";
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     SELECT SCREEN
     ═══════════════════════════════════════════════════════════════ */
  if (phase === "select") {
    return (
      <div className="min-h-screen bg-[#080810] text-white pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-bold mb-3">
              <span className="bg-gradient-to-r from-red-500 via-yellow-400 to-red-500 bg-clip-text text-transparent">Battle Simulator</span>
            </h1>
            <p className="text-white/40">Real damage formulas · Type matchups · AI opponents · Animated battles</p>
          </div>

          {/* difficulty */}
          <div className="mb-8 text-center">
            <p className="text-xs text-white/30 mb-3 uppercase tracking-widest">Difficulty</p>
            <div className="flex justify-center gap-3">
              {(["easy","normal","hard"] as Difficulty[]).map(d => (
                <button key={d} onClick={()=>setDifficulty(d)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold capitalize transition-all ${
                    difficulty===d
                      ? d==="easy"?"bg-green-500/20 text-green-400 ring-1 ring-green-500/40"
                        : d==="normal"?"bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40"
                        : "bg-red-500/20 text-red-400 ring-1 ring-red-500/40"
                      : "bg-white/5 text-white/40 hover:bg-white/10"
                  }`}>
                  {d==="easy"?"\ud83c\udf31 Easy":d==="normal"?"\u26a1 Normal":"\ud83d\udd25 Hard"}
                </button>
              ))}
            </div>
            <p className="text-xs text-white/25 mt-2">{difficulty==="easy"?"AI picks random moves":difficulty==="normal"?"AI weighs moves by power & type":"AI always picks the optimal move"}</p>
          </div>

          {/* quick battle */}
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 mb-6 hover:border-white/10 transition-all">
            <h2 className="text-lg font-bold mb-1">\ud83c\udfb2 Quick Battle</h2>
            <p className="text-white/35 text-sm mb-4">Random teams of 3. Jump right in!</p>
            <button onClick={startQuickBattle} className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold py-3 px-8 rounded-xl transition-all text-lg shadow-lg shadow-red-500/20">
              Start Quick Battle
            </button>
          </div>

          {/* custom battle */}
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-all">
            <h2 className="text-lg font-bold mb-1">\ud83c\udfaf Custom Battle</h2>
            <p className="text-white/35 text-sm mb-4">Choose up to 3 Pok\u00e9mon</p>
            <div className="flex gap-2 mb-4">
              <input type="text" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&searchPokemon(searchQuery)}
                placeholder="Search by name or ID..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/25 transition-all" />
              <button onClick={()=>searchPokemon(searchQuery)} disabled={searching}
                className="bg-white/10 hover:bg-white/15 px-5 py-2.5 rounded-xl text-sm font-medium transition-all">
                {searching?"...":"Search"}
              </button>
            </div>
            {searchResults.length>0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {searchResults.map(r=>(
                  <button key={r.id} onClick={()=>{if(selectedIds.length<3&&!selectedIds.includes(r.id))setSelectedIds([...selectedIds,r.id]);}}
                    disabled={selectedIds.includes(r.id)||selectedIds.length>=3}
                    className={`flex items-center gap-2 p-2 rounded-xl text-sm transition-all ${selectedIds.includes(r.id)?"bg-green-500/20 text-green-400":"bg-white/5 hover:bg-white/10 text-white/70"}`}>
                    <img src={getPokemonImageUrl(r.id)} alt="" className="w-8 h-8" />
                    <span className="capitalize truncate">{formatName(r.name)}</span>
                    <span className="text-white/25 text-xs ml-auto">#{r.id}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedIds.length>0 && (
              <div className="mb-4">
                <p className="text-xs text-white/30 mb-2">Your Team ({selectedIds.length}/3)</p>
                <div className="flex gap-3">
                  {selectedIds.map(id=>(
                    <div key={id} className="relative bg-white/5 rounded-xl p-3 text-center group">
                      <button onClick={()=>setSelectedIds(selectedIds.filter(i=>i!==id))}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">\u00d7</button>
                      <img src={getPokemonImageUrl(id)} alt="" className="w-16 h-16 mx-auto" />
                      <p className="text-xs text-white/50 mt-1">#{id}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={startCustomBattle} disabled={!selectedIds.length}
              className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-red-500/20">
              Start Battle ({selectedIds.length}/3)
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     LOADING
     ═══════════════════════════════════════════════════════════════ */
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-[#080810] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-white/10" />
            <div className="absolute inset-0 rounded-full border-4 border-red-500 border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-white/20" />
            </div>
          </div>
          <p className="text-white/50 animate-pulse">{loadingMsg}</p>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     SWITCHING
     ═══════════════════════════════════════════════════════════════ */
  if (phase === "switching") {
    return (
      <div className="min-h-screen bg-[#080810] text-white pt-24 pb-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-2">Choose your next Pok\u00e9mon!</h2>
          <p className="text-white/35 mb-8">Your active Pok\u00e9mon fainted.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {playerTeam.map((p, i) => (
              <button key={i} onClick={()=>switchPokemon(i)} disabled={p.currentHp<=0||i===activePlayer}
                className={`p-5 rounded-2xl border transition-all ${
                  p.currentHp<=0?"border-red-500/20 bg-red-500/5 opacity-30 cursor-not-allowed"
                  :i===activePlayer?"border-white/20 bg-white/5 opacity-30 cursor-not-allowed"
                  :"border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 hover:scale-105 cursor-pointer"
                }`}>
                <img src={p.sprite} alt={p.name} className="w-24 h-24 mx-auto" style={p.currentHp<=0?{filter:"grayscale(1)",opacity:0.4}:{}} />
                <p className="font-bold mt-2">{formatName(p.name)}</p>
                <div className="flex gap-1 mt-1 justify-center">
                  {p.types.map(t=><span key={t} className="text-[10px] px-2 py-0.5 rounded-full" style={{background:`${TC[t]}33`,color:TC[t]}}>{t}</span>)}
                </div>
                <div className="mt-2">
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{width:`${hpPct(p.currentHp,p.maxHp)}%`,background:hpCol(p.currentHp,p.maxHp)}} />
                  </div>
                  <p className="text-xs text-white/35 mt-1">{p.currentHp}/{p.maxHp} HP</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     RESULT
     ═══════════════════════════════════════════════════════════════ */
  if (phase === "result") {
    return (
      <div className="min-h-screen bg-[#080810] text-white pt-24 pb-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-8xl mb-4">{winner==="player"?"\ud83c\udfc6":"\ud83d\udc80"}</div>
          <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent">
            {winner==="player"?"Victory!":"Defeat..."}
          </h1>
          <p className="text-white/40 mb-8">{winner==="player"?"Your team emerged victorious!":"Train harder and try again!"}</p>
          <div className="grid grid-cols-2 gap-6 mb-8 text-left">
            <div>
              <p className="text-xs text-white/30 mb-3 uppercase tracking-wider">Your Team</p>
              {playerTeam.map((p,i)=>(
                <div key={i} className="flex items-center gap-2 mb-2">
                  <img src={p.sprite} alt="" className="w-8 h-8" style={p.currentHp<=0?{filter:"grayscale(1)",opacity:0.3}:{}} />
                  <span className={p.currentHp<=0?"text-white/25 line-through":""}>{formatName(p.name)}</span>
                  <span className="text-xs text-white/25 ml-auto">{p.currentHp}/{p.maxHp}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs text-white/30 mb-3 uppercase tracking-wider">Opponent</p>
              {aiTeam.map((p,i)=>(
                <div key={i} className="flex items-center gap-2 mb-2">
                  <img src={p.sprite} alt="" className="w-8 h-8" style={p.currentHp<=0?{filter:"grayscale(1)",opacity:0.3}:{}} />
                  <span className={p.currentHp<=0?"text-white/25 line-through":""}>{formatName(p.name)}</span>
                  <span className="text-xs text-white/25 ml-auto">{p.currentHp}/{p.maxHp}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={()=>{setPhase("select");setWinner(null);setSelectedIds([]);setSearchResults([]);setSearchQuery("");}}
              className="bg-gradient-to-r from-red-600 to-red-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-red-500/20">
              Battle Again
            </button>
            <Link href="/dex" className="bg-white/10 hover:bg-white/15 text-white font-bold py-3 px-8 rounded-xl transition-all">Back to Dex</Link>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     BATTLE SCREEN
     ═══════════════════════════════════════════════════════════════ */
  const player = playerTeam[activePlayer];
  const ai = aiTeam[activeAi];
  if (!player || !ai) return null;

  return (
    <div className="min-h-screen bg-[#080810] text-white pt-20 pb-4 px-4 flex flex-col">
      {/* super-effective flash overlay */}
      {superFlash && <div className="fixed inset-0 z-40 bg-yellow-300/20 pointer-events-none" style={{animation:"b-flash 0.15s ease-in-out 2"}} />}

      <div className={`max-w-4xl mx-auto w-full flex-1 flex flex-col ${screenShake?"anim-shake-screen":""}`}>

        {/* ── BATTLEFIELD ──────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden mb-3" style={{background:"linear-gradient(180deg, #1a1a3e 0%, #0f2027 40%, #203a2e 60%, #2d4a1e 100%)", minHeight:320}}>

          {/* ground ellipse */}
          <div className="absolute bottom-0 left-0 right-0 h-[45%]" style={{background:"linear-gradient(180deg, transparent 0%, rgba(34,60,20,0.3) 100%)"}} />

          {/* ── Opponent (top-right) ── */}
          <div className="absolute top-4 right-4 left-[55%]">
            {/* name plate */}
            <div className="bg-[#111827]/80 backdrop-blur-sm rounded-xl p-3 border border-white/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold">{formatName(ai.name)}</span>
                <div className="flex gap-1">
                  {aiTeam.map((p,i) => <div key={i} className={`w-2.5 h-2.5 rounded-full ${p.currentHp<=0?"bg-red-500/50":i===activeAi?"bg-green-400":"bg-white/20"}`} />)}
                </div>
              </div>
              <div className="flex items-center gap-1 mb-1.5">
                {ai.types.map(t=><span key={t} className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{background:`${TC[t]}33`,color:TC[t]}}>{t}</span>)}
                {ai.status && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-purple-500/30 text-purple-300 uppercase ml-1">{ai.status.slice(0,3)}</span>}
              </div>
              {/* HP bar */}
              <div className="relative h-3 bg-black/40 rounded-full overflow-hidden">
                <div className="absolute inset-0 rounded-full transition-all duration-700 ease-out" style={{width:`${hpPct(displayAiHp,ai.maxHp)}%`,background:`linear-gradient(90deg, ${hpCol(displayAiHp,ai.maxHp)}, ${hpCol(displayAiHp,ai.maxHp)}dd)`}} />
              </div>
              <p className="text-[10px] text-white/30 mt-1 text-right">{displayAiHp}/{ai.maxHp}</p>
            </div>
          </div>

          {/* AI sprite */}
          <div className="absolute top-16 right-[15%]" style={{zIndex:10}}>
            <img src={ai.sprite} alt={ai.name}
              className={`w-40 h-40 drop-shadow-2xl ${spriteClass(aiAnim, false)}`}
              style={{filter: aiAnim === "faint" ? "grayscale(0.8)" : "drop-shadow(0 4px 20px rgba(0,0,0,0.5))"}} />
            {/* shadow */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-24 h-4 bg-black/20 rounded-full blur-sm" />
          </div>

          {/* ── Player (bottom-left) ── */}
          <div className="absolute bottom-4 left-4 right-[55%]">
            {/* name plate */}
            <div className="bg-[#111827]/80 backdrop-blur-sm rounded-xl p-3 border border-white/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold">{formatName(player.name)}</span>
                <div className="flex gap-1">
                  {playerTeam.map((p,i) => <div key={i} className={`w-2.5 h-2.5 rounded-full ${p.currentHp<=0?"bg-red-500/50":i===activePlayer?"bg-green-400":"bg-white/20"}`} />)}
                </div>
              </div>
              <div className="flex items-center gap-1 mb-1.5">
                {player.types.map(t=><span key={t} className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{background:`${TC[t]}33`,color:TC[t]}}>{t}</span>)}
                {player.status && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-purple-500/30 text-purple-300 uppercase ml-1">{player.status.slice(0,3)}</span>}
              </div>
              {/* HP bar */}
              <div className="relative h-3 bg-black/40 rounded-full overflow-hidden">
                <div className="absolute inset-0 rounded-full transition-all duration-700 ease-out" style={{width:`${hpPct(displayPlayerHp,player.maxHp)}%`,background:`linear-gradient(90deg, ${hpCol(displayPlayerHp,player.maxHp)}, ${hpCol(displayPlayerHp,player.maxHp)}dd)`}} />
              </div>
              <div className="flex justify-between mt-1">
                <p className="text-[10px] text-white/30">{displayPlayerHp}/{player.maxHp}</p>
                <p className="text-[10px] text-white/20">Lv.50</p>
              </div>
            </div>
          </div>

          {/* Player sprite */}
          <div className="absolute bottom-20 left-[10%]" style={{zIndex:10}}>
            <img src={player.sprite} alt={player.name}
              className={`w-44 h-44 drop-shadow-2xl ${spriteClass(playerAnim, true)}`}
              style={{filter: playerAnim === "faint" ? "grayscale(0.8)" : "drop-shadow(0 4px 20px rgba(0,0,0,0.5))"}} />
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-black/20 rounded-full blur-sm" />
          </div>
        </div>

        {/* ── MESSAGE BOX ──────────────────────────────────── */}
        <div className="bg-[#111827] border-2 border-white/10 rounded-xl p-4 mb-3 min-h-[56px] relative">
          <p className="text-white/90 text-lg font-medium">
            {currentMessage && <TypewriterText text={currentMessage} speed={22} />}
          </p>
          {/* toggle log */}
          <button onClick={()=>setShowLog(!showLog)} className="absolute top-2 right-3 text-[10px] text-white/20 hover:text-white/40 transition-all">
            {showLog?"Hide":"Log"} \u25be
          </button>
          {showLog && (
            <div ref={logRef} className="mt-2 max-h-28 overflow-y-auto border-t border-white/5 pt-2 space-y-0.5">
              {battleLog.map((m,i) => <p key={i} className={`text-xs ${m.includes("super effective")||m.includes("critical")?"text-yellow-400":m.includes("fainted")?"text-red-400":m.includes("win")?"text-green-400":"text-white/30"}`}>{m}</p>)}
            </div>
          )}
        </div>

        {/* ── CONTROLS ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Moves (3/5 width) */}
          <div className="md:col-span-3">
            {showMoves && !winner ? (
              <div className="grid grid-cols-2 gap-2">
                {player.moves.map((m,i) => (
                  <button key={i} onClick={()=>executeTurn(i)} disabled={isAnimating||m.pp<=0||!!winner}
                    className="p-3 rounded-xl text-left transition-all hover:scale-[1.03] hover:brightness-110 disabled:opacity-25 disabled:cursor-not-allowed active:scale-95"
                    style={{background:`${TC[m.type]||"#666"}22`,border:`1px solid ${TC[m.type]||"#666"}44`}}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{formatName(m.name)}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style={{background:`${TC[m.type]}44`,color:TC[m.type]}}>{m.type}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-white/35">
                      {m.power&&<span>PWR {m.power}</span>}
                      {m.accuracy&&<span>ACC {m.accuracy}</span>}
                      <span className="ml-auto">{m.pp}/{m.maxPp} PP</span>
                    </div>
                    <div className="text-[9px] text-white/20 mt-0.5 uppercase">{m.damageClass}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-white/15 text-sm">
                {winner ? "Battle ended" : "Waiting..."}
              </div>
            )}
          </div>

          {/* Team panel (2/5 width) */}
          <div className="md:col-span-2 bg-white/[0.02] border border-white/5 rounded-xl p-3">
            <p className="text-[10px] text-white/25 mb-2 uppercase tracking-wider">Team \u2014 click to switch</p>
            <div className="space-y-1.5">
              {playerTeam.map((p,i) => (
                <button key={i} onClick={()=>i!==activePlayer&&p.currentHp>0&&voluntarySwitch(i)}
                  disabled={i===activePlayer||p.currentHp<=0||isAnimating||!!winner}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-lg transition-all ${
                    i===activePlayer?"bg-white/10 ring-1 ring-white/15"
                    :p.currentHp<=0?"bg-red-500/5 opacity-30 cursor-not-allowed"
                    :"bg-white/[0.02] hover:bg-white/[0.06] cursor-pointer"
                  }`}>
                  <img src={p.sprite} alt="" className="w-9 h-9" style={p.currentHp<=0?{filter:"grayscale(1)"}:{}} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate">{formatName(p.name)}</span>
                      {i===activePlayer&&<span className="text-[8px] text-green-400 flex-shrink-0">\u25cf</span>}
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-0.5">
                      <div className="h-full rounded-full transition-all duration-300" style={{width:`${hpPct(p.currentHp,p.maxHp)}%`,background:hpCol(p.currentHp,p.maxHp)}} />
                    </div>
                  </div>
                  <span className="text-[10px] text-white/25 flex-shrink-0">{p.currentHp}/{p.maxHp}</span>
                </button>
              ))}
            </div>
            <button onClick={()=>{setPhase("select");setWinner(null);}}
              className="mt-2 w-full text-center text-[10px] text-white/20 hover:text-white/40 py-1.5 transition-all">
              \ud83c\udff3\ufe0f Forfeit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
