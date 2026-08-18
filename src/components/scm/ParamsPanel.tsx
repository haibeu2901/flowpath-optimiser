import { SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { AllocationParams } from "@/data/mockData";

export function ParamsPanel({
  params,
  onChange,
}: {
  params: AllocationParams;
  onChange: (p: AllocationParams) => void;
}) {
  const set = (patch: Partial<AllocationParams>) => onChange({ ...params, ...patch });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="size-4" /> Tham số hệ thống (chính sách kinh doanh)
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Safety Buffer: {params.safetyBufferDays} ngày</Label>
          <Slider
            value={[params.safetyBufferDays]}
            min={0}
            max={14}
            step={1}
            onValueChange={(v) => set({ safetyBufferDays: v[0] ?? 3 })}
            className="pt-3"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Max Serving Distance: {params.maxServingDistanceKm} km</Label>
          <Slider
            value={[params.maxServingDistanceKm]}
            min={50}
            max={700}
            step={10}
            onValueChange={(v) => set({ maxServingDistanceKm: v[0] ?? 150 })}
            className="pt-3"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>
            Trọng số — W_Distance {params.weightDistance.toFixed(1)} / W_Expiry{" "}
            {params.weightExpiry.toFixed(1)}
          </Label>
          <Slider
            value={[Math.round(params.weightDistance * 10)]}
            min={0}
            max={10}
            step={1}
            onValueChange={(v) => {
              const wd = (v[0] ?? 4) / 10;
              set({ weightDistance: wd, weightExpiry: Math.round((1 - wd) * 10) / 10 });
            }}
            className="pt-3"
          />
          <p className="text-xs text-muted-foreground">
            Kéo về trái = ưu tiên giải phóng hàng cận date; kéo về phải = ưu tiên kho gần.
          </p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Cold Start — HSD tối thiểu: {params.coldStartMinShelfLifePercent}% tuổi đời</Label>
          <Slider
            value={[params.coldStartMinShelfLifePercent]}
            min={20}
            max={90}
            step={5}
            onValueChange={(v) => set({ coldStartMinShelfLifePercent: v[0] ?? 50 })}
            className="pt-3"
          />
        </div>
      </CardContent>
    </Card>
  );
}
