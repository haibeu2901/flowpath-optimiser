import {
  addDays,
  batches as allBatches,
  routes as allRoutes,
  warehouses as allWarehouses,
  TODAY,
  type Batch,
  type RouteEdge,
  type Warehouse,
} from "@/data/mockData";

export type WeightMode = "time" | "distance";

export interface DijkstraStep {
  index: number;
  currentId: string | null;
  visited: string[];
  dist: Record<string, number>;
  relaxed: { nodeId: string; from: string; oldDist: number; newDist: number }[];
  note: string;
}

export interface DijkstraResult {
  dist: Record<string, number>;
  prev: Record<string, string | null>;
  steps: DijkstraStep[];
}

const INF = Number.POSITIVE_INFINITY;

export function edgeWeight(edge: RouteEdge, mode: WeightMode): number {
  return mode === "time" ? edge.transitTimeDays : edge.distanceKm;
}

export function buildAdjacency(
  routes: RouteEdge[] = allRoutes,
): Record<string, { to: string; edge: RouteEdge }[]> {
  const adj: Record<string, { to: string; edge: RouteEdge }[]> = {};
  for (const w of allWarehouses) adj[w.id] = [];
  for (const r of routes) {
    adj[r.fromWarehouseId]?.push({ to: r.toWarehouseId, edge: r });
    adj[r.toWarehouseId]?.push({ to: r.fromWarehouseId, edge: r });
  }
  return adj;
}

/** Dijkstra chuẩn, có ghi lại từng bước để mô phỏng trực quan. */
export function dijkstra(
  sourceId: string,
  mode: WeightMode = "time",
  warehouses: Warehouse[] = allWarehouses,
  routes: RouteEdge[] = allRoutes,
): DijkstraResult {
  const adj = buildAdjacency(routes);
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const visited = new Set<string>();
  const steps: DijkstraStep[] = [];

  for (const w of warehouses) {
    dist[w.id] = INF;
    prev[w.id] = null;
  }
  dist[sourceId] = 0;

  steps.push({
    index: 0,
    currentId: null,
    visited: [],
    dist: { ...dist },
    relaxed: [],
    note: `Khởi tạo: khoảng cách tới ${sourceId} = 0, các kho khác = ∞.`,
  });

  while (visited.size < warehouses.length) {
    let current: string | null = null;
    let best = INF;
    for (const w of warehouses) {
      const d = dist[w.id] ?? INF;
      if (!visited.has(w.id) && d < best) {
        best = d;
        current = w.id;
      }
    }
    if (current === null) break;
    visited.add(current);

    const relaxed: DijkstraStep["relaxed"] = [];
    for (const { to, edge } of adj[current] ?? []) {
      if (visited.has(to)) continue;
      const candidate = (dist[current] ?? INF) + edgeWeight(edge, mode);
      const currentTo = dist[to] ?? INF;
      if (candidate < currentTo) {
        relaxed.push({ nodeId: to, from: current, oldDist: currentTo, newDist: candidate });
        dist[to] = candidate;
        prev[to] = current;
      }
    }

    steps.push({
      index: steps.length,
      currentId: current,
      visited: [...visited],
      dist: { ...dist },
      relaxed,
      note:
        relaxed.length > 0
          ? `Chốt kho ${current} (d = ${fmt(best)}), cập nhật ${relaxed.length} kho lân cận.`
          : `Chốt kho ${current} (d = ${fmt(best)}), không có cập nhật mới.`,
    });
  }

  return { dist, prev, steps };
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function reconstructPath(prev: Record<string, string | null>, from: string, to: string) {
  const path: string[] = [];
  let cur: string | null = to;
  while (cur) {
    path.unshift(cur);
    if (cur === from) break;
    cur = prev[cur] ?? null;
  }
  return path[0] === from ? path : [];
}

export function pathMetrics(path: string[], routes: RouteEdge[] = allRoutes) {
  let days = 0;
  let km = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const edge = routes.find(
      (r) =>
        (r.fromWarehouseId === a && r.toWarehouseId === b) ||
        (r.fromWarehouseId === b && r.toWarehouseId === a),
    );
    if (edge) {
      days += edge.transitTimeDays;
      km += edge.distanceKm;
    }
  }
  return { transitTimeDays: days, distanceKm: km };
}

export function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 86400000;
}

export function daysUntilExpiry(batch: Batch, today: Date = TODAY): number {
  return daysBetween(today, new Date(`${batch.expiryDate}T00:00:00.000Z`));
}

export type RejectReason = "no-route" | "expired-on-arrival" | "insufficient-quantity" | null;

export interface TransferOption {
  batch: Batch;
  sourceWarehouseId: string;
  path: string[];
  transitTimeDays: number;
  distanceKm: number;
  arrivalDate: Date;
  remainingShelfLifeOnArrival: number;
  daysUntilExpiry: number;
  valid: boolean;
  rejectReason: RejectReason;
  rejectText: string;
  shortfallDays: number;
}

export interface EvaluationResult {
  targetWarehouseId: string;
  productId: string;
  quantity: number;
  threshold: number;
  weightMode: WeightMode;
  dijkstra: DijkstraResult;
  best: TransferOption | null;
  bestReason: string;
  alternatives: TransferOption[];
  rejected: TransferOption[];
  closestMiss: TransferOption | null;
}

export function evaluateTransfer(params: {
  targetWarehouseId: string;
  productId: string;
  quantity: number;
  threshold: number;
  weightMode?: WeightMode;
  today?: Date;
}): EvaluationResult {
  const {
    targetWarehouseId,
    productId,
    quantity,
    threshold,
    weightMode = "time",
    today = TODAY,
  } = params;

  const dj = dijkstra(targetWarehouseId, weightMode);
  const options: TransferOption[] = [];

  for (const batch of allBatches) {
    if (batch.productId !== productId) continue;
    if (batch.warehouseId === targetWarehouseId) continue;

    const path = reconstructPath(dj.prev, targetWarehouseId, batch.warehouseId).slice().reverse();
    const hasRoute = path.length > 1;
    const metrics = hasRoute ? pathMetrics(path) : { transitTimeDays: 0, distanceKm: 0 };
    const arrivalDate = addDays(today, metrics.transitTimeDays);
    const expiry = new Date(`${batch.expiryDate}T00:00:00.000Z`);
    const remaining = daysBetween(arrivalDate, expiry);

    let rejectReason: RejectReason = null;
    let rejectText = "";
    if (!hasRoute) {
      rejectReason = "no-route";
      rejectText = "Không có tuyến vận chuyển tới kho đích";
    } else if (remaining < threshold) {
      rejectReason = "expired-on-arrival";
      rejectText = `HSD khi tới nơi chỉ còn ${fmt(remaining)} ngày, thiếu ${fmt(threshold - remaining)} ngày so với ngưỡng ${threshold}`;
    } else if (batch.quantity < quantity) {
      rejectReason = "insufficient-quantity";
      rejectText = `Tồn kho lô chỉ có ${batch.quantity}, không đủ ${quantity} cần điều chuyển`;
    }

    options.push({
      batch,
      sourceWarehouseId: batch.warehouseId,
      path,
      transitTimeDays: metrics.transitTimeDays,
      distanceKm: metrics.distanceKm,
      arrivalDate,
      remainingShelfLifeOnArrival: remaining,
      daysUntilExpiry: daysUntilExpiry(batch, today),
      valid: rejectReason === null,
      rejectReason,
      rejectText,
      shortfallDays: Math.max(0, threshold - remaining),
    });
  }

  const valid = options.filter((o) => o.valid);
  // FEFO: lô hết hạn sớm nhất trước; nếu bằng nhau → HSD còn lại tại đích cao hơn;
  // rồi tới thời gian vận chuyển ngắn hơn.
  valid.sort((a, b) => {
    const byExpiry = a.batch.expiryDate.localeCompare(b.batch.expiryDate);
    if (byExpiry !== 0) return byExpiry;
    if (b.remainingShelfLifeOnArrival !== a.remainingShelfLifeOnArrival)
      return b.remainingShelfLifeOnArrival - a.remainingShelfLifeOnArrival;
    return a.transitTimeDays - b.transitTimeDays;
  });

  const rejected = options
    .filter((o) => !o.valid)
    .sort((a, b) => a.shortfallDays - b.shortfallDays);

  const closestMiss =
    rejected.find((o) => o.rejectReason === "expired-on-arrival") ?? rejected[0] ?? null;

  const best = valid[0] ?? null;
  const bestReason = best
    ? `Lô hết hạn sớm nhất (FEFO) trong số các lô vẫn đạt ngưỡng ≥ ${threshold} ngày khi tới kho đích — vừa giải phóng hàng tồn lâu, vừa còn ${fmt(best.remainingShelfLifeOnArrival)} ngày HSD cho người tiêu dùng.`
    : "";

  return {
    targetWarehouseId,
    productId,
    quantity,
    threshold,
    weightMode,
    dijkstra: dj,
    best,
    bestReason,
    alternatives: valid.slice(1),
    rejected,
    closestMiss,
  };
}

export const formatNum = fmt;