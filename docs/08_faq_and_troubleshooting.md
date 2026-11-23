# ❓ 08. Pertanyaan Umum (FAQ) dan Panduan Pemecahan Masalah (Troubleshooting)

Dokumen ini dirancang untuk menjawab pertanyaan-pertanyaan yang sering diajukan oleh pengguna/pengembang serta memberikan solusi taktis untuk mengatasi kendala operasional pada aplikasi Madrasah.

---

## 8.1 Pertanyaan Sering Diajukan (FAQ)

### Q: Apakah data catatan dan pustaka saya aman? Di mana data tersebut disimpan?
**A**: Keamanan dan privasi data Anda adalah prioritas utama. Seluruh data catatan, pustaka, kurikulum, proyek, draf menulis, graf konsep, dan flashcard disimpan **secara lokal penuh di dalam IndexedDB peramban perangkat Anda** (`madrasah_db` melalui `localforage`) tanpa memerlukan akun cloud. Anda dapat mengaktifkan perlindungan *Persistent Storage* dan mencadangkan seluruh data kapan saja lewat **Backup JSON Terpadu** atau **Ekspor ZIP Markdown** di halaman Pengaturan. Data hanya dikirim ke server lokal saat Anda secara sadar memicu fitur asisten AI atau webhook penerbitan.

### Q: Mengapa aplikasi mengusung tema warna monokromatik hitam-putih?
**A**: Madrasah adalah sebuah sistem operasi kognitif yang dirancang untuk mendukung pembelajaran mendalam (*deep work*). Warna-warni cerah yang berlebihan di layar terbukti secara ilmiah dapat memicu distorsi konsentrasi dan beban sensorik berlebih. Dengan membatasi palet visual ke nuansa hitam-putih-slate, kami menciptakan lingkungan digital yang "hening", di mana satu-satunya hal yang menarik perhatian Anda adalah esensi dari pemikiran Anda sendiri.

### Q: Apakah saya wajib memiliki API Key untuk menggunakan Madrasah?
**A**: **Tidak wajib**. Seluruh fungsi inti Madrasah—mulai dari menulis catatan Markdown, menyusun pustaka, membuat peta jalan kurikulum, memvisualisasikan Knowledge Graph, melacak proyek, hingga melatih flashcard secara manual—dapat beroperasi 100% tanpa API Key. Anda hanya membutuhkan `GEMINI_API_KEY` jika ingin menggunakan fungsionalitas cerdas bertenaga Google Gemini seperti *AI Syllabus Planner*, *AI Flashcard Generator*, *AI Grading Assistant*, dan *AI Zettelkasten Assistant*.

---

## 8.2 Panduan Pemecahan Masalah (Troubleshooting)

### Kendala 1: Fitur AI Tidak Merespons / Mengembalikan Kesalahan "Error 500" atau "Rate Limit 429"
* **Gejala**: Saat mengklik tombol "AI Planner", "Saran Tag Otomatis", atau melakukan ulasan flashcard, aplikasi menampilkan pesan kesalahan atau gagal memproses permintaan.
* **Kemungkinan Penyebab**:
  1. Variabel `GEMINI_API_KEY` di dalam **Settings > Secrets** atau berkas `.env` server kosong atau tidak valid.
  2. Variabel `GEMINI_MODEL` diisi dengan nama model usang/tidak didukung sehingga diabaikan atau ditolak oleh API.
  3. Env di server/Vercel berbeda dengan `.env` lokal — pastikan `Settings > Environment Variables` ikut diperbarui lalu redeploy/restart.
  4. Kuota permintaan Google Gemini API sedang mencapai batas sementara (*Rate Limit 429*) atau layanan sedang padat (`503`).
* **Solusi**:
  1. Pastikan `GEMINI_API_KEY` sudah diisi dengan benar di **Settings > Secrets** atau berkas `.env` tanpa spasi tambahan.
  2. Kosongkan `GEMINI_MODEL` agar sistem otomatis memilih jalur hybrid hemat token (`gemini-3.1-flash-lite` dan `gemini-4-hydrogen`).
  3. Jika mengubah variabel lingkungan, restart server pengembangan (`npm run dev`).
  4. Jika muncul batas kuota (`429`), tunggu beberapa saat atau gunakan kunci API dengan kuota aktif yang lebih tinggi.

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
  1. Selalu buka Madrasah di jendela peramban reguler (bukan Mode Penyamaran/Incognito).
  2. Aktifkan opsi **Aktifkan proteksi permanen (Persistent Storage)** di menu **Pengaturan > Penyimpanan Lokal & Ruang Kerja**.
  3. Lakukan ekspor **Backup JSON Terpadu** secara berkala dari halaman Pengaturan agar seluruh catatan dan progres Anda mudah dipulihkan kapan saja.

### Kendala 4: Tampilan Graf Pengetahuan Lambat atau Patah-Patah (*Lagging*)
* **Gejala**: Animasi penarikan simpul pada Graf Pengetahuan terasa berat, patah-patah, atau memakan utilisasi CPU peramban yang sangat tinggi.
* **Kemungkinan Penyebab**: Jumlah catatan di dalam Otak Kedua Anda telah mencapai ratusan hingga ribuan simpul, sehingga mesin rendering SVG D3.js memproses terlalu banyak kalkulasi fisika (*force simulation*) secara bersamaan.
* **Solusi**:
  1. Gunakan fitur "Filter Tipe Simpul" di panel atas Graf Pengetahuan untuk menyembunyikan tipe simpul yang sedang tidak Anda tinjau (misalnya menyembunyikan simpul `Author` atau `Book`).
  2. Hindari melakukan manipulasi seret (*drag*) yang terlalu cepat pada simpul jika graf memiliki kepadatan relasi yang sangat tinggi.
