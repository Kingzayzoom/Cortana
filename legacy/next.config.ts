import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // StrictMode's dev-only unmount/remount makes React Three Fiber force-lose the
  // orb's WebGL context on the remounted canvas, leaving the orb blank in
  // `next dev`. Production is unaffected either way.
  reactStrictMode: false,
}

export default nextConfig
