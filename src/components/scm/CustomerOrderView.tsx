import { useMemo, useState } from "react";
import {
  BadgePercent,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Search,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { DecisionLog } from "@/components/scm/DecisionLog";
import { NetworkGraph } from "@/components/scm/NetworkGraph";
import {
  defaultPromotionRule,
  formatDate,
  orderLocations,
  orderScenarios,
  productById,
  products,
  warehouseById,
} from "@/data/mockData";
import {
  evaluateOrder,
  formatVnd,
  selectBatchesForCustomer,
  type BatchChoice,
} from "@/lib/order-algorithm";
import { formatNum } from "@/lib/scm-algorithm";
import { cn } from "@/lib/utils";

const DEFAULTS = { orderLocationId: "OL1", productId: "P1", quantity: 100 };

export function CustomerOrderView() {
  const [orderLocationId, setOrderLocationId] = useState(DEFAULTS.orderLocationId);
  const [productId, setProductId] = useState(DEFAULTS.productId);
  const [quantity, setQuantity] = useState(DEFAULTS.quantity);
  const [promoThreshold, setPromoThreshold] = useState(
    defaultPromotionRule.maxShelfLifeDaysForPromo,
  );
  const [discount, setDiscount] = useState(defaultPromotionRule.discountPercent);
  const [planKind, setPlanKind] = useState<string>("");
  const [choice, setChoice] = useState<"standard" | "promo">("standard");

  const promotionRule = useMemo(
    () => ({ maxShelfLifeDaysForPromo: promoThreshold, discountPercent: discount }),
    [promoThreshold, discount],
  );

  const evaluation = useMemo(
    () => evaluateOrder({ orderLocationId, productId, quantity, promotionRule }),
    [orderLocationId, productId, quantity, promotionRule],
  );

  const plan =
    evaluation.plans.find((p) => p.kind === planKind) ?? evaluation.plans[0] ?? null;

  const selection = useMemo(
    () =>
      plan
        ? selectBatchesForCustomer({
            warehouseId: plan.servingWarehouseId,
            productId,
            quantity,
            deliveryDays: plan.totalDays,
            promotionRule,
          })
        : null,
    [plan, productId, quantity, promotionRule],
  );

  const picked: BatchChoice | null =
    choice === "promo" && selection?.promo ? selection.promo : (selection?.standard ?? null);

  const product = productById.get(productId);
  const log = [...evaluation.log, ...(selection?.log ?? [])];

  function applyScenario(id: string) {
    const s = orderScenarios.find((x) => x.id === id);
    if (!s) return;
    setOrderLocationId(s.orderLocationId);
    setProductId(s.productId);
    setQuantity(s.quantity);
    setPlanKind("");
    setChoice("standard");
  }

  function reset() {
    setOrderLocationId(DEFAULTS.orderLocationId);
    setProductId(DEFAULTS.productId);
    setQuantity(DEFAULTS.quantity);
    setPromoThreshold(defaultPromotionRule.maxShelfLifeDaysForPromo);
    setDiscount(defaultPromotionRule.discountPercent);
    setPlanKind("");
    setChoice("standard");
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4" /> Điểm đặt đơn &amp; kho phục vụ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-2">
              <NetworkGraph
                targetWarehouseId={evaluation.nearest.warehouseId}
                sourceWarehouseId={plan ? plan.servingWarehouseId : null}
                path={plan?.transferPath.length ? plan.transferPath : undefined}
                weightLabelMode="time"
                animationKey={0}
                orderPoint={{
                  label: evaluation.orderLocation.label,
                  position: evaluation.orderLocation.position,
                }}
                lastMileWarehouseId={plan?.lastMileFromWarehouseId ?? null}
                lastMileLabel={
                  plan
                    ? `${formatNum(plan.lastMileKm)} km · ${formatNum(plan.lastMileDays)} ngày`
                    : undefined
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Nét đứt màu cam = chặng giao cuối tới khách. Nét liền đậm = tuyến điều chuyển nội bộ
              (Dijkstra) nếu phương án có điều chuyển.
            </p>
          </CardContent>
        </Card>

        <DecisionLog entries={log} />
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="size-4" /> Bước 1 — Nhập đơn hàng
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {orderScenarios.map((s) => (
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
              <Label>Điểm đặt đơn (nhân viên kinh doanh)</Label>
              <Select value={orderLocationId} onValueChange={setOrderLocationId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {orderLocations.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Số lượng khách đặt</Label>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ngưỡng khuyến mãi: ≤ {promoThreshold} ngày</Label>
                <Slider
                  value={[promoThreshold]}
                  min={0}
                  max={45}
                  step={1}
                  onValueChange={(v) => setPromoThreshold(v[0] ?? 15)}
                  className="pt-3"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Mức giảm giá cận HSD: {discount}%</Label>
                <Slider
                  value={[discount]}
                  min={0}
                  max={50}
                  step={5}
                  onValueChange={(v) => setDiscount(v[0] ?? 20)}
                  className="pt-3"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="size-4" /> Bước 2 &amp; 3 — Kho phục vụ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border p-3 text-sm">
              <p>
                <span className="text-muted-foreground">Kho gần nhất: </span>
                <span className="font-semibold">
                  {warehouseById.get(evaluation.nearest.warehouseId)?.name}
                </span>{" "}
                — {formatNum(evaluation.nearest.distanceKm)} km
              </p>
              <p className="mt-1">
                {evaluation.nearestHasStock ? (
                  <Badge className="bg-success text-success-foreground hover:bg-success">
                    Đủ hàng — phục vụ trực tiếp
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    Không đủ hàng (tồn {evaluation.nearest.totalStock}) — cần Dijkstra
                  </Badge>
                )}
              </p>
            </div>

            {evaluation.plans.length > 1 ? (
              <RadioGroup
                value={plan?.kind ?? ""}
                onValueChange={(v) => setPlanKind(v)}
                className="space-y-2"
              >
                {evaluation.plans.map((p) => (
                  <label
                    key={p.kind}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition",
                      plan?.kind === p.kind ? "border-primary bg-primary/5" : "border-border",
                    )}
                  >
                    <RadioGroupItem value={p.kind} className="mt-1" />
                    <div className="space-y-1">
                      <p className="font-semibold">{p.label}</p>
                      <p className="text-xs text-muted-foreground">
                        Kho xuất: {warehouseById.get(p.servingWarehouseId)?.shortName} · Tổng{" "}
                        {formatNum(p.totalDays)} ngày · {formatNum(p.totalKm)} km
                      </p>
                      <p className="text-xs">{p.tradeOff}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            ) : evaluation.plans.length === 1 ? (
              <p className="text-sm text-muted-foreground">
                {evaluation.plans[0]!.tradeOff} Tổng thời gian giao:{" "}
                {formatNum(evaluation.plans[0]!.totalDays)} ngày.
              </p>
            ) : (
              <p className="text-sm font-medium text-destructive">
                Không kho nào có lô đủ số lượng cho đơn hàng này.
              </p>
            )}
          </CardContent>
        </Card>

        {selection && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="size-4" /> Bước 4 — Chọn lô hàng giao khách
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {selection.standard && (
                  <BatchCard
                    title="Lô tiêu chuẩn"
                    subtitle="HSD dài nhất — theo yêu cầu khách hàng"
                    choice={selection.standard}
                    quantity={quantity}
                    unit={product?.unit ?? ""}
                    selected={choice === "standard"}
                    onSelect={() => setChoice("standard")}
                  />
                )}
                {selection.promo ? (
                  <BatchCard
                    title="Lô khuyến mãi"
                    subtitle="Cận HSD — giảm giá để giảm lãng phí"
                    choice={selection.promo}
                    quantity={quantity}
                    unit={product?.unit ?? ""}
                    selected={choice === "promo"}
                    onSelect={() => setChoice("promo")}
                    promo
                  />
                ) : (
                  <div className="flex items-center rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                    Không có lô cận hạn tại kho này (ngưỡng ≤ {promoThreshold} ngày).
                  </div>
                )}
              </div>
              {selection.standard && selection.promo && (
                <p className="rounded-lg bg-secondary/50 p-3 text-xs">
                  Chênh lệch: khách nhận ít hơn{" "}
                  <span className="font-semibold text-destructive">
                    {formatNum(
                      selection.standard.remainingShelfLifeOnDelivery -
                        selection.promo.remainingShelfLifeOnDelivery,
                    )}{" "}
                    ngày HSD
                  </span>{" "}
                  nhưng tiết kiệm{" "}
                  <span className="font-semibold text-success">
                    {formatVnd(selection.standard.totalPrice - selection.promo.totalPrice)}
                  </span>
                  .
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {plan && picked && (
          <Card className="border-success/40 bg-success/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-success">
                <CheckCircle2 className="size-5" /> Bước 5 — Xác nhận đơn hàng
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Info label="Kho phục vụ" value={warehouseById.get(plan.servingWarehouseId)?.name} />
                <Info label="Phương án" value={plan.label} />
                <Info
                  label="Thời gian giao"
                  value={`${formatNum(plan.totalDays)} ngày · ${formatNum(plan.totalKm)} km`}
                />
                <Info label="Lô hàng" value={picked.batch.batchCode} />
                <Info label="HSD lô" value={formatDate(picked.batch.expiryDate)} />
                <Info
                  label="HSD còn lại khi giao"
                  value={`${formatNum(picked.remainingShelfLifeOnDelivery)} ngày`}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Truck className="size-4" /> {quantity} {product?.unit} × {formatVnd(picked.finalUnitPrice)}
                  {picked.isPromo && (
                    <Badge className="gap-1 bg-warning text-warning-foreground hover:bg-warning">
                      <BadgePercent className="size-3" /> -{picked.discountPercent}%
                    </Badge>
                  )}
                </span>
                <span className="text-xl font-bold text-success">
                  {formatVnd(picked.totalPrice)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
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

function BatchCard({
  title,
  subtitle,
  choice,
  quantity,
  unit,
  selected,
  onSelect,
  promo,
}: {
  title: string;
  subtitle: string;
  choice: BatchChoice;
  quantity: number;
  unit: string;
  selected: boolean;
  onSelect: () => void;
  promo?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-xl border p-3 text-left transition",
        selected
          ? promo
            ? "border-warning bg-warning/10"
            : "border-primary bg-primary/5"
          : "border-border hover:bg-secondary/50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        {promo && (
          <Badge className="gap-1 bg-warning text-warning-foreground hover:bg-warning">
            <BadgePercent className="size-3" /> Giảm giá do cận HSD
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      <p className="mt-2 font-mono text-sm">{choice.batch.batchCode}</p>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="size-3" /> HSD khi giao:{" "}
        {formatNum(choice.remainingShelfLifeOnDelivery)} ngày · {formatDate(choice.batch.expiryDate)}
      </p>
      <p className="mt-2 text-lg font-bold">
        {formatVnd(choice.totalPrice)}
        {choice.discountPercent > 0 && (
          <span className="ml-2 text-xs font-normal text-muted-foreground line-through">
            {formatVnd(choice.unitPrice * quantity)}
          </span>
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {quantity} {unit} × {formatVnd(choice.finalUnitPrice)}
      </p>
    </button>
  );
}