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
}

const WIDTH = 620;
const HEIGHT = 570;

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
}: Props) {
  const hasPath = !!path && path.length > 1;
  const motionPath = hasPath
    ? path!.map((id, i) => `${i === 0 ? "M" : "L"} ${pos(id).x} ${pos(id).y}`).join(" ")
    : "";

  const visited = new Set(step?.visited ?? []);
  const relaxedIds = new Set((step?.relaxed ?? []).map((r) => r.nodeId));

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-full w-full"
      role="img"
      aria-label="Sơ đồ mạng lưới kho"
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--primary)" />
        </marker>
      </defs>

      {routes.map((r) => {
        const a = pos(r.fromWarehouseId);
        const b = pos(r.toWarehouseId);
        const active = isOnPath(path, r.fromWarehouseId, r.toWarehouseId);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        return (
          <g key={`${r.fromWarehouseId}-${r.toWarehouseId}`}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={cn(
                "transition-all",
                active ? "stroke-primary" : hasPath ? "stroke-border" : "stroke-border",
              )}
              strokeWidth={active ? 5 : 2}
              strokeOpacity={hasPath && !active ? 0.35 : 1}
              strokeLinecap="round"
              markerEnd={active ? "url(#arrow)" : undefined}
            />
            <g opacity={hasPath && !active ? 0.4 : 1}>
              <rect
                x={mx - 22}
                y={my - 10}
                width={44}
                height={19}
                rx={9}
                className={cn("fill-card", active ? "stroke-primary" : "stroke-border")}
              />
              <text
                x={mx}
                y={my + 4}
                textAnchor="middle"
                className={cn(
                  "text-[11px] font-medium",
                  active ? "fill-primary" : "fill-muted-foreground",
                )}
              >
                {weightLabelMode === "time"
                  ? `${formatNum(r.transitTimeDays)}n`
                  : `${r.distanceKm}km`}
              </text>
            </g>
          </g>
        );
      })}

      {hasPath && (
        <g key={animationKey}>
          <circle r={13} className="fill-primary">
            <animateMotion dur="3.2s" repeatCount="indefinite" path={motionPath} rotate="0" />
          </circle>
          <g className="text-primary-foreground">
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
        />
      ))}

      {orderPoint && (
        <g>
          {lastMileWarehouseId && (
            <g>
              <line
                x1={orderPoint.position.x}
                y1={orderPoint.position.y}
                x2={pos(lastMileWarehouseId).x}
                y2={pos(lastMileWarehouseId).y}
                className="stroke-warning"
                strokeWidth={3}
                strokeDasharray="7 6"
              />
              {lastMileLabel && (
                <text
                  x={(orderPoint.position.x + pos(lastMileWarehouseId).x) / 2}
                  y={(orderPoint.position.y + pos(lastMileWarehouseId).y) / 2 - 6}
                  textAnchor="middle"
                  className="fill-warning text-[11px] font-bold"
                >
                  {lastMileLabel}
                </text>
              )}
            </g>
          )}
          <circle
            cx={orderPoint.position.x}
            cy={orderPoint.position.y}
            r={11}
            className="fill-warning stroke-card"
            strokeWidth={2}
          />
          <text
            x={orderPoint.position.x}
            y={orderPoint.position.y + 4}
            textAnchor="middle"
            className="fill-warning-foreground text-[10px] font-bold"
          >
            KH
          </text>
          <text
            x={orderPoint.position.x}
            y={orderPoint.position.y - 17}
            textAnchor="middle"
            className="fill-foreground text-[11px] font-semibold"
          >
            {orderPoint.label}
          </text>
        </g>
      )}
    </svg>
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
}: {
  warehouse: Warehouse;
  isTarget: boolean;
  isSource: boolean;
  onPath: boolean;
  visited: boolean;
  isCurrent: boolean;
  relaxed: boolean;
  stepDist?: number | undefined;
}) {
  const { x, y } = w.position;
  const r = w.type === "central" ? 27 : 22;

  const fill = isTarget
    ? "fill-destructive"
    : isSource
      ? "fill-success"
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

  return (
    <g>
      {(isTarget || isSource || relaxed) && (
        <circle
          cx={x}
          cy={y}
          r={r + 7}
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
      />
      <text x={x} y={y + 4} textAnchor="middle" className={cn("text-[11px] font-bold", textInside)}>
        {w.type === "central" ? "TT" : "CN"}
      </text>
      <text
        x={x}
        y={y + r + 16}
        textAnchor="middle"
        className="fill-foreground text-[12px] font-semibold"
      >
        {w.shortName}
      </text>
      {stepDist !== undefined && (
        <text
          x={x}
          y={y + r + 30}
          textAnchor="middle"
          className={cn(
            "text-[11px] font-semibold",
            relaxed ? "fill-warning" : "fill-muted-foreground",
          )}
        >
          d = {formatNum(stepDist)}
        </text>
      )}
      {isTarget && (
        <g>
          <rect
            x={x - 34}
            y={y - r - 26}
            width={68}
            height={19}
            rx={9}
            className="fill-destructive"
          />
          <text
            x={x}
            y={y - r - 12}
            textAnchor="middle"
            className="fill-destructive-foreground text-[10px] font-bold"
          >
            THIẾU HÀNG
          </text>
        </g>
      )}
      {isSource && (
        <g>
          <rect x={x - 32} y={y - r - 26} width={64} height={19} rx={9} className="fill-success" />
          <text
            x={x}
            y={y - r - 12}
            textAnchor="middle"
            className="fill-success-foreground text-[10px] font-bold"
          >
            KHO NGUỒN
          </text>
        </g>
      )}
    </g>
  );
}