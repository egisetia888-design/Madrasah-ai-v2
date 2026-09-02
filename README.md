# 🕋 Madrasah — Personal Knowledge Operating System

> **Personal Knowledge Operating System (PKOS) — Monochrome Slate Edition**

```
Versi: v1.0.0-beta  |  Kreator: egiistw88  |  Lisensi: © 2026 Madrasah OS
Motto: "Tuntutlah ilmu dari buaian hingga ke liang lahat." (Hadits Riwayat)
```

**Madrasah — Personal Knowledge Operating System** adalah sistem operasi pengetahuan pribadi (Personal Knowledge Operating System) modern yang dirancang khusus untuk mengintegrasikan seluruh siklus hidup intelektual individu. Aplikasi ini menggabungkan penataan kurikulum belajar, manajemen literatur pustaka, pencatatan Markdown berbasis Zettelkasten, penulisan bebas gangguan, serta pelatihan retensi ingatan jangka panjang melalui kartu flash (*spaced repetition*) dalam satu antarmuka monokromatik yang hening dan tanpa distraksi.

Aplikasi ini dioptimalkan sepenuhnya untuk perangkat desktop maupun mobile secara responsif, menghadirkan harmoni visual tinggi, tipografi presisi, mesin penautan entitas otomatis (*Automated Knowledge & Entity Linking*), dan fungsionalitas cerdas berbasis gateway AI HCNSEC.

---

## 📚 Daftar Isi Dokumentasi Resmi (Single Source of Truth)

Untuk memudahkan penelusuran, arsitektur informasi, dan pemeliharaan jangka panjang, dokumentasi Madrasah telah direstrukturisasi secara modular ke dalam direktori `/docs` berikut:

### [🕋 01. Identitas, Visi, dan Filosofi Produk](docs/01_identity_and_philosophy.md)
*Menjelaskan makna nama "Madrasah", visi demokratisasi manajemen pengetahuan pribadi tingkat lanjut, filosofi belajar terstruktur, serta segmentasi target pengguna.*

### [🎨 02. Desain dan Sistem Pengalaman Pengguna (UI/UX)](docs/02_design_and_ux.md)
*Dokumentasi prinsip estetika monokrom murni (Monochrome Zen), penolakan terhadap ornamen hiasan teknis palsu (Anti-AI-Slop), spesifikasi tipografi, lengkukan elemen, penataan layering z-index, serta standarisasi responsivitas seluler.*

### [🛠️ 03. Arsitektur Sistem dan Struktur Proyek](docs/03_architecture_and_project_structure.md)
*Rincian diagram hubungan klien-server, struktur direktori proyek aktual, justifikasi pemilihan pustaka teknologi utama (React, Zustand, Tailwind v4, D3.js, Express), serta standar tipe TypeScript yang ketat.*

### [📦 04. Panduan Modul dan Fitur Sistem](docs/04_modules_and_features.md)
*Penjelasan fungsional lengkap mengenai empat pilar utama Madrasah: Beranda (Mission Control), Analitik Produktivitas, Kurikulum (Syllabus Planner), Pustaka, Otak Kedua (Zettelkasten), Graf Pengetahuan (Knowledge Graph), Latihan (Spaced Repetition), Proyek Kerja, dan Studio Menulis.*

### [📊 05. Model Data dan Integrasi API Backend](docs/05_data_model_and_api.md)
*Definisi skema antarmuka TypeScript untuk seluruh entitas sistem, dokumentasi rute API backend Express, mekanisme pembatasan frekuensi (rate limiting), cache memori (TTL 1 jam), dan penanganan penguraian JSON AI yang tangguh.*

### [⚙️ 06. Panduan Operasional, Instalasi, dan Deployment](docs/06_operation_and_deployment.md)
*Panduan instalasi prasyarat lokal, konfigurasi berkas variabel lingkungan (.env), optimasi RAM server, serta alur build produksi full-stack menggunakan bundler esbuild untuk penyajian container di Google Cloud Run.*

### [🗺️ 07. Peta Jalan Pengembangan (Roadmap) dan Changelog](docs/07_roadmap_and_changelog.md)
*Melacak sejarah rilis perubahan sistem (changelog) serta memetakan rencana masa depan rilis fungsionalitas multi-user, database cloud terdistribusi, dan ekosistem publikasi.*

### [❓ 08. Pertanyaan Umum (FAQ) dan Panduan Pemecahan Masalah](docs/08_faq_and_troubleshooting.md)
*Jawaban atas pertanyaan privasi data, justifikasi filosofis warna monokrom, serta solusi pemecahan masalah praktis untuk kegagalan respons AI, kehilangan data lokal, atau kelambatan performa visualisasi graf.*

### [🤝 09. Panduan Kontribusi Pengembang (Contribution Guidelines)](docs/09_contribution_guidelines.md)
*Siklus kontribusi kode pengembang, konvensi pesan komit berbasis Conventional Commits, standar pengujian linter mandiri, serta praktik kebersihan kode sebelum mengajukan Pull Request.*

---

## ⚡ Langkah Cepat Memulai (Quick Start)

### 1. Unduh Dependensi
```bash
npm install
```

### 2. Konfigurasi Variabel Lingkungan
Salin `.env.example` menjadi `.env` dan masukkan kunci API serta konfigurasi penyedia AI Anda (disarankan **HCNSEC**):
```bash
cp .env.example .env
```
Isi variabel utama di dalam `.env`:
```env
# Penyedia AI Utama (HCNSEC / OpenAI-Compatible Provider)
HCNSEC_API_KEY="your-hcnsec-api-key"
HCNSEC_BASE_URL="https://api.hcnsec.com/v1"
HCNSEC_MODEL="google/gemini-2.5-flash"

# Alternatif Google GenAI SDK (Opsional)
GEMINI_API_KEY=""

# Alternatif OpenRouter (Opsional)
OPENROUTER_API_KEY=""
```

### 3. Jalankan Server Lokal
```bash
npm run dev
```
Aplikasi Anda akan segera mengudara secara terintegrasi pada port **3000** di alamat: **`http://localhost:3000`**.

---

*Madrasah — Personal Knowledge Operating System dirancang dengan ketulusan, kesederhanaan monokrom, dan fungsionalitas tinggi untuk menemani petualangan intelektual Anda.*
