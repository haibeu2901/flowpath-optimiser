import { Badge } from "@/components/ui/badge";
import { formatDate, warehouseById } from "@/data/mockData";
import { formatNum } from "@/lib/scm-algorithm";
import type { AllocationResult } from "@/lib/smart-fefo";
import { cn } from "@/lib/utils";

export function PlanTable({ result }: { result: AllocationResult }) {
  const rows = result.passed;
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-destructive/50 p-3 text-sm text-destructive">
        Không plan nào vượt qua Hard Filter với tham số hiện tại — nới Max_Serving_Distance hoặc
        giảm Safety Buffer để xem hệ thống phản ứng.
      </p>
    );
  }

  return (
    <div className="max-h-[340px] overflow-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-secondary">
          <tr>
            {["Kho", "Lô", "SL", "km", "HSD tới nơi", "Norm_D", "Norm_E", "Score"].map((h) => (
              <th key={h} className="px-2.5 py-2 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const isBest = result.best?.id === p.id;
            const inSplit = result.split?.some((l) => l.plan.id === p.id);
            return (
              <tr
                key={p.id}
                className={cn(
                  "border-t border-border",
                  isBest || inSplit ? "bg-success/12 font-semibold" : "text-muted-foreground",
                )}
              >
                <td className="px-2.5 py-2">
                  <span className="flex items-center gap-1.5">
                    {warehouseById.get(p.warehouseId)?.shortName}
                    {isBest && (
                      <Badge className="bg-success text-success-foreground hover:bg-success">
                        Best
                      </Badge>
                    )}
                    {!isBest && inSplit && (
                      <Badge variant="outline" className="border-success text-success">
                        Split
                      </Badge>
                    )}
                  </span>
                </td>
                <td className="px-2.5 py-2 font-mono">{p.batch.batchCode}</td>
                <td className="px-2.5 py-2">
                  {p.enoughQty ? (
                    <span className="text-muted-foreground">
                      {p.availableQty}/{result.quantity}
                    </span>
                  ) : (
                    <Badge className="bg-warning text-warning-foreground hover:bg-warning">
                      SL không đủ ({p.availableQty}/{result.quantity})
                    </Badge>
                  )}
                </td>
                <td className="px-2.5 py-2">{formatNum(p.distanceKm)}</td>
                <td className="px-2.5 py-2">
                  {formatNum(p.remainingOnArrival)} · {formatDate(p.batch.expiryDate)}
                </td>
                <td className="px-2.5 py-2">{formatNum(p.normDistance)}</td>
                <td className="px-2.5 py-2">{formatNum(p.normExpiry)}</td>
                <td className="px-2.5 py-2 tabular-nums">{formatNum(p.score)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
