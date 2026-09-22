import type { NextConfig } from "next";

// Baseline hardening for every response. No Content-Security-Policy yet: the
// ElevenLabs SDK (WebRTC, worklets) and the WebGL orb need a policy tested
// against a live session, which a header added blind would silently break.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // The page itself asks for the microphone; nothing embedded may.
  {
    key: "Permissions-Policy",
    value: "microphone=(self), camera=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  // R3F 9.7's development StrictMode remount leaves its render root inactive.
  // Explicit renderer teardown is covered by the orb browser harness.
  reactStrictMode: false,
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
