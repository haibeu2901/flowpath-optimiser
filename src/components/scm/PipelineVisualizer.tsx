import { AlertTriangle, CheckCircle2, Info, ListChecks, XCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PipelineStep, StepStatus } from "@/lib/smart-fefo";
import { cn } from "@/lib/utils";

const STATUS: Record<StepStatus, { icon: typeof CheckCircle2; className: string; label: string }> = {
  ok: { icon: CheckCircle2, className: "text-success", label: "Đạt" },
  warn: { icon: AlertTriangle, className: "text-warning", label: "Lưu ý" },
  fail: { icon: XCircle, className: "text-destructive", label: "Không đạt" },
  info: { icon: Info, className: "text-muted-foreground", label: "Bỏ qua" },
};

export function PipelineVisualizer({
  steps,
  title = "Pipeline 11 bước — Smart FEFO Allocation Engine",
}: {
  steps: PipelineStep[];
  title?: string;
}) {
  if (steps.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="size-4" /> {title}
        </CardTitle>
        <div className="flex flex-wrap gap-1 pt-1">
          {steps.map((s) => {
            const st = STATUS[s.status];
            return (
              <span
                key={s.index}
                title={`${s.index}. ${s.title}`}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-[11px] font-bold",
                  s.status === "ok" && "border-success bg-success/15 text-success",
                  s.status === "warn" && "border-warning bg-warning/15 text-warning",
                  s.status === "fail" && "border-destructive bg-destructive/15 text-destructive",
                  s.status === "info" && "border-border bg-secondary text-muted-foreground",
                )}
                aria-label={`${s.title}: ${st.label}`}
              >
                {s.index}
              </span>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion type="multiple" defaultValue={["step-5", "step-7", "step-8"]}>
          {steps.map((s) => {
            const st = STATUS[s.status];
            const Icon = st.icon;
            return (
              <AccordionItem key={s.index} value={`step-${s.index}`}>
                <AccordionTrigger className="py-2.5 text-left hover:no-underline">
                  <span className="flex items-start gap-2 pr-2">
                    <Icon className={cn("mt-0.5 size-4 shrink-0", st.className)} />
                    <span className="text-sm font-semibold">
                      {s.index}. {s.title}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">{s.summary}</p>
                  {s.formula && (
                    <p className="rounded-md bg-secondary px-3 py-2 font-mono text-xs">{s.formula}</p>
                  )}
                  {s.bullets && s.bullets.length > 0 && (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {s.bullets.map((b, i) => (
                        <li key={i} className="flex gap-1.5">
                          <span className="text-muted-foreground">•</span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                  {s.table && s.table.rows.length > 0 && (
                    <div className="max-h-64 overflow-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-secondary">
                          <tr>
                            {s.table.head.map((h) => (
                              <th key={h} className="px-2.5 py-1.5 text-left font-semibold">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {s.table.rows.map((r, i) => (
                            <tr
                              key={i}
                              className={cn(
                                "border-t border-border",
                                r.tone === "fail" && "bg-destructive/5 text-destructive",
                                r.tone === "ok" && "bg-success/5",
                                r.tone === "best" && "bg-success/15 font-semibold",
                              )}
                            >
                              {r.cells.map((c, j) => (
                                <td key={j} className="px-2.5 py-1.5">
                                  {c}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status, children }: { status: StepStatus; children: React.ReactNode }) {
  return (
    <Badge
      className={cn(
        status === "ok" && "bg-success text-success-foreground hover:bg-success",
        status === "warn" && "bg-warning text-warning-foreground hover:bg-warning",
        status === "fail" && "bg-destructive text-destructive-foreground hover:bg-destructive",
      )}
      variant={status === "info" ? "secondary" : "default"}
    >
      {children}
    </Badge>
  );
}
