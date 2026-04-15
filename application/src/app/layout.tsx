import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Itinerary Planner",
  description: "Plan your trip with AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}