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

/* --- type colours ----------------------------------------------- */
const TC: Record<string, string> = {
  normal:"#A8A878",fire:"#F08030",water:"#6890F0",electric:"#F8D030",
  grass:"#78C850",ice:"#98D8D8",fighting:"#C03028",poison:"#A040A0",
  ground:"#E0C068",flying:"#A890F0",psychic:"#F85888",bug:"#A8B820",
  rock:"#B8A038",ghost:"#705898",dragon:"#7038F8",dark:"#705848",
  steel:"#B8B8D0",fairy:"#EE99AC",
};

/* --- CSS keyframes (injected once) ------------------------------ */
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
    @keyframes b-status{0%{filter:hue-rotate(0)}100%{filter:hue-rotate(360deg)}}
    @keyframes b-msg-pop{0%{opacity:0;transform:scale(0.8) translateY(-20px)}60%{opacity:1}100%{opacity:1;transform:scale(1) translateY(0)}}
    @keyframes b-dmg-pop{0%{opacity:1;transform:translateY(0) scale(1)}50%{opacity:1}100%{opacity:0;transform:translateY(-60px) scale(0.7)}}
    @keyframes b-bg-shift{0%{background-position:0 0}100%{background-position:40px 0}}
  `;
  document.head.appendChild(s);
}

/* --- Main Component ------------------------------------------------ */
const EXP_SCALE = 1;
export default function BattlePage() {
  const [p, setP] = useState<BattlePokemon | null>(null);
  const [a, setA] = useState<BattlePokemon | null>(null);
  const [pL, setPL] = useState("");
  const [aL, setAL] = useState("");
  const [dif, setDif] = useState<Difficulty>("NORMAL");
  const [st, setSt] = useState<"menu" | "choosePkm" | "battle" | "win" | "lose">(
    "menu"
  );
  const [turn, setTurn] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [aBsy, setABsy] = useState(false);
  const [pTm, setPTm] = useState(0);
  const [aTm, setATm] = useState(0);
  const [pHP, setPHP] = useState(0);
  const [aHP, setAHP] = useState(0);
  const [pSpd, setPSpd] = useState(0);
  const [aSpd, setASpd] = useState(0);
  const [pSt, setPSt] = useState<string | null>(null);
  const [aSt, setASt] = useState<string | null>(null);
  const [pStC, setPStC] = useState(0);
  const [aStC, setAStC] = useState(0);
  const [pAcc, setPAcc] = useState(0);
  const [aAcc, setAAcc] = useState(0);
  const [pEva, setPEva] = useState(0);
  const [aEva, setAEva] = useState(0);
  const [moves, setMoves] = useState<BattleMove[]>([]);
  const [pMaxHP, setPMaxHP] = useState(0);
  const [aMaxHP, setAMaxHP] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((m: string) => {
    setLog((prev) => {
      const nxt = [...prev, m];
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 0);
      return nxt;
    });
  }, []);

  const loadPokemon = useCallback(
    async (name: string, isPlayer: boolean) => {
      try {
        const pDat = await fetchPokemon(name);
        const bp: BattlePokemon = {
          id: pDat.id,
          name: pDat.name,
          lvl: isPlayer ? 50 : Math.floor(Math.random() * 15 + 35),
          hp: calcHp(pDat.stats.hp, isPlayer ? 50 : Math.floor(Math.random() * 15 + 35)),
          spd: calcStat(
            pDat.stats.speed,
            isPlayer ? 50 : Math.floor(Math.random() * 15 + 35),
            0
          ),
          atk: calcStat(
            pDat.stats.attack,
            isPlayer ? 50 : Math.floor(Math.random() * 15 + 35),
            0
          ),
          def: calcStat(
            pDat.stats.defense,
            isPlayer ? 50 : Math.floor(Math.random() * 15 + 35),
            0
          ),
          spa: calcStat(
            pDat.stats.spAtk,
            isPlayer ? 50 : Math.floor(Math.random() * 15 + 35),
            0
          ),
          spd: calcStat(
            pDat.stats.spDef,
            isPlayer ? 50 : Math.floor(Math.random() * 15 + 35),
            0
          ),
          types: pDat.types,
          moves: [],
          status: null,
          statusTurns: 0,
        };

        const mv = await Promise.all(
          pDat.moves.slice(0, 4).map((m) => fetchMove(m))
        );
        bp.moves = mv;

        if (isPlayer) {
          setP(bp);
          setPMaxHP(bp.hp);
          setPHP(bp.hp);
          setPSpd(bp.spd);
        } else {
          setA(bp);
          setAMaxHP(bp.hp);
          setAHP(bp.hp);
          setASpd(bp.spd);
        }
      } catch (e) {
        addLog(`Error loading ${name}: ${e instanceof Error ? e.message : "unknown"}`);
      }
    },
    [addLog]
  );

  const nxtTn = useCallback(() => {
    if (!p || !a) return;

    let pM = moves[0] || p.moves[0];
    let aM: BattleMove;

    try {
      aM = aiSelectMove(a, p, dif);
    } catch {
      aM = a.moves[0];
    }

    const pGo = getEffectiveSpeed(p, pSpd) >= getEffectiveSpeed(a, aSpd);

    addLog(
      `<b>${formatName(p.name)}</b> used <b>${formatName(pM.name)}</b>!`
    );
    setABsy(true);
    setPTm(1);

    setTimeout(() => {
      let nHP = aHP;
      const dm = calculateDamage(p, a, pM, aAcc, aEva);
      nHP = Math.max(0, nHP - dm);
      setAHP(nHP);

      if (dm > 0) {
        addLog(`<b>${formatName(a.name)}</b> took <b>${dm}</b> damage!`);
      } else {
        addLog(`<b>${formatName(p.name)}'s</b> attack missed!`);
      }

      if (nHP <= 0) {
        setASt(null);
        setAStC(0);
        addLog(`<b>${formatName(a.name)}</b> fainted!`);
        setATm(0);
        setABsy(false);
        return;
      }

      setTimeout(() => {
        setPTm(0);
        setABsy(true);
        setATm(1);

        addLog(
          `<b>${formatName(a.name)}</b> used <b>${formatName(aM.name)}</b>!`
        );

        setTimeout(() => {
          let nHP2 = pHP;
          const dm2 = calculateDamage(a, p, aM, pAcc, pEva);
          nHP2 = Math.max(0, nHP2 - dm2);
          setPHP(nHP2);

          if (dm2 > 0) {
            addLog(
              `<b>${formatName(p.name)}</b> took <b>${dm2}</b> damage!`
            );
          } else {
            addLog(`<b>${formatName(a.name)}'s</b> attack missed!`);
          }

          if (nHP2 <= 0) {
            setPSt(null);
            setPStC(0);
            addLog(`<b>${formatName(p.name)}</b> fainted!`);
            setPTm(0);
            setABsy(false);
            return;
          }

          setATm(0);
          setABsy(false);
          setTurn((prev) => prev + 1);
        }, 600);
      }, 400);
    }, 600);
  }, [p, a, pHP, aHP, moves, dif, pSpd, aSpd, pAcc, pEva, aAcc, aEva, addLog]);

  const startBattle = useCallback(
    async (d: Difficulty) => {
      setDif(d);
      setSt("battle");
      setTurn(0);
      setLog([]);
      await loadPokemon(pL, true);
      await loadPokemon(aL, false);
    },
    [pL, aL, loadPokemon]
  );

  const pickMove = useCallback(
    (m: BattleMove) => {
      setMoves([m]);
      nxtTn();
    },
    [nxtTn]
  );

  const handleForfeit = useCallback(() => {
    setSt("lose");
    addLog("You forfeited the battle.");
  }, [addLog]);

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    if (st === "battle" && p && a) {
      const aLvl = Math.max(a.lvl, 35);
      const pExp = ((aLvl * 10) / 7) * EXP_SCALE;
      const gld = Math.floor(aLvl * 4 * EXP_SCALE);

      if (aHP <= 0 && pHP > 0) {
        setSt("win");
        setLog((prev) => [
          ...prev,
          `You earned <b>` + pExp.toFixed(0) + `</b> EXP!`,
          `You earned <b>` + gld + `</b> Gold!`,
        ]);
      } else if (pHP <= 0) {
        setSt("lose");
      }
    }
  }, [aHP, pHP, st, p, a]);

  const aLvl = a?.lvl || 0;

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-blue-200 via-white to-green-100 flex items-center justify-center p-4">
      {st === "menu" && (
        <div className="max-w-md bg-white rounded-lg shadow-lg p-6 text-center">
          <h1 className="text-4xl font-bold mb-6 text-blue-600">Pok\u00e9mon Battle</h1>
          <p className="text-gray-600 mb-6">Choose a difficulty to start a battle</p>
          <div className="space-y-3">
            {(
              ["EASY", "NORMAL", "HARD"] as const
            ).map((d) => (
              <button
                key={d}
                onClick={() => startBattle(d)}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 transform hover:scale-105"
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {st === "choosePkm" && (
        <div className="max-w-2xl bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-3xl font-bold mb-6 text-blue-600">Choose Your Pok\u00e9mon</h2>
          <div className="mb-6">
            <input
              type="text"
              placeholder="Enter player Pok\u00e9mon name"
              value={pL}
              onChange={(e) => setPL(e.target.value.toLowerCase())}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mb-6">
            <input
              type="text"
              placeholder="Enter opponent Pok\u00e9mon name"
              value={aL}
              onChange={(e) => setAL(e.target.value.toLowerCase())}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => startBattle(dif)}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 transform hover:scale-105"
          >
            Start Battle
          </button>
        </div>
      )}

      {st === "battle" && p && a && (
        <div className="w-full max-w-4xl bg-white rounded-lg shadow-2xl overflow-hidden">
          <div className="grid grid-cols-2 gap-4 p-8 bg-gradient-to-b from-blue-100 to-green-100">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2 text-blue-600">
                {formatName(p.name)}
              </h2>
              <p className="text-gray-600">Lvl {p.lvl}</p>
              <div
                className="relative w-32 h-32 mx-auto mt-2 mb-4 bg-blue-200 rounded-lg flex items-center justify-center overflow-hidden"
                style={{
                  animation: pTm ? "b-atk-player 0.4s ease-in-out" : "b-idle 2s ease-in-out infinite",
                }}
              >
                <img
                  src={getPokemonImageUrl(p.id)}
                  alt={p.name}
                  className="max-w-full max-h-full"
                  style={{
                    animation: pHP <= 0 ? "b-faint 0.8s ease-in-out forwards" : "none",
                  }}
                />
              </div>
              <div className="mb-2">
                <div className="text-sm font-semibold text-gray-700">
                  HP: {Math.max(0, pHP)} / {pMaxHP}
                </div>
                <div className="w-full bg-gray-300 rounded-full h-6 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      pHP / pMaxHP > 0.5
                        ? "bg-green-500"
                        : pHP / pMaxHP > 0.25
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    style={{width: `${(pHP / pMaxHP) * 100}%`}}
                  />
                </div>
              </div>
              {pSt && (
                <div className="inline-block bg-purple-200 px-3 py-1 rounded-full text-sm font-bold text-purple-800 mb-2">
                  {pSt}
                </div>
              )}
            </div>

            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2 text-red-600">
                {formatName(a.name)}
              </h2>
              <p className="text-gray-600">Lvl {aLvl}</p>
              <div
                className="relative w-32 h-32 mx-auto mt-2 mb-4 bg-red-200 rounded-lg flex items-center justify-center overflow-hidden transform scale-x-[-1]"
                style={{
                  animation: aTm ? "b-atk-ai 0.4s ease-in-out" : "b-idle 2s ease-in-out infinite",
                }}
              >
                <img
                  src={getPokemonImageUrl(a.id)}
                  alt={a.name}
                  className="max-w-full max-h-full"
                  style={{
                    animation: aHP <= 0 ? "b-faint 0.8s ease-in-out forwards" : "none",
                  }}
                />
              </div>
              <div className="mb-2">
                <div className="text-sm font-semibold text-gray-700">
                  HP: {Math.max(0, aHP)} / {aMaxHP}
                </div>
                <div className="w-full bg-gray-300 rounded-full h-6 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      aHP / aMaxHP > 0.5
                        ? "bg-green-500"
                        : aHP / aMaxHP > 0.25
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    style={{width: `${(aHP / aMaxHP) * 100}%`}}
                  />
                </div>
              </div>
              {aSt && (
                <div className="inline-block bg-purple-200 px-3 py-1 rounded-full text-sm font-bold text-purple-800 mb-2">
                  {aSt}
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-100 p-4 border-t border-gray-300">
            <div
              ref={scrollRef}
              className="h-32 bg-white rounded border border-gray-300 p-3 overflow-y-auto text-sm"
            >
              {log.map((e, i) => (
                <p
                  key={i}
                  className="mb-1"
                  dangerouslySetInnerHTML={{__html: e}}
                />
              ))}
            </div>
          </div>

          <div className="p-6 bg-white">
            {pHP > 0 && aHP > 0 && (
              <div>
                <p className="text-center mb-4 font-semibold text-gray-700">
                  Choose an action:
                </p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {p.moves.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => pickMove(m)}
                      disabled={aBsy}
                      className={`py-2 px-3 rounded-lg font-bold text-sm transition duration-300 ${
                        aBsy
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-blue-500 hover:bg-blue-600 text-white hover:scale-105"
                      }`}
                    >
                      {formatName(m.name)} <br /> <span className="text-xs">{m.type}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {pHP <= 0 || aHP <= 0 ? (
              <div className="text-center">
                {aHP <= 0 ? (
                  <p className="text-lg font-bold text-green-600 mb-4">
                    Victory! You defeated {formatName(a.name)}!
                  </p>
                ) : (
                  <p className="text-lg font-bold text-red-600 mb-4">
                    Defeat! {formatName(p.name)} fainted!
                  </p>
                )}
                <button
                  onClick={() => {
                    setSt("menu");
                    setLog([]);
                  }}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300 transform hover:scale-105"
                >
                  Return to Menu
                </button>
              </div>
            ) : null}

            <button
              onClick={handleForfeit}
              className="w-full bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition duration-300 mt-4"
            >
              \u270D Forfeit
            </button>
          </div>
        </div>
      )}

      {st === "win" && (
        <div className="max-w-md bg-white rounded-lg shadow-lg p-6 text-center">
          <h1 className="text-4xl font-bold mb-4 text-green-600">Victory!</h1>
          <p className="text-gray-600 mb-6">You defeated {formatName(a.name)}!</p>
          <button
            onClick={() => {
              setSt("menu");
              setLog([]);
            }}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 transform hover:scale-105"
          >
            Return to Menu
          </button>
        </div>
      )}

      {st === "lose" && (
        <div className="max-w-md bg-white rounded-lg shadow-lg p-6 text-center">
          <h1 className="text-4xl font-bold mb-4 text-red-600">Defeat!</h1>
          <p className="text-gray-600 mb-6">You were defeated by {formatName(a.name)}!</p>
          <button
            onClick={() => {
              setSt("menu");
              setLog([]);
            }}
            className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 transform hover:scale-105"
          >
            Return to Menu
          </button>
        </div>
      )}
    </div>
  );
}