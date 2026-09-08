# 🛠️ 03. Arsitektur Sistem dan Struktur Proyek

## 3.1 Arsitektur Sistem Umum
**Madrasah — Personal Knowledge Operating System** mengusung arsitektur **Full-Stack Single Container** yang menggabungkan kecepatan Single Page Application (SPA) berbasis React dengan keandalan server Express.js di sisi backend.

```
+-------------------------------------------------------------------------+
|                        PERAMBAN PENGGUNA (CLIENT)                       |
|                                                                         |
|   +-----------------------+                    +--------------------+   |
|   |     Zustand Store     | <----------------> |   React Frontend   |   |
|   |  (Local + Cloud Sync) |                    |     (Vite SPA)     |   |
|   +-----------------------+                    +--------------------+   |
+---------------------------------------------------|---------------------+
                                                    |
                                                    | (HTTPS / JSON)
                                                    v
+-------------------------------------------------------------------------+
|                        SERVER BACKEND (EXPRESS)                         |
|                                                                         |
|   +----------------------+                     +--------------------+   |
|   |    Caching Engine    | <-----------------> |   API Gateway &    |   |
|   |   (In-Memory Map)    |                     |   Rate Limiters    |   |
|   +----------------------+                     +--------------------+   |
|                                                           |             |
+-----------------------------------------------------------|-------------+
                                                            |
                                                            | (HTTPS / REST)
                                                            v
                                                  +-------------------+
                                                  |  HCNSEC Provider  |
                                                  | (AI Base Gateway) |
                                                  +-------------------+
```

### 1. Sisi Klien (Frontend Client)
Aplikasi klien dibangun menggunakan **React 18+** dan dikompilasi menggunakan **Vite 6**. Seluruh pengelolaan status aplikasi (*global state*) dikonsolidasikan menggunakan **Zustand**. Keuntungan pola ini adalah:
- **Keringanan & Kepatuhan**: Zustand tidak memerlukan pembungkus *Provider* berlebih, meminimalkan rendering ulang yang tidak perlu.
- **Ketahanan Penyimpanan Offline (IndexedDB Engine)**: Data disimpan di peramban menggunakan IndexedDB (didukung `localforage` dengan isolasi per-store) untuk melewati batas 5MB `localStorage`, dengan migrasi otomatis data lawas dan fallback yang aman.
- **Dual Persistence Strategy**: Data lokal disinkronkan secara mulus ke cloud Firestore dengan Optimistic Concurrency Control (OCC) untuk keamanan jangka panjang.
- **Ergonomi Sentuh & Responsivitas**: Dilengkapi dengan hook penanganan gesture sentuh dan bilah tab gulir bebas hambatan (`no-scrollbar`).
- **Ketahanan Fatal & Notifikasi (Resilience & Toast)**: Dilengkapi dengan `ErrorBoundary` level akar dan pencegat kejadian *runtime* global via pustaka *toast* `sonner` untuk menampilkan jejak *error* transparan kepada pengguna tanpa memecah konsol peramban secara sunyi.

### 2. Sisi Server (Backend Gateway)
Server backend menggunakan **Express.js** yang berjalan di Node.js. Server ini memiliki tanggung jawab krusial:
- **Keamanan Kredensial AI**: Menjaga rahasia `HCNSEC_API_KEY`, `OPENROUTER_API_KEY`, dan `GEMINI_API_KEY` dari jangkauan peramban. Aplikasi klien hanya memanggil rute `/api/ai/*`.
- **HCNSEC AI Provider Gateway**: Mengutamakan provider **HCNSEC** (`HCNSEC_API_KEY`, `HCNSEC_BASE_URL`, `HCNSEC_MODEL`) yang kompatibel dengan protokol OpenAI Chat Completions, dengan mekanisme fallback yang anggun.
- **Rate Limiting**: Melindungi server dari lonjakan trafik dan penyalahgunaan kuota menggunakan `express-rate-limit`.
- **In-Memory Cache (TTL 1 Jam)**: Menyimpan respons AI berdasarkan hash payload permintaan untuk memotong latensi dan biaya API.
- **Robust JSON Sanitizer**: Membersihkan blok kode Markdown dan memulihkan objek JSON secara otomatis melalui fungsi `cleanAndParseJson`.

---

## 3.2 Struktur Proyek Aktual

Struktur direktori Madrasah diorganisasikan secara modular untuk memastikan skalabilitas jangka panjang dan kemudahan navigasi:

```
/remix-madrasah
├── .env.example              # Template konfigurasi variabel lingkungan lengkap (Gemini, OpenRouter, Firebase)
├── AGENTS.md                 # Aturan baku dan batasan AI Coding Agent
├── README.md                 # Gerbang utama dan panduan cepat proyek
├── vercel.json               # Konfigurasi deployment Vercel (rewrites, functions, caching)
├── server.ts                 # Standalone Node.js Express server (Cloud Run / Docker / Local)
├── api/                      # Vercel Serverless Functions
│   └── index.ts              # Titik masuk Serverless Function untuk Vercel
├── server/                   # Inti aplikasi backend
│   └── app.ts                # Logika Express terpusat (middleware, AI routing, audit, webhook)
├── package.json              # Dependensi, skrip dev, build esbuild, dan start
├── vite.config.ts            # Konfigurasi pembangun Vite
├── tsconfig.json             # Konfigurasi TypeScript compiler ketat
├── public/                   # Aset publik statis
├── docs/                     # Dokumentasi resmi sistem (Single Source of Truth)
│   ├── 01_identity_and_philosophy.md
│   ├── 02_design_and_ux.md
│   ├── 03_architecture_and_project_structure.md
│   ├── 04_modules_and_features.md
│   ├── 05_data_model_and_api.md
│   ├── 06_operation_and_deployment.md
│   ├── 07_roadmap_and_changelog.md
│   ├── 08_faq_and_troubleshooting.md
│   ├── 09_contribution_guidelines.md
│   ├── 10_tadib_layer_prd.md
│   └── 11_reading_reflection_connecting_prd.md
└── src/                      # Sumber kode utama frontend
    ├── App.tsx               # Komponen akar React
    ├── main.tsx              # Entry point frontend
    ├── index.css             # Konfigurasi Tailwind CSS v4 & tema font
    ├── app/                  # Infrastruktur dasar aplikasi
    │   └── Router.tsx        # Sistem perutean berbasis react-router-dom
    ├── components/           # Komponen UI global dan tata letak
    │   ├── layout/           # MainLayout, Sidebar, MobileNav, CommandPalette, OnboardingTour
    │   └── ui/               # Komponen atomik (Button, Dialog, Badge, Card, dll.)
    ├── store/                # Zustand stores untuk manajemen state modular
    │   ├── authStore.ts      # Autentikasi dan profil pengguna
    │   ├── curriculumStore.ts# Kurikulum dan fase belajar
    │   ├── graphStore.ts     # Konfigurasi simpul dan filter graf
    │   ├── indexedDbStorage.ts # Wrapper IndexedDB terisolasi (localforage)
    │   ├── knowledgeStore.ts # Konsep atomik dan hubungan semantik
    │   ├── libraryStore.ts   # Pustaka buku, penulis, dan riwayat sesi baca
    │   ├── notesStore.ts     # Zettelkasten notes dan inbox
    │   ├── projectsStore.ts  # Proyek dan daftar tugas terstruktur
    │   ├── reviewStore.ts    # Dek flashcard dan algoritma SM-2
    │   ├── syncUtils.ts      # Utilitas sinkronisasi Firestore
    │   ├── toastStore.ts     # Notifikasi toast global
    │   ├── tourStore.ts      # Panduan interaktif onboarding
    │   ├── uiStore.ts        # Status visual dan visibilitas sidebar
    │   └── writingStore.ts   # Pipeline draf studio menulis
    ├── types/                # Definisi tipe data TypeScript global (index.ts)
    ├── utils/                # Fungsi utilitas pembantu umum (cn.ts, date.ts)
    └── modules/              # Modul fungsional independen
        ├── analytics/        # Laporan visual metrik kognitif & produktivitas
        ├── auth/             # Autentikasi dan login modal
        ├── concepts/         # Unit pengetahuan abstrak & evolusi konsep
        ├── curriculum/       # Peta jalan belajar & AI Syllabus Planner
        ├── dashboard/        # Beranda (Mission Control) & Jam Hijriah
        ├── graph/            # Visualisasi interaktif D3.js Knowledge Graph
        ├── library/          # Koleksi buku, metadata cover & ringkasan literatur
        ├── notes/            # Catatan Zettelkasten & AI Copilot Assistant
        │   ├── NotesPage.tsx
        │   ├── NoteDetailPage.tsx
        │   └── components/   # Sub-komponen NotesPage & NoteDetailPage (NotesSidebar, NotesGrid, AddNoteDialog, AddFolderDialog, AIAssistantDialog, NoteEditor, NoteMetadataSidebar, AICopilotPanel, RelatedEntitiesPanel)
        ├── projects/         # Manajemen proyek dan eksekusi tugas
        ├── review/           # Modul Spaced Repetition Flashcards & AI Grader
        ├── settings/         # Pengaturan profil, tema, dan sinkronisasi
        └── writing/          # Studio penulisan Kanban & List pipeline
```

---

## 3.3 Tumpukan Teknologi Utama

| Modul Teknologi | Pustaka yang Digunakan | Justifikasi Pemilihan |
| :--- | :--- | :--- |
| **Kerangka Kerja** | React 18+ & Vite 6 | Kecepatan bundling super cepat di sisi pengembangan dan struktur modular yang matang. |
| **Bahasa Pemrograman**| TypeScript 5 | Membantu deteksi kesalahan ketik pada struktur data rumit sebelum kode didorong ke produksi. |
| **Gaya Visual** | Tailwind CSS v4 | Optimasi CSS modern, ukuran berkas akhir sangat ringan, dan memangkas kebutuhan file CSS terpisah. |
| **Animasi** | Motion (`motion/react`) | Standar industri untuk transisi mikro yang halus, teruji, dan ramah performa peramban. |
| **Manajemen Status** | Zustand | Sangat ringan, tanpa boilerplate berlebih, dan terintegrasi dengan `localStorage` serta Firestore. |
| **Visualisasi Data** | D3.js & Recharts | D3.js untuk fleksibilitas mutlak merancang Graf Pengetahuan interaktif; Recharts untuk grafik performa yang bersih. |
| **Server Samping** | Express.js & Tsx | Sangat cepat melayani rute API, mudah dihubungkan dengan middleware, serta kompatibel dengan ekosistem container. |
| **AI Gateway** | HCNSEC / Custom Provider | Mendukung endpoint AI OpenAI-compatible kustom dengan performa andal dan biaya optimal. |

---

## 3.4 Standar Koding & Pengemasan Produksi

Proyek ini memberlakukan aturan kompilasi ketat untuk mencegah kegagalan di lingkungan Cloud Run / Production:

### 1. Type Safety Mutlak
- Dilarang keras menggunakan tipe implisit `any` atau penanda `never` yang dipaksakan. Seluruh data hasil manipulasi API atau Zustand harus terikat pada model di `src/types/index.ts`.
- Pemeriksaan sintaksis dijalankan otomatis melalui `npm run lint` (yang memicu `tsc --noEmit`).

### 2. Strategi Bundling Server Esbuild
Untuk mengatasi masalah ketidakcocokan ESM (*ES Modules*) dan CJS (*CommonJS*) pada impor berkas di lingkungan server Node.js standar, proses pembentukan kode produksi dikonfigurasi sebagai berikut:
```json
"build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs"
```
Dengan membungkus server backend menggunakan **esbuild** ke format CJS (`dist/server.cjs`), seluruh jalur impor relatif internal diselesaikan saat build, menyisakan pustaka luar pihak ketiga sebagai referensi eksternal yang aman dan mempercepat waktu boot container secara signifikan.
