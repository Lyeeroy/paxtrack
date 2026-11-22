import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            border: "9px solid #4ade80",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              marginLeft: 7,
              borderTop: "18px solid transparent",
              borderBottom: "18px solid transparent",
              borderLeft: "30px solid #4ade80",
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
