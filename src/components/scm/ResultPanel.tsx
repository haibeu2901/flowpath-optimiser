import { AlertTriangle, ArrowRight, CheckCircle2, Clock, MapPin, Package, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDate, productById, warehouseById } from "@/data/mockData";
import { formatNum, type EvaluationResult, type TransferOption } from "@/lib/scm-algorithm";

function PathLine({ path }: { path: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-sm">
      {path.map((id, i) => (
        <span key={id} className="flex items-center gap-1">
          <span className="rounded-md bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
            {warehouseById.get(id)?.shortName}
          </span>
          {i < path.length - 1 && <ArrowRight className="size-3 text-muted-foreground" />}
        </span>
      ))}
    </div>
  );
}

function OptionRow({ o }: { o: TransferOption }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">
          {warehouseById.get(o.sourceWarehouseId)?.name}
          <span className="ml-2 font-mono text-xs text-muted-foreground">{o.batch.batchCode}</span>
        </div>
        <Badge variant={o.valid ? "secondary" : "outline"}>
          {formatNum(o.remainingShelfLifeOnArrival)} ngày HSD
        </Badge>
      </div>
      <div className="mt-2">
        <PathLine path={o.path} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {formatNum(o.transitTimeDays)} ngày · {o.distanceKm} km · SL lô {o.batch.quantity} · HSD{" "}
        {formatDate(o.batch.expiryDate)}
      </p>
      {!o.valid && (
        <p className="mt-1 flex items-start gap-1 text-xs font-medium text-destructive">
          <AlertTriangle className="mt-px size-3 shrink-0" /> {o.rejectText}
        </p>
      )}
    </div>
  );
}

export function ResultPanel({ result }: { result: EvaluationResult }) {
  const target = warehouseById.get(result.targetWarehouseId);
  const product = productById.get(result.productId);
  const best = result.best;

  return (
    <div className="space-y-4">
      {best ? (
        <Card className="border-success/40 bg-success/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-success">
              <CheckCircle2 className="size-5" /> Phương án điều chuyển đề xuất
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Kho nguồn</p>
                <p className="font-semibold">
                  {warehouseById.get(best.sourceWarehouseId)?.name}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Kho đích</p>
                <p className="font-semibold">{target?.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lô hàng (FEFO)</p>
                <p className="font-mono font-semibold">{best.batch.batchCode}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Số lượng điều chuyển</p>
                <p className="font-semibold">
                  {result.quantity} {product?.unit} / tồn {best.batch.quantity}
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Route className="size-3" /> Tuyến vận chuyển tối ưu (Dijkstra)
              </p>
              <PathLine path={best.path} />
              <p className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="size-3" /> {formatNum(best.transitTimeDays)} ngày
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" /> {best.distanceKm} km
                </span>
                <span className="flex items-center gap-1">
                  <Package className="size-3" /> HSD lô: {formatDate(best.batch.expiryDate)}
                </span>
              </p>
            </div>

            <div className="rounded-lg bg-success/10 p-3 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                HSD còn lại khi tới kho đích
              </p>
              <p className="text-4xl font-bold text-success">
                {formatNum(best.remainingShelfLifeOnArrival)}
                <span className="ml-1 text-base font-medium">ngày</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Ngưỡng tối thiểu: {result.threshold} ngày
              </p>
            </div>

            <p className="text-sm">
              <span className="font-semibold">Lý do chọn: </span>
              {result.bestReason}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Không có nguồn hàng phù hợp
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Không kho nào có lô {product?.name} đạt ngưỡng HSD ≥ {result.threshold} ngày khi tới{" "}
              {target?.name} với số lượng {result.quantity}.
            </p>
            {result.closestMiss && (
              <p className="rounded-md bg-card p-3">
                <span className="font-semibold">Phương án gần đạt nhất: </span>
                lô {result.closestMiss.batch.batchCode} tại{" "}
                {warehouseById.get(result.closestMiss.sourceWarehouseId)?.shortName} — thiếu{" "}
                <span className="font-bold text-destructive">
                  {formatNum(result.closestMiss.shortfallDays)} ngày
                </span>{" "}
                HSD khi tới nơi.
              </p>
            )}
            <p className="text-muted-foreground">
              Đề xuất: hạ ngưỡng HSD, giảm số lượng cần, hoặc kích hoạt đơn đặt hàng mới từ nhà cung
              cấp.
            </p>
          </CardContent>
        </Card>
      )}

      {result.alternatives.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Phương án khả thi khác ({result.alternatives.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.alternatives.map((o) => (
              <OptionRow key={o.batch.id} o={o} />
            ))}
          </CardContent>
        </Card>
      )}

      {result.rejected.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Phương án bị loại ({result.rejected.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.rejected.map((o) => (
              <OptionRow key={o.batch.id} o={o} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
