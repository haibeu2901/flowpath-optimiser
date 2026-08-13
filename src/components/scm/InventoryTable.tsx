import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, warehouseById } from "@/data/mockData";
import { formatNum, type TransferOption } from "@/lib/scm-algorithm";
import { cn } from "@/lib/utils";

export function InventoryTable({
  options,
  threshold,
}: {
  options: TransferOption[];
  threshold: number;
}) {
  if (options.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Không có lô hàng nào của SKU này tại các kho khác.
      </p>
    );
  }

  return (
    <div className="max-h-[320px] overflow-auto rounded-lg border border-border">
      <Table>
        <TableHeader className="sticky top-0 bg-secondary">
          <TableRow>
            <TableHead>Kho</TableHead>
            <TableHead>Lô hàng</TableHead>
            <TableHead className="text-right">SL</TableHead>
            <TableHead>HSD</TableHead>
            <TableHead className="text-right">Còn (ngày)</TableHead>
            <TableHead className="text-right">HSD khi tới đích</TableHead>
            <TableHead>Trạng thái</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {options.map((o) => (
            <TableRow
              key={o.batch.id}
              className={cn(o.valid ? "bg-success/5" : "bg-destructive/5")}
            >
              <TableCell className="font-medium">
                {warehouseById.get(o.sourceWarehouseId)?.shortName}
              </TableCell>
              <TableCell className="font-mono text-xs">{o.batch.batchCode}</TableCell>
              <TableCell className="text-right">{o.batch.quantity}</TableCell>
              <TableCell className="text-xs">{formatDate(o.batch.expiryDate)}</TableCell>
              <TableCell className="text-right">{formatNum(o.daysUntilExpiry)}</TableCell>
              <TableCell
                className={cn(
                  "text-right font-semibold",
                  o.remainingShelfLifeOnArrival >= threshold ? "text-success" : "text-destructive",
                )}
              >
                {formatNum(o.remainingShelfLifeOnArrival)}
              </TableCell>
              <TableCell>
                {o.valid ? (
                  <Badge className="gap-1 bg-success text-success-foreground hover:bg-success">
                    <CheckCircle2 className="size-3" /> Đạt
                  </Badge>
                ) : o.rejectReason === "insufficient-quantity" ? (
                  <Badge variant="outline" className="gap-1 border-warning text-warning-foreground">
                    <AlertTriangle className="size-3" /> Thiếu SL
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="size-3" /> Loại
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
