# Daftar Task Lengkap Pengembangan Aplikasi Draw

Status legenda: `[ ]` Belum dikerjakan · `[/]` Sedang dikerjakan · `[x]` Selesai

---

## Fase 0 — Persiapan & Inisialisasi Proyek Frontend

- [x] **0.1 Inisialisasi proyek Vite + React + TypeScript di `/Users/macbook/Documents/Belajar/sahamin/code/draw`**
  - Buat `package.json` (gunakan Bun), `tsconfig.json`, `vite.config.ts` (port `5001`, proxy `/api` → `http://localhost:6000`), `index.html`, dan `.gitignore`.
  - Pasang dependensi utama:
    - `react`, `react-dom`, `@excalidraw/excalidraw`
    - `@excalidraw/mermaid-to-excalidraw`
    - `dexie`, `dexie-react-hooks`
    - `jspdf`
    - `lucide-react`
  - Pasang devDependencies: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `tailwindcss`, `@tailwindcss/vite`, `prettier`.
- [x] **0.2 Konfigurasi Self-Hosted Fonts & Aset Offline Excalidraw**
  - Buat script kecil (`scripts/copy-assets.ts`) dan hook `postinstall` untuk menyalin font dari `node_modules/@excalidraw/excalidraw/dist/prod/fonts` ke `public/fonts/`.
  - Set `window.EXCALIDRAW_ASSET_PATH = "/"` di `index.html`.
  - Pastikan `@excalidraw/excalidraw/index.css` terimpor dengan benar dan tidak bentrok dengan Tailwind CSS v4 preflight.
- [x] **0.3 Verifikasi Kanvas Dasar (Smoke Test)**
  - Buat `src/App.tsx` yang langsung merender `<Excalidraw />` full-viewport (`100vw x 100vh`).
  - Verifikasi production build & preview berjalan mulus tanpa error runtime.

---

## Fase 1 — Modul Backend `draw` di `analisis-saham`

> Lokasi: `/Users/macbook/Documents/Belajar/sahamin/code/analisis-saham`

- [x] **1.1 Buat Migrasi Database `db/migrasi/024_draw.sql` & Pemisahan Schema `db/migrasi/027_draw_schema.sql`**
  - Pisahkan ke PostgreSQL schema khusus `draw` (`draw.workspaces` & `draw.files`) agar tidak bercampur di schema `public`.
  - Tabel `draw.workspaces` (`id uuid`, `user_id`, `judul`, `folder`, `elements jsonb`, `app_state jsonb`, `thumbnail text`, `versi int`, `dibuat`, `diperbarui`).
  - Index `idx_draw_workspaces_user_diperbarui` dan `idx_draw_workspaces_user_folder`.
  - Tabel `draw.files` (`workspace_id`, `file_id`, `mime_type`, `data_url`, `ukuran_byte`, `dibuat`) dengan `ON DELETE CASCADE`.
- [x] **1.2 Buat Skema Validasi Zod (`src/modules/draw/schemas/workspace.schema.ts`)**
  - Skema validasi untuk Create Workspace, Update Workspace (termasuk `expected_version` & `files`), Update Metadata (`judul`, `folder`), rename folder, serta validasi UUID parameter `:id`.
  - Batasi ukuran payload (15 MB) & validasi `mime_type` gambar yang aman.
- [x] **1.3 Buat Model SQL (`src/modules/draw/models/workspace.model.ts` & `file.model.ts`)**
  - Query murni memakai `sql` dari `src/core/db.ts` (tanpa SQL di controller/service).
  - Fungsi: `daftarMilikUser`, `daftarFolderMilikUser`, `ambilDetail`, `buat`, `perbarui` (optimistic lock), `perbaruiMeta`, `ubahNamaFolderMassal`, `hapus`, `ambilFiles`, `sinkronFiles`, `salinFiles`.
- [x] **1.4 Buat Service Layer (`src/modules/draw/services/workspace.service.ts`)**
  - Orkestrasi pembuatan, pembaruan (deteksi 404 vs 409 Conflict), duplikasi (beserta files), penghapusan, manajemen folder, serta sanitasi `app_state`.
- [x] **1.5 Buat Controller & Routes (`controllers/workspace.controller.ts`, `draw.routes.ts`, `index.ts`)**
  - Semua route menggunakan `perluAuth` dan respons seragam `ok()` / `galat()` dari `src/core/respon.ts`.
  - Endpoint:
    - `GET /workspaces`
    - `POST /workspaces`
    - `GET /folders` & `PATCH /folders`
    - `GET /workspaces/:id`
    - `PUT /workspaces/:id`
    - `PATCH /workspaces/:id/meta`
    - `POST /workspaces/:id/duplicate`
    - `DELETE /workspaces/:id`
  - Ekspor `drawModule: AppModule` (`name: "draw"`, `prefix: "/api/draw"`) dan daftarkan di `src/modules/index.ts`.
- [x] **1.6 Unit & Integrasi Test Backend**
  - Tambahkan unit test modul `draw` di `tests/inti.test.ts` & test integrasi API lengkap di `tests/integrasi.test.ts`.
  - Verifikasi backend lulus untuk seluruh test modul `draw`:
    - `bun run cek` (exit code 0)
    - `bun test tests/inti.test.ts` (47 pass, 0 fail)
    - `bun test tests/integrasi.test.ts -t "Modul Draw"` (lulus)

---

## Fase 2 — Core Canvas, MainMenu, Toolbar & Shortcuts

- [x] **2.1 Bangun Komponen `src/components/CanvasBoard.tsx`**
  - Render `<Excalidraw />` full-screen sebagai halaman utama `/`.
  - Tangkap instance `excalidrawAPI` secara aman.
  - Konfigurasikan `<MainMenu>` kustom tanpa tautan promosi eksternal.
  - Konfigurasikan `<WelcomeScreen>` ringan untuk kanvas kosong.
- [x] **2.2 Implementasi Custom Keyboard Shortcuts (`src/hooks/useHotkeys.ts`)**
  - `Cmd/Ctrl + S`: Paksa simpan segera ke storage aktif + toast notifikasi.
  - `Cmd/Ctrl + Shift + W`: Toggle My Canvas Drawer.
  - `Cmd/Ctrl + Shift + M`: Buka modal Mermaid to Excalidraw.
  - `Cmd/Ctrl + Shift + P`: Buka modal Export PDF.
  - `Alt + N` / `Cmd/Ctrl + Shift + K`: New Canvas.
- [x] **2.3 Implementasi Top-Right Controls (`src/components/TopRightControls.tsx`)**
  - Input inline judul canvas aktif + label folder (klik untuk edit, Enter/blur untuk simpan).
  - Indikator badge lokasi & status penyimpanan (`Lokal`, `Database`, `Menyimpan`, `Tertunda`, `Konflik`).
  - Tombol cepat: `New Canvas`, `My Canvas` (ikon folder), `Mermaid`, `PDF`.

---

## Fase 3 — Penyimpanan Lokal IndexedDB (Offline-First)

- [x] **3.1 Setup Database Dexie (`src/lib/db.ts`)**
  - Definisikan skema tabel `workspaces`, `files`, `folders`, dan `settings`.
  - Buat tipe TypeScript ketat di `src/types/workspace.ts`.
- [x] **3.2 Implementasi Generator Thumbnail (`src/lib/thumbnail.ts`)**
  - Generate preview thumbnail ringan (lebar ~320px, WebP) menggunakan `exportToBlob`.
- [x] **3.3 Implementasi Service Lokal (`src/services/localWorkspace.ts`)**
  - CRUD penuh workspace, folder, & files di IndexedDB + pembersihan orphan files.
- [x] **3.4 Implementasi Hook `src/hooks/useWorkspace.ts` (Instant Load + Autosave)**
  - Membuka `lastActiveWorkspaceId` dari IndexedDB seketika (atau membuat `"Canvas Workflow"` otomatis).
  - Deteksi perubahan nyata menggunakan `getSceneVersion(elements)` + komparasi `appState` & `files`.
  - Debounced autosave (`750ms` lokal / `1400ms` cloud) + flush simpan pada `beforeunload`/`visibilitychange`.

---

## Fase 4 — Integrasi Dual Storage (Opsi Simpan ke Database)

- [x] **4.1 API Client & Autentikasi Opsional (`src/lib/api.ts`, `src/services/authService.ts`, `src/hooks/useAuth.ts`)**
  - Koneksi ke `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`, `/api/auth/me` + auto-refresh token.
  - Buat `src/components/AuthModal.tsx` (opsional saat user memilih simpan ke Database).
- [x] **4.2 Cloud Workspace Service (`src/services/cloudWorkspace.ts`)**
  - Integrasikan seluruh endpoint `/api/draw/workspaces*` dan `/api/draw/folders`.
- [x] **4.3 Unified Workspace Manager (`src/services/workspaceManager.ts`)**
  - Gabungkan sumber data IndexedDB + Database, migrasi Lokal ↔ Database, sync otomatis saat kembali online, serta resolusi konflik versi `409`.
- [x] **4.4 My Canvas Drawer, Manajemen Folder & Conflict Modal (`WorkspaceDrawer.tsx`, `ConflictModal.tsx`)**
  - Tab filter storage (`Semua`, `Lokal (IndexedDB)`, `Database`), manajemen folder penuh, pencarian, kartu dengan thumbnail, import/export `.excalidraw`, serta `ConflictModal.tsx`.

---

## Fase 5 — Fitur Mermaid to Excalidraw

- [x] **5.1 Wrapper Konversi & Template (`src/lib/mermaid.ts`)**
  - Integrasikan `parseMermaidToExcalidraw` & `convertToExcalidrawElements` dengan 5 template starter.
- [x] **5.2 Modal Editor Split-Pane (`src/components/MermaidModal.tsx`)**
  - Editor Mermaid + Tab indent + pilihan font & elbow arrows + live SVG preview + tombol `Tambahkan ke Kanvas` & `Ganti Isi Kanvas`.

---

## Fase 6 — Fitur Export PNG, SVG & PDF

- [x] **6.1 Verifikasi & Penyempurnaan Export PNG / SVG / Clipboard**
  - Modal `SaveAsImage` Excalidraw memakai judul workspace aktif dan self-hosted fonts.
- [x] **6.2 Engine Export PDF (`src/lib/exportPdf.ts`)**
  - `exportToBlob` + `jsPDF` mendukung `Fit`, `A4`, `A3`, `Letter`, orientasi `Auto`/`Landscape`/`Portrait`, `1x`/`2x`/`3x`, serta multi-halaman per Frame.
- [x] **6.3 Modal Export PDF (`src/components/ExportPdfModal.tsx`)**
  - Pratinjau live, input nama file, toggle Background, Dark mode, Scale, Ukuran Halaman, Orientasi, dan Multi-Halaman per Frame.

---

## Fase 7 — Polishing, Aksesibilitas & Verifikasi Menyeluruh

- [x] **7.1 Aksesibilitas & Responsive Polish**
  - `aria-label`, tutup dengan `Esc`, dukungan Dark/Light/System theme, serta toast feedback.
- [x] **7.2 Verifikasi Frontend (`/Users/macbook/Documents/Belajar/sahamin/code/draw`)**
  - `bun run typecheck` (`tsc --noEmit`) — lulus.
  - `bun run build` (`tsc --noEmit && vite build`) — lulus.
  - `bun run format:check` — lulus.
  - Smoke test headless browser pada `vite preview` — lulus untuk instant canvas, shortcut `R`, Mermaid to Excalidraw, reload IndexedDB, My Canvas & folder, New Canvas, dan Export PDF.
- [x] **7.3 Verifikasi Backend (`/Users/macbook/Documents/Belajar/sahamin/code/analisis-saham`)**
  - `bun run cek` — lulus.
  - `bun test tests/inti.test.ts` (47/47 lulus), `bun test tests/pemula.test.ts` (17/17 lulus), `bun test tests/integrasi.test.ts` (`Modul Draw` lulus; 1 test Sahamin lama `API kuantitatif` timeout 30s akibat latensi query remote DB).
- [ ] **7.4 Checklist Uji Manual Pengguna Akhir**
  - [x] Buka `/` → langsung masuk kanvas tanpa jeda/login.
  - [x] Gambar flowchart dengan shortcut keyboard (`R`) & reload browser → data tetap utuh dari IndexedDB.
  - [x] Buat folder, New Canvas, dan pindah antar canvas di `My Canvas`.
  - [x] Uji Mermaid to Excalidraw → insert ke kanvas.
  - [x] Uji Export PDF → file `.pdf` berhasil diunduh.
  - [ ] Uji manual login akun backend → simpan workspace ke Database → buka di tab/browser lain saat backend berjalan di port `6000`.
