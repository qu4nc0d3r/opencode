# opencode web — File Manager & Directory Picker Navigation (fork design)

- Ngày: 2026-09-21
- Fork: `qu4nc0d3r/opencode` (upstream `anomalyco/opencode`, branch `custom-fs`)
- Trạng thái: chờ user review spec → viết implementation plan

## 1. Mục tiêu

Bổ sung cho `opencode web` đang chạy tại `https://agent.hehez.net`:

1. **File manager đầy đủ trong UI**: tạo file/folder, rename, move/copy, delete, upload/download, nén/giải nén zip.
2. **Editor**: xem + sửa + save file text/code ngay trong browser.
3. **Picker điều hướng**: chọn project được trong folder con (điều hướng cây thư mục, không chỉ list 1 cấp).
4. **File tree panel**: duyệt và thao tác trên cây file trong session.

Người dùng chính: chủ VPS, truy cập từ mobile browser qua Cloudflare Tunnel + basic auth.

## 2. Quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Hướng triển khai | Fork opencode, tích hợp hoàn toàn trong UI |
| Phạm vi quyền file | **Toàn bộ filesystem** (absolute path, không giới hạn project root) |
| Build | GitHub Actions trên fork → artifact `opencode-linux-x64` → deploy lên VPS |
| Vị trí code | `C:\Users\minha\dev\opencode` (ngoài OneDrive) |
| Phase | P1 (core) → P2 (zip/copy/move/polish) → P3 (tuỳ chọn) |

## 3. Không nằm trong phạm vi (non-goals)

- Không sửa hành vi agent/permission của opencode.
- Không thêm multi-user/auth mới (giữ basic auth + Cloudflare Tunnel hiện có).
- Không hỗ trợ Windows path semantics cho tính năng mới (chỉ cần chạy đúng trên Linux VPS; code vẫn nên trung lập nếu dễ).

## 4. Kiến trúc & vận hành

### 4.1 Fork và branch
- `origin` = `qu4nc0d3r/opencode`, `upstream` = `anomalyco/opencode` (đã cấu hình).
- Mọi thay đổi nằm trên branch `custom-fs`; rebase định kỳ: `git fetch upstream && git rebase upstream/dev`.
- Ưu tiên thay đổi khu trú (file mới + chèn nhỏ vào file có sẵn) để rebase ít conflict.

### 4.2 CI build (`.github/workflows/custom-build.yml`)
- Trigger: `workflow_dispatch` + push lên `custom-fs`.
- Runner: `ubuntu-latest` (KHÔNG dùng blacksmith runner của upstream).
- Steps: checkout → `./.github/actions/setup-bun` → `bun install` → `./packages/opencode/script/build.ts --single` → upload artifact `packages/opencode/dist/opencode-linux-x64/bin/opencode`.
- Lưu ý: GitHub Actions trên fork mặc định bị tắt → cần bật trong Settings → Actions (hoặc qua API).

### 4.3 Deploy lên VPS
- Script `scripts/deploy-custom.sh` (chạy từ máy dev hoặc VPS): tải artifact → `scp` → thay `/usr/bin/opencode` → `systemctl restart opencode-web`.
- Luôn backup binary cũ (`/usr/bin/opencode.bak`) để rollback.
- Config/auth hiện tại (`OPENCODE_SERVER_PASSWORD`, tunnel, systemd) giữ nguyên.

## 5. Server API (`packages/opencode`)

Thêm endpoint vào `FileApi` hiện có (`src/server/routes/instance/httpapi/groups/file.ts` + `handlers/file.ts`), theo pattern `HttpApiBuilder.group` trong `AGENTS.md` của thư mục đó.

### 5.1 Endpoints (P1)
| Method + path | Body/Query | Mô tả |
|---|---|---|
| `POST /file/write` | `{path, content, encoding?: "utf8"\|"base64"}` | Tạo mới/ghi đè file; tự tạo folder cha nếu thiếu |
| `POST /file/mkdir` | `{path, recursive?: boolean}` | Tạo folder |
| `POST /file/rename` | `{from, to}` | Rename/move (kể cả folder; `to` chưa tồn tại) |
| `POST /file/delete` | `{path, recursive?: boolean}` | Xóa file/folder; folder không rỗng cần `recursive: true` |
| `PUT /file/upload` | raw body (octet-stream) + `?path=` | Upload 1 file, stream thẳng ra đĩa (hỗ trợ file lớn) |
| `GET /file/download` | `?path=` | Tải file (Content-Disposition: attachment) |

### 5.2 Endpoints (P2)
| Method + path | Body/Query | Mô tả |
|---|---|---|
| `POST /file/copy` | `{from, to, overwrite?: boolean}` | Copy file/folder |
| `POST /file/extract` | `{path, dest?}` | Giải nén `.zip` |
| `POST /file/archive` | `{paths: string[], dest}` | Nén thành `.zip` |

### 5.3 Quy tắc đường dẫn & an toàn
- Chấp nhận absolute path; relative path resolve theo `InstanceState.context.directory`.
- Canonicalize bằng `path.resolve`; reject khi: path rỗng, chứa byte NUL, không parse được. **Cho phép ra ngoài project root** (quyết định của user).
- Ghi/xóa là hành vi phá hủy: response lỗi rõ ràng (`Schema.ErrorClass`), không silent-fail.
- **Audit log**: append JSONL `{"ts","op","path","from","to","bytes"}` vào `$XDG_DATA_HOME/opencode/audit/fs.jsonl` (fallback `~/.local/share/opencode/`). Ghi cả thành công lẫn lỗi.
- Không log nội dung file vào audit.

### 5.4 Upload/Download
- Upload: raw stream (`handleRaw`) → `Bun.file`/`node:fs` write stream; giới hạn mặc định không; timeout theo server.
- Download: stream response `application/octet-stream` + tên file trong `Content-Disposition` (an toàn header, escape tên).
- Mobile: client upload từng file bằng `fetch(PUT)` để có progress.

### 5.5 Zip
- Dùng `fflate` (pure JS) cho `.zip` (extract + archive) — thêm dependency vào `packages/opencode`.
- Bảo vệ zip-slip: mọi entry path resolve phải nằm trong `dest` (reject `../`).

### 5.6 SDK
- Sau khi đổi API: chạy `./script/generate.ts` để regenerate SDK v2 client; commit kết quả.
- UI gọi qua `sdk.api.file.*` như hiện tại (`sdk.api.file.list(...)`).

## 6. UI (`packages/app`)

### 6.1 Picker điều hướng (P1)
- Sửa `src/components/directory-picker.tsx`: dùng `DialogSelectDirectoryV2` cho cả web (hiện chỉ desktop + `newLayoutDesigns`).
- V2 đã có: cây file (`@pierre/trees`), nút `~`, `Root`, `Parent`, gõ path + suggestion, nút "Select folder".
- Fallback nếu `@pierre/trees` lỗi trên mobile: thêm điều hướng vào `DialogSelectDirectory` legacy (row `..`, hành động "chọn folder hiện tại", Tab-append giữ nguyên).
- Test bắt buộc trên mobile browser (Safari/Chrome) sau deploy P1.

### 6.2 File manager (P1 + P2)
- Nâng cấp cây file session: `src/components/file-tree-v2.tsx` (tree + menu) và `src/pages/session/v2/session-file-browser-tab.tsx` (toolbar, sidebar).
- Toolbar: New file · New folder · Upload · Refresh.
- Context menu mỗi node (desktop: chuột phải; mobile: nút `⋯` trên node active):
  - P1: Open, New file/folder (trong folder), Rename, Delete, Download (file), Upload vào folder.
  - P2: Copy, Move (dùng picker V2 ở mode directory để chọn đích), Extract `.zip`, Compress folder.
- Delete: dialog confirm; folder không rỗng phải gõ đúng tên mới cho xóa.
- Sau mutation: invalidate query file tree + toast kết quả (`showToast`).

### 6.3 Editor (P1)
- Mở rộng file view hiện có (`src/pages/session/file-tabs.tsx`, `SessionFileView`) + nút **Edit** khi file là text.
- P1 dùng `<textarea>` monospace (không thêm dep nặng), có:
  - Save (nút + `Ctrl/Cmd+S`) → `POST /file/write`.
  - Dirty indicator; confirm khi đóng tab/đổi file nếu chưa lưu.
  - Read-only với file binary > giới hạn kích thước (vd 5MB).
- (P2 tuỳ chọn: CodeMirror 6 nếu cần highlight/line numbers.)

### 6.4 Upload từ mobile (P1)
- `<input type="file" multiple>` + drag&drop (desktop).
- Upload theo hàng đợi tuần tự, hiển thị tiến trình, cho phép hủy.
- Upload file vào thư mục đang chọn; tạo folder cha nếu path đích chưa có.

### 6.5 Zip (P2)
- Menu "Extract here" cho file `.zip`; "Compress to .zip" cho folder (lưu cùng cấp hoặc tải về).
- Toast + refresh tree sau khi xong.

## 7. Phases

- **P1 (core)**: API write/mkdir/rename/delete/upload/download · picker V2 cho web · toolbar + context menu cơ bản · editor save · CI workflow · deploy + test mobile.
- **P2**: copy/move · zip extract/archive · drag&drop nâng cao · audit log viewer (đơn giản) · polish mobile UX.
- **P3 (tuỳ)**: multi-select · preview ảnh/media · search trong file manager · CodeMirror.

## 8. Kiểm thử & verification

- **CI**: build thành công + `bun run typecheck` (theo workflow có sẵn nếu khả thi).
- **Unit tests** trong repo nếu sửa logic có test sẵn (`directory-picker-domain.test.ts`, `file-tree-v2-model.test.ts`).
- **E2E thủ công trên VPS** (checklist sau mỗi lần deploy):
  1. Picker: chọn được project trong folder con (`/root/projects/...`), nút Parent/Root, gõ path.
  2. Tạo folder + file mới trong UI, thấy ngay trên filesystem (qua SSH kiểm chứng).
  3. Upload ảnh từ điện thoại → file đúng nội dung; download lại mở được.
  4. Rename, delete (có confirm), copy/move.
  5. Sửa 1 file text + Save → nội dung đúng trên đĩa; reload vẫn thấy.
  6. Zip: nén folder → tải về; upload .zip → extract đúng cây thư mục.
  7. Audit log có ghi các thao tác trên.
- **Rollback**: giữ `/usr/bin/opencode.bak`; rollback = đổi tên + restart service.

## 9. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| `@pierre/trees` không chạy tốt trên mobile | Test ngay P1; fallback nâng cấp dialog legacy |
| Fork lệch upstream gây khó rebase | Thay đổi khu trú, file mới nhiều hơn sửa file lõi, rebase định kỳ |
| Fork bị tắt Actions | Bật qua Settings/API khi setup CI |
| Full-FS + public UI = rủi ro xóa nhầm | Confirm gõ tên, audit log, giữ basic auth mạnh; có thể thêm flag giới hạn sau |
| Upload file lớn qua tunnel | Stream 2 chiều; cảnh báo giới hạn của Cloudflare (100MB/request với gói free; cân nhắc chia nhỏ/`--chunk`) |
| Editor textarea không đủ (thiếu highlight) | Chấp nhận ở P1; P3 nâng cấp CodeMirror |

## 10. Câu hỏi mở

- Có cần giới hạn kích thước upload mặc định không? (đề xuất: không giới hạn phía server, cảnh báo ở client khi >100MB do Cloudflare).
- Có muốn audit log xem được trong UI ở P2 không, hay chỉ cần file log?
