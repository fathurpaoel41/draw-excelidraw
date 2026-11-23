# Draw (`draw-app`)

Aplikasi whiteboard dan diagramming **client-side first** & **offline-ready** berbasis [`@excalidraw/excalidraw`](https://github.com/excalidraw/excalidraw), dirancang untuk menggambar alur (_workflow_), arsitektur sistem, dan diagram teknis secara instan tanpa halaman login penghalang.

Semua kanvas disimpan secara otomatis di browser menggunakan **IndexedDB** (`draw_local_db` via Dexie), dan secara opsional dapat disinkronkan ke **Database PostgreSQL** melalui modul backend `/api/draw` di repositori `analisis-saham`.

Untuk rancangan arsitektur dan catatan implementasi lengkap, lihat [PLAN.md](PLAN.md) dan [TASKS.md](TASKS.md).

---

## Fitur Utama

- **Instant Canvas (`/`)**: Membuka aplikasi langsung menampilkan kanvas layar penuh (`100vw × 100vh`) dan memuat workspace terakhir dari IndexedDB tanpa jeda atau kewajiban login.
- **Offline-Ready & Self-Hosted Fonts**: Aset font Excalidraw disalin otomatis ke `public/fonts/` saat instalasi (`window.EXCALIDRAW_ASSET_PATH = "/"`), sehingga kanvas tetap bekerja penuh secara offline tanpa bergantung pada CDN eksternal.
- **My Canvas & Manajemen Folder (`WorkspaceDrawer`)**:
  - Organisasi kanvas ke dalam folder (_Semua Canvas_, _Tanpa Folder_, dan folder buatan pengguna).
  - Filter penyimpanan: **Semua**, **Lokal (IndexedDB)**, dan **Database**.
  - Pencarian judul canvas, pratinjau thumbnail WebP otomatis, duplikasi, rename inline di top-right bar, pindah folder, migrasi **Lokal ↔ Database**, serta **Import / Export `.excalidraw`**.
- **Dual Storage, Autosave & Resolusi Konflik**:
  - Autosave ter-debounce (`900ms` untuk Lokal, `1600ms` untuk Database) menggunakan `getSceneVersion(elements)` dan komparasi subset `appState` agar tidak menulis berlebih saat pointer bergerak, ditambah flush otomatis saat tab ditutup/disembunyikan (`visibilitychange` / `pagehide`).
  - Workspace Database tetap di-cache di IndexedDB sehingga bisa dibuka dan diedit saat offline, lalu disinkronkan kembali saat online.
  - Deteksi konflik versi (`409 Conflict` dengan _optimistic locking_) lewat `ConflictModal`: pilih **Gunakan Versi Database**, **Timpa dengan Versi Lokal**, atau **Simpan Keduanya**.
- **Mermaid to Excalidraw (`MermaidModal`)**:
  - Editor split-pane dengan **5 template cepat** (_Flowchart Workflow_, _Sequence Diagram_, _Arsitektur Sistem_, _Entity Relationship (ERD)_, _State Diagram_).
  - Pengaturan ukuran font (`16px`, `20px`, `24px`) dan opsi _Elbow Arrows_.
  - Pratinjau SVG langsung (_live preview_), validasi error sintaks, serta opsi **Tambahkan ke Kanvas** (`Cmd/Ctrl + Enter`) atau **Ganti Kanvas**.
- **Export Lengkap (PNG, SVG, Clipboard & PDF)**:
  - **Export PNG Cepat**: Unduh PNG resolusi `2×` dalam 1 klik lewat tombol `PNG` di kanan atas atau menu _Export PNG Cepat_.
  - **Export Image Bawaan**: Dialog `SaveAsImage` Excalidraw untuk ekspor PNG, SVG, atau salin ke clipboard dengan opsi embed scene dan skala.
  - **Export PDF (`ExportPdfModal`)**: Live preview, nama file custom, toggle _Background_ & _Dark mode_, pilihan skala (`1×`, `2×`, `3×`), ukuran halaman (**Fit**, **A4**, **A3**, **Letter**), orientasi (**Auto**, **Landscape**, **Portrait**), serta dukungan **Multi-Halaman per Frame**.
- **Tema & MainMenu Bersih**: Mendukung tema **Light**, **Dark**, dan **System**, pengatur warna latar kanvas, serta `<MainMenu>` yang bebas dari tautan promosi eksternal.

---

## Pintasan Keyboard

### Pintasan Aplikasi

| Pintasan                                 | Aksi                                       |
| :--------------------------------------- | :----------------------------------------- |
| `Cmd/Ctrl + S`                           | Paksa simpan segera ke penyimpanan aktif   |
| `Cmd/Ctrl + Shift + W`                   | Buka / tutup drawer **My Canvas & Folder** |
| `Cmd/Ctrl + Shift + M`                   | Buka modal **Mermaid to Excalidraw**       |
| `Cmd/Ctrl + Shift + P`                   | Buka modal **Export PDF**                  |
| `Alt + N` / `Cmd/Ctrl + Shift + K`       | Buat **New Canvas** kosong                 |
| `Cmd/Ctrl + Enter` _(di editor Mermaid)_ | Tambahkan diagram ke kanvas                |

### Pintasan Bawaan Excalidraw

- **Alat Gambar**: `V` Select, `R` Rectangle, `D` Diamond, `O` Ellipse, `A` Arrow, `L` Line, `P` Freedraw, `T` Text, `9` Image, `E` Eraser, `H` / `Space + Drag` Pan kanvas, `F` Frame, `K` Laser Pointer, `Q` Lock active tool.
- **Navigasi & Utilitas**: `Cmd/Ctrl + F` Find on canvas, `Cmd/Ctrl + /` Command Palette, `Cmd/Ctrl + O` Buka `.excalidraw`, `Cmd/Ctrl + Shift + E` Export image, `?` Daftar shortcut lengkap.

---

## Tech Stack

- **Runtime & Package Manager**: Bun
- **Core UI**: React `^19.0.0`, TypeScript `^5.8.0`, Vite, Tailwind CSS v4 (`@tailwindcss/vite`)
- **Canvas & Diagram**: `@excalidraw/excalidraw` (`^0.18.0`), `@excalidraw/mermaid-to-excalidraw`
- **Local Storage**: `dexie` (`^4.0.11`), `dexie-react-hooks` (`^1.1.7`)
- **Export & UI**: `jspdf`, `react-select` (`^5.10.2`), `lucide-react`

---

## Cara Menjalankan

### Prasyarat

- **Bun** terpasang di sistem.
- _(Opsional)_ Backend `analisis-saham` berjalan di port `6000` jika ingin mengaktifkan login akun dan penyimpanan **Database**. Mode **Lokal (IndexedDB)** berjalan penuh tanpa backend.

### Instalasi & Pengembangan

```bash
bun install
cp .env.example .env   # atur VITE_STORAGE_MODE (local/server) & VITE_API_TARGET
bun run dev
```

- `bun install` otomatis menjalankan script `postinstall` (`bun scripts/copy-assets.ts`) untuk menyalin font Excalidraw ke `public/fonts/`.
- Dev server berjalan di **`http://localhost:5001`** dengan proxy `/api` menuju `VITE_API_TARGET` (default: `http://localhost:6000`).

### Mode Penyimpanan (`.env`)

| Variabel            | Nilai                   | Keterangan                                                                                                                                                                          |
| :------------------ | :---------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_STORAGE_MODE` | `local`                 | Mode khusus lokal (**IndexedDB** saja). Semua menu login, tombol simpan ke Database, filter tab Database, dan sinkronisasi server disembunyikan serta tidak memanggil API `/api/*`. |
| `VITE_STORAGE_MODE` | `server`                | Mode _dual storage_ (**IndexedDB** + **Database PostgreSQL**). Mengaktifkan opsi login akun, _Simpan ke Database_, _Sync DB_, filter tab Database, dan resolusi konflik versi.      |
| `VITE_API_TARGET`   | `http://localhost:6000` | Alamat backend tujuan proxy Vite (`/api`) saat memakai mode `server`.                                                                                                               |

### Skrip Tersedia

| Perintah               | Deskripsi                                                            |
| :--------------------- | :------------------------------------------------------------------- |
| `bun run dev`          | Menjalankan server pengembangan Vite di port `5001`                  |
| `bun run build`        | Type-check TypeScript (`tsc --noEmit`) dan build produksi ke `dist/` |
| `bun run preview`      | Menjalankan preview hasil build produksi                             |
| `bun run typecheck`    | Menjalankan pemeriksaan tipe TypeScript (`tsc --noEmit`)             |
| `bun run format`       | Memformat seluruh kode dengan Prettier                               |
| `bun run format:check` | Memeriksa format Prettier                                            |

---

## Struktur Direktori

```text
draw/
├── .env.example                    # Contoh konfigurasi env (VITE_STORAGE_MODE, VITE_API_TARGET)
├── PLAN.md                         # Dokumen rencana arsitektur & teknis
├── TASKS.md                        # Daftar task pengembangan per fase
├── index.html                      # Entry HTML & set window.EXCALIDRAW_ASSET_PATH = "/"
├── package.json
├── vite.config.ts                  # Alias Excalidraw prod entry, port 5001, proxy /api
├── scripts/
│   └── copy-assets.ts              # Menyalin aset font Excalidraw ke public/fonts/
├── public/
│   └── fonts/                      # Aset font self-hosted (dihasilkan oleh postinstall)
└── src/
    ├── main.tsx                    # Entry point React
    ├── App.tsx                     # Langsung merender CanvasBoard
    ├── index.css                   # Tailwind CSS v4 & penyesuaian style Excalidraw
    ├── types/
    │   └── workspace.ts            # Definisi tipe Workspace, SyncStatus, ExportPdfOptions, dll.
    ├── lib/
    │   ├── api.ts                  # HTTP client (/api/*) dengan auto-refresh token JWT
    │   ├── config.ts               # Pembacaan mode penyimpanan env (local vs server)
    │   ├── db.ts                   # Skema IndexedDB (Dexie: workspaces, files, folders, settings)
    │   ├── exportPdf.ts            # Engine Export PDF (jsPDF + multi-halaman per Frame)
    │   ├── exportPng.ts            # Helper Export PNG cepat
    │   ├── mermaid.ts              # Konversi Mermaid → Excalidraw + 5 template bawaan
    │   └── thumbnail.ts            # Generator thumbnail WebP ringan dari scene
    ├── services/
    │   ├── authService.ts          # Login, register, logout, dan cek sesi user (/api/auth/*)
    │   ├── localWorkspace.ts       # Operasi CRUD IndexedDB & pembersihan orphan files
    │   ├── cloudWorkspace.ts       # Operasi CRUD ke backend (/api/draw/*)
    │   └── workspaceManager.ts     # Unified storage layer, migrasi Lokal ↔ DB & resolusi konflik
    ├── hooks/
    │   ├── useAuth.ts              # State autentikasi opsional untuk Cloud Database
    │   ├── useHotkeys.ts           # Handler pintasan keyboard aplikasi
    │   └── useWorkspace.ts         # Instant load, autosave ter-debounce, sync & manajemen state canvas
    └── components/
        ├── AppSelect.tsx           # Wrapper react-select yang selaras dengan tema Light/Dark
        ├── AuthModal.tsx           # Modal login/register akun Database
        ├── CanvasBoard.tsx         # Wrapper <Excalidraw />, custom <MainMenu />, toast & modal
        ├── ConflictModal.tsx       # Dialog resolusi konflik versi (409 Conflict)
        ├── ExportPdfModal.tsx      # Modal pengaturan & pratinjau Export PDF
        ├── MermaidModal.tsx        # Modal editor & live preview Mermaid to Excalidraw
        ├── TopRightControls.tsx    # Badge folder, rename inline, status simpan, tombol PNG & PDF
        └── WorkspaceDrawer.tsx     # Panel explorer My Canvas, folder, filter & import/export
```

---

## Integrasi Backend (Opsional)

Saat pengguna memilih **Masuk Akun Database...** atau memindahkan canvas ke **Database**, frontend berkomunikasi melalui proxy `/api` ke backend `analisis-saham` dengan respons standar `{ data }` / `{ error }` dan _Bearer JWT_ (beserta auto-refresh token):

- **Autentikasi (`/api/auth`)**:
  - `POST /api/auth/login`
  - `POST /api/auth/register`
  - `POST /api/auth/refresh`
  - `GET /api/auth/me`
- **Modul Draw (`/api/draw`)**:
  - `GET /api/draw/workspaces` (`?q=&folder=`) — Daftar ringkasan workspace
  - `POST /api/draw/workspaces` — Buat workspace baru di database
  - `GET /api/draw/workspaces/:id` — Ambil detail workspace beserta map `files`
  - `PUT /api/draw/workspaces/:id` — Update workspace dengan `expected_version` (_optimistic locking_)
  - `PATCH /api/draw/workspaces/:id/meta` — Ubah judul atau folder tanpa mengirim ulang `elements`
  - `POST /api/draw/workspaces/:id/duplicate` — Duplikasi workspace beserta `files`
  - `DELETE /api/draw/workspaces/:id` — Hapus workspace dari database
  - `GET /api/draw/folders` & `PATCH /api/draw/folders` — Daftar & rename folder massal
