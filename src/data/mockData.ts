export interface Warehouse {
  id: string;
  name: string;
  shortName: string;
  type: "central" | "branch";
  position: { x: number; y: number };
}

export interface RouteEdge {
  fromWarehouseId: string;
  toWarehouseId: string;
  distanceKm: number;
  transitTimeDays: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string;
  shelfLifeDays: number;
  /** Giá bán lẻ 1 đơn vị (VND) — dùng cho module đơn hàng khách hàng. */
  unitPrice: number;
}

export interface Batch {
  id: string;
  productId: string;
  warehouseId: string;
  batchCode: string;
  quantity: number;
  manufactureDate: string;
  expiryDate: string;
}

/** Ngày "hôm nay" cố định để demo luôn cho kết quả giống nhau. */
export const TODAY = new Date("2026-08-13T00:00:00.000Z");

export function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86400000);
}

function iso(offsetDays: number): string {
  return addDays(TODAY, offsetDays).toISOString().slice(0, 10);
}

export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export const warehouses: Warehouse[] = [
  {
    id: "W-HN",
    name: "Kho Trung tâm Hà Nội",
    shortName: "Hà Nội",
    type: "central",
    position: { x: 150, y: 90 },
  },
  {
    id: "W-HP",
    name: "Kho Chi nhánh Hải Phòng",
    shortName: "Hải Phòng",
    type: "branch",
    position: { x: 380, y: 60 },
  },
  {
    id: "W-DN",
    name: "Kho Chi nhánh Đà Nẵng",
    shortName: "Đà Nẵng",
    type: "branch",
    position: { x: 430, y: 215 },
  },
  {
    id: "W-NT",
    name: "Kho Chi nhánh Nha Trang",
    shortName: "Nha Trang",
    type: "branch",
    position: { x: 470, y: 360 },
  },
  {
    id: "W-HCM",
    name: "Kho Trung tâm HCM",
    shortName: "TP.HCM",
    type: "central",
    position: { x: 150, y: 400 },
  },
  {
    id: "W-BD",
    name: "Kho Chi nhánh Bình Dương",
    shortName: "Bình Dương",
    type: "branch",
    position: { x: 290, y: 320 },
  },
  {
    id: "W-CT",
    name: "Kho Chi nhánh Cần Thơ",
    shortName: "Cần Thơ",
    type: "branch",
    position: { x: 250, y: 495 },
  },
];

export const routes: RouteEdge[] = [
  { fromWarehouseId: "W-HN", toWarehouseId: "W-HP", distanceKm: 120, transitTimeDays: 0.5 },
  { fromWarehouseId: "W-HN", toWarehouseId: "W-DN", distanceKm: 770, transitTimeDays: 2 },
  { fromWarehouseId: "W-HP", toWarehouseId: "W-DN", distanceKm: 880, transitTimeDays: 3 },
  { fromWarehouseId: "W-DN", toWarehouseId: "W-NT", distanceKm: 530, transitTimeDays: 1 },
  { fromWarehouseId: "W-NT", toWarehouseId: "W-HCM", distanceKm: 430, transitTimeDays: 1.5 },
  { fromWarehouseId: "W-NT", toWarehouseId: "W-CT", distanceKm: 600, transitTimeDays: 2.5 },
  { fromWarehouseId: "W-HCM", toWarehouseId: "W-DN", distanceKm: 960, transitTimeDays: 2 },
  { fromWarehouseId: "W-HCM", toWarehouseId: "W-BD", distanceKm: 30, transitTimeDays: 0.5 },
  { fromWarehouseId: "W-HCM", toWarehouseId: "W-CT", distanceKm: 170, transitTimeDays: 1 },
  { fromWarehouseId: "W-BD", toWarehouseId: "W-CT", distanceKm: 195, transitTimeDays: 1.2 },
  { fromWarehouseId: "W-HN", toWarehouseId: "W-HCM", distanceKm: 1710, transitTimeDays: 3 },
];

export const products: Product[] = [
  { id: "P1", sku: "SKU-MILK-1L", name: "Sữa tươi tiệt trùng 1L", unit: "thùng", shelfLifeDays: 45, unitPrice: 420000 },
  { id: "P2", sku: "SKU-YOG-100", name: "Sữa chua có đường 100g", unit: "lốc", shelfLifeDays: 35, unitPrice: 32000 },
  { id: "P3", sku: "SKU-BREAD-F", name: "Bánh mì tươi đóng gói", unit: "thùng", shelfLifeDays: 20, unitPrice: 180000 },
  { id: "P4", sku: "SKU-JUICE-1L", name: "Nước ép trái cây 1L", unit: "thùng", shelfLifeDays: 60, unitPrice: 350000 },
  { id: "P5", sku: "SKU-SOY-330", name: "Sữa hạt óc chó 330ml", unit: "thùng", shelfLifeDays: 50, unitPrice: 480000 },
];

type RawBatch = [
  productId: string,
  warehouseId: string,
  code: string,
  quantity: number,
  expiryOffset: number,
];

const rawBatches: RawBatch[] = [
  // ----- P1 Sữa tươi (45 ngày) -----
  ["P1", "W-HCM", "LOT-M-1101", 200, 32],
  ["P1", "W-HCM", "LOT-M-1102", 300, 40],
  ["P1", "W-HCM", "LOT-M-1103", 150, 12],
  ["P1", "W-BD", "LOT-M-1201", 120, 28],
  ["P1", "W-BD", "LOT-M-1202", 80, 44],
  ["P1", "W-BD", "LOT-M-1203", 200, 18],
  ["P1", "W-NT", "LOT-M-1301", 500, 31],
  ["P1", "W-HN", "LOT-M-1401", 400, 33],
  ["P1", "W-CT", "LOT-M-1501", 20, 18],
  ["P1", "W-DN", "LOT-M-1601", 60, 26],

  // ----- P2 Sữa chua (35 ngày) -----
  ["P2", "W-HCM", "LOT-Y-2101", 150, 38],
  ["P2", "W-HCM", "LOT-Y-2102", 100, 30],
  ["P2", "W-HN", "LOT-Y-2201", 200, 36],
  ["P2", "W-HP", "LOT-Y-2301", 90, 33],
  ["P2", "W-HP", "LOT-Y-2302", 140, 14],
  ["P2", "W-NT", "LOT-Y-2401", 60, 34],
  ["P2", "W-CT", "LOT-Y-2501", 300, 45],
  ["P2", "W-DN", "LOT-Y-2601", 25, 9],
  ["P2", "W-BD", "LOT-Y-2701", 110, 27],

  // ----- P3 Bánh mì tươi (20 ngày) -----
  ["P3", "W-HCM", "LOT-B-3101", 200, 18],
  ["P3", "W-HN", "LOT-B-3201", 180, 16],
  ["P3", "W-DN", "LOT-B-3301", 120, 20],
  ["P3", "W-CT", "LOT-B-3401", 90, 15],
  ["P3", "W-BD", "LOT-B-3501", 140, 11],
  ["P3", "W-HP", "LOT-B-3601", 30, 7],

  // ----- P4 Nước ép (60 ngày) -----
  ["P4", "W-HCM", "LOT-J-4101", 260, 52],
  ["P4", "W-HCM", "LOT-J-4102", 180, 21],
  ["P4", "W-HN", "LOT-J-4201", 300, 47],
  ["P4", "W-NT", "LOT-J-4301", 150, 39],
  ["P4", "W-CT", "LOT-J-4401", 75, 34],
  ["P4", "W-BD", "LOT-J-4501", 210, 58],

  // ----- P5 Sữa hạt (50 ngày) -----
  ["P5", "W-HN", "LOT-S-5101", 220, 44],
  ["P5", "W-HP", "LOT-S-5201", 130, 37],
  ["P5", "W-DN", "LOT-S-5301", 90, 25],
  ["P5", "W-HCM", "LOT-S-5401", 340, 49],
  ["P5", "W-BD", "LOT-S-5501", 160, 13],
];

const shelfLifeById = new Map(products.map((p) => [p.id, p.shelfLifeDays]));

export const batches: Batch[] = rawBatches.map(
  ([productId, warehouseId, batchCode, quantity, expiryOffset], i) => ({
    id: `B${i + 1}`,
    productId,
    warehouseId,
    batchCode,
    quantity,
    manufactureDate: iso(expiryOffset - (shelfLifeById.get(productId) ?? 30)),
    expiryDate: iso(expiryOffset),
  }),
);

export interface DemoScenario {
  id: string;
  label: string;
  description: string;
  targetWarehouseId: string;
  productId: string;
  quantity: number;
  threshold: number;
}

export const demoScenarios: DemoScenario[] = [
  {
    id: "S1",
    label: "Kịch bản mẫu 1",
    description: "Chỉ 1 kho nguồn hợp lệ, tuyến đi trực tiếp",
    targetWarehouseId: "W-CT",
    productId: "P1",
    quantity: 100,
    threshold: 30,
  },
  {
    id: "S2",
    label: "Kịch bản mẫu 2",
    description: "Nhiều kho khả thi, có lô bị loại vì HSD",
    targetWarehouseId: "W-DN",
    productId: "P2",
    quantity: 80,
    threshold: 30,
  },
  {
    id: "S3",
    label: "Kịch bản mẫu 3",
    description: "Không có nguồn hàng phù hợp",
    targetWarehouseId: "W-HP",
    productId: "P3",
    quantity: 50,
    threshold: 30,
  },
];

export const warehouseById = new Map(warehouses.map((w) => [w.id, w]));
export const productById = new Map(products.map((p) => [p.id, p]));

/* ============================================================
 * MODULE 2 — Đặt đơn hàng khách hàng (Vấn đề 3 & 4)
 * ============================================================ */

export interface OrderLocation {
  id: string;
  label: string;
  position: { x: number; y: number };
}

export interface SalesOrder {
  id: string;
  orderLocationId: string;
  productId: string;
  quantity: number;
}

export interface PromotionRule {
  /** Lô có HSD còn lại <= giá trị này (ngày) được đưa vào diện khuyến mãi. */
  maxShelfLifeDaysForPromo: number;
  discountPercent: number;
}

export const orderLocations: OrderLocation[] = [
  { id: "OL1", label: "Điểm đặt đơn - Quận 7, TP.HCM", position: { x: 185, y: 425 } },
  { id: "OL2", label: "Khách hàng khu vực Thủ Đức", position: { x: 275, y: 350 } },
  { id: "OL3", label: "Đại lý Ninh Kiều, Cần Thơ", position: { x: 235, y: 520 } },
];

export const orderLocationById = new Map(orderLocations.map((o) => [o.id, o]));

export const defaultPromotionRule: PromotionRule = {
  maxShelfLifeDaysForPromo: 15,
  discountPercent: 20,
};

export interface OrderScenario {
  id: string;
  label: string;
  description: string;
  orderLocationId: string;
  productId: string;
  quantity: number;
}

export const orderScenarios: OrderScenario[] = [
  {
    id: "A",
    label: "Kịch bản A",
    description: "Kho gần nhất đủ hàng, không có lô cận hạn",
    orderLocationId: "OL3",
    productId: "P2",
    quantity: 200,
  },
  {
    id: "B",
    label: "Kịch bản B",
    description: "Kho gần nhất hết hàng → Dijkstra tìm kho thay thế, so sánh 2 phương án",
    orderLocationId: "OL2",
    productId: "P2",
    quantity: 300,
  },
  {
    id: "C",
    label: "Kịch bản C",
    description: "Có cả lô tiêu chuẩn và lô khuyến mãi cận HSD",
    orderLocationId: "OL1",
    productId: "P1",
    quantity: 100,
  },
];

/** Quy đổi 1 đơn vị toạ độ trên sơ đồ ≈ 1.2 km thực tế (chỉ để minh hoạ). */
export const KM_PER_UNIT = 1.2;
/** Tốc độ giao chặng cuối: 400 km/ngày. */
export const LAST_MILE_KM_PER_DAY = 400;
/* ============================================================
 * SMART FEFO — MRSL động, Hard Filter, Weighted Scoring
 * ============================================================ */

export interface SalesRecord {
  date: string;
  productId: string;
  unitsSold: number;
}

export interface DemandNode {
  id: string;
  name: string;
  type: "branch_warehouse" | "retailer";
  position: { x: number; y: number };
  /** Kho tương ứng (chỉ với type = branch_warehouse) */
  warehouseId?: string;
  salesHistory: SalesRecord[];
  isColdStart: boolean;
}

export interface AllocationParams {
  safetyBufferDays: number;
  maxServingDistanceKm: number;
  weightDistance: number;
  weightExpiry: number;
  coldStartMinShelfLifePercent: number;
}

export const defaultAllocationParams: AllocationParams = {
  safetyBufferDays: 3,
  maxServingDistanceKm: 150,
  weightDistance: 0.4,
  weightExpiry: 0.6,
  coldStartMinShelfLifePercent: 50,
};

/** Tốc độ bán trung bình (đơn vị/ngày) dùng để sinh lịch sử bán hàng giả lập. */
const baseVelocity: Record<string, Record<string, number>> = {
  "DN-W-HP": { P1: 18, P2: 12, P3: 8, P5: 6 },
  "DN-W-DN": { P1: 22, P2: 15, P3: 10, P5: 7 },
  "DN-W-NT": { P1: 14, P2: 9, P4: 6 },
  "DN-W-BD": { P1: 26, P2: 18, P3: 12, P4: 9 },
  "DN-W-CT": { P1: 10, P2: 7, P3: 5, P4: 4 },
  "DN-W-HN": { P1: 40, P2: 30, P3: 18, P5: 14 },
  "DN-W-HCM": { P1: 45, P2: 32, P3: 20, P4: 16 },
  "R-SUPER-Q7": { P1: 40, P2: 26, P4: 12 },
  "R-TAPHOA-TD": { P1: 5, P2: 4, P3: 3 },
  "R-CT-NINHKIEU": { P1: 12, P2: 8, P4: 5 },
  "R-NEW-BD": {},
};

/** Sinh lịch sử 10 ngày gần nhất, dao động ±20% quanh tốc độ nền (tất định). */
function makeHistory(nodeId: string): SalesRecord[] {
  const map = baseVelocity[nodeId] ?? {};
  const out: SalesRecord[] = [];
  let seed = nodeId.length * 7 + 13;
  for (const [productId, v] of Object.entries(map)) {
    for (let d = 10; d >= 1; d--) {
      seed = (seed * 1103515245 + 12345) % 2147483647;
      const jitter = 0.8 + ((seed >>> 8) % 41) / 100; // 0.80 → 1.20
      out.push({
        date: iso(-d),
        productId,
        unitsSold: Math.max(1, Math.round(v * jitter)),
      });
    }
  }
  return out;
}

export const demandNodes: DemandNode[] = [
  ...warehouses.map<DemandNode>((w) => ({
    id: `DN-${w.id}`,
    name: w.name,
    type: "branch_warehouse",
    position: w.position,
    warehouseId: w.id,
    salesHistory: makeHistory(`DN-${w.id}`),
    isColdStart: false,
  })),
  {
    id: "R-SUPER-Q7",
    name: "Siêu thị lớn — Quận 7, TP.HCM",
    type: "retailer",
    position: { x: 185, y: 425 },
    salesHistory: makeHistory("R-SUPER-Q7"),
    isColdStart: false,
  },
  {
    id: "R-TAPHOA-TD",
    name: "Tạp hoá nhỏ — Thủ Đức (bán chậm)",
    type: "retailer",
    position: { x: 275, y: 350 },
    salesHistory: makeHistory("R-TAPHOA-TD"),
    isColdStart: false,
  },
  {
    id: "R-CT-NINHKIEU",
    name: "Đại lý Ninh Kiều — Cần Thơ",
    type: "retailer",
    position: { x: 235, y: 520 },
    salesHistory: makeHistory("R-CT-NINHKIEU"),
    isColdStart: false,
  },
  {
    id: "R-NEW-BD",
    name: "Đại lý mới mở — Bình Dương (chưa có lịch sử)",
    type: "retailer",
    position: { x: 330, y: 300 },
    salesHistory: [],
    isColdStart: true,
  },
];

export const demandNodeById = new Map(demandNodes.map((n) => [n.id, n]));
export const retailerNodes = demandNodes.filter((n) => n.type === "retailer");

export interface SmartScenario {
  id: string;
  label: string;
  description: string;
  demandNodeId: string;
  productId: string;
  quantity: number;
  /** Các đơn khác cùng chuyến xe (bước 11 — Delivery Routing) */
  companionOrders?: { demandNodeId: string; productId: string; quantity: number }[];
}

export const smartScenarios: SmartScenario[] = [
  {
    id: "D",
    label: "D · FEFO mù quáng vs Smart FEFO",
    description:
      "Đại lý bán chậm: lô cận date nhất bị Hard Filter loại vì không đủ MRSL, Smart FEFO chọn lô khác",
    demandNodeId: "R-TAPHOA-TD",
    productId: "P1",
    quantity: 100,
  },
  {
    id: "E",
    label: "E · Split Shipment",
    description: "Đơn lớn, không kho đơn lẻ nào đủ hàng → tách 2 kho, tính Effective MRSL",
    demandNodeId: "R-SUPER-Q7",
    productId: "P2",
    quantity: 420,
  },
  {
    id: "F",
    label: "F · Cold Start",
    description: "Đại lý mới chưa có lịch sử bán → áp luật tĩnh còn > 50% tuổi đời",
    demandNodeId: "R-NEW-BD",
    productId: "P1",
    quantity: 60,
  },
  {
    id: "G",
    label: "G · Nhiều đơn cùng chuyến",
    description: "3 đơn gộp 1 chuyến xe → nearest-neighbor sắp thứ tự điểm dừng (VRP rút gọn)",
    demandNodeId: "R-SUPER-Q7",
    productId: "P1",
    quantity: 80,
    companionOrders: [
      { demandNodeId: "R-TAPHOA-TD", productId: "P1", quantity: 30 },
      { demandNodeId: "R-CT-NINHKIEU", productId: "P1", quantity: 40 },
    ],
  },
];

/** Tốc độ xe tải trung bình dùng để ước lượng ETA từ khoảng cách Haversine. */
export const TRUCK_KMH = 45;
export const TRUCK_HOURS_PER_DAY = 10;
