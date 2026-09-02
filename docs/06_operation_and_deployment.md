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
| `HCNSEC_API_KEY` | **Sangat Direkomendasikan** | *Kosong* | Kunci autentikasi API provider HCNSEC utama. |
| `HCNSEC_BASE_URL` | **Sangat Direkomendasikan** | `https://api.hcnsec.com/v1` | URL basis endpoint API provider HCNSEC (OpenAI-compatible). |
| `HCNSEC_MODEL` | Opsional | `google/gemini-2.5-flash` | Nama model AI yang ditargetkan di provider HCNSEC. |
| `GEMINI_API_KEY` | Opsional | *Kosong* | Kredensial Google GenAI API resmi sebagai opsi fallback. |
| `OPENROUTER_API_KEY` | Opsional | *Kosong* | Kredensial autentikasi API OpenRouter alternatif. |
| `OPENROUTER_MODEL` | Opsional | `google/gemini-2.5-flash` | Model kecerdasan buatan fallback OpenRouter jika HCNSEC tidak dikonfigurasi. |
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
