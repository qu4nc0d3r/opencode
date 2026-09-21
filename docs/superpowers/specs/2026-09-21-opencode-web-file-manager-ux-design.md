# opencode web — File Manager UI/UX Upgrade (P1.5) Design

- Ngày: 2026-09-21
- Fork: `qu4nc0d3r/opencode`, branch `custom-fs`
- Tiền đề: P1 đã deploy (`0.1.0-custom`) — file ops, picker V2, toolbar/menu cơ bản, editor textarea
- Trạng thái: chờ user review spec → viết implementation plan

## 1. Mục tiêu

Nâng UI/UX của file manager / picker / editor lên mức dùng hằng ngày trên điện thoại, gồm 5 nhóm:

- **Cây file + menu UX**: toolbar đúng chỗ, breadcrumb, search trong cây, menu native, long-press mobile, hiện/ẩn file ẩn.
- **Editor CodeMirror 6**: syntax highlight, line numbers, undo/redo, auto-indent, chặn mất dữ liệu chưa lưu.
- **Copy/move/zip + multi-select**: chọn nhiều, copy/move kéo thả, nén/giải nén `.zip`.
- **Preview + info**: ảnh/video/PDF/markdown; panel thông tin file (size, mtime, mode, mime).
- **Mobile-first polish + PWA cài được**: bottom sheet, touch target lớn, sticky action bar, manifest standalone.

## 2. Quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Ưu tiên | Mobile-first; desktop vẫn đầy đủ chức năng |
| Menu | Dùng `MenuV2` có sẵn trong `packages/ui/src/v2/components/menu-v2.tsx` (không tự chế popover) |
| Bottom sheet | Component app-local `packages/app/src/components/sheet-v2.tsx` (không đụng package ui) |
| Editor | CodeMirror 6, deps đặt trong `packages/app`, lazy-load bằng dynamic import + `@codemirror/language-data` |
| Zip | Server-side bằng `fflate` (pure JS), không cần binary ngoài |
| PWA | Chỉ cần cài được lên home screen (manifest + icon + standalone + meta iOS). **Không service worker, không offline cache** |
| Preview | Dùng viewer sẵn có của repo trước; chỉ thêm cái thiếu (ảnh/video/PDF) |
| Chia đợt | 3 wave độc lập, mỗi wave deploy + test trên điện thoại trước khi sang wave sau |

## 3. Không nằm trong phạm vi (non-goals)

- Offline/service worker; đồng bộ khi mất mạng.
- LSP/autocomplete trong editor (chỉ highlight + indent + search).
- Thumbnails phía server (nặng, không cần cho 1 user).
- Sửa look & feel toàn app (theme/layout upstream) — để đợt sau nếu muốn.
- Multi-user/permission model.

## 4. Kiến trúc theo wave

### Wave A — Cây file + Editor

**A1. Toolbar + breadcrumb + tree UX** (`packages/app`)
- Chuyển toolbar lên đầu sidebar cây file: render trong `SessionReviewV2Sidebar` (component đã nhận `children`/`filter`), đặt trước `<FileTreeV2>`; bỏ toolbar khỏi `SessionFilePanelV2.toolbar` (trả về `toolbar={false}` như gốc).
- Breadcrumb: đường dẫn thư mục hiện tại (root = project worktree) với các segment click để nhảy; nút `⌂` về root.
- Thêm toggle "hiện file ẩn" (mặc định ẩn dotfiles + ignored), nút expand-all/collapse-all, nút refresh.
- Search trong cây: input lọc node đã tải (client-side, không gọi server) + fallback gọi `file.searchFiles` khi cần.
- Selection/active highlight rõ ràng hơn; hàng active có nền + viền trái.

**A2. Context menu + long-press** (`packages/app`)
- Right-click (desktop) và long-press (mobile, 500ms) trên node → `MenuV2` với items theo `fileManagerMenuItems` (mở rộng thêm Copy/Move khi có Wave B).
- Menu neo tại vị trí chuột/chạm; mobile hiển thị dạng bottom sheet (dùng `sheet-v2` ở Wave C, tạm dùng MenuV2 centered nếu chưa có).
- Hành động trên folder: New file, New folder, Rename, Delete, Copy, Move; trên file: Open, Rename, Delete, Download, Copy, Move (+ Extract nếu `.zip`).

**A3. Editor CodeMirror 6** (`packages/app`)
- Deps mới trong `packages/app/package.json`: `codemirror`, `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/search`, `@codemirror/language-data`.
- Lazy-load: `const { createEditor } = await import("./file-editor-codemirror")` chỉ khi bấm Edit (giữ bundle chính nhẹ cho mobile).
- Tính năng: `basicSetup` (line numbers, bracket matching, highlight active line, history), `keymap` với `Ctrl/Cmd+S` = save, `Ctrl/Cmd+F` = search, `Tab` = indent 2 spaces, `EditorView.lineWrapping`.
- Ngôn ngữ: map phần mở rộng file → `languages` từ `@codemirror/language-data` (fallback plain text). Danh sách tối thiểu: js/ts/tsx/jsx/json/css/html/md/py/go/rs/java/sh/yaml/sql.
- Theme: `EditorView.theme` dùng CSS variables của app (nền `--v2-background-*`, text `--v2-text-*`), font mono, size 12–13px mobile.
- Chặn mất dữ liệu: dirty map giữ nguyên; chặn (1) đóng tab (hook vào `layout.tabs` close), (2) chuyển sang file khác trong viewer, (3) `beforeunload`; cảnh báo bằng bottom sheet/dialog 3 lựa chọn: Save / Discard / Cancel.
- Giữ viewer shiki hiện có cho chế độ xem (không thay bằng CodeMirror để tránh nặng trang).

### Wave B — Copy/Move/Zip + Multi-select

**B1. Server endpoints** (`packages/opencode`)
- `POST /file/copy` payload `{ from, to, overwrite?: boolean }` — copy file/folder đệ quy (`fs.cp`), tạo folder cha, từ chối ghi đè trừ khi `overwrite`.
- `POST /file/archive` payload `{ paths: string[], dest: string }` — nén `.zip` bằng `fflate.zipSync`/stream, giữ cấu trúc tương đối so với thư mục cha chung.
- `POST /file/extract` payload `{ path: string, dest?: string }` — giải nén `.zip` (mặc định cùng cấp, bỏ đuôi `.zip`), chống zip-slip (mọi entry phải nằm trong `dest`).
- Audit log cho cả 3 (`op: "copy" | "archive" | "extract"`), error schema như P1.
- Tests trong `httpapi-file-mutations.test.ts` (copy file/folder/overwrite/zip roundtrip/zip-slip reject).

**B2. Multi-select + bulk actions** (`packages/app`)
- Desktop: Ctrl/Cmd-click toggle, Shift-click range; Mobile: long-press vào node → vào selection mode (checkbox hiện ra), tap để thêm/bớt.
- Sticky action bar đáy màn hình khi đang chọn: `n selected` + Delete / Copy / Move / Download / Compress.
- Delete nhiều: confirm một lần (gõ tên nếu có folder không rỗng).
- Download nhiều: gọi `archive` tạm vào thư mục tạm rồi `download` — hoặc archive vào `dest` cùng cấp rồi tải; chọn phương án: archive vào `dest` = `${parent}/selection-<timestamp>.zip` rồi tự tải.
- Copy/Move: mở `DialogSelectDirectoryV2` (mode directory) chọn đích → gọi `copy`/`rename` cho từng path.

**B3. Client ops mở rộng** (`packages/app/src/context/file/ops.ts`)
- Thêm `copy`, `archive`, `extract` theo cùng pattern P1 (deps injectable, test riêng).

### Wave C — Preview + Info + Mobile polish + PWA

**C1. Preview** (`packages/app`)
- Kiểm tra viewer hiện có trong `file-tabs.tsx` (viewer shiki/text/binary). Thêm renderer theo mime/đuôi: ảnh (`<img>` với zoom/fit bằng CSS + pinch native), video (`<video controls>`), PDF (`<iframe>` với `#toolbar=0`), markdown (dùng markdown pipeline có sẵn của session-ui nếu tách được, nếu không thì render đơn giản).
- Nút mở file trong tab mới (download) giữ nguyên.

**C2. Info panel + endpoint** 
- `GET /file/info?path=` → `{ path, type: "file"|"directory"|"symlink", size, mtime, mode: "644"?, mime?, target? }` (symlink trả `target`).
- UI: mục "Info" trong menu → bottom sheet hiển thị thông tin + copy path.

**C3. Mobile polish + PWA**
- `sheet-v2.tsx`: bottom sheet (overlay + panel trượt từ dưới, kéo xuống để đóng bằng pointer events, safe-area padding iOS).
- Dùng sheet cho: prompt tên (new file/folder, rename), confirm delete, info file, chọn actions trên mobile.
- Touch target ≥ 40px; sticky bar; spinner/progress rõ hơn khi upload.
- PWA: cập nhật `packages/app/public/site.webmanifest` (name `opencode`, short_name `opencode`, `display: standalone`, `start_url: /`, `theme_color`/`background_color` khớp theme tối, icons 192/512 với `purpose: "any maskable"`); thêm meta iOS (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`, `apple-touch-icon`) trong `index.html` của app. Không service worker.

## 5. Kiểm thử & verification

- Unit tests (`bun test`) cho: menu items theo loại node (A2), dirty-guard state (A3), selection state (B2), ops mới (B3), zip path-slip client-side (nếu có), info formatting (C2).
- Server tests cho copy/archive/extract/info (B1, C2) theo pattern `httpapi-file-mutations.test.ts`, kèm audit assertions.
- CI: build `custom-build.yml` phải xanh trước khi deploy.
- E2E thủ công trên điện thoại sau mỗi wave (checklist riêng từng wave trong plan).
- Rollback: giữ `/usr/bin/opencode.bak` (như P1); revert commit nếu cần.

## 6. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| CodeMirror tăng bundle, tải chậm trên 4G | dynamic import khi bấm Edit; không nhúng vào bundle chính |
| `MenuV2`/long-press xung đột với scroll trên mobile | long-press 500ms + huỷ khi di chuyển >10px; test thật trên iOS Safari |
| `@pierre/trees` (picker V2) chưa mượt trên mobile | Wave A test sớm; nếu kém, chuyển picker sang cây nhà trồng dùng chung FileTreeV2 |
| Zip bomb / zip-slip | giới hạn tổng kích thước giải nén (mặc định 2GB) + chặn entry thoát `dest` |
| Nén nhiều file lớn làm nghẽn server 1 vCPU | nén chạy async, ghi dần xuống đĩa, không giữ toàn bộ trong RAM nếu > 256MB |
| Guard dirty chặn nhầm | chỉ chặn khi có draft khác nội dung đĩa; có nút Discard rõ ràng |

## 7. Câu hỏi mở

- Preview markdown: render full (GFM) hay chỉ text? (đề xuất: render GFM bằng pipeline có sẵn; nếu tách khó trong wave C thì hạ xuống text + highlight).
- Có cần giới hạn kích thước file editable trong CodeMirror không? (đề xuất: giữ 5MB như P1).
- Có cần hỗ trợ `.tar.gz` ngoài `.zip`? (đề xuất: chỉ `.zip` đợt này).
