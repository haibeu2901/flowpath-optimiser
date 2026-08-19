import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes, warehouses, type Warehouse } from "@/data/mockData";
import type { DijkstraStep } from "@/lib/scm-algorithm";
import { formatNum } from "@/lib/scm-algorithm";
import { cn } from "@/lib/utils";

interface Props {
  targetWarehouseId: string;
  sourceWarehouseId?: string | null;
  path?: string[] | undefined;
  step?: DijkstraStep | null | undefined;
  weightLabelMode: "time" | "distance";
  animationKey: number;
  /** Điểm đặt đơn của khách (module đơn hàng) */
  orderPoint?: { label: string; position: { x: number; y: number } } | null | undefined;
  /** Kho được nối nét đứt tới điểm đặt đơn (chặng giao cuối) */
  lastMileWarehouseId?: string | null | undefined;
  lastMileLabel?: string | undefined;
  /** Kho nguồn có ít nhất 1 lô không đủ số lượng — cảnh báo nhẹ ở cấp kho. */
  partialStock?: boolean | undefined;
}

const WIDTH = 620;
const HEIGHT = 600;
const PAD = 40;
/** Khoảng cách tối thiểu giữa tâm 2 node bất kỳ (px trên canvas). */
const MIN_NODE_DIST = 104;
/** Bán kính cố định đặt node đại lý quanh kho gần nhất. */
const AGENCY_RADIUS = 78;

const HALO = "[paint-order:stroke] stroke-card [stroke-width:5px] [stroke-linejoin:round]";

type Pt = { x: number; y: number };

/**
 * Bố cục dạng sơ đồ (schematic, không to-scale): giãn các node để không cụm nào
 * dính nhau. Chạy 1 lần mỗi khi tập node hiển thị đổi — không cần physics realtime.
 */
function relaxLayout(input: { id: string; p: Pt; pinned?: boolean }[]): Record<string, Pt> {
  const pts = input.map((n) => ({ ...n, x: n.p.x, y: n.p.y }));
  for (let iter = 0; iter < 220; iter++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i]!;
        const b = pts[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d < 0.01) {
          dx = 1;
          dy = 0.3;
          d = 1.04;
        }
        if (d >= MIN_NODE_DIST) continue;
        const push = (MIN_NODE_DIST - d) / 2 + 0.5;
        const ux = dx / d;
        const uy = dy / d;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
        moved = true;
      }
    }
    for (const p of pts) {
      p.x = Math.min(WIDTH - PAD, Math.max(PAD, p.x));
      p.y = Math.min(HEIGHT - PAD - 24, Math.max(PAD, p.y));
    }
    if (!moved) break;
  }
  const out: Record<string, Pt> = {};
  for (const p of pts) out[p.id] = { x: p.x, y: p.y };
  return out;
}

/** Rút gọn nhãn dài thành 1 dòng ngắn trên canvas. */
function shortLabel(full: string): string {
  const noParen = full.replace(/\s*\([^)]*\)/g, "").trim();
  const parts = noParen
    .split(/\s+[—–-]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const ordered = parts.length > 1 ? [parts[parts.length - 1]!, parts[0]!] : parts;
  const s = ordered.join(" · ");
  return s.length > 26 ? `${s.slice(0, 25)}…` : s;
}

function isOnPath(path: string[] | undefined, a: string, b: string) {
  if (!path) return false;
  for (let i = 0; i < path.length - 1; i++) {
    if ((path[i] === a && path[i + 1] === b) || (path[i] === b && path[i + 1] === a)) return true;
  }
  return false;
}

const ORDER_ID = "__order__";

export function NetworkGraph({
  targetWarehouseId,
  sourceWarehouseId,
  path,
  step,
  weightLabelMode,
  animationKey,
  orderPoint,
  lastMileWarehouseId,
  lastMileLabel,
  partialStock,
}: Props) {
  const [showAllEdgeLabels, setShowAllEdgeLabels] = useState(false);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  /** Lớp 1 — layout chống chồng, tính lại khi tập node đổi. */
  const layout = useMemo(() => {
    const nodes = warehouses.map((w) => ({ id: w.id, p: w.position }));
    if (orderPoint) {
      // Đặt node đại lý lệch ra 1 bán kính cố định quanh kho gần nhất thay vì trùng vị trí.
      let anchor = warehouses[0]!;
      let bestD = Infinity;
      for (const w of warehouses) {
        const d = Math.hypot(w.position.x - orderPoint.position.x, w.position.y - orderPoint.position.y);
        if (d < bestD) {
          bestD = d;
          anchor = w;
        }
      }
      const dx = orderPoint.position.x - anchor.position.x;
      const dy = orderPoint.position.y - anchor.position.y;
      const len = Math.hypot(dx, dy) || 1;
      nodes.push({
        id: ORDER_ID,
        p: {
          x: anchor.position.x + (dx / len) * AGENCY_RADIUS,
          y: anchor.position.y + (dy / len) * AGENCY_RADIUS,
        },
      });
    }
    return relaxLayout(nodes);
  }, [orderPoint?.label, orderPoint?.position.x, orderPoint?.position.y]);

  const pos = useCallback((id: string): Pt => layout[id] ?? { x: 0, y: 0 }, [layout]);

  const hasPath = !!path && path.length > 1;
  const motionPath = hasPath
    ? path!.map((id, i) => `${i === 0 ? "M" : "L"} ${pos(id).x} ${pos(id).y}`).join(" ")
    : "";

  const visited = new Set(step?.visited ?? []);
  const relaxedIds = new Set((step?.relaxed ?? []).map((r) => r.nodeId));
  const op = orderPoint ? pos(ORDER_ID) : null;

  /** Lớp 4 — zoom quanh con trỏ + pan bằng kéo chuột. */
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const scale = WIDTH / rect.width;
      const px = (e.clientX - rect.left) * scale;
      const py = (e.clientY - rect.top) * scale;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const cur = viewRef.current;
      const next = Math.min(4, Math.max(0.6, cur.k * Math.exp(-dy * 0.0015)));
      const ratio = next / cur.k;
      setView({
        k: next,
        x: px - (px - cur.x) * ratio,
        y: py - (py - cur.y) * ratio,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const rect = containerRef.current?.getBoundingClientRect();
    const scale = rect ? WIDTH / rect.width : 1;
    setView((v) => ({ ...v, x: d.vx + (e.clientX - d.x) * scale, y: d.vy + (e.clientY - d.y) * scale }));
  }
  function endDrag() {
    drag.current = null;
  }

  function zoomBy(f: number) {
    setView((v) => {
      const k = Math.min(4, Math.max(0.6, v.k * f));
      const ratio = k / v.k;
      const cx = WIDTH / 2;
      const cy = HEIGHT / 2;
      return { k, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio };
    });
  }

  const activeIds = new Set<string>(path ?? []);
  if (sourceWarehouseId) activeIds.add(sourceWarehouseId);
  if (targetWarehouseId) activeIds.add(targetWarehouseId);
  if (lastMileWarehouseId) activeIds.add(lastMileWarehouseId);
  const dimming = hasPath || (!!orderPoint && !!lastMileWarehouseId);
  const nodeOpacity = (id: string) => (dimming && !activeIds.has(id) ? 0.35 : 1);

  const tooltip = buildTooltip({
    hoverNode,
    orderPoint,
    lastMileLabel,
    sourceWarehouseId,
    targetWarehouseId,
    partialStock,
    step,
  });
  const tipPos = hoverNode ? pos(hoverNode === ORDER_ID ? ORDER_ID : hoverNode) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          Sơ đồ dạng schematic — độ dài cạnh không tỉ lệ với số km thật. Di chuột vào node/cạnh để
          xem chi tiết.
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={showAllEdgeLabels ? "secondary" : "ghost"}
            className="h-7 px-2 text-[11px]"
            onClick={() => setShowAllEdgeLabels((s) => !s)}
          >
            Nhãn km
          </Button>
          <Button size="icon" variant="ghost" className="size-7" onClick={() => zoomBy(1 / 1.25)}>
            <Minus className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-7" onClick={() => zoomBy(1.25)}>
            <Plus className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={() => setView({ k: 1, x: 0, y: 0 })}
          >
            <Maximize2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full touch-none select-none overflow-hidden"
        style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-full w-full cursor-grab active:cursor-grabbing"
          role="img"
          aria-label="Sơ đồ mạng lưới kho"
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--primary)" />
            </marker>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                className="stroke-border"
                strokeWidth={0.6}
                strokeOpacity={0.5}
              />
            </pattern>
            <filter id="nodeShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.16" />
            </filter>
          </defs>

          <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="url(#grid)" />

          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {/* Đường nối */}
            {routes.map((r) => {
              const key = `${r.fromWarehouseId}-${r.toWarehouseId}`;
              const a = pos(r.fromWarehouseId);
              const b = pos(r.toWarehouseId);
              const active = isOnPath(path, r.fromWarehouseId, r.toWarehouseId);
              const hovered = hoverEdge === key;
              const showLabel = active || hovered || showAllEdgeLabels;
              const label =
                weightLabelMode === "time"
                  ? `${formatNum(r.transitTimeDays)} ngày`
                  : `${r.distanceKm} km`;
              const anchor = labelAnchor(a, b, layout, r.fromWarehouseId, r.toWarehouseId);
              return (
                <g key={key}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="transparent"
                    strokeWidth={16}
                    onPointerEnter={() => setHoverEdge(key)}
                    onPointerLeave={() => setHoverEdge((k) => (k === key ? null : k))}
                  />
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={cn(
                      "pointer-events-none transition-all",
                      active ? "stroke-primary" : hovered ? "stroke-foreground/50" : "stroke-border",
                    )}
                    strokeWidth={active ? 5.5 : 2}
                    strokeOpacity={dimming && !active ? 0.22 : 0.9}
                    strokeLinecap="round"
                    markerEnd={active ? "url(#arrow)" : undefined}
                  />
                  {showLabel && (
                    <text
                      x={anchor.x}
                      y={anchor.y}
                      textAnchor="middle"
                      className={cn(
                        "pointer-events-none text-[11px] font-semibold",
                        HALO,
                        active ? "fill-primary" : "fill-muted-foreground",
                      )}
                    >
                      {label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Chặng giao cuối tới khách (nét đứt mảnh) */}
            {op && lastMileWarehouseId && (
              <line
                x1={op.x}
                y1={op.y}
                x2={pos(lastMileWarehouseId).x}
                y2={pos(lastMileWarehouseId).y}
                className="stroke-warning"
                strokeWidth={2.5}
                strokeDasharray="7 6"
                strokeLinecap="round"
              />
            )}

            {hasPath && (
              <g key={animationKey} className="pointer-events-none">
                <circle r={14} className="fill-primary" filter="url(#nodeShadow)">
                  <animateMotion dur="3.2s" repeatCount="indefinite" path={motionPath} rotate="0" />
                </circle>
                <g>
                  <animateMotion dur="3.2s" repeatCount="indefinite" path={motionPath} />
                  <Truck x={-8} y={-8} width={16} height={16} strokeWidth={2.2} color="white" />
                </g>
              </g>
            )}

            {warehouses.map((w) => (
              <WarehouseNode
                key={w.id}
                warehouse={w}
                at={pos(w.id)}
                opacity={nodeOpacity(w.id)}
                isTarget={w.id === targetWarehouseId}
                isSource={w.id === sourceWarehouseId}
                onPath={!!path?.includes(w.id)}
                visited={visited.has(w.id)}
                isCurrent={step?.currentId === w.id}
                relaxed={relaxedIds.has(w.id)}
                stepDist={step ? step.dist[w.id] : undefined}
                partialStock={!!partialStock && w.id === sourceWarehouseId}
                onHover={setHoverNode}
              />
            ))}

            {/* Node đại lý / điểm đặt đơn */}
            {orderPoint && op && (
              <g
                onPointerEnter={() => setHoverNode(ORDER_ID)}
                onPointerLeave={() => setHoverNode((n) => (n === ORDER_ID ? null : n))}
              >
                <circle cx={op.x} cy={op.y} r={18} className="fill-warning/20 animate-pulse" />
                <circle
                  cx={op.x}
                  cy={op.y}
                  r={12}
                  className="fill-warning stroke-card"
                  strokeWidth={2.5}
                  filter="url(#nodeShadow)"
                />
                <text
                  x={op.x}
                  y={op.y + 4}
                  textAnchor="middle"
                  className="pointer-events-none fill-warning-foreground text-[10px] font-bold"
                >
                  KH
                </text>
                <text
                  x={op.x}
                  y={op.y + 30}
                  textAnchor={op.x > WIDTH - 110 ? "end" : op.x < 110 ? "start" : "middle"}
                  className={cn("pointer-events-none fill-foreground text-[11px] font-semibold", HALO)}
                >
                  {shortLabel(orderPoint.label)}
                </text>
              </g>
            )}
          </g>
        </svg>

        {tooltip && tipPos && (
          <div
            className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 rounded-lg border border-border bg-popover p-2 text-[11px] leading-relaxed text-popover-foreground shadow-lg"
            style={{
              left: `${((tipPos.x * view.k + view.x) / WIDTH) * 100}%`,
              top: `${((tipPos.y * view.k + view.y + 34 * view.k) / HEIGHT) * 100}%`,
            }}
          >
            <p className="font-semibold">{tooltip.title}</p>
            {tooltip.lines.map((l) => (
              <p key={l} className="text-muted-foreground">
                {l}
              </p>
            ))}
          </div>
        )}
      </div>

      <Legend showCustomer={!!orderPoint} />
    </div>
  );
}

/** Lớp 3 — dịch nhãn cạnh ra khỏi vùng node/badge lân cận. */
function labelAnchor(a: Pt, b: Pt, layout: Record<string, Pt>, fromId: string, toId: string): Pt {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = (-(b.y - a.y) / len) * 13;
  const ny = ((b.x - a.x) / len) * 13;
  const candidates = [0.5, 0.38, 0.62, 0.3, 0.7, 0.24];
  let fallback: Pt | null = null;
  for (const t of candidates) {
    const p = { x: a.x + (b.x - a.x) * t + nx, y: a.y + (b.y - a.y) * t + ny + 4 };
    fallback ??= p;
    let clash = false;
    for (const [id, q] of Object.entries(layout)) {
      if (id === fromId || id === toId) continue;
      if (Math.hypot(q.x - p.x, q.y - p.y) < 46) {
        clash = true;
        break;
      }
    }
    if (!clash) return p;
  }
  return fallback!;
}

function buildTooltip(args: {
  hoverNode: string | null;
  orderPoint?: { label: string; position: Pt } | null | undefined;
  lastMileLabel?: string | undefined;
  sourceWarehouseId?: string | null | undefined;
  targetWarehouseId: string;
  partialStock?: boolean | undefined;
  step?: DijkstraStep | null | undefined;
}): { title: string; lines: string[] } | null {
  const { hoverNode } = args;
  if (!hoverNode) return null;
  if (hoverNode === ORDER_ID) {
    if (!args.orderPoint) return null;
    const lines = ["Điểm nhận hàng của khách / đại lý"];
    if (args.lastMileLabel) lines.push(`Chặng giao cuối: ${args.lastMileLabel}`);
    return { title: args.orderPoint.label, lines };
  }
  const w = warehouses.find((x) => x.id === hoverNode);
  if (!w) return null;
  const lines = [w.type === "central" ? "Kho trung tâm (TT)" : "Kho chi nhánh (CN)"];
  if (hoverNode === args.sourceWarehouseId) {
    lines.push("Kho nguồn xuất hàng (Best Plan)");
    if (args.partialStock) lines.push("⚠ Có lô không đủ số lượng — xem bảng Plan");
    if (args.lastMileLabel) lines.push(`Chặng giao cuối: ${args.lastMileLabel}`);
  }
  if (hoverNode === args.targetWarehouseId) lines.push("Kho đang thiếu hàng / kho phục vụ");
  const d = args.step?.dist[hoverNode];
  if (d !== undefined && Number.isFinite(d)) lines.push(`Dijkstra d = ${formatNum(d)}`);
  return { title: w.name, lines };
}

function Legend({ showCustomer }: { showCustomer: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-1 pt-2 text-[11px] text-muted-foreground">
      <Item className="bg-primary" label="Kho trung tâm (TT)" />
      <Item className="border-2 border-border bg-card" label="Kho chi nhánh (CN)" />
      <Item className="bg-destructive" label="Kho thiếu hàng / kho phục vụ" />
      <Item className="bg-success" label="Kho nguồn xuất hàng" />
      {showCustomer && <Item className="bg-warning" label="Điểm đặt đơn của khách" />}
      <span className="flex items-center gap-1.5">
        <span className="h-[3px] w-6 rounded bg-primary" /> Tuyến tối ưu (Dijkstra)
      </span>
      {showCustomer && (
        <span className="flex items-center gap-1.5">
          <span
            className="h-[3px] w-6 rounded"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, var(--warning) 0 6px, transparent 6px 11px)",
            }}
          />
          Chặng giao cuối
        </span>
      )}
    </div>
  );
}

function Item({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded-full", className)} />
      {label}
    </span>
  );
}

function WarehouseNode({
  warehouse: w,
  at,
  opacity,
  isTarget,
  isSource,
  onPath,
  visited,
  isCurrent,
  relaxed,
  stepDist,
  partialStock,
  onHover,
}: {
  warehouse: Warehouse;
  at: Pt;
  opacity: number;
  isTarget: boolean;
  isSource: boolean;
  onPath: boolean;
  visited: boolean;
  isCurrent: boolean;
  relaxed: boolean;
  stepDist?: number | undefined;
  partialStock?: boolean;
  onHover: (id: string | null) => void;
}) {
  const { x, y } = at;
  const r = w.type === "central" ? 26 : 21;

  const fill = isSource
    ? "fill-success"
    : isTarget
      ? "fill-destructive"
      : isCurrent
        ? "fill-warning"
        : visited
          ? "fill-primary-glow"
          : w.type === "central"
            ? "fill-primary"
            : "fill-card";

  const textInside =
    isTarget || isSource || isCurrent || visited || w.type === "central"
      ? "fill-primary-foreground"
      : "fill-foreground";

  // Lớp 2 — tối đa 1 badge chính; thông tin phụ nằm trong tooltip.
  const badge = isSource
    ? {
        label: partialStock ? "⚠ KHO NGUỒN" : "KHO NGUỒN",
        className: "fill-success",
        textClass: "fill-success-foreground",
        width: partialStock ? 86 : 70,
      }
    : isTarget
      ? {
          label: "THIẾU HÀNG",
          className: "fill-destructive",
          textClass: "fill-destructive-foreground",
          width: 72,
        }
      : null;

  return (
    <g
      opacity={opacity}
      onPointerEnter={() => onHover(w.id)}
      onPointerLeave={() => onHover(null)}
    >
      {(isTarget || isSource || relaxed) && (
        <circle
          cx={x}
          cy={y}
          r={r + 8}
          className={cn(
            "animate-pulse",
            isTarget ? "fill-destructive/20" : isSource ? "fill-success/20" : "fill-warning/25",
          )}
        />
      )}
      <circle
        cx={x}
        cy={y}
        r={r}
        className={cn(fill, onPath ? "stroke-primary" : "stroke-border")}
        strokeWidth={onPath || isTarget ? 3 : 1.5}
        filter="url(#nodeShadow)"
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        className={cn("pointer-events-none text-[11px] font-bold", textInside)}
      >
        {w.type === "central" ? "TT" : "CN"}
      </text>
      <text
        x={x}
        y={y + r + 17}
        textAnchor="middle"
        className={cn("pointer-events-none fill-foreground text-[12px] font-semibold", HALO)}
      >
        {w.shortName}
      </text>
      {stepDist !== undefined && (
        <text
          x={x}
          y={y + r + 31}
          textAnchor="middle"
          className={cn(
            "pointer-events-none text-[11px] font-semibold",
            HALO,
            relaxed ? "fill-warning" : "fill-muted-foreground",
          )}
        >
          d = {formatNum(stepDist)}
        </text>
      )}
      {badge && (
        <g className="pointer-events-none">
          <rect
            x={x - badge.width / 2}
            y={y - r - 26}
            width={badge.width}
            height={19}
            rx={9.5}
            className={badge.className}
            filter="url(#nodeShadow)"
          />
          <text
            x={x}
            y={y - r - 12}
            textAnchor="middle"
            className={cn("text-[10px] font-bold", badge.textClass)}
          >
            {badge.label}
          </text>
        </g>
      )}
    </g>
  );
}
