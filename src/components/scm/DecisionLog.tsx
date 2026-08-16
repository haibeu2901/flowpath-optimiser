import { ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DecisionLog({ entries }: { entries: string[] }) {
  if (entries.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="size-4" /> Nhật ký quyết định
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {entries.map((e, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground">
                {i + 1}
              </span>
              <span>{e}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}