import { useMemo, useState } from "react";
import {
  ChevronRight,
  PlayCircle,
  RotateCcw,
  Search,
  Truck,
  Warehouse as WarehouseIcon,
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
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InventoryTable } from "@/components/scm/InventoryTable";
import { NetworkGraph } from "@/components/scm/NetworkGraph";
import { ResultPanel } from "@/components/scm/ResultPanel";
import {
  defaultAllocationParams,
  demandNodeById,
  demoScenarios,
  products,
  warehouses,
} from "@/data/mockData";
import { computeMrsl } from "@/lib/smart-fefo";
import {
  evaluateTransfer,
  formatNum,
  type EvaluationResult,
  type WeightMode,
} from "@/lib/scm-algorithm";


const DEFAULTS = {
  targetWarehouseId: "W-CT",
  productId: "P1",
  quantity: 100,
  safetyBufferDays: defaultAllocationParams.safetyBufferDays,
};

export function InternalTransferView() {
  const [targetWarehouseId, setTarget] = useState(DEFAULTS.targetWarehouseId);
  const [productId, setProductId] = useState(DEFAULTS.productId);
  const [quantity, setQuantity] = useState(DEFAULTS.quantity);
  const [safetyBufferDays, setSafetyBuffer] = useState(DEFAULTS.safetyBufferDays);
  const [weightMode, setWeightMode] = useState<WeightMode>("time");
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [animationKey, setAnimationKey] = useState(0);

  // MRSL động: ngưỡng HSD tối thiểu tính riêng theo tốc độ bán của chính kho nhận hàng,
  // thay cho ngưỡng cứng 30 ngày áp dụng cho mọi kho.
  const mrsl = useMemo(
    () =>
      computeMrsl(demandNodeById.get(`DN-${targetWarehouseId}`)!, productId, quantity, {
        ...defaultAllocationParams,
        safetyBufferDays,
      }),
    [targetWarehouseId, productId, quantity, safetyBufferDays],
  );
  const threshold = mrsl.requiredDays;

  const preview = useMemo(
    () => evaluateTransfer({ targetWarehouseId, productId, quantity, threshold, weightMode }),
    [targetWarehouseId, productId, quantity, threshold, weightMode],
  );

  const steps = preview.dijkstra.steps;
  const currentStep = stepIndex === null ? null : (steps[stepIndex] ?? null);

  function run() {
    setResult(preview);
    setStepIndex(null);
    setAnimationKey((k) => k + 1);
  }

  function reset() {
    setTarget(DEFAULTS.targetWarehouseId);
    setProductId(DEFAULTS.productId);
    setQuantity(DEFAULTS.quantity);
    setSafetyBuffer(DEFAULTS.safetyBufferDays);
    setWeightMode("time");
    setResult(null);
    setStepIndex(null);
  }

  function applyScenario(id: string) {
    const s = demoScenarios.find((x) => x.id === id);
    if (!s) return;
    setTarget(s.targetWarehouseId);
    setProductId(s.productId);
    setQuantity(s.quantity);
    setResult(null);
    setStepIndex(null);
  }

  const bestPath = result?.best?.path;

  return (
    <>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <WarehouseIcon className="size-4" /> Sơ đồ mạng lưới kho &amp; tuyến vận chuyển
            </CardTitle>
            <Tabs value={weightMode} onValueChange={(v) => setWeightMode(v as WeightMode)}>
              <TabsList>
                <TabsTrigger value="time">Trọng số: ngày</TabsTrigger>
                <TabsTrigger value="distance">Trọng số: km</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-2">
              <NetworkGraph
                targetWarehouseId={targetWarehouseId}
                sourceWarehouseId={result?.best?.sourceWarehouseId ?? null}
                path={bestPath}
                step={currentStep}
                weightLabelMode={weightMode}
                animationKey={animationKey}
              />
            </div>

            <div className="rounded-xl border border-border bg-secondary/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setStepIndex(0)}
                  className="gap-1"
                >
                  <PlayCircle className="size-4" /> Chạy thuật toán từng bước
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    setStepIndex((i) => Math.min((i ?? -1) + 1, steps.length - 1))
                  }
                  disabled={stepIndex === null || stepIndex >= steps.length - 1}
                  className="gap-1"
                >
                  Next <ChevronRight className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setStepIndex(null)}>
                  Ẩn mô phỏng
                </Button>
                {stepIndex !== null && (
                  <span className="text-xs text-muted-foreground">
                    Bước {stepIndex + 1}/{steps.length}
                  </span>
                )}
              </div>
              {currentStep ? (
                <div className="mt-2 space-y-1 text-sm">
                  <p className="font-medium">{currentStep.note}</p>
                  {currentStep.relaxed.length > 0 && (
                    <ul className="text-xs text-muted-foreground">
                      {currentStep.relaxed.map((r) => (
                        <li key={r.nodeId}>
                          Cập nhật {r.nodeId}: {formatNum(r.oldDist)} → {formatNum(r.newDist)} (qua{" "}
                          {r.from})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Dijkstra chạy từ kho đích ra toàn mạng lưới (đồ thị vô hướng), cho biết tuyến ngắn
                  nhất từ mọi kho nguồn về kho đang thiếu hàng.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Kịch bản điều chuyển</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {demoScenarios.map((s) => (
                  <Button
                    key={s.id}
                    variant="outline"
                    size="sm"
                    onClick={() => applyScenario(s.id)}
                    title={s.description}
                  >
                    {s.label}
                  </Button>
                ))}
                <Button variant="ghost" size="sm" onClick={reset} className="gap-1">
                  <RotateCcw className="size-4" /> Reset
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Kho đang thiếu hàng</Label>
                  <Select value={targetWarehouseId} onValueChange={setTarget}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
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
                  <Label>Số lượng cần</Label>
                  <Input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Safety Buffer: {safetyBufferDays} ngày</Label>
                  <Slider
                    value={[safetyBufferDays]}
                    min={0}
                    max={14}
                    step={1}
                    onValueChange={(v) => setSafetyBuffer(v[0] ?? 3)}
                    className="pt-3"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">MRSL động của kho nhận</span>
                  <Badge className="bg-success text-success-foreground hover:bg-success">
                    {formatNum(threshold)} ngày
                  </Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{mrsl.formula}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Không còn ngưỡng cứng 30 ngày: kho bán nhanh cần ít HSD hơn, kho bán chậm cần
                  nhiều HSD hơn — tránh &quot;FEFO mù quáng&quot;.
                </p>
              </div>

              <Button className="w-full gap-2" onClick={run}>
                <Search className="size-4" /> Tìm phương án điều chuyển
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tồn kho SKU tại các kho khác</CardTitle>
            </CardHeader>
            <CardContent>
              <InventoryTable
                options={[...preview.rejected, ...(preview.best ? [preview.best] : []), ...preview.alternatives].sort(
                  (a, b) => a.batch.expiryDate.localeCompare(b.batch.expiryDate),
                )}
                threshold={threshold}
              />
            </CardContent>
          </Card>

          {result && <ResultPanel result={result} />}
        </div>
      </div>
    </>
  );
}
