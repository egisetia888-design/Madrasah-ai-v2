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

| Kategori | Elemen Desain | Kelas Tailwind Terkait | Keterangan |
| :--- | :--- | :--- | :--- |
| **Tipografi** | Display (Judul Utama) | `font-display` (Plus Jakarta Sans) | Memberikan karakter modern, ramah, dan profesional pada setiap tajuk (`h1`, `h2`, `h3`, `DialogTitle`). |
| | Body (Isi Teks) | `font-sans` (Inter) | Keterbacaan optimal di berbagai resolusi layar ponsel maupun monitor desktop. |
| | Code / Meta | `font-mono` (JetBrains Mono) | Menampilkan metadata waktu, kode, angka, statistik, dan status teknis. |
| **Lengkukan** | Kartu Utama / Dialog | `rounded-2xl` | Memberikan kesan modern dan ramah pada elemen kontainer berukuran besar. |
| | Tombol / Input | `rounded-xl` | Standar konsisten untuk area interaktif berukuran kecil-menengah. |
| **Warna** | Latar Belakang | `bg-gray-50/50` / `bg-white` | Bersih, sejuk, dan konsisten di seluruh modul. |
| | Teks Utama | `text-gray-900` | Kontras tinggi (WCAG AA compliant) tanpa terlalu tajam di mata. |
| | Teks Sekunder | `text-gray-500` | Digunakan untuk petunjuk input, metadata, atau teks pendukung. |
| | Batas Elemen | `border-gray-200` | Garis pembatas tipis yang elegan dan transparan. |
| **Ikonografi** | Ikon Set Tunggal | `@lucide-react` | Konsistensi visual mutlak tanpa mencampur SVG mentah eksternal. |

---

## 2.3 Standar Lintas Perangkat (Mobile-First Mastery)

Madrasah dirancang dengan pendekatan desktop-first untuk fungsionalitas kognitif berat, tetapi dioptimalkan secara penuh untuk akses mobile yang nyaman melalui panduan berikut:

### 1. Aksesibilitas Sentuh (44px Minimum Touch Targets)
Di perangkat mobile, seluruh tombol aksi primer, item tab navigasi, dan input teks wajib memiliki tinggi area sentuh minimal **44px** (`h-11 md:h-9` atau `h-11 sm:h-9`) untuk menjamin kenyamanan navigasi satu tangan dan mencegah terjadinya salah ketuk.

### 2. Bilah Tab Horisontal Anti-Overflow (Horizontal Scrollable Tabs)
Pada seluruh modul dengan sub-kategori (seperti **Pustaka**, **Proyek**, **Catatan**, **Alur Menulis**, dan **Graf Pengetahuan**), tombol tab disusun dalam baris horisontal yang dapat digeser secara mulus dengan sentuhan jari menggunakan kelas `no-scrollbar` dan margin negatif responsif (`-mx-4 px-4 sm:mx-0 sm:px-0`). Tombol tab tidak pernah dipaksa melipat ke bawah (*wrap*) yang merusak tata letak.

### 3. Papan Kanban Snap-Scroll
Pada tampilan Kanban di modul **Alur Menulis**, kolom status diletakkan dalam kontainer horisontal dengan dukungan penangkapan gulir (`snap-x snap-mandatory w-[82vw] sm:w-72`) agar pengguna ponsel dapat beralih antarkolom dengan usapan jari yang sangat alami.

### 4. Penataan Layering (Z-Index Harmony)
Untuk menjamin tidak adanya tumpang tindih visual yang merusak fungsionalitas:
- **Mobile Nav**: Diberikan kelas `z-40` atau `z-50` menempel pada bagian bawah viewport.
- **Dialog Modal / Popup**: Wajib diletakkan pada kelas **`z-[100]`** serta dilapisi efek blur redup (`backdrop-blur-[4px] bg-black/45`) di latar belakang untuk memisahkan fokus kognitif secara tegas dari bilah navigasi bawah.

### 5. Penyaringan Pintar (Smart Accordion Drawer)
Panel penyaringan data yang kompleks (seperti pada modul **Catatan**) secara dinamis berubah menjadi tombol lipat interaktif di layar mobile. Pengguna dapat membuka filter hanya saat membutuhkannya, memberikan ruang maksimal pada tabel catatan utama.

### 6. Bottom Sheet Detail Simpul Graf
Pada tampilan visualisasi Graf Pengetahuan di layar mobile, informasi detail mengenai simpul yang dipilih tidak diletakkan di sidebar samping kanan (seperti di desktop), melainkan meluncur mulus sebagai panel dari bawah layar (*bottom sheet*) untuk kegunaan satu tangan yang maksimal.

---

## 2.4 Pola Dialog Identitas Sistem (About Dialog Pattern)

Modal informasi sistem (**AboutDialog**) dirancang sebagai representasi visual murni dari filosofi Madrasah yang tenang dan presisi:

```
+-------------------------------------------------------------+
|                                                             |
|                          [ 🧠 ]                             |
|                         Madrasah                            |
|                 PERSONAL KNOWLEDGE OS                       |
|                                                             |
|          +-------------------+-------------------+          |
|          |       Versi       |      Kreator      |          |
|          |    v1.0.0-beta    |     egiistw88     |          |
|          +-------------------+-------------------+          |
|                                                             |
|          +---------------------------------------+          |
|          |  "Tuntutlah ilmu dari buaian hingga   |          |
|          |           ke liang lahat."            |          |
|          |           🌐 HADITS RIWAYAT           |          |
|          +---------------------------------------+          |
|                                                             |
|                         [Github] [Heart]                    |
|             © 2026 Madrasah OS. All rights reserved.        |
+-------------------------------------------------------------+
```

- **Geometri Sudut (*Corner Radius*)**: Menggunakan kurvatur `rounded-[2rem]` untuk kontainer utama modal dan `rounded-[1.5rem]` untuk badge ikon otak, memberikan kelembutan optik yang presisi.
- **Hierarki Informasi**:
  1. **Badge Ikon Identitas**: Kontainer `w-20 h-20 bg-gray-900` dengan ikon `Brain` putih.
  2. **Tipografi Judul**: `font-display font-bold text-xl` (Plus Jakarta Sans) dipadukan dengan label monospace `font-mono text-[11px] tracking-[0.2em]`.
  3. **Grid Metadata**: Menampilkan Versi (`v1.0.0-beta`) dan Kreator (`egiistw88`) dalam pembagian kolom 2-jalur yang seimbang dengan garis pemisah tipis `border-y border-gray-50`.
  4. **Kartu Kutipan (*Quote Card*)**: Kontainer `bg-gray-50/80 rounded-2xl` membingkai kalimat hikmah dengan tipografi serif italic `text-gray-700` dan atribusi riwayat.
  5. **Tautan Komunitas & Copyright**: Ikon tautan GitHub, apresiasi komunitas, dan klausa hak cipta resmi `© 2026 Madrasah OS`.

