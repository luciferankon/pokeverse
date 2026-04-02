"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

const features = [
  {
    href: "/dex",
    title: "PokéDex",
    subtitle: "Explorer",
    description:
      "Browse all 1025+ Pokémon. Search by name, filter by type, explore stats, evolution chains, and type matchups.",
    icon: "📖",
    color: "#EAB308",
    tags: ["1025+ Pokémon", "Type Filters", "Animated Stats", "Evo Chains"],
  },
  {
    href: "/team",
    title: "Team",
    subtitle: "Builder",
    description:
      "Assemble a perfect team of 6. Instantly see type coverage, shared weaknesses, and resistances.",
    icon: "⚔️",
    color: "#22C55E",
    tags: ["6-Slot Teams", "Type Coverage", "Weakness Analysis", "Resistance Chart"],
  },
  {
    href: "/whos-that",
    title: "Who's That",
    subtitle: "Pokémon?",
    description:
      "Test your Pokémon knowledge with silhouette challenges. All generations. Track your streak.",
    icon: "❓",
    color: "#EC4899",
    tags: ["All Generations", "Streak Tracker", "Timer Mode", "Instant Reveal"],
  },
];

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      a: number;
    }[] = Array.from({ length: 70 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.5 + 0.5,
      a: Math.random() * 0.35 + 0.05,
    }));

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x = (p.x + p.vx + canvas.width) % canvas.width;
        p.y = (p.y + p.vy + canvas.height) % canvas.height;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,38,38,${p.a})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none opacity-70"
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(220,38,38,0.08) 0%, transparent 55%)",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Hero */}
        <div className="text-center mb-24">
          {/* Pokéball */}
          <div className="flex justify-center mb-10">
            <div
              className="relative w-20 h-20"
              style={{ animation: "float 3s ease-in-out infinite" }}
            >
              <div
                className="w-full h-full rounded-full border-4 border-white/10 overflow-hidden relative"
                style={{ animation: "spin 10s linear infinite" }}
              >
                <div className="absolute inset-0 bg-[#dc2626]" style={{ clipPath: "inset(0 0 50% 0)" }} />
                <div className="absolute inset-0 bg-[#111120]" style={{ clipPath: "inset(50% 0 0 0)" }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-[#111120] border-4 border-white/15 z-10" />
                </div>
              </div>
            </div>
          </div>

          <h1 className="text-6xl sm:text-8xl font-black tracking-tight mb-6 leading-none">
            <span className="text-white">Poké</span>
            <span className="text-[#dc2626]">Verse</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/40 max-w-xl mx-auto leading-relaxed mb-10">
            The ultimate Pokémon companion. Explore, build, and test your
            knowledge across all generations.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/dex"
              className="px-8 py-3.5 bg-[#dc2626] hover:bg-[#ef4444] text-white font-semibold rounded-xl transition-colors"
            >
              Open PokéDex
            </Link>
            <Link
              href="/whos-that"
              className="px-8 py-3.5 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl border border-white/10 transition-colors"
            >
              Play Game
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-20">
          {features.map(({ href, title, subtitle, description, icon, color, tags }) => (
            <Link key={href} href={href} className="block">
              <div className="group relative rounded-2xl border border-white/5 bg-[#111120] p-6 hover:border-white/10 transition-all duration-300 hover:-translate-y-1 overflow-hidden h-full cursor-pointer">
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at 25% 25%, ${color}12, transparent 60%)`,
                  }}
                />

                <div className="relative">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xl mb-5"
                    style={{
                      backgroundColor: `${color}15`,
                      border: `1px solid ${color}30`,
                    }}
                  >
                    {icon}
                  </div>

                  <h2 className="text-xl font-bold text-white">{title}</h2>
                  <p className="text-sm font-medium mb-3" style={{ color }}>
                    {subtitle}
                  </p>
                  <p className="text-sm text-white/40 leading-relaxed mb-5">
                    {description}
                  </p>

                  <div className="grid grid-cols-2 gap-1.5">
                    {tags.map((tag) => (
                      <div
                        key={tag}
                        className="text-[11px] py-1 px-2 rounded-lg text-center font-medium"
                        style={{
                          backgroundColor: `${color}0f`,
                          color: `${color}bb`,
                          border: `1px solid ${color}20`,
                        }}
                      >
                        {tag}
                      </div>
                    ))}
                  </div>

                  <div
                    className="flex items-center gap-1.5 mt-5 text-sm font-medium group-hover:gap-2.5 transition-all"
                    style={{ color }}
                  >
                    Explore <span>→</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-white/20 text-xs">
          Data from{" "}
          <a
            href="https://pokeapi.co"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white/40 transition-colors"
          >
            PokéAPI
          </a>{" "}
          · Fan project, not affiliated with Nintendo or The Pokémon Company
        </p>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}