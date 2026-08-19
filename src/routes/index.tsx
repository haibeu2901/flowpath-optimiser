import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Presentation, ShoppingCart, Truck, Warehouse as WarehouseIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerOrderView } from "@/components/scm/CustomerOrderView";
import { InternalTransferView } from "@/components/scm/InternalTransferView";
import { StoryMode } from "@/components/scm/StoryMode";
import { TODAY } from "@/data/mockData";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Điều chuyển & đặt đơn FMCG HSD ngắn — Haversine + Dijkstra, FEFO" },
      {
        name: "description",
        content:
          "Demo chuỗi cung ứng FMCG hạn sử dụng ngắn: luân chuyển kho theo FEFO, chọn kho phục vụ đơn hàng bằng Haversine + Dijkstra và chọn lô theo yêu cầu khách hàng.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Điều chuyển & đặt đơn FMCG HSD ngắn — Haversine + Dijkstra, FEFO" },
      {
        property: "og:description",
        content:
          "Demo chuỗi cung ứng FMCG hạn sử dụng ngắn: luân chuyển kho theo FEFO, chọn kho phục vụ đơn hàng bằng Haversine + Dijkstra và chọn lô theo yêu cầu khách hàng.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [story, setStory] = useState(false);

  return (
    <main className="min-h-screen bg-background">
      <header
        className="px-6 py-4 text-primary-foreground"
        style={{ background: "var(--gradient-header)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Truck className="size-7" />
            <div>
              <h1 className="text-xl font-bold leading-tight">
                Hệ thống chuỗi cung ứng FMCG hạn sử dụng ngắn
              </h1>
              <p className="text-sm opacity-85">
                Haversine + Dijkstra tối ưu tuyến · FEFO giảm lãng phí · Cân bằng lợi ích khách hàng (đủ HSD để bán) & nhà phân phối (giảm chi phí logistics, tăng fill rate)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              Ngày hệ thống: {TODAY.toISOString().slice(0, 10).split("-").reverse().join("/")}
            </Badge>
            <Button variant="secondary" size="sm" className="gap-1" onClick={() => setStory(true)}>
              <Presentation className="size-4" /> Thuyết trình
            </Button>
          </div>
        </div>
      </header>

      <Tabs defaultValue="order" className="p-4">
        <TabsList className="mb-4">
          <TabsTrigger value="order" className="gap-1">
            <ShoppingCart className="size-4" /> Đặt đơn khách hàng
          </TabsTrigger>
          <TabsTrigger value="transfer" className="gap-1">
            <WarehouseIcon className="size-4" /> Luân chuyển kho nội bộ
          </TabsTrigger>
        </TabsList>
        <TabsContent value="order">
          <CustomerOrderView />
        </TabsContent>
        <TabsContent value="transfer">
          <InternalTransferView />
        </TabsContent>
      </Tabs>

      {story && <StoryMode onClose={() => setStory(false)} />}
    </main>
  );
}
