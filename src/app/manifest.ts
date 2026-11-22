import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Baaki: tuition fee tracker",
    short_name: "Baaki",
    description: "Who owes, what's coming, and a clerk that chases for you.",
    start_url: "/home",
    display: "standalone",
    background_color: "#0E0E0E",
    theme_color: "#0E0E0E",
    share_target: {
      action: "/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", url: "url", files: [{ name: "file", accept: ["text/plain", ".txt", "image/*"] }] },
    },
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
