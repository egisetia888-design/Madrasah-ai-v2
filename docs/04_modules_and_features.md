# 📦 04. Panduan Modul dan Fitur Sistem

Modul fungsional **Madrasah — Personal Knowledge Operating System** dikelompokkan ke dalam empat pilar utama yang saling terhubung membentuk ekosistem manajemen pengetahuan yang kokoh.

---

## 4.1 Pilar 1: Utama (Core Navigation)

### 🕋 Beranda (Mission Control)
Beranda adalah ruang kendali utama pengguna saat membuka aplikasi pertama kali.
- **Fungsi**: Memberikan tinjauan umum instan tentang keadaan "Otak Kedua" pengguna.
- **Fitur Utama**:
  - **Jam Hijriah Dinamis**: Menampilkan kalender Islam dan waktu aktual secara real-time untuk menyelaraskan ritme belajar dengan penanggalan Hijriah.
  - **Prioritas Teratas**: Rekomendasi bacaan buku aktif, tugas review flashcard hari ini, dan progres belajar dalam kurikulum.
  - **Ruang Produksi**: Daftar draf tulisan yang sedang disunting dan proyek-proyek aktif yang membutuhkan tindakan segera.
  - **AI Copilot Insight**: Panel asisten AI yang secara cerdas memperingatkan jumlah catatan yang belum diproses di Inbox dan menyarankan tindakan pembersihan.
  - **Palet Perintah (Cmd+K)**: Jendela pencarian global instan untuk mengakses modul, mencari catatan, proyek, buku, atau draf dari mana saja.
  - **Tangkapan Kilat Multi-Tab (Quick Add / Cmd+Shift+I)**: Modal penangkapan ide instan yang dioptimalkan penuh untuk mobile dengan bilah tab sentuh 4-kategori (*Catatan Inbox*, *Tugas Proyek*, *Ide Tulisan*, dan *Kutipan Literatur*), lengkap dengan deteksi entitas otomatis dan tombol sentuh 44px ramah jempol.

### 📈 Analitik Produktivitas
Menyediakan visualisasi data kuantitatif mengenai aktivitas kognitif pengguna.
- **Fungsi**: Membantu pengguna memantau konsistensi belajar mereka melalui grafik interaktif Recharts.
- **Fitur Utama**:
  - **Grafik Komitmen Harian**: Menampilkan kurva aktivitas pembuatan catatan dan review dari waktu ke waktu.
  - **Metrik Distribusi Catatan**: Diagram lingkaran yang memecah jenis-jenis catatan (knowledge, project, writing, personal) di dalam sistem.
  - **Indikator Kecepatan Tinjauan**: Menunjukkan performa retensi memori pengguna berdasarkan persentase jawaban benar pada sesi review flashcard.

---

## 4.2 Pilar 2: Sumber Belajar (Learning Resources)

### 🗺️ Kurikulum & AI Syllabus Planner
Modul ini berfungsi untuk merancang dan memantau jalur pembelajaran mandiri.
- **Fungsi**: Membantu pengguna memecah topik besar yang menakutkan menjadi langkah-langkah belajar terukur.
- **Fitur Utama**:
  - **Jalur Pembelajaran Mandiri**: Pengguna dapat menyusun peta jalan belajar secara hierarkis (Jalur -> Fase -> Kompetensi).
  - **AI Syllabus Planner**: Masukkan satu topik studi (contoh: "Dasar Ushul Fiqih" atau "Deep Learning"), AI akan otomatis memecah topik tersebut menjadi 3-5 Fase Belajar berurutan, lengkap dengan daftar Kompetensi rinci di setiap fase.
  - **Integrasi Pustaka & Catatan**: Di setiap kompetensi, pengguna dapat menyematkan buku-buku referensi yang relevan dari Pustaka serta menghubungkan catatan proyek atau hasil belajar sebagai bukti fisik penguasaan kompetensi (*output*).

### 📚 Pustaka (Library Management)
Modul penyimpanan literatur digital dan cetak.
- **Fungsi**: Mengelola daftar buku, kitab, artikel jurnal, atau dokumen bacaan pengguna.
- **Fitur Utama**:
  - **Metadata Terstruktur & OpenLibrary Resolver**: Melacak nama penulis, kategori, jumlah halaman, dan persentase progres membaca. Terintegrasi dengan OpenLibrary API untuk melengkapi ISBN, data tahun terbit, dan resolusi gambar sampul (*book covers*) otomatis.
  - **Status Pembacaan**: Buku dikategorikan ke dalam status: *Wishlist*, *Owned*, *Reading*, *Finished*, *Summarized*, *Connected*, *Applied*, hingga *Published*.
  - **Pembuat Catatan Instan**: Di dalam halaman detail buku, pengguna dapat menulis "Catatan Cepat" (*Quick Note*). Catatan ini secara otomatis didaftarkan ke modul **Zettelkasten** dengan referensi `sourceId` yang mengarah kembali ke buku tersebut.
  - **Ringkasan Literatur AI**: Memindai kutipan panjang buku untuk mengekstrak masalah utama, metodologi, dan kesimpulan ke dalam format catatan terstruktur.
  - **Ergonomi Mobile**: Filter status bacaan disajikan dalam bentuk bilah tab gulir horisontal (`no-scrollbar`) yang responsif terhadap gestur usap.

---

## 4.3 Pilar 3: Zettelkasten & Jaring Kognitif (The Cognitive Core)

### 🧠 Otak Kedua (Notes & Inbox)
Pusat dari seluruh sistem penataan ide, dibangun dengan metode pencatatan Zettelkasten.
- **Fungsi**: Mengumpulkan ide, fakta, riset, dan menyintesisnya ke dalam struktur yang terorganisasi.
- **Fitur Utama**:
  - **Inbox & Status Proses**: Catatan yang baru dibuat masuk ke kategori *Unprocessed* (Mentah) di Inbox. Setelah diproses (diberi tag, dihubungkan, atau disarikan), statusnya berubah menjadi *Processed*.
  - **Folder Hierarkis & Tags**: Pengguna dapat menyusun catatan dalam folder fisik atau menggunakan sistem penandaan (*tagging*) lintas folder yang fleksibel.
  - **Automated Knowledge Linking**: Sistem mendeteksi penyebutan entitas lain (buku, konsep, proyek, kompetensi, draf tulisan) secara real-time saat mengetik dan otomatis menautkannya ke *Knowledge Graph* tanpa tindakan manual.
  - **AI Zettelkasten Assistant**: Panel AI khusus di sisi editor catatan yang dapat:
    1. **AI Suggest Tags**: Menganalisis konten catatan secara real-time dan memberikan saran tag yang relevan.
    2. **AI Suggest Connections**: Merekomendasikan catatan lain yang relevan di dalam pustaka pengguna untuk dihubungkan.
    3. **AI Chat & Synthesis**: Membedah isi catatan, merangkum, atau memformulasikan argumen baru berdasarkan referensi silang.

### 💡 Konsep (Conceptual Knowledge Units)
Modul pematangan unit-unit pemikiran abstrak yang diekstraksi dari berbagai literatur.
- **Fungsi**: Menampung konsep inti yang memiliki definisi baku dan melacak asal-usul kelahirannya (*provenance*).
- **Fitur Utama**:
  - **Status Kedewasaan Konsep**: Melacak evolusi konsep dari tahap *Emerging* (Masih Berkembang), *Defined* (Sudah Terdefinisi), hingga *Mastered* (Sudah Dikuasai Sepenuhnya) — sesuai label yang benar-benar tampil di `ConceptsPage.tsx`.
  - **Asal-Usul Rujukan (Source Fragments)**: Menghubungkan definisi konsep langsung ke kutipan kalimat atau halaman buku referensi di Pustaka.
  - **Pembuat Flashcard dari Konsep**: Memungkinkan pembuatan kartu memori langsung dari sebuah Konsep (baik manual maupun via Generator AI yang menggunakan definisi konsep sebagai sumber).
  - **Auto-Sync Relations**: Menyimpan konsep secara instan menghubungkan keterkaitan dengan seluruh catatan, buku, dan draf terkait di seluruh sistem.
  - **Dukungan Graf Relasional**: Konsep otomatis terpetakan sebagai simpul sentral di dalam Graf Pengetahuan.

### 📊 Graf Pengetahuan (Knowledge Graph)
Visualisasi jaringan kognitif berbasis teori graf.
- **Fungsi**: Membantu pengguna melihat hubungan tersembunyi antarkonsep yang telah mereka catat.
- **Fitur Utama**:
  - **Visualisasi D3.js**: Render graf dinamis di mana setiap simpul (*node*) merepresentasikan Catatan, Buku, Penulis, Proyek, Draf, atau Konsep, dan garis (*edge*) menggambarkan koneksi antar-elemen.
  - **Dual Edge Engine (Explicit & Inferred)**: Menggabungkan relasi eksplisit yang disimpan dengan relasi implisit yang dipindai otomatis oleh *Auto-Linker Engine*, sehingga graf selalu utuh dan terkini.
  - **Filter Tipe Simpul & Mode Layar Penuh**: Pengguna dapat menyembunyikan atau menampilkan tipe simpul tertentu dan memperbesar kanvas graf ke mode satu layar penuh (*fullscreen*).
  - **Panel Rincian Relasi & Aksi Cepat**: Menampilkan daftar relasi masuk/keluar serta tombol "Tautkan Node" untuk pemindaian instan satu klik.
  - **Bottom Sheet Detail Mobile**: Mengetuk simpul di layar ponsel memicu panel informasi meluncur dari bawah layar (*bottom sheet*), menjaga kanvas graf tetap terlihat.

### 🔁 Latihan & Tinjauan (Spaced Repetition)
Sistem pelatihan memori berbasis sains kognitif untuk mencegah kurva lupa (*forgetting curve*).
- **Fungsi**: Mengunci pengetahuan penting ke dalam ingatan jangka panjang melalui kartu flash (*flashcards*).
- **Fitur Utama**:
  - **Algoritma SuperMemo-2 (SM-2)**: Melacak sejarah latihan pengguna dan menghitung hari tepat berikutnya kartu harus diulas kembali (interval) berdasarkan tingkat kesulitan ingatan.
  - **AI Flashcard Generator**: Cukup klik satu tombol pada catatan penting, AI akan otomatis memindai konten tersebut dan mengekstrak 5-10 kartu flash tanya-jawab yang esensial.
  - **AI Grading Assistant**: Saat menjawab kartu, pengguna tidak perlu mengetik jawaban persis sama dengan kunci jawaban. Cukup ketik pemahaman mereka, dan asisten AI akan menilai kebenaran konsep (*conceptual grading*) secara objektif dari skala kualitas 0-5.

---

## 4.4 Pilar 4: Ruang Kerja (Workspace Production)

### 💼 Proyek (Project Board)
Manajemen eksekusi tugas praktis untuk mengubah ilmu menjadi amal nyata.
- **Fungsi**: Menyusun tugas-tugas terukur berdasarkan ide atau proyek yang sedang dikerjakan.
- **Fitur Utama**:
  - **Status Proyek**: Melacak proyek dari fase *Planned*, *Active*, *Review*, *Completed*, hingga *Archived*.
  - **Sistem Daftar Tugas (Task Checklist)**: Menambahkan tugas konkret di bawah proyek, menyusun urutan, dan mencentangnya setelah selesai dikerjakan.
  - **Automated Entity & Knowledge Linking**: Memindai judul dan deskripsi proyek saat dibuat atau diperbarui untuk secara otomatis menautkan konsep, literatur, atau catatan terkait. Menampilkan lencana relasi (*relation count badges*) dan panel khusus relasi pengetahuan terhubung.
  - **Tampilan Tab Responsif**: Pengalihan cepat antara daftar proyek aktif dan arsip menggunakan tab sentuh horisontal.

### ✍️ Alur Menulis (Distraction-Free Writing Studio)
Studio penulisan kreatif dengan pipa penerbitan 5-tahap.
- **Fungsi**: Ruang tenang untuk merangkai karya tulis akhir seperti esai, artikel, kitab ringkasan, atau makalah ilmiah.
- **Fitur Utama**:
  - **Dual Mode View (Kanban & List)**: Menyajikan draf dalam bentuk kartu Kanban multi-kolom yang mendukung *snap-scroll* di ponsel atau tabel daftar (*List View*) yang ringkas.
  - **Pipeline 5 Tahap Penerbitan**: Mengelola tulisan dari *Ide*, *Kerangka*, *Draf*, *Revisi*, hingga *Terbit*.
  - **Fokus Sunyi & Penghitung Kata**: Editor Markdown minim gangguan dengan metrik jumlah kata dan estimasi waktu membaca secara langsung.
  - **Live Detected Entities & Auto-Linking**: Panel samping (*ContextualSidebar*) mendeteksi entitas konsep, buku, dan catatan secara langsung (*real-time*), memungkinkan penyisipan sintaks `[[WikiLink]]` satu sentuhan dan penautan otomatis ke graf saat draf disimpan.
  - **Integrasi Referensi Otak Kedua**: Mempermudah pengguna meninjau ulang catatan penting di Otak Kedua tanpa perlu keluar dari studio menulis.
