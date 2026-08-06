import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Resilience Estate Management Portal",
    short_name: "REMP",
    description: "Resilience Estate Management Portal",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0052CC",
    icons: [
      {
        src: "/icons/icon-1024.png",
        sizes: "1024x1024",
        type: "image/png",
      },
    ],
  };
}