import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";
import "./context.css";
import { Providers } from "./providers";
export const metadata: Metadata = {
  title: "Cortana — Your daily clinical conversation",
  description:
    "A moment to listen, think, and learn. A voice-first cardiology learning prototype with synthetic cases and visible evidence.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
