import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: 240,
            height: 240,
            borderRadius: 120,
            border: "22px solid #4ade80",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              marginLeft: 16,
              borderTop: "42px solid transparent",
              borderBottom: "42px solid transparent",
              borderLeft: "70px solid #4ade80",
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
