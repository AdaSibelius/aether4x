import type { Metadata } from "next";
import DebugConsole from "@/components/Debug/DebugConsole";
import DebugOverlay from "@/components/Debug/DebugOverlay";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aether 4x — Space Strategy",
  description: "A 4X space strategy game inspired by Aurora 4X",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <DebugConsole />
        <DebugOverlay />
      </body>
    </html>
  );
}
