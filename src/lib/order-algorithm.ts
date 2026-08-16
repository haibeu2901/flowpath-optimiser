import {
  addDays,
  batches as allBatches,
  warehouses as allWarehouses,
  defaultPromotionRule,
  KM_PER_UNIT,
  LAST_MILE_KM_PER_DAY,
  orderLocationById,
  productById,
  TODAY,
  warehouseById,
  type Batch,
  type OrderLocation,
  type PromotionRule,
} from "@/data/mockData";
import {
  daysBetween,
  dijkstra,
  formatNum,
  pathMetrics,
  reconstructPath,
  type DijkstraResult,
} from "@/lib/scm-algorithm";

export interface WarehouseProximity {
  warehouseId: string;
  euclidUnits: number;
  distanceKm: number;
  lastMileDays: number;
  hasEnoughStock: boolean;
  totalStock: number;
}

export interface BatchChoice {
  batch: Batch;
  daysUntilExpiry: number;
  remainingShelfLifeOnDelivery: number;
  unitPrice: number;
  discountPercent: number;
  finalUnitPrice: number;
  totalPrice: number;
  isPromo: boolean;
}

export type PlanKind = "direct-nearest" | "direct-alternate" | "transfer-then-deliver";

export interface FulfillmentPlan {
  kind: PlanKind;
  label: string;
  servingWarehouseId: string;
  /** Tuyến điều chuyển giữa các kho (rỗng nếu giao thẳng). */
  transferPath: string[];
  transferDays: number;
  transferKm: number;
  lastMileFromWarehouseId: string;
  lastMileDays: number;
  lastMileKm: number;
  totalDays: number;
  totalKm: number;
  tradeOff: string;
}

export interface OrderEvaluation {
  orderLocation: OrderLocation;
  productId: string;
  quantity: number;
  promotionRule: PromotionRule;
  proximity: WarehouseProximity[];
  nearest: WarehouseProximity;
  nearestHasStock: boolean;
  alternate: WarehouseProximity | null;
  dijkstra: DijkstraResult | null;
  plans: FulfillmentPlan[];
  log: string[];
}

export function euclid(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function stockAt(warehouseId: string, productId: string, quantity: number) {
  const list = allBatches.filter(
    (b) => b.warehouseId === warehouseId && b.productId === productId,
  );
  const total = list.reduce((s, b) => s + b.quantity, 0);
  const usable = list.filter((b) => b.quantity >= quantity);
  return { list, total, usable, ok: usable.length > 0 };
}

function proximityOf(
  warehouseId: string,
  location: OrderLocation,
  productId: string,
  quantity: number,
): WarehouseProximity {
  const w = warehouseById.get(warehouseId)!;
  const units = euclid(w.position, location.position);
  const km = Math.round(units * KM_PER_UNIT * 10) / 10;
  const s = stockAt(warehouseId, productId, quantity);
  return {
    warehouseId,
    euclidUnits: units,
    distanceKm: km,
    lastMileDays: Math.round((km / LAST_MILE_KM_PER_DAY) * 10) / 10,
    hasEnoughStock: s.ok,
    totalStock: s.total,
  };
}

export function evaluateOrder(params: {
  orderLocationId: string;
  productId: string;
  quantity: number;
  promotionRule?: PromotionRule;
}): OrderEvaluation {
  const {
    orderLocationId,
    productId,
    quantity,
    promotionRule = defaultPromotionRule,
  } = params;

  const location = orderLocationById.get(orderLocationId)!;
  const product = productById.get(productId)!;
  const log: string[] = [];

  const proximity = allWarehouses
    .map((w) => proximityOf(w.id, location, productId, quantity))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const nearest = proximity[0]!;
  const nearestName = warehouseById.get(nearest.warehouseId)?.name;

  log.push(
    `Điểm đặt đơn: ${location.label} — cần ${quantity} ${product.unit} ${product.name} (${product.sku}).`,
  );
  log.push(
    `Kho gần nhất với điểm đặt đơn là ${nearestName} (${formatNum(nearest.distanceKm)} km, giao chặng cuối ~${formatNum(nearest.lastMileDays)} ngày).`,
  );

  const plans: FulfillmentPlan[] = [];
  let alternate: WarehouseProximity | null = null;
  let dj: DijkstraResult | null = null;

  if (nearest.hasEnoughStock) {
    log.push(
      `${nearestName} còn đủ hàng (tồn ${nearest.totalStock} ${product.unit}) → phục vụ trực tiếp, không cần điều chuyển.`,
    );
    plans.push({
      kind: "direct-nearest",
      label: "Giao thẳng từ kho gần nhất",
      servingWarehouseId: nearest.warehouseId,
      transferPath: [],
      transferDays: 0,
      transferKm: 0,
      lastMileFromWarehouseId: nearest.warehouseId,
      lastMileDays: nearest.lastMileDays,
      lastMileKm: nearest.distanceKm,
      totalDays: nearest.lastMileDays,
      totalKm: nearest.distanceKm,
      tradeOff: "Phương án nhanh nhất: hàng có sẵn tại kho gần nhất.",
    });
  } else {
    log.push(
      `${nearestName} không đủ hàng cho SKU "${product.name}" (tồn ${nearest.totalStock} ${product.unit} < ${quantity}). Chạy Dijkstra từ ${nearestName} để tìm kho thay thế...`,
    );
    dj = dijkstra(nearest.warehouseId, "time");
    const candidates = proximity
      .filter((p) => p.warehouseId !== nearest.warehouseId && p.hasEnoughStock)
      .map((p) => ({
        p,
        transferDays: dj!.dist[p.warehouseId] ?? Number.POSITIVE_INFINITY,
      }))
      .filter((c) => Number.isFinite(c.transferDays))
      .sort((a, b) => a.transferDays - b.transferDays);

    const chosen = candidates[0];
    if (chosen) {
      alternate = chosen.p;
      const altName = warehouseById.get(alternate.warehouseId)?.name;
      const path = reconstructPath(dj.prev, nearest.warehouseId, alternate.warehouseId)
        .slice()
        .reverse();
      const m = pathMetrics(path);
      log.push(
        `${altName} là kho gần nhất còn đủ hàng theo Dijkstra (thời gian vận chuyển ${formatNum(m.transitTimeDays)} ngày, ${m.distanceKm} km).`,
      );

      plans.push({
        kind: "direct-alternate",
        label: "(a) Giao thẳng cho khách từ kho thay thế",
        servingWarehouseId: alternate.warehouseId,
        transferPath: [],
        transferDays: 0,
        transferKm: 0,
        lastMileFromWarehouseId: alternate.warehouseId,
        lastMileDays: alternate.lastMileDays,
        lastMileKm: alternate.distanceKm,
        totalDays: alternate.lastMileDays,
        totalKm: alternate.distanceKm,
        tradeOff:
          "Bỏ qua bước điều chuyển nội bộ; quãng đường giao tới khách xa hơn nhưng thường nhanh hơn tổng thể.",
      });

      plans.push({
        kind: "transfer-then-deliver",
        label: "(b) Điều chuyển về kho gần nhất rồi giao khách",
        servingWarehouseId: alternate.warehouseId,
        transferPath: path,
        transferDays: m.transitTimeDays,
        transferKm: m.distanceKm,
        lastMileFromWarehouseId: nearest.warehouseId,
        lastMileDays: nearest.lastMileDays,
        lastMileKm: nearest.distanceKm,
        totalDays: Math.round((m.transitTimeDays + nearest.lastMileDays) * 10) / 10,
        totalKm: Math.round((m.distanceKm + nearest.distanceKm) * 10) / 10,
        tradeOff:
          "Tái sử dụng luồng điều chuyển nội bộ, hàng nằm sẵn ở kho gần khách cho các đơn sau — nhưng tổng thời gian giao dài hơn, HSD khi tới tay khách ngắn hơn.",
      });

      const a = plans[0]!;
      const b = plans[1]!;
      log.push(
        `So sánh: (a) giao thẳng ${formatNum(a.totalDays)} ngày so với (b) điều chuyển trước ${formatNum(b.totalDays)} ngày — chênh lệch ${formatNum(Math.abs(a.totalDays - b.totalDays))} ngày HSD khi tới tay khách.`,
      );
    } else {
      log.push(
        `Không kho nào trong mạng lưới có lô đủ ${quantity} ${product.unit} cho SKU này. Đề xuất tách đơn hoặc đặt hàng nhà cung cấp.`,
      );
    }
  }

  return {
    orderLocation: location,
    productId,
    quantity,
    promotionRule,
    proximity,
    nearest,
    nearestHasStock: nearest.hasEnoughStock,
    alternate,
    dijkstra: dj,
    plans,
    log,
  };
}

export interface BatchSelection {
  standard: BatchChoice | null;
  promo: BatchChoice | null;
  all: BatchChoice[];
  log: string[];
}

/** Vấn đề 4: khách muốn HSD dài nhất; lô cận hạn được gắn khuyến mãi để dung hoà. */
export function selectBatchesForCustomer(params: {
  warehouseId: string;
  productId: string;
  quantity: number;
  deliveryDays: number;
  promotionRule?: PromotionRule;
  today?: Date;
}): BatchSelection {
  const {
    warehouseId,
    productId,
    quantity,
    deliveryDays,
    promotionRule = defaultPromotionRule,
    today = TODAY,
  } = params;

  const product = productById.get(productId)!;
  const deliveryDate = addDays(today, deliveryDays);
  const log: string[] = [];

  const all: BatchChoice[] = allBatches
    .filter((b) => b.warehouseId === warehouseId && b.productId === productId && b.quantity >= quantity)
    .map((batch) => {
      const expiry = new Date(`${batch.expiryDate}T00:00:00.000Z`);
      const remaining = Math.round(daysBetween(deliveryDate, expiry) * 10) / 10;
      const isPromo = remaining <= promotionRule.maxShelfLifeDaysForPromo;
      const discount = isPromo ? promotionRule.discountPercent : 0;
      const finalUnitPrice = Math.round(product.unitPrice * (1 - discount / 100));
      return {
        batch,
        daysUntilExpiry: Math.round(daysBetween(today, expiry) * 10) / 10,
        remainingShelfLifeOnDelivery: remaining,
        unitPrice: product.unitPrice,
        discountPercent: discount,
        finalUnitPrice,
        totalPrice: finalUnitPrice * quantity,
        isPromo,
      };
    })
    .sort((a, b) => b.remainingShelfLifeOnDelivery - a.remainingShelfLifeOnDelivery);

  const standard = all[0] ?? null;
  // Trong các lô cận hạn, ưu tiên lô hết hạn sớm nhất (FEFO) để giảm lãng phí.
  const promoList = all.filter((c) => c.isPromo);
  const promo = promoList[promoList.length - 1] ?? null;

  const whName = warehouseById.get(warehouseId)?.name;
  if (!standard) {
    log.push(`Không có lô nào tại ${whName} đủ ${quantity} ${product.unit}.`);
    return { standard: null, promo: null, all, log };
  }

  log.push(
    `Lô tiêu chuẩn (khách yêu cầu HSD dài nhất): ${standard.batch.batchCode}, còn ${formatNum(standard.remainingShelfLifeOnDelivery)} ngày HSD khi giao, giá gốc.`,
  );
  for (const c of all) {
    if (!c.isPromo) {
      log.push(
        `Lô ${c.batch.batchCode} bị loại khỏi diện khuyến mãi vì HSD còn lại ${formatNum(c.remainingShelfLifeOnDelivery)} ngày > ngưỡng ${promotionRule.maxShelfLifeDaysForPromo} ngày.`,
      );
    }
  }
  if (promo) {
    log.push(
      `Đề xuất lô ${promo.batch.batchCode} (HSD còn ${formatNum(promo.remainingShelfLifeOnDelivery)} ngày) làm lựa chọn khuyến mãi, giảm ${promotionRule.discountPercent}%.`,
    );
  } else {
    log.push(`Không có lô cận hạn tại ${whName} — chỉ có lựa chọn tiêu chuẩn.`);
  }

  return { standard, promo: promo && promo !== standard ? promo : null, all, log };
}

export function formatVnd(n: number): string {
  return `${n.toLocaleString("vi-VN")} ₫`;
}