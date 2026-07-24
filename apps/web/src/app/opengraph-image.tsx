import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Jeevons Eya — Développeur web";

// Satori ne compile pas Tailwind : styles inline uniquement, et `display: flex`
// explicite sur tout conteneur ayant plusieurs enfants.
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        backgroundColor: "#111827",
        padding: "80px",
      }}
    >
      <div
        style={{
          display: "flex",
          width: "120px",
          height: "8px",
          borderRadius: "9999px",
          backgroundImage: "linear-gradient(to right, #6ee7b7, #38bdf8)",
        }}
      />
      <div
        style={{
          display: "flex",
          marginTop: "48px",
          fontSize: "76px",
          fontWeight: 700,
          color: "#ffffff",
          letterSpacing: "-0.02em",
        }}
      >
        Jeevons Eya
      </div>
      <div
        style={{
          display: "flex",
          marginTop: "16px",
          fontSize: "44px",
          backgroundImage: "linear-gradient(to right, #6ee7b7, #38bdf8)",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        Développeur web
      </div>
      <div
        style={{
          display: "flex",
          marginTop: "40px",
          fontSize: "30px",
          color: "rgba(255, 255, 255, 0.6)",
        }}
      >
        Projets · Parcours · Compétences
      </div>
    </div>,
    { ...size },
  );
}
