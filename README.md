# Smart Shelf

BỐI CẢNH DỰ ÁN

Đây là một web app demo (không cần backend thật, dùng mock data in-memory) để minh họa cho đồ án tốt nghiệp về hệ thống quản lý chuỗi cung ứng FMCG hạn sử dụng ngắn (Short Shelf-Life FMCG SCM). Mục tiêu: khi một kho chi nhánh thiếu hàng cho một SKU, hệ thống phải:

Tìm các kho khác đang dư hàng của SKU đó.

Dùng thuật toán Dijkstra để tính đường đi (route) ngắn nhất/tối ưu nhất từ mỗi kho nguồn đến kho chi nhánh đang thiếu hàng, dựa trên mạng lưới kho (graph có trọng số = khoảng cách hoặc thời gian vận chuyển).

Với mỗi lô hàng (batch) có thể điều chuyển, tính HSD còn lại khi hàng tới kho đích = (Hạn sử dụng của lô) − (Ngày hiện tại + thời gian vận chuyển theo đường đi Dijkstra tìm được).

Loại bỏ các lô/đường đi mà HSD còn lại khi tới nơi < ngưỡng tối thiểu (mặc định 30 ngày, cho phép chỉnh trong UI).

Trong các lựa chọn còn hợp lệ, ưu tiên chọn theo FEFO (First-Expired-First-Out: ưu tiên xuất lô sắp hết hạn trước) nhưng đồng thời tối đa hóa HSD còn lại tại kho đích — nghĩa là ưu tiên phương án nào vừa xuất được lô cũ vừa vẫn đảm bảo hàng tới tay người dùng với thời hạn sử dụng còn nhiều nhất có thể trong số các lựa chọn hợp lệ.

Nếu không có kho nào thỏa điều kiện → hiển thị cảnh báo rõ ràng "Không có nguồn hàng phù hợp".

Ứng dụng này dùng để trình bày trước hội đồng/thầy cô trong 2-3 ngày tới, nên ưu tiên: hoạt động ổn định, trực quan, có thể chạy demo lặp lại nhiều lần với kịch bản có sẵn (không phụ thuộc dữ liệu ngẫu nhiên gây rủi ro khi trình bày live).

1. STACK KỸ THUẬT

React + TypeScript, Tailwind CSS, shadcn/ui cho component.

Không cần backend/database thật — toàn bộ dữ liệu là mock data định nghĩa trong file TypeScript (src/data/mockData.ts), load vào React state khi app khởi động (dùng useState/useMemo, có thể thêm zustand nếu cần state phức tạp).

Vẽ graph mạng lưới kho bằng SVG tự vẽ (custom) hoặc thư viện graph nhẹ (ví dụ react-flow nếu Lovable hỗ trợ tốt) — ưu tiên cách nào Lovable dựng ổn định nhất, không cần 3D hay physics phức tạp, layout kho có thể đặt cố định theo tọa độ x/y cho dễ kiểm soát khi demo.

Không cần đăng nhập/authentication.

Đơn vị thời gian vận chuyển: giờ hoặc ngày (chọn ngày cho dễ hiểu với ngưỡng 30 ngày).

2. DATA MODEL (mock data)

typescript

interface Warehouse {
  id: string;
  name: string;           // "Kho Trung tâm HCM", "Kho Chi nhánh Cần Thơ", ...
  type: "central" | "branch";
  position: { x: number; y: number }; // toạ độ cố định để vẽ graph
}

interface Route {
  fromWarehouseId: string;
  toWarehouseId: string;
  distanceKm: number;
  transitTimeDays: number; // thời gian vận chuyển ước tính (dùng làm trọng số Dijkstra)
}

interface Product {
  id: string;
  sku: string;
  name: string;            // "Sữa tươi tiệt trùng 1L", "Sữa chua có đường", ...
  unit: string;             // "thùng", "lốc", ...
  shelfLifeDays: number;    // tổng hạn sử dụng tiêu chuẩn của sản phẩm
}

interface Batch {
  id: string;
  productId: string;
  warehouseId: string;
  batchCode: string;        // "LOT-2026-0731"
  quantity: number;
  manufactureDate: string;  // ISO date
  expiryDate: string;       // ISO date — dùng để tính HSD còn lại
}

Yêu cầu mock data cụ thể:

6–8 kho: 1–2 kho trung tâm (central) và 5–6 kho chi nhánh (branch), đặt tên theo các tỉnh/thành VN (HCM, Hà Nội, Đà Nẵng, Cần Thơ, Bình Dương, Hải Phòng...).

Mạng lưới route (edges) nối giữa các kho — không cần full-mesh, tạo một topology thực tế (kho trung tâm nối nhiều kho chi nhánh, một vài kho chi nhánh nối chéo nhau) để Dijkstra có ý nghĩa (có đường đi trực tiếp và đường đi phải qua trung gian).

4–5 sản phẩm FMCG hạn sử dụng ngắn (sữa, sữa chua, bánh mì tươi, nước ép...), mỗi sản phẩm có shelfLifeDays từ 20–60 ngày.

Mỗi kho có 2–4 batch cho mỗi sản phẩm, với expiryDate đa dạng: một số batch sắp hết hạn (còn 5–15 ngày), một số còn nhiều hạn (30–50 ngày) — để khi demo có batch bị loại vì không đạt ngưỡng 30 ngày và có batch hợp lệ.

Cố định dữ liệu (không random mỗi lần load) để demo lặp lại được kết quả giống nhau.

3. THUẬT TOÁN CỐT LÕI (bắt buộc implement rõ ràng, có thể trace từng bước)

3.1 Dijkstra

Implement Dijkstra chuẩn trên graph các kho, trọng số = transitTimeDays (hoặc distanceKm, cho phép toggle giữa 2 chế độ trong UI nếu không tốn nhiều công).

Input: kho nguồn (kho đang thiếu hàng, gọi là targetWarehouse).

Output: với MỖI kho khác trong hệ thống — khoảng cách/thời gian ngắn nhất và đường đi cụ thể (mảng các kho đi qua) tới targetWarehouse.

Cần lưu lại predecessor map để dựng lại đường đi đầy đủ, phục vụ hiển thị trên UI.

3.2 Lọc theo ràng buộc HSD (FEFO + ngưỡng tối thiểu)

Với mỗi kho nguồn có tồn kho SKU đang cần:

Lấy transit time từ Dijkstra (kho nguồn → kho đích).

Với từng batch của SKU đó tại kho nguồn: remainingShelfLifeOnArrival = (expiryDate - (today + transitTimeDays)), tính bằng số ngày.

Batch hợp lệ nếu remainingShelfLifeOnArrival >= minShelfLifeThreshold (mặc định 30, chỉnh được qua input UI) VÀ quantity đủ đáp ứng số lượng cần điều chuyển.

Trong tập batch hợp lệ (có thể từ nhiều kho khác nhau): sắp xếp ưu tiên theo FEFO trước (expiryDate tăng dần — lô cũ nhất được ưu tiên xuất trước) nhưng chỉ trong số các lựa chọn đã đạt ngưỡng 30 ngày — tức là logic là "trong các phương án khả thi, ưu tiên giải phóng hàng tồn lâu nhất mà vẫn đảm bảo đủ HSD khi tới tay người dùng", không chọn lô sắp hết hạn tới mức không an toàn.

Kết quả cuối: đề xuất 1 phương án tốt nhất (kho nguồn + batch + đường đi + HSD còn lại khi tới nơi) và liệt kê thêm các phương án khả thi khác để so sánh (nếu có nhiều kho có hàng).

Nếu không có batch nào đạt ngưỡng ở bất kỳ kho nào → trả về trạng thái "no valid source" kèm lý do (ví dụ hiển thị batch gần đạt nhất bị loại vì thiếu bao nhiêu ngày).

4. GIAO DIỆN & LUỒNG TƯƠNG TÁC

Layout tổng thể: 1 trang dashboard, chia 2 khu vực chính

Bên trái (60%): Sơ đồ mạng lưới kho (graph visualization)

Vẽ các kho dưới dạng node (hình tròn/thẻ), route là các đường nối có nhãn hiển thị số ngày vận chuyển.

Kho central và branch có màu/icon phân biệt.

Khi chọn kho đích đang thiếu hàng → highlight kho đó (viền đỏ/badge "Thiếu hàng").

Khi thuật toán chạy xong → highlight đường đi được chọn (path tô đậm màu xanh, các route không dùng tô mờ), và hiển thị animation nhỏ (một icon xe tải/hộp hàng di chuyển dọc theo path) để minh họa hàng đang được vận chuyển.

Có nút "▶ Chạy thuật toán từng bước" (step-by-step) mô phỏng Dijkstra: mỗi lần bấm "Next", hiển thị node đang được xét, cập nhật khoảng cách tạm thời (relaxation) trên các node lân cận, đổi màu node đã "chốt" (visited) — mục đích để giải thích thuật toán trực quan khi thuyết trình.

Bên phải (40%): Panel điều khiển & kết quả

Form chọn kịch bản:

Dropdown chọn kho chi nhánh đang thiếu hàng.

Dropdown chọn SKU/sản phẩm đang thiếu.

Input số lượng cần.

Input/slider ngưỡng HSD tối thiểu khi tới nơi (mặc định 30 ngày).

Nút "Tìm phương án điều chuyển".

Bảng tồn kho hiện tại của SKU đã chọn tại tất cả các kho (mỗi dòng: kho, batch, số lượng, ngày hết hạn, số ngày còn lại) — có color-code: đỏ nếu batch sẽ không đạt ngưỡng khi vận chuyển tới đích, xanh nếu đạt.

Sau khi chạy xong, hiển thị thẻ kết quả đề xuất:

Kho nguồn được chọn, batch cụ thể, số lượng.

Đường đi (danh sách kho theo thứ tự), tổng thời gian vận chuyển, tổng khoảng cách.

HSD còn lại khi tới kho đích (số ngày, nổi bật).

Lý do được chọn (ví dụ: "Lô cũ nhất trong số các lô đạt ngưỡng ≥30 ngày").

Danh sách các phương án khác bị loại và lý do loại (để chứng minh thuật toán có xét đầy đủ, tăng tính thuyết phục khi bảo vệ đồ án).

Có sẵn 2–3 kịch bản demo dựng sẵn (nút "Kịch bản mẫu 1 / 2 / 3")

Mỗi nút tự động điền sẵn kho đích + SKU + số lượng vào form, để khi trình bày chỉ cần bấm 1 nút chạy ra kết quả ngay, tránh rủi ro gõ tay sai khi demo live. Gợi ý:

Kịch bản 1: có duy nhất 1 kho nguồn hợp lệ, đường đi trực tiếp — minh họa case đơn giản.

Kịch bản 2: có nhiều kho nguồn khả thi, cần Dijkstra so sánh và có batch bị loại vì HSD không đạt — minh họa rõ giá trị của thuật toán.

Kịch bản 3: không có kho nào đạt ngưỡng → hiển thị cảnh báo — minh họa hệ thống xử lý được trường hợp xấu.

5. YÊU CẦU VỀ TÍNH ỔN ĐỊNH KHI DEMO

Toàn bộ dữ liệu mock cố định, không dùng Math.random() cho dữ liệu hiển thị (chỉ dùng cho animation timing nếu cần).

Không cần responsive mobile hoàn hảo, nhưng phải hiển thị tốt trên màn hình trình chiếu (desktop, tỉ lệ 16:9).

Có nút "Reset" để đưa app về trạng thái ban đầu giữa các lần demo.

Giao diện tiếng Việt, thuật ngữ dùng: "Kho", "Kho chi nhánh", "Kho trung tâm", "Hạn sử dụng (HSD)", "Lô hàng", "Điều chuyển", "Tuyến vận chuyển".

6. THIẾT KẾ TRỰC QUAN

Theme: sạch, chuyên nghiệp, tông màu xanh dương/xanh lá (gợi liên tưởng logistics/supply chain), nền sáng.

Dùng shadcn/ui Card, Badge, Table, Select, Slider, Button.

Icon: dùng lucide-react (truck, package, warehouse, alert-triangle, check-circle...).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://flowpath-optimiser.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/623d2c87-32c6-4815-9ba3-6b21bb6c55ef).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
