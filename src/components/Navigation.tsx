"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/dex", label: "Pok\u00e9Dex", icon: "\ud83d\udcd6", color: "#EAB308" },
  { href: "/team", label: "Team Builder", icon: "\u2694\ufe0f", color: "#22C55E" },
  { href: "/whos-that", label: "Who's That?", icon: "\u2753", color: "#EC4899" },
  { href: "/compare", label: "Compare", icon: "\u2696\ufe0f", color: "#818CF8" },
  { href: "/battle", label: "Battle", icon: "\ud83d\udca5", color: "#EF4444" },
  { href: "/items", label: "Items", icon: "\ud83c\udf92", color: "#F97316" },
  { href: "/favourites", label: "Favourites", icon: "\u2b50", color: "#EAB308" },
];

export default function Navigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#080810]/90 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-7 h-7 relative rounded-full overflow-hidden border-2 border-white/10 flex-shrink-0">
              <div className="absolute inset-0 bg-[#dc2626]" style={{ clipPath: "inset(0 0 50% 0)" }} />
              <div className="absolute inset-0 bg-[#111120]" style={{ clipPath: "inset(50% 0 0 0)" }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-[#111120] border-2 border-white/20" />
              </div>
            </div>
            <span className="text-xl font-bold">
              Pok\u00e9<span className="text-[#dc2626]">Verse</span>
            </span>
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(({ href, label, icon }) => {
              const active = pathname?.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-white/50 hover:text-white"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/5 bg-[#111120]">
          {navItems.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-6 py-4 text-sm font-medium border-b border-white/5 transition-colors ${
                pathname?.startsWith(href) ? "text-white bg-white/5" : "text-white/50 hover:text-white"
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
