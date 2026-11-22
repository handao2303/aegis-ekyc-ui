# Diagram tooling

Mermaid trong `docs/` là bản gốc. Script ở đây xuất chúng thành PNG theo theme Aegis để dùng trên Confluence.

```bash
cd tools/diagrams && npm install
npm run check        # kiểm tra cú pháp 45 diagram
npm run render       # xuất PNG vào public/diagrams (bố cục ELK, theme Aegis, tô màu tự động)
npm run confluence   # chuyển docs/*.md → HTML cho Confluence (thư mục out/)
```

- Màu và font: `theme.mjs` (lấy từ skin-aurora trong `src/styles/tokens.css`).
- Tô màu tự động theo nội dung nút: đỏ = từ chối/lỗi/hết hạn, hổ phách = chờ/REFER/cảnh báo, xanh = duyệt/thành công, hình thoi = điểm quyết định.
- Sau khi render, chạy `npm run deploy` ở thư mục gốc để đẩy ảnh lên GitHub Pages; trang Confluence tự hiện ảnh mới.
