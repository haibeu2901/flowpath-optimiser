import { useState } from "react";
import { ArrowLeft, ArrowRight, Presentation, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const slides: { title: string; body: React.ReactNode }[] = [
  {
    title: "1. Đặt vấn đề",
    body: (
      <ul className="space-y-2 text-lg">
        <li>① Kho chi nhánh thiếu hàng → cần luân chuyển từ kho khác trong mạng lưới.</li>
        <li>② Hàng FMCG hạn sử dụng ngắn → tuyến vận chuyển càng dài, HSD còn lại càng ít.</li>
        <li>③ Đơn hàng của nhân viên kinh doanh cần được phục vụ từ kho gần nhất còn hàng.</li>
        <li>
          ④ Mâu thuẫn lợi ích: doanh nghiệp muốn xuất lô cũ trước (FEFO) để giảm lãng phí, khách
          hàng lại muốn nhận lô HSD dài nhất.
        </li>
      </ul>
    ),
  },
  {
    title: "2. Kiến trúc giải pháp",
    body: (
      <pre className="overflow-x-auto rounded-lg bg-secondary p-4 text-sm leading-relaxed">
{`Đặt đơn (vị trí NVKD)
      │
      ▼
Chọn kho gần nhất  ──(khoảng cách Euclidean)
      │
      ▼
Kiểm tra tồn kho ── đủ ──────────────┐
      │ thiếu                        │
      ▼                              │
Dijkstra tìm kho thay thế            │
   ├─ (a) giao thẳng từ kho đó       │
   └─ (b) điều chuyển về kho gần ────┤
                                     ▼
                        Chọn lô hàng cho khách
                   ├─ Lô tiêu chuẩn: HSD dài nhất
                   └─ Lô khuyến mãi: cận HSD, giảm giá
                                     ▼
                             Xác nhận đơn hàng`}
      </pre>
    ),
  },
  {
    title: "3. Demo tương tác 1 — Luân chuyển kho nội bộ",
    body: (
      <ul className="space-y-2 text-lg">
        <li>Chọn kho đang thiếu hàng, SKU và số lượng cần.</li>
        <li>Dijkstra chạy trên mạng lưới kho, mô phỏng được từng bước.</li>
        <li>FEFO chọn lô hết hạn sớm nhất nhưng vẫn đạt ngưỡng HSD tối thiểu khi tới nơi.</li>
        <li>Các lô bị loại đều có lý do rõ ràng (HSD, số lượng, không có tuyến).</li>
      </ul>
    ),
  },
  {
    title: "4. Demo tương tác 2 — Đặt đơn hàng khách hàng",
    body: (
      <ul className="space-y-2 text-lg">
        <li>Chọn kho phục vụ theo khoảng cách tới điểm đặt đơn.</li>
        <li>Kho gần nhất hết hàng → Dijkstra tìm kho thay thế, so sánh 2 phương án xử lý.</li>
        <li>Chọn lô theo yêu cầu khách: mặc định HSD dài nhất.</li>
        <li>Lô cận hạn được gắn khuyến mãi để khách chủ động lựa chọn.</li>
      </ul>
    ),
  },
  {
    title: "5. Giá trị mang lại",
    body: (
      <ul className="space-y-2 text-lg">
        <li>Giảm lãng phí hàng hạn ngắn nhờ FEFO nội bộ + khuyến mãi cận HSD.</li>
        <li>Tối ưu thời gian và chi phí vận chuyển nhờ Dijkstra trên mạng lưới kho.</li>
        <li>Cải thiện trải nghiệm khách hàng: ưu tiên HSD dài, minh bạch lựa chọn giá.</li>
        <li>Mọi quyết định đều được ghi lại trong Nhật ký quyết định — không phải hộp đen.</li>
      </ul>
    ),
  },
];

export function StoryMode({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const slide = slides[i]!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-card shadow-xl">
        <div
          className="flex items-center justify-between px-6 py-4 text-primary-foreground"
          style={{ background: "var(--gradient-header)" }}
        >
          <div className="flex items-center gap-2">
            <Presentation className="size-5" />
            <h2 className="text-lg font-bold">Chế độ thuyết trình</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-primary-foreground">
            <X className="size-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <h3 className="mb-4 text-2xl font-bold">{slide.title}</h3>
          {slide.body}
        </div>
        <div className="flex items-center justify-between border-t border-border px-6 py-3">
          <Button variant="outline" onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          <div className="flex gap-1.5">
            {slides.map((_, idx) => (
              <span
                key={idx}
                className={
                  idx === i ? "size-2.5 rounded-full bg-primary" : "size-2.5 rounded-full bg-border"
                }
              />
            ))}
          </div>
          {i === slides.length - 1 ? (
            <Button onClick={onClose}>Bắt đầu demo</Button>
          ) : (
            <Button onClick={() => setI((v) => Math.min(slides.length - 1, v + 1))}>
              Next <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}