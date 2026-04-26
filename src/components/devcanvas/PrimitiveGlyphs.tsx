// Wireframe primitive glyphs — small presentational components used by the
// Canvas to render list-row / card / map / segmented / stepper / bottom-bar
// in the recognizable wireframe-sheet style (mountain icon for images, etc.).

import type { CanvasNode } from "@/lib/scene";

const isHifi = (n: CanvasNode) => n.fidelity === "hifi";

const lineColor = (n: CanvasNode) =>
  isHifi(n) ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.18)";
const mutedColor = (n: CanvasNode) =>
  isHifi(n) ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
const surface = (n: CanvasNode) => (isHifi(n) ? "#2a2622" : "#ececec");

export const ImagePlaceholderGlyph = () => (
  <svg
    viewBox="0 0 100 60"
    preserveAspectRatio="none"
    className="h-full w-full"
    style={{ display: "block" }}
  >
    <rect width="100" height="60" fill="transparent" />
    {/* sun */}
    <circle cx="72" cy="18" r="5" fill="rgba(0,0,0,0.18)" />
    {/* mountains */}
    <path
      d="M 4 52 L 30 24 L 50 42 L 70 18 L 96 52 Z"
      fill="rgba(0,0,0,0.18)"
    />
  </svg>
);

export const ListRowGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const c = lineColor(node);
  return (
    <div
      className="flex h-full w-full items-center"
      style={{ padding: 10, gap: 12, color: isHifi(node) ? "#e9e4d8" : "#1a1a1a" }}
    >
      <div
        className="flex shrink-0 items-center justify-center"
        style={{
          width: Math.min(56, node.size.height - 12),
          height: Math.min(56, node.size.height - 12),
          background: surface(node),
          border: `1px solid ${c}`,
          borderRadius: 4,
        }}
      >
        <ImagePlaceholderGlyph />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="truncate" style={{ fontSize: 12, fontWeight: 600 }}>
          {d.title ?? node.content ?? "Item title"}
        </div>
        {d.meta && (
          <div className="truncate" style={{ fontSize: 10, color: mutedColor(node) }}>
            {d.meta}
          </div>
        )}
      </div>
      {d.trailing && (
        <div
          className="shrink-0"
          style={{ fontSize: 12, fontWeight: 600 }}
        >
          {d.trailing}
        </div>
      )}
    </div>
  );
};

export const CardGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const imageH = Math.max(48, Math.round(node.size.height * 0.55));
  const c = lineColor(node);
  return (
    <div className="flex h-full w-full flex-col">
      <div
        className="relative w-full"
        style={{
          height: imageH,
          background: surface(node),
          borderBottom: `1px solid ${c}`,
        }}
      >
        <ImagePlaceholderGlyph />
        {d.badge && (
          <span
            className="absolute left-2 top-2 rounded px-1.5 py-0.5"
            style={{
              fontSize: 9,
              fontWeight: 600,
              background: "#ee4f3a",
              color: "#fff",
              letterSpacing: 0.3,
            }}
          >
            {d.badge}
          </span>
        )}
      </div>
      <div
        className="flex flex-1 flex-col justify-center"
        style={{ padding: 8, gap: 2 }}
      >
        <div className="truncate" style={{ fontSize: 12, fontWeight: 600 }}>
          {d.title ?? node.content ?? "Card title"}
        </div>
        {d.meta && (
          <div className="truncate" style={{ fontSize: 10, color: mutedColor(node) }}>
            {d.meta}
          </div>
        )}
        {d.trailing && (
          <div style={{ fontSize: 11, fontWeight: 600 }}>{d.trailing}</div>
        )}
      </div>
    </div>
  );
};

export const MapBlockGlyph = () => (
  <svg
    viewBox="0 0 200 120"
    preserveAspectRatio="none"
    className="h-full w-full"
    style={{ display: "block" }}
  >
    <defs>
      <pattern
        id="mapgrid"
        width="20"
        height="20"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M 20 0 L 0 0 0 20"
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth="0.5"
        />
      </pattern>
    </defs>
    <rect width="200" height="120" fill="url(#mapgrid)" />
    {/* roads */}
    <path d="M 0 80 Q 60 60 120 90 T 200 70" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" fill="none" />
    <path d="M 40 0 L 80 120" stroke="rgba(0,0,0,0.12)" strokeWidth="1" fill="none" />
    {/* pin */}
    <circle cx="120" cy="62" r="6" fill="#ee4f3a" />
    <circle cx="120" cy="62" r="2" fill="#fff" />
  </svg>
);

export const SegmentedGlyph = ({ node }: { node: CanvasNode }) => {
  const opts = node.data?.options ?? ["Option A", "Option B"];
  const active = node.data?.active ?? 0;
  const c = lineColor(node);
  return (
    <div className="flex h-full w-full">
      {opts.map((o, i) => (
        <div
          key={i}
          className="flex flex-1 items-center justify-center truncate"
          style={{
            fontSize: 11,
            fontWeight: i === active ? 600 : 400,
            color: i === active ? (isHifi(node) ? "#e9e4d8" : "#1a1a1a") : mutedColor(node),
            borderRight: i < opts.length - 1 ? `1px solid ${c}` : undefined,
            background: i === active ? (isHifi(node) ? "#2a2622" : "#f7f7f7") : "transparent",
            padding: "0 6px",
          }}
        >
          {o}
        </div>
      ))}
    </div>
  );
};

export const BottomBarGlyph = ({ node }: { node: CanvasNode }) => {
  const opts = node.data?.options;
  if (opts && opts.length > 1) {
    const active = node.data?.active ?? 0;
    return (
      <div className="flex h-full w-full">
        {opts.map((o, i) => (
          <div
            key={i}
            className="flex flex-1 flex-col items-center justify-center"
            style={{
              fontSize: 10,
              color: i === active ? "#ee4f3a" : mutedColor(node),
              fontWeight: i === active ? 600 : 400,
              gap: 2,
            }}
          >
            <div
              className="rounded-full"
              style={{
                width: 16,
                height: 16,
                background: i === active ? "#ee4f3a" : surface(node),
              }}
            />
            <span className="truncate">{o}</span>
          </div>
        ))}
      </div>
    );
  }
  // Single CTA bar
  return (
    <div className="flex h-full w-full items-center justify-between" style={{ padding: 12 }}>
      <div className="flex flex-col">
        <span style={{ fontSize: 10, color: mutedColor(node) }}>Total</span>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{node.data?.meta ?? "₹680"}</span>
      </div>
      <div
        className="flex items-center justify-center rounded"
        style={{
          background: "#ee4f3a",
          color: "#fff",
          padding: "8px 18px",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {node.content ?? node.data?.title ?? "Place Order"}
      </div>
    </div>
  );
};

export const SidebarGlyph = ({ node }: { node: CanvasNode }) => {
  const opts = node.data?.options ?? ["My Profile", "Addresses", "Payment", "Notifications"];
  const active = node.data?.active ?? 0;
  return (
    <div className="flex h-full w-full flex-col" style={{ padding: 8, gap: 4 }}>
      {opts.map((o, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-sm"
          style={{
            padding: "8px 10px",
            fontSize: 11,
            background: i === active ? (isHifi(node) ? "#2a2622" : "#fef2f0") : "transparent",
            color: i === active ? "#ee4f3a" : mutedColor(node),
            fontWeight: i === active ? 600 : 400,
          }}
        >
          <span
            className="rounded-sm"
            style={{ width: 12, height: 12, background: mutedColor(node), opacity: 0.4 }}
          />
          <span className="truncate">{o}</span>
        </div>
      ))}
    </div>
  );
};

export const StepperGlyph = ({ node }: { node: CanvasNode }) => {
  const steps = node.data?.options ?? ["Order Placed", "Preparing", "Out for Delivery", "Delivered"];
  const active = node.data?.active ?? 1;
  const c = lineColor(node);
  return (
    <div className="flex h-full w-full items-center" style={{ padding: "0 4px" }}>
      {steps.map((s, i) => (
        <div key={i} className="flex flex-1 items-center">
          <div className="flex flex-col items-center" style={{ gap: 2 }}>
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 14,
                height: 14,
                background: i <= active ? "#ee4f3a" : "transparent",
                border: `1px solid ${i <= active ? "#ee4f3a" : c}`,
                color: "#fff",
                fontSize: 8,
                fontWeight: 700,
              }}
            >
              {i <= active ? "✓" : ""}
            </div>
            <span
              className="truncate"
              style={{
                fontSize: 8,
                color: i <= active ? (isHifi(node) ? "#e9e4d8" : "#1a1a1a") : mutedColor(node),
                maxWidth: 60,
              }}
            >
              {s}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="flex-1"
              style={{ height: 1, background: i < active ? "#ee4f3a" : c, marginBottom: 14 }}
            />
          )}
        </div>
      ))}
    </div>
  );
};
