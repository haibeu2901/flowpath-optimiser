import {
  addDays,
  batches as allBatches,
  demandNodeById,
  defaultAllocationParams,
  KM_PER_UNIT,
  productById,
  TODAY,
  TRUCK_HOURS_PER_DAY,
  TRUCK_KMH,
  warehouseById,
  warehouses as allWarehouses,
  type AllocationParams,
  type Batch,
  type DemandNode,
} from "@/data/mockData";
import { daysBetween, dijkstra, formatNum } from "@/lib/scm-algorithm";

/* ---------- Khoảng cách & thời gian ---------- */

/**
 * Source Selection dùng Haversine (đường chim bay, O(1)/cặp điểm) — KHÔNG dùng Dijkstra.
 * Trên toạ độ mock, Haversine quy về khoảng cách Euclid rồi đổi sang km.
 */
export function haversineKm(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const d = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  return Math.round(d * KM_PER_UNIT * 10) / 10;
}

const KM_PER_DAY = TRUCK_KMH * TRUCK_HOURS_PER_DAY;

export function etaDays(km: number): number {
  return Math.round((km / KM_PER_DAY) * 100) / 100;
}

/* ---------- Sales Velocity & MRSL ---------- */

export function salesVelocity(node: DemandNode, productId: string): number {
  const rows = node.salesHistory.filter((r) => r.productId === productId);
  if (rows.length === 0) return 0;
  const days = new Set(rows.map((r) => r.date)).size;
  const total = rows.reduce((s, r) => s + r.unitsSold, 0);
  return Math.round((total / days) * 10) / 10;
}

export interface MrslInfo {
  mode: "dynamic" | "cold-start";
  /** Số ngày HSD tối thiểu bắt buộc khi hàng tới nơi. */
  requiredDays: number;
  velocity: number;
  formula: string;
}

export function computeMrsl(
  node: DemandNode,
  productId: string,
  quantity: number,
  params: AllocationParams,
): MrslInfo {
  const product = productById.get(productId)!;
  const velocity = salesVelocity(node, productId);
  if (node.isColdStart || velocity <= 0) {
    const requiredDays =
      Math.round(((product.shelfLifeDays * params.coldStartMinShelfLifePercent) / 100) * 10) / 10;
    return {
      mode: "cold-start",
      requiredDays,
      velocity: 0,
      formula: `Cold Start: chưa có lịch sử bán → luật tĩnh HSD còn ≥ ${params.coldStartMinShelfLifePercent}% tuổi đời = ${formatNum(requiredDays)} ngày.`,
    };
  }
  const requiredDays = Math.round((quantity / velocity + params.safetyBufferDays) * 10) / 10;
  return {
    mode: "dynamic",
    requiredDays,
    velocity,
    formula: `MRSL = (${quantity} / ${formatNum(velocity)}) + ${params.safetyBufferDays} = ${formatNum(requiredDays)} ngày`,
  };
}

export function effectiveMrsl(
  inventoryAhead: number,
  currentQty: number,
  velocity: number,
  params: AllocationParams,
): number {
  if (velocity <= 0) return 0;
  return Math.round(((inventoryAhead + currentQty) / velocity + params.safetyBufferDays) * 10) / 10;
}

/* ---------- Fulfillment plans ---------- */

export type RejectKind = "distance" | "shelf-life" | null;

export interface PlanCandidate {
  id: string;
  warehouseId: string;
  batch: Batch;
  availableQty: number;
  distanceKm: number;
  etaDays: number;
  arrivalDate: Date;
  remainingOnArrival: number;
  requiredDays: number;
  enoughQty: boolean;
  passed: boolean;
  rejectKind: RejectKind;
  rejectText: string;
  normDistance: number;
  normExpiry: number;
  score: number;
}

export interface SplitLeg {
  plan: PlanCandidate;
  qty: number;
  inventoryAhead: number;
  effectiveMrsl: number;
  ok: boolean;
}

export interface RouteStop {
  nodeId: string;
  name: string;
  position: { x: number; y: number };
  legKm: number;
  cumulativeKm: number;
  viaGraph: boolean;
}

export interface DeliveryRoute {
  depotWarehouseId: string;
  stops: RouteStop[];
  totalKm: number;
}

export type StepStatus = "ok" | "warn" | "fail" | "info";

export interface StepRow {
  cells: (string | number)[];
  tone?: "ok" | "fail" | "best";
}

export interface PipelineStep {
  index: number;
  title: string;
  status: StepStatus;
  summary: string;
  formula?: string;
  bullets?: string[];
  table?: { head: string[]; rows: StepRow[] };
}

export interface AllocationResult {
  node: DemandNode;
  productId: string;
  quantity: number;
  params: AllocationParams;
  mrsl: MrslInfo;
  candidates: PlanCandidate[];
  passed: PlanCandidate[];
  rejected: PlanCandidate[];
  best: PlanCandidate | null;
  split: SplitLeg[] | null;
  /** Lô cận date nhất — cái mà "FEFO mù quáng" sẽ chọn. */
  blindFefo: PlanCandidate | null;
  blindFefoViolates: boolean;
  route: DeliveryRoute | null;
  steps: PipelineStep[];
}

function minMaxNorm(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.round((((value - min) / (max - min)) * 100) * 10) / 10;
}

export function allocate(input: {
  demandNodeId: string;
  productId: string;
  quantity: number;
  params?: AllocationParams;
  companionOrders?: { demandNodeId: string; productId: string; quantity: number }[];
  today?: Date;
}): AllocationResult {
  const {
    demandNodeId,
    productId,
    quantity,
    params = defaultAllocationParams,
    companionOrders = [],
    today = TODAY,
  } = input;

  const node = demandNodeById.get(demandNodeId)!;
  const product = productById.get(productId)!;
  const steps: PipelineStep[] = [];
  const mrsl = computeMrsl(node, productId, quantity, params);

  /* 1 — Candidate Warehouse Discovery */
  const warehousesWithSku = allWarehouses
    .filter((w) => w.id !== node.warehouseId)
    .map((w) => {
      const list = allBatches.filter((b) => b.warehouseId === w.id && b.productId === productId);
      return {
        w,
        list,
        stock: list.reduce((s, b) => s + b.quantity, 0),
        distanceKm: haversineKm(w.position, node.position),
      };
    })
    .filter((c) => c.list.length > 0)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  steps.push({
    index: 1,
    title: "Candidate Warehouse Discovery",
    status: warehousesWithSku.length ? "ok" : "fail",
    summary: `${warehousesWithSku.length} kho đang có SKU ${product.sku}. Khoảng cách tính bằng Haversine (O(1)), không dùng Dijkstra ở bước chọn nguồn.`,
    table: {
      head: ["Kho", "Tồn kho", "Số lô", "Haversine (km)"],
      rows: warehousesWithSku.map((c) => ({
        cells: [c.w.name, c.stock, c.list.length, formatNum(c.distanceKm)],
      })),
    },
  });

  /* 2 — Candidate Batch/Lot */
  const rawCandidates = warehousesWithSku.flatMap((c) =>
    c.list.map((batch) => ({ batch, warehouse: c.w, distanceKm: c.distanceKm })),
  );

  steps.push({
    index: 2,
    title: "Candidate Batch / Lot",
    status: rawCandidates.length ? "ok" : "fail",
    summary: `${rawCandidates.length} lô hàng khả dụng trên toàn mạng lưới.`,
    table: {
      head: ["Lô", "Kho", "SL", "HSD"],
      rows: rawCandidates.map((c) => ({
        cells: [c.batch.batchCode, c.warehouse.shortName, c.batch.quantity, c.batch.expiryDate],
      })),
    },
  });

  /* 3 — Calculate Base MRSL */
  steps.push({
    index: 3,
    title: "Calculate Base MRSL",
    status: mrsl.mode === "cold-start" ? "warn" : "ok",
    summary:
      mrsl.mode === "cold-start"
        ? `${node.name} chưa đủ dữ liệu lịch sử → bỏ qua MRSL động, áp luật tĩnh.`
        : `Sales Velocity của ${node.name} với SKU này = ${formatNum(mrsl.velocity)} ${product.unit}/ngày (trung bình 10 ngày gần nhất).`,
    formula: mrsl.formula,
  });

  /* 4 — ETA & Consumption Simulation */
  const candidates: PlanCandidate[] = rawCandidates.map((c, i) => {
    const eta = etaDays(c.distanceKm);
    const arrivalDate = addDays(today, eta);
    const expiry = new Date(`${c.batch.expiryDate}T00:00:00.000Z`);
    const remaining = Math.round(daysBetween(arrivalDate, expiry) * 10) / 10;
    const overDistance = c.distanceKm > params.maxServingDistanceKm;
    const shortShelf = remaining < mrsl.requiredDays;
    return {
      id: `${c.batch.id}-${i}`,
      warehouseId: c.warehouse.id,
      batch: c.batch,
      availableQty: c.batch.quantity,
      distanceKm: c.distanceKm,
      etaDays: eta,
      arrivalDate,
      remainingOnArrival: remaining,
      requiredDays: mrsl.requiredDays,
      enoughQty: c.batch.quantity >= quantity,
      passed: !overDistance && !shortShelf,
      rejectKind: overDistance ? "distance" : shortShelf ? "shelf-life" : null,
      rejectText: overDistance
        ? `Vượt Max_Serving_Distance: ${formatNum(c.distanceKm)} km > ${params.maxServingDistanceKm} km`
        : shortShelf
          ? `HSD khi tới nơi ${formatNum(remaining)} ngày < MRSL ${formatNum(mrsl.requiredDays)} ngày`
          : "",
      normDistance: 0,
      normExpiry: 0,
      score: 0,
    };
  });

  steps.push({
    index: 4,
    title: "Delivery ETA & Consumption Simulation",
    status: "ok",
    summary: `ETA = Haversine / ${KM_PER_DAY} km/ngày. HSD còn lại khi tới nơi = Expiry − (hôm nay + ETA).`,
    table: {
      head: ["Lô", "Kho", "km", "ETA (ngày)", "HSD khi tới (ngày)"],
      rows: candidates.map((c) => ({
        cells: [
          c.batch.batchCode,
          warehouseById.get(c.warehouseId)?.shortName ?? "",
          formatNum(c.distanceKm),
          formatNum(c.etaDays),
          formatNum(c.remainingOnArrival),
        ],
      })),
    },
  });

  /* 5 — Hard Filter */
  const passedAll = candidates.filter((c) => c.passed);
  const rejected = candidates.filter((c) => !c.passed);

  steps.push({
    index: 5,
    title: "Hard Filter (Constraint First)",
    status: passedAll.length ? (rejected.length ? "warn" : "ok") : "fail",
    summary: `${passedAll.length} plan qua vòng lọc, ${rejected.length} plan bị loại ngay (không chấm điểm).`,
    table: {
      head: ["Lô", "Kho", "Kết quả", "Lý do"],
      rows: candidates.map((c) => ({
        cells: [
          c.batch.batchCode,
          warehouseById.get(c.warehouseId)?.shortName ?? "",
          c.passed ? "ĐẠT" : c.rejectKind === "distance" ? "LOẠI · Logistics" : "LOẠI · HSD",
          c.passed ? `HSD ${formatNum(c.remainingOnArrival)} ≥ MRSL ${formatNum(mrsl.requiredDays)}` : c.rejectText,
        ],
        tone: c.passed ? "ok" : "fail",
      })),
    },
  });

  /* 6 — Normalize */
  const dists = passedAll.map((c) => c.distanceKm);
  const rems = passedAll.map((c) => c.remainingOnArrival);
  const minD = Math.min(...dists);
  const maxD = Math.max(...dists);
  const minR = Math.min(...rems);
  const maxR = Math.max(...rems);
  for (const c of passedAll) {
    c.normDistance = minMaxNorm(c.distanceKm, minD, maxD);
    c.normExpiry = minMaxNorm(c.remainingOnArrival, minR, maxR);
    c.score = Math.round((params.weightDistance * c.normDistance + params.weightExpiry * c.normExpiry) * 10) / 10;
  }

  const edgeNote: string[] = [];
  if (passedAll.length && maxD === minD)
    edgeNote.push("Edge case: mọi plan cùng khoảng cách (Max = Min) → Norm_Distance = 50.");
  if (passedAll.length && maxR === minR)
    edgeNote.push("Edge case: mọi plan cùng HSD còn lại (Max = Min) → Norm_Expiry = 50.");

  steps.push({
    index: 6,
    title: "Normalize Dimensions (Min-Max, 0-100)",
    status: passedAll.length ? "ok" : "fail",
    summary: "Norm_X = ((X − Min_X) / (Max_X − Min_X)) × 100. Norm_Expiry thấp = lô cận date hơn (được ưu tiên giải phóng).",
    bullets: edgeNote.length ? edgeNote : undefined,
    table: {
      head: ["Lô", "km", "Norm_Distance", "HSD tới nơi", "Norm_Expiry"],
      rows: passedAll.map((c) => ({
        cells: [
          c.batch.batchCode,
          formatNum(c.distanceKm),
          formatNum(c.normDistance),
          formatNum(c.remainingOnArrival),
          formatNum(c.normExpiry),
        ],
      })),
    },
  });

  /* 7 — Weighted Scoring */
  const scored = [...passedAll].sort((a, b) => a.score - b.score || a.distanceKm - b.distanceKm);
  steps.push({
    index: 7,
    title: "Weighted Scoring",
    status: scored.length ? "ok" : "fail",
    summary: `Score = ${params.weightDistance} × Norm_Distance + ${params.weightExpiry} × Norm_Expiry — điểm càng THẤP càng ưu tiên.`,
    table: {
      head: ["#", "Lô", "Kho", "Score", "Đủ SL?"],
      rows: scored.map((c, i) => ({
        cells: [
          i + 1,
          c.batch.batchCode,
          warehouseById.get(c.warehouseId)?.shortName ?? "",
          formatNum(c.score),
          c.enoughQty ? "Đủ" : `Thiếu (${c.availableQty}/${quantity})`,
        ],
        tone: i === 0 ? "best" : undefined,
      })),
    },
  });

  /* 8 — Select Best Plan (+ Split Shipment nếu không kho đơn lẻ nào đủ) */
  const best = scored.find((c) => c.enoughQty) ?? null;
  let split: SplitLeg[] | null = null;

  if (!best && scored.length > 0) {
    const legs: SplitLeg[] = [];
    let need = quantity;
    let ahead = 0;
    for (const c of scored) {
      if (legs.length >= 2 || need <= 0) break;
      if (legs.some((l) => l.plan.warehouseId === c.warehouseId)) continue;
      const qty = Math.min(c.availableQty, need);
      const eff =
        mrsl.mode === "cold-start"
          ? mrsl.requiredDays
          : effectiveMrsl(ahead, qty, mrsl.velocity, params);
      legs.push({
        plan: c,
        qty,
        inventoryAhead: ahead,
        effectiveMrsl: eff,
        ok: c.remainingOnArrival >= eff,
      });
      ahead += qty;
      need -= qty;
    }
    split = legs.length ? legs : null;
    steps.push({
      index: 8,
      title: "Select Best Plan — Split Shipment",
      status: split && need <= 0 && split.every((l) => l.ok) ? "warn" : "fail",
      summary:
        need > 0
          ? `Ngay cả khi tách 2 kho vẫn thiếu ${need} ${product.unit}. Cần đặt hàng nhà cung cấp.`
          : `Không kho đơn lẻ nào đủ ${quantity} ${product.unit} → tách đơn tối đa 2 kho. Lô về sau phải "xếp hàng" chờ lô trước bán hết (Effective MRSL).`,
      table: {
        head: ["Lô", "Kho", "SL giao", "Inventory Ahead", "Effective MRSL", "HSD tới nơi", "KQ"],
        rows: (split ?? []).map((l) => ({
          cells: [
            l.plan.batch.batchCode,
            warehouseById.get(l.plan.warehouseId)?.shortName ?? "",
            l.qty,
            l.inventoryAhead,
            formatNum(l.effectiveMrsl),
            formatNum(l.plan.remainingOnArrival),
            l.ok ? "ĐẠT" : "LOẠI",
          ],
          tone: l.ok ? "ok" : "fail",
        })),
      },
    });
  } else {
    steps.push({
      index: 8,
      title: "Select Best Plan",
      status: best ? "ok" : "fail",
      summary: best
        ? `Best Plan: lô ${best.batch.batchCode} từ ${warehouseById.get(best.warehouseId)?.name} — Score ${formatNum(best.score)} thấp nhất, HSD khi tới nơi ${formatNum(best.remainingOnArrival)} ngày ≥ MRSL ${formatNum(mrsl.requiredDays)} ngày.`
        : "Không có plan nào qua Hard Filter — từ chối phục vụ từ mạng lưới hiện tại.",
    });
  }

  /* 9 — FEFO Depletion */
  const depletion = best
    ? [{ plan: best, qty: quantity }]
    : (split ?? []).map((l) => ({ plan: l.plan, qty: l.qty }));
  steps.push({
    index: 9,
    title: "FEFO Depletion",
    status: depletion.length ? "ok" : "fail",
    summary: "Trừ tồn kho theo đúng lô đã chọn (FEFO trong phạm vi các lô đã đạt ngưỡng an toàn).",
    table: {
      head: ["Lô", "Tồn trước", "Xuất", "Tồn sau"],
      rows: depletion.map((d) => ({
        cells: [d.plan.batch.batchCode, d.plan.availableQty, d.qty, d.plan.availableQty - d.qty],
      })),
    },
  });

  /* 10 — Optimistic Locking */
  steps.push({
    index: 10,
    title: "Optimistic Locking",
    status: depletion.length ? "ok" : "info",
    summary: depletion.length
      ? `Khoá tạm ${depletion.length} lô bằng version check (mô phỏng) để đơn khác không giành cùng tồn kho.`
      : "Không có lô nào để khoá.",
    bullets: depletion.map(
      (d) => `${d.plan.batch.batchCode} — version +1, giữ ${d.qty} ${product.unit} trong 15 phút.`,
    ),
  });

  /* 11 — Delivery Routing (VRP rút gọn) */
  let route: DeliveryRoute | null = null;
  const depot = best?.warehouseId ?? split?.[0]?.plan.warehouseId ?? null;
  if (depot && companionOrders.length > 0) {
    const stopNodes = [node, ...companionOrders.map((o) => demandNodeById.get(o.demandNodeId)!)];
    route = nearestNeighborRoute(depot, stopNodes);
    steps.push({
      index: 11,
      title: "Delivery Routing (mô phỏng đơn giản hoá của VRP)",
      status: "ok",
      summary: `Gộp ${stopNodes.length} đơn vào 1 chuyến từ ${warehouseById.get(depot)?.name}. Nearest-neighbor: mỗi bước chọn điểm giao gần nhất chưa ghé; chặng giữa các kho dùng khoảng cách Dijkstra trên graph. Không ràng buộc tải trọng / khung giờ.`,
      table: {
        head: ["Thứ tự", "Điểm giao", "Chặng (km)", "Cộng dồn (km)"],
        rows: route.stops.map((s, i) => ({
          cells: [i + 1, s.name, formatNum(s.legKm), formatNum(s.cumulativeKm)],
        })),
      },
    });
  } else {
    steps.push({
      index: 11,
      title: "Delivery Routing (mô phỏng đơn giản hoá của VRP)",
      status: "info",
      summary:
        "Chỉ có 1 điểm giao trong chuyến này → không cần tối ưu thứ tự điểm dừng. Chọn kịch bản G để xem nearest-neighbor + Dijkstra hoạt động.",
    });
  }

  /* FEFO mù quáng để đối chiếu */
  const blindFefo =
    [...candidates].sort((a, b) => a.batch.expiryDate.localeCompare(b.batch.expiryDate))[0] ?? null;

  return {
    node,
    productId,
    quantity,
    params,
    mrsl,
    candidates,
    passed: scored,
    rejected,
    best,
    split,
    blindFefo,
    blindFefoViolates: !!blindFefo && !blindFefo.passed,
    route,
    steps,
  };
}

/** Nearest-neighbor trên các điểm giao; chặng kho→kho lấy từ Dijkstra (km) trên graph tuyến. */
export function nearestNeighborRoute(depotWarehouseId: string, stops: DemandNode[]): DeliveryRoute {
  const dj = dijkstra(depotWarehouseId, "distance");
  const remaining = [...stops];
  const ordered: RouteStop[] = [];
  let cursor = warehouseById.get(depotWarehouseId)!.position;
  let fromDepot = true;
  let total = 0;

  while (remaining.length) {
    let bestIdx = 0;
    let bestKm = Infinity;
    let bestViaGraph = false;
    remaining.forEach((s, i) => {
      let km: number;
      let viaGraph = false;
      if (fromDepot && s.warehouseId) {
        const graphKm = dj.dist[s.warehouseId];
        km = Number.isFinite(graphKm ?? Infinity) ? (graphKm as number) : haversineKm(cursor, s.position);
        viaGraph = true;
      } else {
        km = haversineKm(cursor, s.position);
      }
      if (km < bestKm) {
        bestKm = km;
        bestIdx = i;
        bestViaGraph = viaGraph;
      }
    });
    const [picked] = remaining.splice(bestIdx, 1);
    if (!picked) break;
    total = Math.round((total + bestKm) * 10) / 10;
    ordered.push({
      nodeId: picked.id,
      name: picked.name,
      position: picked.position,
      legKm: Math.round(bestKm * 10) / 10,
      cumulativeKm: total,
      viaGraph: bestViaGraph,
    });
    cursor = picked.position;
    fromDepot = false;
  }

  return { depotWarehouseId, stops: ordered, totalKm: total };
}

export function formatVnd(n: number): string {
  return `${n.toLocaleString("vi-VN")} ₫`;
}
