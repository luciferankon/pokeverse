// ── Battle Engine ─────────────────────────────────────────────────────
// Pure logic: type chart, damage calc, AI, status effects

export type StatusEffect = "burn" | "paralyze" | "poison" | "sleep" | "freeze" | null;
export type Difficulty = "easy" | "normal" | "hard";

export interface BattleMove {
  name: string;
  type: string;
  damageClass: string; // physical | special | status
  power: number | null;
  accuracy: number | null;
  pp: number;
  maxPp: number;
  priority: number;
}

export interface BattlePokemon {
  id: number;
  name: string;
  types: string[];
  stats: { hp: number; attack: number; defense: number; spAtk: number; spDef: number; speed: number };
  currentHp: number;
  maxHp: number;
  moves: BattleMove[];
  status: StatusEffect;
  statusTurns: number;
  sprite: string;
  isPlayer: boolean;
}

// ── 18×18 Type Chart (only non-1.0x entries) ────────────────────────
const TYPE_CHART: Record<string, Record<string, number>> = {
  normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice:      { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground:   { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug:      { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy:    { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

// ── Helpers ──────────────────────────────────────────────────────────

export function getTypeEffectiveness(moveType: string, defenderTypes: string[]): number {
  let eff = 1;
  for (const dt of defenderTypes) {
    const chart = TYPE_CHART[moveType];
    if (chart && chart[dt] !== undefined) {
      eff *= chart[dt];
    }
  }
  return eff;
}

/** Level 50, IV=31, EV=0 HP */
export function calcHp(base: number): number {
  return Math.floor(((2 * base + 31) * 50) / 100) + 50 + 10;
}

/** Level 50, IV=31, EV=0, neutral nature stat */
export function calcStat(base: number): number {
  return Math.floor(((2 * base + 31) * 50) / 100) + 5;
}

export function getEffectiveSpeed(pokemon: BattlePokemon): number {
  let spd = pokemon.stats.speed;
  if (pokemon.status === "paralyze") spd = Math.floor(spd / 2);
  return spd;
}

// ── Damage Calculation (Gen V+ formula) ──────────────────────────────

export interface DamageResult {
  damage: number;
  effectiveness: number;
  isCrit: boolean;
  message: string;
}

export function calculateDamage(
  attacker: BattlePokemon,
  defender: BattlePokemon,
  move: BattleMove
): DamageResult {
  if (move.damageClass === "status" || !move.power) {
    return { damage: 0, effectiveness: 1, isCrit: false, message: "" };
  }

  const level = 50;
  const power = move.power;

  // Physical vs Special
  let A: number, D: number;
  if (move.damageClass === "physical") {
    A = attacker.stats.attack;
    D = defender.stats.defense;
  } else {
    A = attacker.stats.spAtk;
    D = defender.stats.spDef;
  }

  // Burn halves physical attack
  if (attacker.status === "burn" && move.damageClass === "physical") {
    A = Math.floor(A / 2);
  }

  // Critical hit: 1/16 chance, 1.5x multiplier
  const isCrit = Math.random() < 1 / 16;
  const crit = isCrit ? 1.5 : 1;

  // STAB
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;

  // Type effectiveness
  const effectiveness = getTypeEffectiveness(move.type, defender.types);

  // Random factor 0.85 - 1.0
  const random = 0.85 + Math.random() * 0.15;

  // Gen V+ formula
  const baseDmg = Math.floor(
    Math.floor(
      Math.floor((2 * level / 5 + 2) * power * A / D) / 50
    ) + 2
  );

  const finalDmg = Math.max(1, Math.floor(baseDmg * stab * effectiveness * crit * random));

  let message = "";
  if (effectiveness === 0) message = "It had no effect...";
  else if (effectiveness >= 4) message = "It's extremely effective!";
  else if (effectiveness >= 2) message = "It's super effective!";
  else if (effectiveness <= 0.25) message = "It's barely effective...";
  else if (effectiveness < 1) message = "It's not very effective...";
  if (isCrit && effectiveness > 0) message = (message ? message + " " : "") + "A critical hit!";

  return { damage: effectiveness === 0 ? 0 : finalDmg, effectiveness, isCrit, message };
}

// ── Accuracy Check ───────────────────────────────────────────────────

export function checkAccuracy(move: BattleMove): boolean {
  if (!move.accuracy) return true; // moves with null accuracy always hit
  return Math.random() * 100 < move.accuracy;
}

// ── Status Effects ───────────────────────────────────────────────────

export function applyStatusDamage(pokemon: BattlePokemon): { damage: number; message: string } | null {
  if (pokemon.status === "burn") {
    const dmg = Math.max(1, Math.floor(pokemon.maxHp / 16));
    return { damage: dmg, message: `${formatName(pokemon.name)} is hurt by its burn!` };
  }
  if (pokemon.status === "poison") {
    const dmg = Math.max(1, Math.floor(pokemon.maxHp / 8));
    return { damage: dmg, message: `${formatName(pokemon.name)} is hurt by poison!` };
  }
  return null;
}

export function checkStatusBlock(pokemon: BattlePokemon): { blocked: boolean; message: string; cured: boolean } {
  if (pokemon.status === "paralyze" && Math.random() < 0.25) {
    return { blocked: true, message: `${formatName(pokemon.name)} is paralyzed! It can't move!`, cured: false };
  }
  if (pokemon.status === "sleep") {
    if (pokemon.statusTurns <= 0) {
      return { blocked: false, message: `${formatName(pokemon.name)} woke up!`, cured: true };
    }
    return { blocked: true, message: `${formatName(pokemon.name)} is fast asleep...`, cured: false };
  }
  if (pokemon.status === "freeze") {
    if (Math.random() < 0.2) {
      return { blocked: false, message: `${formatName(pokemon.name)} thawed out!`, cured: true };
    }
    return { blocked: true, message: `${formatName(pokemon.name)} is frozen solid!`, cured: false };
  }
  return { blocked: false, message: "", cured: false };
}

// ── AI Move Selection ────────────────────────────────────────────────

export function aiSelectMove(
  ai: BattlePokemon,
  player: BattlePokemon,
  difficulty: Difficulty
): BattleMove {
  const usable = ai.moves.filter((m) => m.pp > 0);
  if (usable.length === 0) {
    // Struggle equivalent
    return { name: "Struggle", type: "normal", damageClass: "physical", power: 50, accuracy: null, pp: 1, maxPp: 1, priority: 0 };
  }

  if (difficulty === "easy") {
    return usable[Math.floor(Math.random() * usable.length)];
  }

  // Score each move
  const scored = usable.map((m) => {
    let score = 0;
    if (m.power) {
      const eff = getTypeEffectiveness(m.type, player.types);
      const stab = ai.types.includes(m.type) ? 1.5 : 1;
      score = m.power * eff * stab;

      // Hard: bonus for finishing moves
      if (difficulty === "hard") {
        const est = (m.power * stab * eff) / 3; // rough estimate
        if (est >= player.currentHp) score *= 2;
      }
    } else {
      score = 30; // status moves get a base score
    }
    return { move: m, score };
  });

  scored.sort((a, b) => b.score - a.score);

  if (difficulty === "hard") {
    return scored[0].move;
  }

  // Normal: weighted random from top 3
  const top = scored.slice(0, 3);
  const total = top.reduce((s, t) => s + t.score, 0);
  if (total === 0) return top[0].move;
  let r = Math.random() * total;
  for (const t of top) {
    r -= t.score;
    if (r <= 0) return t.move;
  }
  return top[0].move;
}

// ── Name formatting ──────────────────────────────────────────────────

export function formatName(name: string): string {
  return name
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
