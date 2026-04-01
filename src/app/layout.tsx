import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "PokéVerse — Explore, Build, Discover",
  description:
    "A professional Pokémon companion app. PokéDex Explorer, Team Builder, and Who's That Pokémon.",
  openGraph: {
    title: "PokéVerse",
    description: "Explore 1000+ Pokémon, build teams, test your knowledge.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#080810] text-white antialiased">
        <Navigation />
        <main className="pt-16 min-h-screen">{children}</main>
      </body>
    </html>
  );
}