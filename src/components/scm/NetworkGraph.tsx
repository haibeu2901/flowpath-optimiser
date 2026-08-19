import { Truck } from "lucide-react";
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

/** Viền nền quanh chữ để luôn đọc được khi nằm đè lên đường nối. */
const HALO = "[paint-order:stroke] stroke-card [stroke-width:5px] [stroke-linejoin:round]";

function pos(id: string) {
  return warehouses.find((w) => w.id === id)?.position ?? { x: 0, y: 0 };
}

function isOnPath(path: string[] | undefined, a: string, b: string) {
  if (!path) return false;
  for (let i = 0; i < path.length - 1; i++) {
    if ((path[i] === a && path[i + 1] === b) || (path[i] === b && path[i + 1] === a)) return true;
  }
  return false;
}

/** Đẩy điểm đặt đơn ra khỏi node kho gần nhất để không chồng lên nhau. */
function resolveOrderPoint(p: { x: number; y: number }) {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const w of warehouses) {
    const d = Math.hypot(w.position.x - p.x, w.position.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = w.position;
    }
  }
  const MIN = 62;
  if (!best || bestD >= MIN) return p;
  const dx = p.x - best.x;
  const dy = p.y - best.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: best.x + (dx / len) * MIN, y: best.y + (dy / len) * MIN };
}

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
  const hasPath = !!path && path.length > 1;
  const motionPath = hasPath
    ? path!.map((id, i) => `${i === 0 ? "M" : "L"} ${pos(id).x} ${pos(id).y}`).join(" ")
    : "";

  const visited = new Set(step?.visited ?? []);
  const relaxedIds = new Set((step?.relaxed ?? []).map((r) => r.nodeId));
  const op = orderPoint ? resolveOrderPoint(orderPoint.position) : null;

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-full w-full"
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
            <path d="M 40 0 L 0 0 0 40" fill="none" className="stroke-border" strokeWidth={0.6} strokeOpacity={0.5} />
          </pattern>
          <filter id="nodeShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.16" />
          </filter>
        </defs>

        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="url(#grid)" />

        {/* Đường nối */}
        {routes.map((r) => {
          const a = pos(r.fromWarehouseId);
          const b = pos(r.toWarehouseId);
          const active = isOnPath(path, r.fromWarehouseId, r.toWarehouseId);
          // Đặt nhãn lệch khỏi trung điểm + đẩy vuông góc để tránh chồng chéo.
          const t = 0.42;
          const lx = a.x + (b.x - a.x) * t;
          const ly = a.y + (b.y - a.y) * t;
          const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          const nx = (-(b.y - a.y) / len) * 12;
          const ny = ((b.x - a.x) / len) * 12;
          return (
            <g key={`${r.fromWarehouseId}-${r.toWarehouseId}`}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className={cn("transition-all", active ? "stroke-primary" : "stroke-border")}
                strokeWidth={active ? 5.5 : 2}
                strokeOpacity={hasPath && !active ? 0.28 : 0.9}
                strokeLinecap="round"
                markerEnd={active ? "url(#arrow)" : undefined}
              />
              <g opacity={hasPath && !active ? 0.35 : 1}>
                <text
                  x={lx + nx}
                  y={ly + ny + 4}
                  textAnchor="middle"
                  className={cn(
                    "text-[11px] font-semibold",
                    HALO,
                    active ? "fill-primary" : "fill-muted-foreground",
                  )}
                >
                  {weightLabelMode === "time"
                    ? `${formatNum(r.transitTimeDays)} ngày`
                    : `${r.distanceKm} km`}
                </text>
              </g>
            </g>
          );
        })}

        {/* Chặng giao cuối tới khách */}
        {op && lastMileWarehouseId && (
          <g>
            <line
              x1={op.x}
              y1={op.y}
              x2={pos(lastMileWarehouseId).x}
              y2={pos(lastMileWarehouseId).y}
              className="stroke-warning"
              strokeWidth={3}
              strokeDasharray="7 6"
              strokeLinecap="round"
            />
            {lastMileLabel && (
              <text
                x={(op.x + pos(lastMileWarehouseId).x) / 2}
                y={(op.y + pos(lastMileWarehouseId).y) / 2 - 8}
                textAnchor="middle"
                className={cn("fill-warning text-[11px] font-bold", HALO)}
              >
                {lastMileLabel}
              </text>
            )}
          </g>
        )}

        {hasPath && (
          <g key={animationKey}>
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
            isTarget={w.id === targetWarehouseId}
            isSource={w.id === sourceWarehouseId}
            onPath={!!path?.includes(w.id)}
            visited={visited.has(w.id)}
            isCurrent={step?.currentId === w.id}
            relaxed={relaxedIds.has(w.id)}
            stepDist={step ? step.dist[w.id] : undefined}
            partialStock={!!partialStock && w.id === sourceWarehouseId}
          />
        ))}

        {/* Điểm đặt đơn của khách */}
        {orderPoint && op && (
          <g>
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
              className="fill-warning-foreground text-[10px] font-bold"
            >
              KH
            </text>
            <text
              x={op.x}
              y={op.y + 30}
              textAnchor={op.x > WIDTH - 110 ? "end" : op.x < 110 ? "start" : "middle"}
              className={cn("fill-foreground text-[11px] font-semibold", HALO)}
            >
              {orderPoint.label}
            </text>
          </g>
        )}
      </svg>

      <Legend showCustomer={!!orderPoint} />
    </div>
  );
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
  isTarget,
  isSource,
  onPath,
  visited,
  isCurrent,
  relaxed,
  stepDist,
  partialStock,
}: {
  warehouse: Warehouse;
  isTarget: boolean;
  isSource: boolean;
  onPath: boolean;
  visited: boolean;
  isCurrent: boolean;
  relaxed: boolean;
  stepDist?: number | undefined;
  partialStock?: boolean;
}) {
  const { x, y } = w.position;
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

  // Xếp chồng badge theo tầng để không đè lên nhau khi node vừa là đích vừa là nguồn.
  const badges: { label: string; className: string; textClass: string; width: number }[] = [];
  if (isTarget && !isSource)
    badges.push({
      label: "THIẾU HÀNG",
      className: "fill-destructive",
      textClass: "fill-destructive-foreground",
      width: 72,
    });
  if (isSource)
    badges.push({
      label: partialStock ? "⚠ KHO NGUỒN" : "KHO NGUỒN",
      className: "fill-success",
      textClass: "fill-success-foreground",
      width: partialStock ? 86 : 70,
    });

  return (
    <g>
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
      <text x={x} y={y + 4} textAnchor="middle" className={cn("text-[11px] font-bold", textInside)}>
        {w.type === "central" ? "TT" : "CN"}
      </text>
      <text
        x={x}
        y={y + r + 17}
        textAnchor="middle"
        className={cn("fill-foreground text-[12px] font-semibold", HALO)}
      >
        {w.shortName}
      </text>
      {stepDist !== undefined && (
        <text
          x={x}
          y={y + r + 31}
          textAnchor="middle"
          className={cn(
            "text-[11px] font-semibold",
            HALO,
            relaxed ? "fill-warning" : "fill-muted-foreground",
          )}
        >
          d = {formatNum(stepDist)}
        </text>
      )}
      {badges.map((b, i) => {
        const by = y - r - 12 - i * 22;
        return (
          <g key={b.label}>
            <rect
              x={x - b.width / 2}
              y={by - 14}
              width={b.width}
              height={19}
              rx={9.5}
              className={b.className}
              filter="url(#nodeShadow)"
            />
            <text
              x={x}
              y={by}
              textAnchor="middle"
              className={cn("text-[10px] font-bold", b.textClass)}
            >
              {b.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
