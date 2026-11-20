import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import Nav from "@/components/Nav";

export const metadata: Metadata = { title: "Press · golf games", description: "Run the bets on the course. Sixes, Nassau, skins, wolf and more, with the money settled for you." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#09090b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <div className="app">{children}</div>
          <Nav />
        </StoreProvider>
      </body>
    </html>
  );
}
