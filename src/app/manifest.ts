import type { MetadataRoute } from "next";

// Icon file names are versioned (remp-*) so installed apps pick up new artwork
// instead of reusing a cached copy of an old icon at the same URL.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Resilience Estate Management Portal",
    short_name: "REMP",
    description: "Resilience Estate Management Portal",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0b2219",
    theme_color: "#0b2219",
    icons: [
      { src: "/icons/remp-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/remp-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/remp-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
