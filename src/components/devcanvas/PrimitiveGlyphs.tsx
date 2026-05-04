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
  const thumbSize = Math.min(56, node.size.height - 16);
  return (
    <div
      className="flex h-full w-full items-center"
      style={{ padding: 12, gap: 12, color: isHifi(node) ? "#e9e4d8" : "#1a1a1a" }}
    >
      <div
        className="flex shrink-0 items-center justify-center overflow-hidden"
        style={{
          width: thumbSize,
          height: thumbSize,
          background: surface(node),
          border: `1px solid ${c}`,
          borderRadius: 6,
        }}
      >
        {d.glyph ? (
          <span style={{ fontSize: thumbSize * 0.45, lineHeight: 1 }}>{d.glyph}</span>
        ) : (
          <ImagePlaceholderGlyph />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 2 }}>
        <div
          className="line-clamp-1"
          style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.25 }}
        >
          {d.title ?? node.content ?? "Item title"}
        </div>
        {d.meta && (
          <div
            className="line-clamp-2"
            style={{ fontSize: 11, color: mutedColor(node), lineHeight: 1.35 }}
          >
            {d.meta}
          </div>
        )}
      </div>
      {d.trailing && (
        <div
          className="shrink-0 text-right"
          style={{ fontSize: 13, fontWeight: 600, maxWidth: 90 }}
        >
          {d.trailing}
        </div>
      )}
    </div>
  );
};

export const CardGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const imageH = Math.max(72, Math.round(node.size.height * 0.55));
  const c = lineColor(node);
  return (
    <div className="flex h-full w-full flex-col">
      <div
        className="relative w-full overflow-hidden"
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
              fontWeight: 700,
              background: "#ee4f3a",
              color: "#fff",
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            {d.badge}
          </span>
        )}
        {d.trailing && (
          <span
            className="absolute right-2 top-2 rounded-full px-2 py-0.5"
            style={{
              fontSize: 11,
              fontWeight: 700,
              background: "rgba(255,255,255,0.95)",
              color: "#1a1a1a",
            }}
          >
            {d.trailing}
          </span>
        )}
      </div>
      <div
        className="flex flex-1 flex-col justify-center"
        style={{ padding: 10, gap: 3 }}
      >
        <div
          className="line-clamp-2"
          style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.25 }}
        >
          {d.title ?? node.content ?? "Card title"}
        </div>
        {d.meta && (
          <div
            className="line-clamp-2"
            style={{ fontSize: 10, color: mutedColor(node), lineHeight: 1.3 }}
          >
            {d.meta}
          </div>
        )}
        {typeof d.rating === "number" && (
          <div className="flex items-center gap-1" style={{ fontSize: 10 }}>
            <span style={{ color: "#f5a623" }}>★</span>
            <span style={{ fontWeight: 600 }}>{d.rating.toFixed(1)}</span>
            {d.reviews && <span style={{ color: mutedColor(node) }}>({d.reviews})</span>}
          </div>
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

// ─────────────────────────────────────────────────────────────────────────
// Richer primitives: KPI, slider, progress, rating, avatar-stack, tag,
// toggle/checkbox rows, sparkline charts. All read from node.data.
// ─────────────────────────────────────────────────────────────────────────

export const KpiCardGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const trend = d.trend ?? "up";
  const trendColor =
    trend === "down" ? "#dc2626" : trend === "flat" ? mutedColor(node) : "#16a34a";
  const arrow = trend === "down" ? "↓" : trend === "flat" ? "→" : "↑";
  return (
    <div
      className="flex h-full w-full flex-col justify-between"
      style={{ padding: 12, color: isHifi(node) ? "#e9e4d8" : "#1a1a1a" }}
    >
      <div className="flex items-center gap-1.5" style={{ fontSize: 10, color: mutedColor(node), fontWeight: 500, letterSpacing: 0.4, textTransform: "uppercase" }}>
        {d.glyph && <span style={{ fontSize: 12 }}>{d.glyph}</span>}
        <span className="line-clamp-1">{d.title ?? node.content ?? "Metric"}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.4 }}>
        {d.trailing ?? d.value ?? "—"}
      </div>
      <div className="flex items-center gap-1.5" style={{ fontSize: 10 }}>
        {d.delta && (
          <span style={{ color: trendColor, fontWeight: 600 }}>
            {arrow} {d.delta}
          </span>
        )}
        {d.meta && <span style={{ color: mutedColor(node) }}>{d.meta}</span>}
      </div>
    </div>
  );
};

export const SliderGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const value = Math.max(0, Math.min(100, d.value ?? 40));
  const c = lineColor(node);
  return (
    <div
      className="flex h-full w-full flex-col justify-center"
      style={{ padding: "8px 4px", gap: 6, color: isHifi(node) ? "#e9e4d8" : "#1a1a1a" }}
    >
      {(d.title || d.trailing) && (
        <div className="flex items-center justify-between" style={{ fontSize: 11 }}>
          <span style={{ fontWeight: 500 }}>{d.title ?? "Range"}</span>
          <span style={{ fontWeight: 600 }}>{d.trailing ?? `${value}%`}</span>
        </div>
      )}
      <div className="relative w-full" style={{ height: 4, background: c, borderRadius: 999 }}>
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ width: `${value}%`, background: "#ee4f3a" }}
        />
        <div
          className="absolute -top-1.5 rounded-full"
          style={{
            left: `calc(${value}% - 7px)`,
            width: 14,
            height: 14,
            background: "#fff",
            border: `2px solid #ee4f3a`,
            boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
          }}
        />
      </div>
      {(d.min || d.max) && (
        <div className="flex items-center justify-between" style={{ fontSize: 9, color: mutedColor(node) }}>
          <span>{d.min ?? "0"}</span>
          <span>{d.max ?? "100"}</span>
        </div>
      )}
    </div>
  );
};

export const ProgressGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const value = Math.max(0, Math.min(100, d.value ?? 60));
  const c = lineColor(node);
  return (
    <div
      className="flex h-full w-full flex-col justify-center"
      style={{ gap: 4, color: isHifi(node) ? "#e9e4d8" : "#1a1a1a" }}
    >
      {(d.title || d.trailing) && (
        <div className="flex items-center justify-between" style={{ fontSize: 11 }}>
          <span style={{ fontWeight: 500 }}>{d.title ?? "Progress"}</span>
          <span style={{ fontWeight: 600 }}>{d.trailing ?? `${value}%`}</span>
        </div>
      )}
      <div className="w-full" style={{ height: 6, background: c, borderRadius: 999 }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${value}%`, background: "#ee4f3a" }}
        />
      </div>
    </div>
  );
};

export const RatingGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const r = Math.max(0, Math.min(5, d.rating ?? 4.5));
  const full = Math.floor(r);
  const half = r - full >= 0.5;
  return (
    <div
      className="flex h-full w-full items-center"
      style={{ gap: 4, color: isHifi(node) ? "#e9e4d8" : "#1a1a1a" }}
    >
      <div className="flex" style={{ color: "#f5a623", fontSize: 13, letterSpacing: 1 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i}>{i < full ? "★" : i === full && half ? "⯨" : "☆"}</span>
        ))}
      </div>
      <span style={{ fontSize: 12, fontWeight: 700 }}>{r.toFixed(1)}</span>
      {d.reviews != null && (
        <span style={{ fontSize: 10, color: mutedColor(node) }}>
          ({d.reviews.toLocaleString?.() ?? d.reviews})
        </span>
      )}
    </div>
  );
};

export const AvatarStackGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const count = d.count ?? 4;
  const visible = Math.min(4, count);
  const palette = ["#ee4f3a", "#f5a623", "#3b82f6", "#16a34a", "#a855f7"];
  return (
    <div className="flex h-full w-full items-center" style={{ gap: 6 }}>
      <div className="flex">
        {Array.from({ length: visible }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-center rounded-full"
            style={{
              width: 24,
              height: 24,
              background: palette[i % palette.length],
              border: "2px solid #fff",
              marginLeft: i === 0 ? 0 : -8,
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {String.fromCharCode(65 + i)}
          </div>
        ))}
      </div>
      {(count > visible || d.meta) && (
        <span style={{ fontSize: 11, color: mutedColor(node) }}>
          {count > visible ? `+${count - visible} ${d.meta ?? "more"}` : d.meta}
        </span>
      )}
    </div>
  );
};

export const TagGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const tone = d.tone ?? "neutral";
  const palette: Record<string, { bg: string; fg: string }> = {
    success: { bg: "#dcfce7", fg: "#15803d" },
    warning: { bg: "#fef3c7", fg: "#a16207" },
    danger: { bg: "#fee2e2", fg: "#b91c1c" },
    info: { bg: "#dbeafe", fg: "#1d4ed8" },
    neutral: { bg: "#f1f5f9", fg: "#475569" },
  };
  const { bg, fg } = palette[tone];
  return (
    <div
      className="flex h-full w-full items-center justify-center rounded-full"
      style={{
        background: bg,
        color: fg,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        padding: "0 8px",
      }}
    >
      <span className="truncate">{d.title ?? node.content ?? "Tag"}</span>
    </div>
  );
};

export const ToggleRowGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const on = d.on ?? true;
  return (
    <div
      className="flex h-full w-full items-center justify-between"
      style={{ padding: "10px 12px", gap: 12, color: isHifi(node) ? "#e9e4d8" : "#1a1a1a" }}
    >
      <div className="flex min-w-0 flex-col" style={{ gap: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }} className="line-clamp-1">
          {d.title ?? node.content ?? "Setting"}
        </span>
        {d.meta && (
          <span style={{ fontSize: 10, color: mutedColor(node) }} className="line-clamp-2">
            {d.meta}
          </span>
        )}
      </div>
      <div
        className="shrink-0 rounded-full"
        style={{
          width: 32,
          height: 18,
          background: on ? "#ee4f3a" : "#cbd5e1",
          padding: 2,
          transition: "background 120ms",
        }}
      >
        <div
          className="rounded-full"
          style={{
            width: 14,
            height: 14,
            background: "#fff",
            transform: on ? "translateX(14px)" : "translateX(0)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
          }}
        />
      </div>
    </div>
  );
};

export const CheckboxRowGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const checked = d.checked ?? false;
  return (
    <div
      className="flex h-full w-full items-center"
      style={{ padding: "10px 12px", gap: 12, color: isHifi(node) ? "#e9e4d8" : "#1a1a1a" }}
    >
      <div
        className="flex shrink-0 items-center justify-center rounded"
        style={{
          width: 18,
          height: 18,
          background: checked ? "#ee4f3a" : "transparent",
          border: `1.5px solid ${checked ? "#ee4f3a" : lineColor(node)}`,
          color: "#fff",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {checked ? "✓" : ""}
      </div>
      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }} className="line-clamp-1">
          {d.title ?? node.content ?? "Option"}
        </span>
        {d.meta && (
          <span style={{ fontSize: 10, color: mutedColor(node) }} className="line-clamp-2">
            {d.meta}
          </span>
        )}
      </div>
      {d.trailing && (
        <span style={{ fontSize: 12, fontWeight: 600 }}>{d.trailing}</span>
      )}
    </div>
  );
};

const defaultSeries = (n = 12) =>
  Array.from({ length: n }).map((_, i) => 30 + Math.round(Math.sin(i * 0.7) * 25 + i * 3));

export const ChartBarGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const series = d.series ?? defaultSeries(10);
  const max = Math.max(...series, 1);
  const c = lineColor(node);
  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ padding: 10, gap: 8, color: isHifi(node) ? "#e9e4d8" : "#1a1a1a" }}
    >
      {(d.title || d.trailing) && (
        <div className="flex items-center justify-between" style={{ fontSize: 11 }}>
          <span style={{ fontWeight: 600 }}>{d.title ?? "Chart"}</span>
          {d.trailing && <span style={{ color: mutedColor(node) }}>{d.trailing}</span>}
        </div>
      )}
      <div className="flex flex-1 items-end" style={{ gap: 4 }}>
        {series.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm"
            style={{
              height: `${(v / max) * 100}%`,
              background: i === series.length - 1 ? "#ee4f3a" : c,
              minHeight: 4,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export const ChartLineGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const series = d.series ?? defaultSeries(16);
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const range = max - min || 1;
  const w = 200;
  const h = 80;
  const points = series.map((v, i) => {
    const x = (i / (series.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const path = `M ${points.join(" L ")}`;
  const area = `${path} L ${w},${h} L 0,${h} Z`;
  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ padding: 10, gap: 6, color: isHifi(node) ? "#e9e4d8" : "#1a1a1a" }}
    >
      {(d.title || d.trailing) && (
        <div className="flex items-center justify-between" style={{ fontSize: 11 }}>
          <span style={{ fontWeight: 600 }}>{d.title ?? "Trend"}</span>
          {d.trailing && <span style={{ color: mutedColor(node), fontWeight: 600 }}>{d.trailing}</span>}
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full" style={{ flex: 1, minHeight: 0 }}>
        <path d={area} fill="rgba(238,79,58,0.12)" />
        <path d={path} fill="none" stroke="#ee4f3a" strokeWidth={1.5} />
        {points.length > 0 && (() => {
          const [lx, ly] = points[points.length - 1].split(",").map(Number);
          return <circle cx={lx} cy={ly} r={2.5} fill="#ee4f3a" />;
        })()}
      </svg>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// New structured-data primitives
// ─────────────────────────────────────────────────────────────────────────

export const TableGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const cols = d.columns ?? ["Name", "Status", "Amount", "Date"];
  const rows = d.rows ?? [
    ["Acme Corp", "Paid", "$2,400", "Mar 12"],
    ["Globex", "Pending", "$1,180", "Mar 11"],
    ["Initech", "Paid", "$890", "Mar 10"],
    ["Umbrella", "Failed", "$540", "Mar 09"],
    ["Stark Ind", "Paid", "$3,200", "Mar 08"],
  ];
  const c = lineColor(node);
  const txt = isHifi(node) ? "#e9e4d8" : "#1a1a1a";
  return (
    <div className="flex h-full w-full flex-col overflow-hidden" style={{ color: txt }}>
      <div
        className="flex w-full items-center"
        style={{
          padding: "8px 10px",
          borderBottom: `1px solid ${c}`,
          background: isHifi(node) ? "#15120f" : "#fafafa",
          fontSize: 9,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: mutedColor(node),
          gap: 8,
        }}
      >
        {cols.map((h, i) => (
          <span key={i} className="flex-1 truncate">{h}</span>
        ))}
      </div>
      <div className="flex-1">
        {rows.map((r, ri) => (
          <div
            key={ri}
            className="flex w-full items-center"
            style={{
              padding: "6px 10px",
              borderBottom: ri < rows.length - 1 ? `1px solid ${c}` : "none",
              fontSize: 11,
              gap: 8,
            }}
          >
            {r.map((cell, ci) => {
              const status = /paid|active|success/i.test(cell)
                ? { bg: "#dcfce7", fg: "#15803d" }
                : /pending|warning/i.test(cell)
                ? { bg: "#fef3c7", fg: "#a16207" }
                : /failed|danger|error/i.test(cell)
                ? { bg: "#fee2e2", fg: "#b91c1c" }
                : null;
              return (
                <span key={ci} className="flex-1 truncate" style={{ fontWeight: ci === 0 ? 600 : 400 }}>
                  {status ? (
                    <span
                      className="rounded-full"
                      style={{
                        background: status.bg,
                        color: status.fg,
                        padding: "2px 8px",
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}
                    >
                      {cell}
                    </span>
                  ) : (
                    cell
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export const CalendarGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const month = d.month ?? "March 2026";
  const today = d.today ?? 12;
  const marked = d.marked ?? [3, 8, 14, 18, 22, 27];
  const c = lineColor(node);
  const days = Array.from({ length: 35 }).map((_, i) => i - 2); // start offset
  return (
    <div className="flex h-full w-full flex-col" style={{ padding: 10, gap: 6, color: isHifi(node) ? "#e9e4d8" : "#1a1a1a" }}>
      <div className="flex items-center justify-between" style={{ fontSize: 11, fontWeight: 600 }}>
        <span>{month}</span>
        <span style={{ color: mutedColor(node), fontSize: 14 }}>‹ ›</span>
      </div>
      <div className="grid grid-cols-7" style={{ fontSize: 8, color: mutedColor(node), fontWeight: 600, textTransform: "uppercase" }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="text-center">{d}</span>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7" style={{ gap: 2 }}>
        {days.map((day, i) => {
          const isValid = day > 0 && day <= 31;
          const isToday = day === today;
          const isMarked = marked.includes(day);
          return (
            <div
              key={i}
              className="flex items-center justify-center rounded-full"
              style={{
                fontSize: 10,
                fontWeight: isToday ? 700 : 400,
                background: isToday ? "#ee4f3a" : "transparent",
                color: isToday ? "#fff" : !isValid ? "transparent" : isMarked ? "#ee4f3a" : "inherit",
                border: isMarked && !isToday ? `1px solid #ee4f3a` : "none",
                aspectRatio: "1",
              }}
            >
              {isValid ? day : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const TimelineGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const events = d.events ?? [
    { title: "Order placed", meta: "Mar 12 · 2:30 PM", tone: "success" as const },
    { title: "Payment confirmed", meta: "Mar 12 · 2:31 PM", tone: "success" as const },
    { title: "Preparing shipment", meta: "Mar 12 · 4:10 PM", tone: "info" as const },
    { title: "Out for delivery", meta: "Mar 13 · 9:00 AM", tone: "warning" as const },
  ];
  const palette = { success: "#16a34a", warning: "#f5a623", danger: "#b91c1c", info: "#3b82f6", neutral: "#94a3b8" };
  const c = lineColor(node);
  return (
    <div className="flex h-full w-full flex-col" style={{ padding: 12, gap: 10, color: isHifi(node) ? "#e9e4d8" : "#1a1a1a" }}>
      {events.map((e, i) => (
        <div key={i} className="relative flex items-start" style={{ gap: 10 }}>
          <div className="relative flex shrink-0 flex-col items-center" style={{ width: 12 }}>
            <div
              className="rounded-full"
              style={{ width: 10, height: 10, background: palette[e.tone ?? "info"], border: "2px solid #fff" }}
            />
            {i < events.length - 1 && (
              <div className="absolute" style={{ top: 12, bottom: -16, width: 1, background: c }} />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 1 }}>
            <span style={{ fontSize: 11, fontWeight: 600 }} className="line-clamp-1">{e.title}</span>
            {e.meta && <span style={{ fontSize: 10, color: mutedColor(node) }}>{e.meta}</span>}
          </div>
        </div>
      ))}
    </div>
  );
};

export const BreadcrumbGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const trail = d.trail ?? ["Home", "Projects", "DevCanvas"];
  return (
    <div className="flex h-full w-full items-center truncate" style={{ fontSize: 11, gap: 6, color: mutedColor(node) }}>
      {trail.map((t, i) => (
        <span key={i} className="flex items-center" style={{ gap: 6 }}>
          <span style={{ color: i === trail.length - 1 ? (isHifi(node) ? "#e9e4d8" : "#1a1a1a") : mutedColor(node), fontWeight: i === trail.length - 1 ? 600 : 400 }}>
            {t}
          </span>
          {i < trail.length - 1 && <span style={{ opacity: 0.5 }}>›</span>}
        </span>
      ))}
    </div>
  );
};

export const TabsGlyph = ({ node }: { node: CanvasNode }) => {
  const opts = node.data?.options ?? ["Overview", "Activity", "Settings"];
  const active = node.data?.active ?? 0;
  const c = lineColor(node);
  return (
    <div className="flex h-full w-full items-end" style={{ borderBottom: `1px solid ${c}`, gap: 4 }}>
      {opts.map((o, i) => (
        <div
          key={i}
          className="relative flex items-center justify-center"
          style={{
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: i === active ? 600 : 400,
            color: i === active ? (isHifi(node) ? "#e9e4d8" : "#1a1a1a") : mutedColor(node),
          }}
        >
          {o}
          {i === active && (
            <div className="absolute" style={{ bottom: -1, left: 8, right: 8, height: 2, background: "#ee4f3a", borderRadius: 2 }} />
          )}
        </div>
      ))}
    </div>
  );
};

export const SearchBarGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  return (
    <div className="flex h-full w-full items-center" style={{ padding: "0 12px", gap: 10, color: isHifi(node) ? "#e9e4d8" : "#1a1a1a" }}>
      <span style={{ fontSize: 14, opacity: 0.5 }}>⌕</span>
      <span className="flex-1 truncate" style={{ fontSize: 12, color: mutedColor(node) }}>
        {d.title ?? node.content ?? "Search anything…"}
      </span>
      {d.trailing && (
        <span
          className="rounded"
          style={{ fontSize: 10, fontWeight: 600, padding: "3px 6px", background: lineColor(node), color: mutedColor(node) }}
        >
          {d.trailing}
        </span>
      )}
    </div>
  );
};

export const NotificationGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const tone = d.tone ?? "info";
  const palette: Record<string, string> = { success: "#16a34a", warning: "#f5a623", danger: "#b91c1c", info: "#3b82f6", neutral: "#94a3b8" };
  const dot = palette[tone];
  return (
    <div className="flex h-full w-full items-start" style={{ padding: 12, gap: 10, color: isHifi(node) ? "#e9e4d8" : "#1a1a1a" }}>
      <div
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{ width: 28, height: 28, background: dot + "22", color: dot, fontSize: 14 }}
      >
        {d.glyph ?? "🔔"}
      </div>
      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 1 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }} className="line-clamp-1">{d.title ?? "Notification"}</span>
        {d.meta && <span style={{ fontSize: 10, color: mutedColor(node) }} className="line-clamp-2">{d.meta}</span>}
      </div>
      {d.trailing && <span style={{ fontSize: 10, color: mutedColor(node) }}>{d.trailing}</span>}
    </div>
  );
};

export const FileRowGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const ext = (d.glyph ?? "PDF").toUpperCase().slice(0, 4);
  const colors: Record<string, string> = { PDF: "#dc2626", DOC: "#2563eb", XLS: "#16a34a", IMG: "#a855f7", ZIP: "#f59e0b", PNG: "#a855f7", JPG: "#a855f7", MP4: "#ec4899" };
  const color = colors[ext] ?? "#64748b";
  return (
    <div className="flex h-full w-full items-center" style={{ padding: 10, gap: 12, color: isHifi(node) ? "#e9e4d8" : "#1a1a1a" }}>
      <div
        className="flex shrink-0 items-center justify-center rounded"
        style={{ width: 36, height: 40, background: color + "18", color, fontSize: 9, fontWeight: 800, letterSpacing: 0.5 }}
      >
        {ext}
      </div>
      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }} className="line-clamp-1">{d.title ?? "Document.pdf"}</span>
        {d.meta && <span style={{ fontSize: 10, color: mutedColor(node) }}>{d.meta}</span>}
      </div>
      {d.trailing && <span style={{ fontSize: 11, fontWeight: 600 }}>{d.trailing}</span>}
    </div>
  );
};

export const CodeBlockGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const lines = (d.options as string[] | undefined) ?? [
    "const config = {",
    "  apiKey: process.env.KEY,",
    "  region: 'us-east-1',",
    "  retries: 3,",
    "};",
    "export default config;",
  ];
  return (
    <div className="flex h-full w-full flex-col overflow-hidden" style={{ padding: 10, gap: 2, fontFamily: "ui-monospace, monospace", color: "#e2e8f0", background: "#0f172a", borderRadius: 6 }}>
      {d.title && (
        <div className="flex items-center gap-1.5 pb-1" style={{ fontSize: 9, color: "#94a3b8" }}>
          <span className="h-2 w-2 rounded-full" style={{ background: "#ef4444" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "#f59e0b" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "#10b981" }} />
          <span className="ml-2">{d.title}</span>
        </div>
      )}
      {lines.map((l, i) => (
        <div key={i} className="flex" style={{ gap: 8, fontSize: 10, lineHeight: 1.5 }}>
          <span style={{ color: "#475569", width: 16, textAlign: "right" }}>{i + 1}</span>
          <span className="truncate">
            {l.split(/(\b(?:const|let|var|export|default|function|return|import|from|process|env)\b)/).map((part, j) =>
              /^(const|let|var|export|default|function|return|import|from)$/.test(part)
                ? <span key={j} style={{ color: "#c084fc" }}>{part}</span>
                : /process|env/.test(part)
                ? <span key={j} style={{ color: "#fbbf24" }}>{part}</span>
                : <span key={j}>{part}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
};

export const VideoPlayerGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: surface(node) }}>
      <ImagePlaceholderGlyph />
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: 48, height: 48, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 18, paddingLeft: 4 }}
        >
          ▶
        </div>
      </div>
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center"
        style={{ padding: "8px 10px", gap: 8, background: "linear-gradient(transparent, rgba(0,0,0,0.6))", color: "#fff" }}
      >
        <span style={{ fontSize: 10 }}>{d.meta ?? "0:42"}</span>
        <div className="relative flex-1" style={{ height: 3, background: "rgba(255,255,255,0.3)", borderRadius: 999 }}>
          <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${d.value ?? 35}%`, background: "#ee4f3a" }} />
        </div>
        <span style={{ fontSize: 10 }}>{d.trailing ?? "2:18"}</span>
      </div>
    </div>
  );
};

export const ChartDonutGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const series = d.series ?? [42, 28, 18, 12];
  const palette = ["#ee4f3a", "#3b82f6", "#16a34a", "#f5a623", "#a855f7"];
  const total = series.reduce((s, v) => s + v, 0) || 1;
  let acc = 0;
  const r = 28;
  const cx = 36;
  const cy = 36;
  const segs = series.map((v, i) => {
    const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += v;
    const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + Math.cos(start) * r;
    const y1 = cy + Math.sin(start) * r;
    const x2 = cx + Math.cos(end) * r;
    const y2 = cy + Math.sin(end) * r;
    return { d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`, color: palette[i % palette.length] };
  });
  return (
    <div className="flex h-full w-full items-center" style={{ padding: 10, gap: 10, color: isHifi(node) ? "#e9e4d8" : "#1a1a1a" }}>
      <svg viewBox="0 0 72 72" style={{ width: 80, height: 80, flexShrink: 0 }}>
        {segs.map((s, i) => <path key={i} d={s.d} fill={s.color} />)}
        <circle cx={cx} cy={cy} r={16} fill={isHifi(node) ? "#1a1714" : "#fff"} />
        <text x={cx} y={cy + 4} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: isHifi(node) ? "#e9e4d8" : "#1a1a1a" }}>
          {d.trailing ?? `${total}`}
        </text>
      </svg>
      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 4 }}>
        {(d.options ?? ["Direct", "Search", "Social", "Email"]).slice(0, 4).map((label, i) => (
          <div key={i} className="flex items-center" style={{ fontSize: 10, gap: 6 }}>
            <span style={{ width: 8, height: 8, background: palette[i % palette.length], borderRadius: 2 }} />
            <span className="flex-1 truncate" style={{ color: mutedColor(node) }}>{label}</span>
            <span style={{ fontWeight: 600 }}>{Math.round((series[i] / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const StatRowGlyph = ({ node }: { node: CanvasNode }) => {
  const d = node.data ?? {};
  const series = d.series ?? defaultSeries(8);
  const max = Math.max(...series, 1);
  const points = series.map((v, i) => `${(i / (series.length - 1)) * 80},${24 - (v / max) * 22}`).join(" ");
  const trend = d.trend ?? "up";
  const trendColor = trend === "down" ? "#dc2626" : trend === "flat" ? mutedColor(node) : "#16a34a";
  return (
    <div className="flex h-full w-full items-center" style={{ padding: 12, gap: 12, color: isHifi(node) ? "#e9e4d8" : "#1a1a1a" }}>
      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 2 }}>
        <span style={{ fontSize: 10, color: mutedColor(node), fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }} className="line-clamp-1">
          {d.title ?? "Metric"}
        </span>
        <div className="flex items-baseline" style={{ gap: 6 }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>{d.trailing ?? "—"}</span>
          {d.delta && <span style={{ fontSize: 10, color: trendColor, fontWeight: 600 }}>{d.delta}</span>}
        </div>
      </div>
      <svg viewBox="0 0 80 24" style={{ width: 80, height: 32, flexShrink: 0 }}>
        <polyline points={points} fill="none" stroke={trendColor} strokeWidth={1.5} />
      </svg>
    </div>
  );
};
