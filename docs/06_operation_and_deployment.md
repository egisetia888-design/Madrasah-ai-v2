# ⚙️ 06. Panduan Operasional, Instalasi, dan Deployment

Dokumen ini berisi informasi operasional teknis mengenai konfigurasi lingkungan, keamanan sistem, performa, serta langkah instalasi untuk pengembangan lokal maupun rilis produksi.

---

## 6.1 Protokol Keamanan dan Optimasi Performa

### 1. Perlindungan Kredensial AI
Seluruh interaksi kecerdasan buatan disalurkan melalui server backend Express (`server.ts`). Kunci rahasia API (`OPENROUTER_API_KEY`) hanya disimpan di memori server dan **tidak pernah** diekspos ke kode peramban klien. Skenario ini melindungi kuota penggunaan pengguna dari risiko pencurian kunci oleh pihak luar.

### 2. Efisiensi Penggunaan Memori & Penyimpanan
- **Dynamic Vite Importing**: Pada server backend, modul pembangunan Vite hanya diimpor secara dinamis jika lingkungan sistem berada dalam mode pengembangan (`process.env.NODE_ENV !== "production"`). Hal ini memangkas penggunaan memori RAM server hingga 50% ketika aplikasi dijalankan di server produksi.
- **Zustand LocalStorage Sync**: State frontend disinkronkan secara selektif ke penyimpanan lokal browser. Data yang sangat besar dipilah agar tidak melampaui batas kuota penyimpanan `localStorage` (maksimal 5MB di sebagian besar peramban).

---

## 6.2 Konfigurasi Variabel Lingkungan (.env)

Aplikasi membutuhkan file `.env` di direktori akar untuk beroperasi dengan fungsionalitas penuh. Salin file `.env.example` ke `.env` dan lengkapi variabel berikut:

| Nama Variabel | Status | Nilai Default | Keterangan |
| :--- | :--- | :--- | :--- |
| `HCNSEC_API_KEY` | **Penyedia Utama (Tier 1)** | *Kosong* | Kunci autentikasi API provider mandiri HCNSEC. |
| `HCNSEC_BASE_URL` | **Penyedia Utama (Tier 1)** | `https://api.hcnsec.cn/v1` | URL basis endpoint API provider HCNSEC (OpenAI-compatible). |
| `HCNSEC_MODEL` | Opsional | `Qwen3.8-27B` | Model prioritas HCNSEC (didukung otomatis: `Qwen3.8-27B`, `DeepSeek-V4-Pro`). |
| `OPENROUTER_API_KEY` | **Penyedia Sekunder (Tier 2)** | *Kosong* | Kredensial API OpenRouter untuk kestabilan multi-model mandiri. |
| `OPENROUTER_MODEL` | Opsional | `deepseek/deepseek-chat` | Model OpenRouter (didukung: `deepseek/deepseek-chat`, `qwen/qwen-2.5-72b-instruct`, dll). |
| `GEMINI_API_KEY` | **Cadangan Terakhir (Tier 3)** | *Kosong* | Kredensial Google GenAI API resmi murni sebagai safety net jika Tier 1 & Tier 2 tidak dapat dihubungi. |
| `APP_URL` | Opsional | `https://madrasah.remix` | Alamat URL aplikasi, dikirim sebagai header referer ke provider AI. |
| `NODE_ENV` | Otomatis | `development` | Mengontrol mode jalannya aplikasi (`development` atau `production`). |

---

## 6.3 Panduan Instalasi & Pengembangan Lokal

### Prasyarat Sistem
- **Node.js**: Versi 18 ke atas (Direkomendasikan versi LTS terbaru).
- **NPM**: Versi 9 ke atas (bawaan Node.js).

### Langkah-Langkah Memulai

1. **Unduh Sumber Kode**
   Pastikan Anda berada di direktori akar proyek Madrasah.

2. **Pasang Paket Dependensi**
   Unduh seluruh pustaka yang dideklarasikan di `package.json`:
   ```bash
   npm install
   ```

3. **Buat Berkas Konfigurasi Lingkungan**
   Duplikat contoh konfigurasi yang telah disediakan:
   ```bash
   cp .env.example .env
   ```
   Buka file `.env` menggunakan editor teks Anda dan masukkan kunci API HCNSEC atau provider pilihan Anda.

4. **Jalankan Server Pengembangan**
   Mulai server terintegrasi lokal:
   ```bash
   npm run dev
   ```
   Bilah konsol akan mengonfirmasi bahwa server berhasil dijalankan. Buka peramban Anda dan arahkan ke alamat: **`http://localhost:3000`**.

---

## 6.4 Alur Deployment Produksi (Full-Stack Container)

Aplikasi Madrasah dirancang untuk dapat dikemas ke dalam Container (seperti Docker) dan dideploy ke layanan Cloud berbasis serverless seperti **Google Cloud Run**.

### 1. Proses Pembangunan (Build Phase)
Ketika perintah build dijalankan:
```bash
npm run build
```
Sistem melakukan dua aksi penting secara berurutan:
1. **Pembangunan Frontend**: Vite mengompilasi seluruh modul React, TypeScript, dan Tailwind CSS menjadi berkas statis siap saji (HTML, CSS, JS terkompresi) di dalam direktori `/dist`.
2. **Pembundelan Backend**: `esbuild` memaketkan berkas `server.ts` beserta impor jalur relatifnya menjadi berkas CommonJS tunggal di alamat **`dist/server.cjs`** dengan menyematkan sourcemaps fungsional untuk pemantauan error di pelayan produksi.

### 2. Proses Menjalankan Produksi (Runtime Phase)
Untuk menyalakan server di lingkungan produksi, jalankan perintah:
```bash
npm run start
```
Perintah ini mengeksekusi **`node dist/server.cjs`**. Server ini akan beroperasi mandiri pada port **3000** di host **0.0.0.0** untuk menerima lalu lintas masuk, melayani berkas statis frontend dari `/dist`, serta menyediakan rute API `/api/*` secara berkinerja tinggi.

---

## 6.5 Panduan Deployment ke Vercel (Serverless Architecture)

Proyek Madrasah kini mendukung penuh arsitektur deployment modern ke **Vercel** tanpa ketergantungan pada Google AI Studio maupun server fisik jangka panjang.

### 1. Struktur Arsitektur Vercel
Proyek menggunakan arsitektur hibrida berkinerja tinggi:
- **Frontend SPA**: Dibangun menggunakan `vite build` dan disajikan langsung melalui Vercel Global Edge CDN dari direktori `dist/`. Seluruh aset statis (PWA icon, font, chunk JS/CSS) di-cache secara instan.
- **Backend API (Serverless Function)**: Diarahkan ke titik masuk tunggal **`api/index.ts`** yang membungkus aplikasi Express (`server/app.ts`). Vercel secara otomatis mengompilasi dan mengisolasi fungsi ini sebagai serverless invocation dengan batas waktu eksekusi hingga 60 detik (`maxDuration: 60`).
- **Penyelarasan Rute (`vercel.json`)**:
  ```json
  {
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "framework": "vite",
    "outputDirectory": "dist",
    "functions": {
      "api/index.ts": {
        "maxDuration": 60,
        "memory": 1024
      }
    },
    "rewrites": [
      { "source": "/api/(.*)", "destination": "/api" },
      { "source": "/(.*)", "destination": "/index.html" }
    ]
  }
  ```
- **Proteksi Stream Serverless**: `server/app.ts` dilengkapi middleware pendeteksi `req.body` pre-parsed dari runtime Vercel, mencegah _hang / 504 Gateway Timeout_ yang sering terjadi saat Express berjalan di atas platform serverless.

### 2. Langkah-Langkah Deploy ke Vercel

1. **Hubungkan Repositori Git**:
   - Buka dashboard [Vercel](https://vercel.com).
   - Klik **Add New...** > **Project**.
   - Pilih repositori Git proyek Madrasah Anda (GitHub / GitLab / Bitbucket).

2. **Pengaturan Framework & Build**:
   - **Framework Preset**: Pilih `Vite` (Vercel akan mendeteksi `vite` secara otomatis melalui `vercel.json`).
   - **Root Directory**: `./` (akar proyek).
   - **Build Command**: Biarkan default `npm run build` (atau `vite build`).
   - **Output Directory**: `dist`.

3. **Konfigurasi Environment Variables di Vercel**:
   Pada menu **Environment Variables**, tambahkan variabel kunci berikut (sesuai `.env.example`):
   - `GEMINI_API_KEY`: Kunci API Google Gemini untuk fungsionalitas AI.
   - `GEMINI_MODEL`: `gemini-2.5-flash` (opsional).
   - `OPENROUTER_API_KEY`: Kunci OpenRouter (opsional).
   - `APP_URL`: URL domain Vercel Anda (misal: `https://madrasah-pwa.vercel.app`).
   - *(Jika menggunakan sinkronisasi Firebase)*:
     - `VITE_FIREBASE_API_KEY`
     - `VITE_FIREBASE_AUTH_DOMAIN`
     - `VITE_FIREBASE_PROJECT_ID`
     - `VITE_FIREBASE_STORAGE_BUCKET`
     - `VITE_FIREBASE_MESSAGING_SENDER_ID`
     - `VITE_FIREBASE_APP_ID`
     - `VITE_FIREBASE_FIRESTORE_DATABASE_ID`

4. **Eksekusi Deploy**:
   - Klik tombol **Deploy**.
   - Vercel akan mengunduh paket dependensi, mengompilasi aset Vite, memaketkan Serverless Function `api/index.ts`, dan merilis aplikasi Anda secara global.

5. **Verifikasi Operasional**:
   - Akses `https://<domain-anda>.vercel.app/api/health` di peramban atau terminal.
   - Respons sukses:
     ```json
     {
       "status": "ok",
       "service": "madrasah-api",
       "timestamp": 1788898323686,
       "environment": "vercel"
     }
     ```
   - Semua rute kecerdasan buatan (`/api/ai/*`) dan rute penulisan webhook (`/api/publishing/webhook`) siap melayani permintaan secara mulus.
