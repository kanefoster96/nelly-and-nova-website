import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /**
     * Placeholder media is SVG, and a future Capacitor static export
     * (`output: "export"`) cannot use the Next image optimizer — so we serve
     * images unoptimized. next/image still lazy-loads by default. When real
     * raster media lands and the site stays server-rendered, you can drop this
     * and configure `remotePatterns` / optimization instead.
     */
    unoptimized: true,
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // When wrapping with Capacitor, add:  output: "export",
};

export default nextConfig;
