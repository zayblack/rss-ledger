import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Resource Ledger",
    template: "%s · Resource Ledger",
  },
  description:
    "Track stock, shipments, transport tax and supplier payouts for in-game resource trading.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
