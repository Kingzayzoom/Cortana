import type { NextConfig } from "next";
// R3F 9.7's development StrictMode remount leaves its render root inactive.
// Explicit renderer teardown is covered by the orb browser harness.
const nextConfig: NextConfig = { reactStrictMode: false, devIndicators: false };
export default nextConfig;
