import { useState } from "react";
import { ArrowLeft, ArrowRight, Presentation, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const slides: { title: string; body: React.ReactNode }[] = [
  {
    title: "1. Đặt vấn đề — \u201cFEFO mù quáng\u201d",
    body: (
      <ul className="space-y-3 text-lg">
        <li>
          FEFO truyền thống luôn xuất lô cận date nhất cho bất kỳ đại lý nào đang có đơn, bất kể đại
          lý đó bán nhanh hay chậm.
        </li>
        <li>
          Hệ quả: rủi ro hết hạn bị đẩy từ nhà phân phối xuống thẳng đại lý — tạp hoá bán 5
          thùng/ngày nhận lô còn 10 ngày thì hàng hết hạn ngay trên kệ.
        </li>
        <li className="rounded-lg bg-secondary p-3 font-semibold">
          Bài toán thực sự: <em>Lô nào, từ kho nào, nên giao cho đại lý nào</em> — để vừa giảm rủi
          ro hết hạn ở nhà phân phối, vừa đảm bảo đại lý đủ thời gian bán hết, vừa không vận chuyển
          quá xa, vừa tối ưu số chuyến xe?
        </li>
      </ul>
    ),
  },
  {
    title: "2. Lời giải — MRSL động thay ngưỡng cứng",
    body: (
      <ul className="space-y-3 text-lg">
        <li>
          <span className="font-mono text-base">
            MRSL = (Order_Qty / Sales_Velocity) + Safety_Buffer
          </span>{" "}
          — ngưỡng HSD tối thiểu tính riêng cho từng đại lý theo tốc độ bán thực tế.
        </li>
        <li>
          Tách đơn: <span className="font-mono text-base">Effective_MRSL = ((Inventory_Ahead + Qty) / Velocity) + Buffer</span>
        </li>
        <li>Cold Start: đại lý mới chưa có lịch sử → luật tĩnh &ldquo;còn &gt; 50% tuổi đời&rdquo;.</li>
      </ul>
    ),
  },
  {
    title: "3. Kiến trúc — pipeline 11 bước",
    body: (
      <pre className="overflow-x-auto rounded-lg bg-secondary p-4 text-sm leading-relaxed">
{`1  Candidate Warehouse Discovery
2  Candidate Batch / Lot
3  Base MRSL  (hoặc luật Cold Start)
4  Delivery ETA + Consumption Simulation
5  HARD FILTER  ── Max_Serving_Distance (Haversine, O(1))
                └─ HSD khi tới nơi ≥ MRSL
6  Normalize (Min-Max 0-100, Max=Min → 50)
7  Weighted Scoring = W_D*Norm_D + W_E*Norm_E   (thấp = tốt)
8  Select Best Plan
9  FEFO Depletion (trừ tồn kho)
10 Optimistic Locking
11 Delivery Routing — nearest-neighbor + Dijkstra (VRP rút gọn)`}
      </pre>
    ),
  },
  {
    title: "4. Ranh giới thuật toán",
    body: (
      <ul className="space-y-3 text-lg">
        <li>
          <strong>Chọn kho nguồn:</strong> Haversine O(1) — không dùng Dijkstra để tránh nghẽn cổ
          chai O(V²) khi mạng lưới kho lớn.
        </li>
        <li>
          <strong>Giao hàng:</strong> Dijkstra trên graph mạng lưới, kết hợp nearest-neighbor để
          xếp thứ tự điểm dừng cho một chuyến xe.
        </li>
        <li className="text-base text-muted-foreground">
          Minh bạch phạm vi: đây là mô phỏng đơn giản hoá của VRP (không ràng buộc tải trọng, không
          time-window).
        </li>
      </ul>
    ),
  },
  {
    title: "5. Giá trị mang lại",
    body: (
      <ul className="space-y-2 text-lg">
        <li>Giảm hàng hết hạn ở cả nhà phân phối lẫn đại lý — không đẩy rủi ro xuống hạ nguồn.</li>
        <li>Ngưỡng an toàn thích ứng theo từng đại lý, chỉnh được qua tham số chính sách.</li>
        <li>Điểm số kết hợp khoảng cách và độ cận date: giải phóng hàng cũ mà vẫn giao gần.</li>
        <li>Pipeline 11 bước hiển thị tường minh — không phải hộp đen.</li>
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