import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgePercent,
  CheckCircle2,
  Gauge,
  Lock,
  MapPin,
  Package,
  Route as RouteIcon,
  ShoppingCart,
  Split,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { NetworkGraph } from "@/components/scm/NetworkGraph";
import { ParamsPanel } from "@/components/scm/ParamsPanel";
import { PipelineVisualizer } from "@/components/scm/PipelineVisualizer";
import { PlanTable } from "@/components/scm/PlanTable";
import {
  defaultAllocationParams,
  defaultPromotionRule,
  formatDate,
  productById,
  products,
  retailerNodes,
  smartScenarios,
  warehouseById,
  warehouses,
  type AllocationParams,
} from "@/data/mockData";
import { formatNum } from "@/lib/scm-algorithm";
import { allocate, formatVnd, haversineKm } from "@/lib/smart-fefo";

const DEFAULTS = { demandNodeId: "R-TAPHOA-TD", productId: "P1", quantity: 100 };

export function CustomerOrderView() {
  const [demandNodeId, setDemandNodeId] = useState(DEFAULTS.demandNodeId);
  const [productId, setProductId] = useState(DEFAULTS.productId);
  const [quantity, setQuantity] = useState(DEFAULTS.quantity);
  const [params, setParams] = useState<AllocationParams>(defaultAllocationParams);
  const [companions, setCompanions] = useState<
    { demandNodeId: string; productId: string; quantity: number }[]
  >([]);

  const result = useMemo(
    () => allocate({ demandNodeId, productId, quantity, params, companionOrders: companions }),
    [demandNodeId, productId, quantity, params, companions],
  );

  const product = productById.get(productId)!;
  const node = result.node;

  const nearestWarehouseId = useMemo(() => {
    return [...warehouses].sort(
      (a, b) => haversineKm(a.position, node.position) - haversineKm(b.position, node.position),
    )[0]!.id;
  }, [node]);

  const servingId = result.best?.warehouseId ?? result.split?.[0]?.plan.warehouseId ?? null;

  // Giá: lô cận date được giảm giá để khuyến khích tiêu thụ sớm.
  const chosen = result.best;
  const isPromo =
    !!chosen && chosen.remainingOnArrival <= defaultPromotionRule.maxShelfLifeDaysForPromo;
  const unitPrice = isPromo
    ? Math.round(product.unitPrice * (1 - defaultPromotionRule.discountPercent / 100))
    : product.unitPrice;

  function applyScenario(id: string) {
    const s = smartScenarios.find((x) => x.id === id);
    if (!s) return;
    setDemandNodeId(s.demandNodeId);
    setProductId(s.productId);
    setQuantity(s.quantity);
    setCompanions(s.companionOrders ?? []);
  }

  function reset() {
    setDemandNodeId(DEFAULTS.demandNodeId);
    setProductId(DEFAULTS.productId);
    setQuantity(DEFAULTS.quantity);
    setParams(defaultAllocationParams);
    setCompanions([]);
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4" /> Điểm nhận hàng &amp; kho nguồn được chọn
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-2">
              <NetworkGraph
                targetWarehouseId={nearestWarehouseId}
                sourceWarehouseId={servingId}
                weightLabelMode="distance"
                animationKey={0}
                orderPoint={{ label: node.name, position: node.position }}
                lastMileWarehouseId={servingId}
                lastMileLabel={
                  result.best
                    ? `${formatNum(result.best.distanceKm)} km · ETA ${formatNum(result.best.etaDays)} ngày`
                    : undefined
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Chọn kho nguồn bằng <strong>Haversine O(1)</strong> (nét đứt cam = chặng giao thực
              tế). Dijkstra chỉ dùng ở bước 11 — Delivery Routing.
            </p>
          </CardContent>
        </Card>

        <PipelineVisualizer steps={result.steps} />
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="size-4" /> Đơn hàng
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {smartScenarios.map((s) => (
                <Button
                  key={s.id}
                  variant="outline"
                  size="sm"
                  title={s.description}
                  onClick={() => applyScenario(s.id)}
                >
                  {s.label}
                </Button>
              ))}
              <Button variant="ghost" size="sm" onClick={reset}>
                Reset
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label>Đại lý / điểm nhận hàng</Label>
              <Select
                value={demandNodeId}
                onValueChange={(v) => {
                  setDemandNodeId(v);
                  setCompanions([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {retailerNodes.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sản phẩm / SKU</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Số lượng đặt ({product.unit})</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            {companions.length > 0 && (
              <p className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-2 text-xs">
                <RouteIcon className="size-3.5" /> Gộp chuyến với {companions.length} đơn khác — xem
                bước 11.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="size-4" /> MRSL — ngưỡng HSD động theo đại lý
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {result.mrsl.mode === "cold-start" ? (
              <Badge className="gap-1 whitespace-normal bg-warning text-left text-warning-foreground hover:bg-warning">
                <AlertTriangle className="size-3.5 shrink-0" /> Đại lý mới — áp dụng luật an toàn
                tĩnh (còn &gt; {params.coldStartMinShelfLifePercent}% HSD)
              </Badge>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Info
                  label="Sales Velocity"
                  value={`${formatNum(result.mrsl.velocity)} ${product.unit}/ngày`}
                />
                <Info label="Safety Buffer" value={`${params.safetyBufferDays} ngày`} />
              </div>
            )}
            <p className="rounded-md bg-secondary px-3 py-2 font-mono text-xs">
              {result.mrsl.formula}
            </p>
            {result.blindFefo && (
              <div
                className={
                  result.blindFefoViolates
                    ? "rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs"
                    : "rounded-lg border border-border p-3 text-xs"
                }
              >
                <p className="font-semibold">FEFO mù quáng chọn: {result.blindFefo.batch.batchCode}</p>
                <p className="text-muted-foreground">
                  HSD khi tới nơi {formatNum(result.blindFefo.remainingOnArrival)} ngày —{" "}
                  {result.blindFefoViolates
                    ? `vi phạm ngưỡng ${formatNum(result.mrsl.requiredDays)} ngày, hàng sẽ hết hạn trên kệ đại lý.`
                    : "trường hợp này vẫn đạt ngưỡng an toàn."}
                </p>
                {result.best && (
                  <p className="mt-1 font-semibold text-success">
                    Smart FEFO chọn: {result.best.batch.batchCode} (
                    {formatNum(result.best.remainingOnArrival)} ngày HSD khi tới nơi).
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="size-4" /> So sánh Plan sau Hard Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <PlanTable result={result} />
            {result.split && (
              <div className="space-y-2 rounded-lg border border-warning/50 bg-warning/5 p-3">
                <Badge className="gap-1 bg-warning text-warning-foreground hover:bg-warning">
                  <Split className="size-3.5" /> Split Shipment — tách {result.split.length} kho
                </Badge>
                {result.split.map((l) => (
                  <p key={l.plan.id} className="text-xs">
                    <span className="font-semibold">
                      {warehouseById.get(l.plan.warehouseId)?.shortName} · {l.plan.batch.batchCode}
                    </span>{" "}
                    — giao {l.qty} {product.unit}, Inventory_Ahead {l.inventoryAhead}, Effective
                    MRSL {formatNum(l.effectiveMrsl)} ngày, HSD tới nơi{" "}
                    {formatNum(l.plan.remainingOnArrival)} ngày ·{" "}
                    <span className={l.ok ? "font-semibold text-success" : "font-semibold text-destructive"}>
                      {l.ok ? "ĐẠT" : "LOẠI"}
                    </span>
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {chosen ? (
          <Card className="border-success/40 bg-success/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-success">
                <CheckCircle2 className="size-5" /> Xác nhận đơn hàng
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Info label="Kho xuất" value={warehouseById.get(chosen.warehouseId)?.name} />
                <Info label="Lô hàng" value={chosen.batch.batchCode} />
                <Info
                  label="Giao hàng"
                  value={`${formatNum(chosen.distanceKm)} km · ETA ${formatNum(chosen.etaDays)} ngày`}
                />
                <Info label="HSD lô" value={formatDate(chosen.batch.expiryDate)} />
                <Info
                  label="HSD khi tới nơi"
                  value={`${formatNum(chosen.remainingOnArrival)} ngày (MRSL ${formatNum(result.mrsl.requiredDays)})`}
                />
                <Info label="Score" value={formatNum(chosen.score)} />
              </div>
              <Separator />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Lock className="size-3" /> Đã khoá tồn kho
                  </Badge>
                  {isPromo && (
                    <Badge className="gap-1 bg-warning text-warning-foreground hover:bg-warning">
                      <BadgePercent className="size-3" /> -{defaultPromotionRule.discountPercent}%
                      cận date
                    </Badge>
                  )}
                </span>
                <span className="text-xl font-bold text-success">
                  {formatVnd(unitPrice * quantity)}
                </span>
              </div>
            </CardContent>
          </Card>
        ) : (
          !result.split && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="pt-6 text-sm font-medium text-destructive">
                Không có phương án nào thoả cả ràng buộc logistics lẫn ràng buộc MRSL — hệ thống từ
                chối giao thay vì đẩy rủi ro hết hạn xuống đại lý.
              </CardContent>
            </Card>
          )
        )}

        <ParamsPanel params={params} onChange={setParams} />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
