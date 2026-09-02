# ❓ 08. Pertanyaan Umum (FAQ) dan Panduan Pemecahan Masalah (Troubleshooting)

Dokumen ini dirancang untuk menjawab pertanyaan-pertanyaan yang sering diajukan oleh pengguna/pengembang serta memberikan solusi taktis untuk mengatasi kendala operasional pada aplikasi Madrasah.

---

## 8.1 Pertanyaan Sering Diajukan (FAQ)

### Q: Apakah data catatan dan pustaka saya aman? Di mana data tersebut disimpan?
**A**: Keamanan data Anda adalah prioritas kami. Seluruh data catatan, pustaka, kurikulum, proyek, draf menulis, dan flashcard Anda disimpan **secara lokal di dalam penyimpanan peramban Anda** (`localStorage`) menggunakan mekanisme persistensi otomatis dari Zustand Store. Data Anda **tidak pernah** dikirim atau disimpan di server luar mana pun, kecuali bagian teks catatan yang Anda kirimkan secara sadar untuk dianalisis oleh asisten AI melalui endpoint proxy server lokal Anda.

### Q: Mengapa aplikasi mengusung tema warna monokromatik hitam-putih?
**A**: Madrasah adalah sebuah sistem operasi kognitif yang dirancang untuk mendukung pembelajaran mendalam (*deep work*). Warna-warni cerah yang berlebihan di layar terbukti secara ilmiah dapat memicu distorsi konsentrasi dan beban sensorik berlebih. Dengan membatasi palet visual ke nuansa hitam-putih-slate, kami menciptakan lingkungan digital yang "hening", di mana satu-satunya hal yang menarik perhatian Anda adalah esensi dari pemikiran Anda sendiri.

### Q: Apakah saya wajib memiliki API Key untuk menggunakan Madrasah?
**A**: **Tidak wajib**. Seluruh fungsi inti Madrasah—mulai dari menulis catatan Markdown, menyusun pustaka, membuat peta jalan kurikulum, memvisualisasikan Knowledge Graph, melacak proyek, hingga melatih flashcard secara manual—dapat beroperasi 100% tanpa API Key. Anda hanya membutuhkan `HCNSEC_API_KEY` (atau `GEMINI_API_KEY` / `OPENROUTER_API_KEY`) jika ingin menggunakan fungsionalitas cerdas bertenaga AI seperti *AI Syllabus Planner*, *AI Flashcard Generator*, *AI Grading Assistant*, dan *AI Zettelkasten Assistant*.

---

## 8.2 Panduan Pemecahan Masalah (Troubleshooting)

### Kendala 1: Fitur AI Tidak Merespons / Mengembalikan Kesalahan "Error 500"
* **Gejala**: Saat mengklik tombol "Mulai Silabus AI", "Rekomendasi Tag", atau melakukan ulasan flashcard, aplikasi menampilkan pesan kesalahan atau animasi memuat berputar tanpa henti.
* **Kemungkinan Penyebab**:
  1. Variabel `HCNSEC_API_KEY` atau `HCNSEC_BASE_URL` di dalam berkas `.env` server kosong atau tidak valid.
  2. Server backend tidak mendeteksi file `.env` karena server dinyalakan sebelum file tersebut dibuat.
  3. Kuota saldo pada akun provider AI Anda telah habis atau terkena pembatasan frekuensi (*Rate Limit*).
* **Solusi**:
  1. Buka berkas `.env` di komputer server Anda, pastikan isinya telah sesuai dengan template `.env.example`.
  2. Pastikan tidak ada spasi tambahan atau karakter tersembunyi di sekitar kunci API Anda.
  3. Jika mengubah variabel lingkungan, restart server pengembangan (`npm run dev`) agar sistem memuat konfigurasi terbaru.
  4. Periksa dasbor provider AI Anda untuk memastikan saldo dan token API Anda mencukupi.

### Kendala 2: Tab Navigasi atau Konten Terpotong pada Layar Smartphone
* **Gejala**: Bilah tab tidak menampilkan semua menu atau layout terpotong di perangkat seluler.
* **Kemungkinan Penyebab**: Pengguna belum menggeser (*swipe/scroll*) bilah tab horisontal yang dirancang khusus untuk menghemat ruang vertikal.
* **Solusi**:
  1. Geser bilah tab secara horisontal ke kiri atau kanan (didukung sentuhan gestur alami).
  2. Pastikan menggunakan browser modern yang mendukung CSS Flexbox dan scrolling touch.

### Kendala 3: Catatan atau Progress Membaca Hilang Setelah Peramban Ditutup
* **Gejala**: Ketika membuka kembali aplikasi Madrasah keesokan harinya, seluruh data yang telah diinput sebelumnya hilang dan aplikasi kembali ke kondisi kosong (Onboarding Tour muncul kembali).
* **Kemungkinan Penyebab**:
  1. Anda membuka aplikasi menggunakan Mode Penyamaran (*Incognito Mode / Private Browsing*), di mana peramban secara otomatis menghapus seluruh data `localStorage` begitu tab ditutup.
  2. Anda menggunakan ekstensi pembersih peramban otomatis atau perangkat lunak utilitas pihak ketiga yang memaksa penghapusan cache peramban secara berkala.
* **Solusi**:
  1. Selalu buka Madrasah di jendela peramban reguler.
  2. Kecualikan alamat domain Madrasah (misalnya `localhost:3000` atau URL deployment Anda) dari daftar pembersihan otomatis di pengaturan ekstensi peramban Anda.
  3. Lakukan pencatatan penting dan ekspor berkala jika Anda berniat melakukan pembersihan menyeluruh terhadap sistem komputer Anda.

### Kendala 4: Tampilan Graf Pengetahuan Lambat atau Patah-Patah (*Lagging*)
* **Gejala**: Animasi penarikan simpul pada Graf Pengetahuan terasa berat, patah-patah, atau memakan utilisasi CPU peramban yang sangat tinggi.
* **Kemungkinan Penyebab**: Jumlah catatan di dalam Otak Kedua Anda telah mencapai ratusan hingga ribuan simpul, sehingga mesin rendering SVG D3.js memproses terlalu banyak kalkulasi fisika (*force simulation*) secara bersamaan.
* **Solusi**:
  1. Gunakan fitur "Filter Tipe Simpul" di panel atas Graf Pengetahuan untuk menyembunyikan tipe simpul yang sedang tidak Anda tinjau (misalnya menyembunyikan simpul `Author` atau `Book`).
  2. Hindari melakukan manipulasi seret (*drag*) yang terlalu cepat pada simpul jika graf memiliki kepadatan relasi yang sangat tinggi.
