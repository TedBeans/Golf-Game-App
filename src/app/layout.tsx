import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import Nav from "@/components/Nav";

export const metadata: Metadata = { title: "Golf Game", description: "Track golf gambling games, balances and who owes who." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0c1a12" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <div className="wrap">{children}</div>
          <Nav />
        </StoreProvider>
      </body>
    </html>
  );
}
