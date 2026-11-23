# 🎨 02. Desain dan Sistem Pengalaman Pengguna (UI/UX)

## 2.1 Prinsip Desain Utama

Estetika visual dan interaksi di dalam **Madrasah — Personal Knowledge Operating System** dipandu oleh tiga prinsip dasar:

### 1. Minimalisme Monokrom Murni (The Strict 3-Color Rule)
Sesuai dengan arahan terbaru untuk mendukung kejernihan berpikir tanpa distraksi visual, Madrasah mengadopsi palet warna monokromatik hitam-putih yang ketat dengan maksimal 3 spektrum warna dasar:
- **Spektrum 1: Putih Murni & Abu-abu Latar (`#FFFFFF` / `bg-gray-50/50`)**: Digunakan untuk kanvas dasar, kontainer kartu (`Card`), dan jendela dialog modal.
- **Spektrum 2: Slate Grays (`#F3F4F6`, `#E5E7EB`, `#9CA3AF`, `#6B7280`)**: Digunakan untuk garis batas tipis (`border-gray-200`), latar belakang tombol sekunder (`hover:bg-gray-50`), teks metadata, dan status pelengkap.
- **Spektrum 3: Hitam Arang / Deep Charcoal (`#111827` / `text-gray-900` / `bg-gray-900`)**: Digunakan untuk teks tajuk berkontras tinggi, tombol aksi utama, dan penanda tab aktif.
- **Tanpa Palette Colors**: Seluruh aksen warna sekunder (seperti biru, indigo, merah, hijau, ungu) telah dihapus total. Satu-satunya kontras didapatkan dari variasi intensitas warna hitam, putih, dan abu-abu.

### 2. Kejujuran Arsitektur (Anti-AI-Slop & No Tech-Larping)
Madrasah menolak keras elemen dekoratif tiruan yang sering kali ditambahkan hanya untuk membuat antarmuka terlihat canggih secara semu. 
- Tidak ada baris status buatan seperti `● ONLINE`, `● ACTIVE`, `CORE_NODE_ONLINE`, atau log sistem tiruan.
- Tidak ada gradien warna ungu-ke-biru, efek glassmorphism berlebihan dengan pendaran neon, atau bayangan gelap melayang yang tidak beralasan.
- Label antarmuka bersifat humble, literal, dan manusiawi (misalnya: "Jam Hijriah", "Misi Kontrol", "Draf Tulisan", bukan istilah fiksi teknologi seperti "Quantum Chronometer").
- Setiap komponen di layar harus memiliki fungsi praktis bagi pengguna, bukan sekadar hiasan.

### 3. Keberpihakan pada Konten & Ergonomi Sentuh (Content First)
Fokus utama pengguna adalah membaca, merenung, menulis, dan melatih ingatan. Oleh karena itu:
- Navigasi diminimalkan agar tidak memakan porsi layar yang berharga.
- Teks paragraf menggunakan jenis font sans yang sangat terbaca dengan tinggi baris (*line-height*) yang optimal dan pembatasan lebar paragraf (*max-width*) agar nyaman dibaca dalam waktu lama.
- Animasi mikro dihadirkan secara fungsional melalui pustaka `motion` untuk memberikan umpan balik aksi (seperti transisi dialog modal, hover tombol, dan perpindahan tab), bukan sekadar gerakan kosmetik.

---

## 2.2 Spesifikasi Design System

| Kategori | Elemen Desain | Kelas / Komponen Terkait | Keterangan |
| :--- | :--- | :--- | :--- |
| **Tipografi** | Display (Judul Utama) | `font-display` (Plus Jakarta Sans) | Memberikan karakter modern, ramah, dan profesional pada setiap tajuk (`h1`, `h2`, `h3`, `DialogTitle`). |
| | Body (Isi Teks) | `font-sans` (Inter) | Keterbacaan optimal di berbagai resolusi layar ponsel maupun monitor desktop. |
| | Code / Meta | `font-mono tabular-nums` (JetBrains Mono) | Menampilkan metadata waktu, angka, statistik, dan status teknis secara sejajar. |
| **Lengkukan** | Kartu Utama / Dialog | `rounded-2xl` | Memberikan kesan modern dan ramah pada elemen kontainer berukuran besar. |
| | Tombol / Input | `rounded-xl` | Standar konsisten untuk area interaktif berukuran kecil-menengah. |
| **Primitif UI** | Header Halaman | `PageHeader` | Menyeragamkan judul, subjudul, dan slot aksi utama di seluruh halaman tingkat atas (`max-w-7xl`). |
| | Metadata Tanpa Pill | `MetadataRow` | Menampilkan atribut teks bersih (`text-xs font-mono text-gray-500`) dengan pemisah titik tengah (`·`) tanpa kotak atau kapsul statis. |
| | Keadaan Kosong | `EmptyState` | Wadah seragam dengan batas putus-putus, ikon monokrom `rounded-2xl`, serta ajakan aksi yang ringkas. |
| | Konfirmasi Aksi | `ConfirmDialog` | Menggantikan seluruh `window.confirm` dan `window.alert` bawaan browser dengan modal monokrom `z-[100]`. |
| **Warna** | Latar Belakang | `bg-gray-50/50` / `bg-white` | Bersih, sejuk, dan konsisten di seluruh modul. |
| | Teks Utama | `text-gray-900` | Kontras tinggi (WCAG AA compliant) tanpa terlalu tajam di mata. |
| | Teks Sekunder | `text-gray-500` | Digunakan untuk petunjuk input, metadata, atau teks pendukung. |
| | Batas Elemen | `border-gray-200` | Garis pembatas tipis yang elegan dan transparan. |
| **Ikonografi** | Ikon Set Tunggal | `@lucide-react` | Konsistensi visual mutlak tanpa mencampur SVG mentah eksternal. |

---

## 2.3 Standar Lintas Perangkat (Mobile-First Mastery)

Madrasah dirancang dengan tata letak lega di desktop (`max-w-7xl` untuk ruang kerja utama dan `max-w-3xl`/`max-w-4xl` untuk halaman baca/editor) sekaligus dioptimalkan penuh untuk akses mobile melalui panduan berikut:

### 1. Aksesibilitas Sentuh (44px Minimum Touch Targets)
Di perangkat mobile, seluruh tombol aksi primer (`Button`), kontrol segmen, item tab navigasi, tombol hapus/tutup, dan input teks wajib memiliki tinggi area sentuh minimal **44px** (`min-h-[44px] md:min-h-0` atau `h-11 md:h-9`). Aksi kartu yang tersembunyi saat *hover* di desktop tetap tampil jelas di layar sentuh (`opacity-100 md:opacity-0 md:group-hover:opacity-100`).

### 2. Bilah Tab Horisontal Anti-Overflow (Horizontal Scrollable Tabs)
Pada seluruh modul dengan sub-kategori (seperti **Pustaka**, **Proyek**, **Catatan**, **Alur Menulis**, dan **Graf Pengetahuan**), tombol tab disusun dalam baris horisontal yang dapat digeser secara mulus dengan sentuhan jari menggunakan kelas `no-scrollbar` dan margin negatif responsif (`-mx-4 px-4 sm:mx-0 sm:px-0`).

### 3. Papan Kanban Snap-Scroll
Pada tampilan Kanban di modul **Alur Menulis**, kolom status diletakkan dalam kontainer horisontal dengan dukungan penangkapan gulir (`snap-x snap-mandatory w-[82vw] sm:w-72`) agar pengguna ponsel dapat beralih antarkolom dengan usapan jari yang alami.

### 4. Penataan Layering (Z-Index Harmony)
Untuk menjamin tidak adanya tumpang tindih visual yang merusak fungsionalitas:
- **Mobile Nav**: Diberikan kelas `z-40` atau `z-50` menempel pada bagian bawah viewport.
- **Dialog Modal / ConfirmDialog**: Wajib diletakkan pada kelas **`z-[100]`** serta dilapisi efek blur redup (`backdrop-blur-[4px] bg-black/45`) di latar belakang untuk memisahkan fokus kognitif secara tegas dari bilah navigasi bawah.

### 5. Penyaringan Pintar (Smart Accordion Drawer)
Panel penyaringan data yang kompleks (seperti pada modul **Basis Pengetahuan / Catatan**) secara dinamis berubah menjadi tombol lipat interaktif di layar mobile. Pengguna dapat membuka filter hanya saat membutuhkannya, memberikan ruang maksimal pada daftar catatan utama.

### 6. Bottom Sheet Detail Simpul Graf
Pada tampilan visualisasi Graf Pengetahuan di layar mobile, informasi detail mengenai simpul yang dipilih meluncur sebagai panel dari bawah layar (*bottom sheet*) dengan tombol tutup `min-h-[44px]` untuk kegunaan satu tangan yang maksimal.

---

## 2.4 Pola Dialog Identitas Sistem (About Dialog Pattern)

Modal informasi sistem (**AboutDialog**) dirancang sebagai representasi visual murni dari filosofi Madrasah yang tenang dan presisi:

```
+-------------------------------------------------------------+
|                                                             |
|                          [ 🧠 ]                             |
|                         Madrasah                            |
|            SISTEM OPERASI PENGETAHUAN PRIBADI               |
|                                                             |
|          +-------------------+-------------------+          |
|          |       Versi       |      Kreator      |          |
|          |      v1.2.5       |     Egi Setia     |          |
|          +-------------------+-------------------+          |
|                                                             |
|          +---------------------------------------+          |
|          |  "Tuntutlah ilmu dari buaian hingga   |          |
|          |           ke liang lahat."            |          |
|          |           🌐 HADITS RIWAYAT           |          |
|          +---------------------------------------+          |
|                                                             |
|        © 2026 Madrasah · Penyimpanan Lokal IndexedDB        |
+-------------------------------------------------------------+
```

- **Geometri Sudut (*Corner Radius*)**: Menggunakan `rounded-2xl` untuk kontainer modal dan badge ikon otak, selaras dengan sistem lengkungan Madrasah.
- **Hierarki Informasi**:
  1. **Badge Ikon Identitas**: Kontainer `w-16 h-16 bg-gray-900 rounded-2xl` dengan ikon `Brain` putih.
  2. **Tipografi Judul**: `font-display font-bold text-xl` (Plus Jakarta Sans) dipadukan dengan label monospace `font-mono text-[11px] tracking-[0.18em]`.
  3. **Grid Metadata**: Menampilkan Versi (`v1.2.5`) dan Kreator (`Egi Setia`) dalam pembagian kolom 2-jalur dengan garis pemisah `border-y border-gray-100`.
  4. **Kartu Kutipan (*Quote Card*)**: Kontainer `bg-gray-50 rounded-2xl` membingkai kalimat hikmah dengan tipografi serif italic `text-gray-700` dan atribusi riwayat.
  5. **Keterangan Penyimpanan**: Footer bersih `© {tahun} Madrasah · Penyimpanan Lokal IndexedDB` tanpa tautan placeholder mati.


