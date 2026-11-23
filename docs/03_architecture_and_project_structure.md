# 🛠️ 03. Arsitektur Sistem dan Struktur Proyek

## 3.1 Arsitektur Sistem Umum
**Madrasah — Personal Knowledge Operating System** mengusung arsitektur **Full-Stack Single Container** yang menggabungkan kecepatan Single Page Application (SPA) berbasis React dengan keandalan server Express.js di sisi backend.

```
+-------------------------------------------------------------------------+
|                        PERAMBAN PENGGUNA (CLIENT)                       |
|                                                                         |
|   +-----------------------+                    +--------------------+   |
|   |     Zustand Store     | <----------------> |   React Frontend   |   |
|   |   (IndexedDB Lokal)   |                    |     (Vite SPA)     |   |
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
                                                  +------------------------+
                                                  |  Google Gemini API     |
                                                  |  (@google/genai SDK)   |
                                                  +------------------------+
```

### 1. Sisi Klien (Frontend Client)
Aplikasi klien dibangun menggunakan **React 18+** dan dikompilasi menggunakan **Vite 6**. Seluruh pengelolaan status aplikasi (*global state*) dikonsolidasikan menggunakan **Zustand**. Keuntungan pola ini adalah:
- **Keringanan & Kepatuhan**: Zustand tidak memerlukan pembungkus *Provider* berlebih, meminimalkan rendering ulang yang tidak perlu.
- **Ketahanan Penyimpanan Luring (IndexedDB Multi-Store Registry)**: Data disimpan secara lokal di peramban menggunakan IndexedDB (didukung `localforage` dengan 8 *object store* terisolasi dalam database `madrasah_db`), lengkap dengan registri terpusat untuk diagnostik kuota, proteksi *Persistent Storage*, dan ekspor/impor cadangan JSON terpadu (v2 + fallback v1).
- **Zero-Config Workspace**: Aplikasi langsung siap digunakan melalui layar sambutan lokal instan tanpa memerlukan akun cloud maupun kunci API Firebase.
- **Ergonomi Sentuh & Responsivitas**: Dilengkapi dengan hook penanganan gesture sentuh dan bilah tab gulir bebas hambatan (`no-scrollbar`).
- **Ketahanan Fatal & Notifikasi (Resilience & Toast)**: Dilengkapi dengan `ErrorBoundary` level akar dan pencegat kejadian *runtime* global via pustaka *toast* `sonner` untuk menampilkan jejak *error* transparan kepada pengguna tanpa memecah konsol peramban secara sunyi.

### 2. Sisi Server (Backend Gateway)
Server backend menggunakan **Express.js** yang berjalan di Node.js. Server ini memiliki tanggung jawab krusial:
- **Keamanan Kredensial AI**: Menjaga rahasia `GEMINI_API_KEY` dari jangkauan peramban. Aplikasi klien hanya memanggil rute `/api/ai/*`.
- **Google Gemini Hybrid Engine**: Mengarahkan beban ringan ke `gemini-3.1-flash-lite` (`ThinkingLevel.MINIMAL`) dan tugas sintesis/kurikulum ke `gemini-4-hydrogen` (`ThinkingLevel.LOW`) untuk memaksimalkan kuota harian.
- **Rate Limiting**: Melindungi server dari lonjakan trafik dan penyalahgunaan kuota menggunakan `express-rate-limit`.
- **Bounded LRU Cache (TTL 2 Jam, Maks 500 Entri)**: Menyimpan respons AI berdasarkan hash SHA-256 payload yang telah dinormalisasi untuk memotong latensi dan konsumsi token.
- **Robust JSON Sanitizer**: Membersihkan blok kode Markdown dan memulihkan objek JSON secara otomatis melalui fungsi `cleanAndParseJson`.

---

## 3.2 Struktur Proyek Aktual

Struktur direktori Madrasah diorganisasikan secara modular untuk memastikan skalabilitas jangka panjang dan kemudahan navigasi:

```
/remix-madrasah
├── .env.example              # Template konfigurasi variabel lingkungan (Google Gemini & APP_URL)
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
    │   ├── authStore.ts      # Sesi dan nama ruang kerja lokal
    │   ├── curriculumStore.ts# Kurikulum dan fase belajar
    │   ├── graphStore.ts     # Konfigurasi simpul dan filter graf
    │   ├── indexedDbStorage.ts # Mesin & registri IndexedDB terpadu (backup JSON v2 & diagnostik)
    │   ├── knowledgeStore.ts # Konsep atomik dan hubungan semantik
    │   ├── libraryStore.ts   # Pustaka buku, penulis, dan riwayat sesi baca
    │   ├── notesStore.ts     # Zettelkasten notes dan inbox
    │   ├── projectsStore.ts  # Proyek dan daftar tugas terstruktur
    │   ├── reviewStore.ts    # Dek flashcard dan algoritma SM-2
    │   ├── syncStateStore.ts # Pelacak status penyimpanan lokal & waktu simpan terakhir
    │   ├── syncUtils.ts      # Utilitas metadata revisi lokal
    │   ├── toastStore.ts     # Notifikasi toast global
    │   ├── tourStore.ts      # Panduan interaktif onboarding
    │   ├── uiStore.ts        # Status visual dan visibilitas sidebar
    │   └── writingStore.ts   # Pipeline draf studio menulis
    ├── types/                # Definisi tipe data TypeScript global (index.ts)
    ├── utils/                # Fungsi utilitas pembantu umum (cn.ts, date.ts)
    └── modules/              # Modul fungsional independen
        ├── analytics/        # Laporan visual metrik kognitif & produktivitas
        ├── auth/             # Layar selamat datang ruang kerja lokal & pemulihan cepat JSON
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
| **Manajemen Status** | Zustand | Sangat ringan, tanpa boilerplate berlebih, dan terintegrasi dengan registri multi-store **IndexedDB** (`localforage`). |
| **Visualisasi Data** | D3.js & Recharts | D3.js untuk fleksibilitas mutlak merancang Graf Pengetahuan interaktif; Recharts untuk grafik performa yang bersih. |
| **Server Samping** | Express.js & Tsx | Sangat cepat melayani rute API, mudah dihubungkan dengan middleware, serta kompatibel dengan ekosistem container. |
| **AI Gateway** | Google GenAI SDK (`@google/genai`) | Arsitektur hybrid `gemini-3.1-flash-lite` + `gemini-4-hydrogen` (`ThinkingLevel.LOW`) yang hemat token. |

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
