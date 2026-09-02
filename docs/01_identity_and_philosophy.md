# 🕋 01. Identitas, Visi, dan Filosofi Produk

## 1.1 Identitas Produk
**Madrasah — Personal Knowledge Operating System** adalah sebuah **Personal Knowledge Operating System (PKOS)** modern yang dirancang untuk mengintegrasikan seluruh siklus hidup pengetahuan individu. Lebih dari sekadar aplikasi pencatatan, Madrasah adalah platform terpadu yang menyatukan perencanaan belajar, manajemen pustaka, pencatatan berbasis Zettelkasten, penulisan terfokus, serta pengulangan berjarak (*spaced repetition*) untuk retensi ingatan jangka panjang.

### 📋 Ringkasan Metadata Resmi Sistem
| Atribut | Nilai Resmi | Keterangan |
| :--- | :--- | :--- |
| **Nama Aplikasi** | Madrasah | Personal Knowledge Operating System (PKOS) |
| **Versi Rilis** | `v1.0.0-beta` | Versi stabil saat ini (Agustus 2026) |
| **Kreator / Pemilik**| **egiistw88** | Pengembang utama dan arsitek produk |
| **Motto Keilmuan** | *"Tuntutlah ilmu dari buaian hingga ke liang lahat."* | Hadits Riwayat / Atsar Salafus Shalih |
| **Identitas Visual**| Ikon Otak (*Brain*) | Simbol Otak Kedua, kognisi mandiri, dan kristalisasi ilmu |
| **Hak Cipta** | © 2026 Madrasah OS | Hak cipta terpelihara |
| **Palet Visual** | Monokrom Minimalis (Maks. 3 Warna) | Putih Murni, Slate Grays, Hitam Arang |
| **Gateway AI Utama**| **HCNSEC Provider Gateway** | Kompatibel dengan protokol OpenAI Chat Completions |

---

## 1.2 Visi Produk
Visi utama **Madrasah — Personal Knowledge Operating System** adalah **demokratisasi manajemen pengetahuan pribadi tingkat lanjut**. Kami percaya bahwa di era kelimpahan informasi (information overload), tantangan terbesar manusia bukan lagi mencari informasi, melainkan menyaring, menghubungkan, dan memproduksi pengetahuan yang bermakna. Madrasah hadir sebagai "Otak Kedua" (Second Brain) yang andal, sunyi, bebas dari kebisingan algoritma media sosial, dan dioptimalkan secara estetis untuk merangsang kejernihan berpikir.

## 1.3 Filosofi "Madrasah" dan Siklus Hidup Intelektual
Nama **Madrasah** diambil dari bahasa Arab (*مدرسة*) yang secara harfiah berarti "tempat belajar" atau "sekolah". Dalam sejarah peradaban keilmuan, madrasah merupakan pusat transmisi ilmu pengetahuan secara sistematis, di mana kurikulum disusun dengan saksama, literatur dipelajari secara mendalam, catatan tepi (*hasyiyah*) dibuat di pinggir kitab, dan diskusi melahirkan sintesis baru yang melahirkan karya tulis bermanfaat.

Kami mengadopsi tradisi luhur ini ke dalam desain perangkat lunak modern melalui **Siklus Hidup Intelektual 5 Tahap**:

```
+-------------------------------------------------------------------------+
|                  SIKLUS HIDUP PENGETAHUAN MADRASAH                      |
|                                                                         |
|  1. ABSORPSI   -->  2. ATOMISASI   -->  3. KONEKSI   -->  4. RETENSI    |
|   (Kurikulum &       (Zettelkasten &      (Knowledge       (Spaced      |
|     Pustaka)           Konsep)              Graph)        Repetition)   |
|                                                                |        |
|                                                                v        |
|                                                          5. PRODUKSI    |
|                                                           (Proyek &     |
|                                                            Menulis)     |
+-------------------------------------------------------------------------+
```

1. **Absorpsi (Peta Jalan & Literatur)**: Belajar dimulai dengan arah terstruktur melalui Kurikulum dan Pustaka literatur kredibel.
2. **Atomisasi & Sintesis (Otak Kedua & Konsep)**: Informasi mentah dipecah menjadi unit-unit pemikiran mandiri (*atomic notes*) dan konsep abstrak terdefinisi.
3. **Koneksi Relasional (Knowledge Graph)**: Menghubungkan titik-titik pengetahuan menjadi jaring graf kognitif interaktif bertenaga D3.js.
4. **Retensi & Kristalisasi (Spaced Repetition SM-2)**: Menjaga pemahaman agar tidak hilang melalui kartu flash cerdas dan penilaian semantik berbasis AI.
5. **Produksi & Amal Nyata (Proyek & Studio Menulis)**: Mengalirkan pengetahuan menjadi aksi nyata melalui papan proyek dan studio penulisan tanpa distraksi.

## 1.4 Prinsip Nilai Inti (Core Values)
- **Monokromatik Hening**: Desain visual murni monokrom (maksimal 3 variasi warna: putih, slate, hitam arang) untuk memastikan ketenangan berpikir total.
- **Ramah Ponsel (Mobile-First Ergonomics)**: Antarmuka yang mulus dioperasikan dengan satu tangan melalui bilah navigasi bawah dan tombol berukuran minimal 44px.
- **Kedaulatan Data**: Data Anda adalah milik Anda seutuhnya, tersimpan di penyimpanan lokal dengan opsi pencadangan cloud terenkripsi.
- **Kejujuran Epistemik**: Sistem tidak pernah menampilkan hasil kerja AI (relasi, tag, ringkasan) sebagai "terverifikasi" kecuali pengguna benar-benar meninjaunya. Lihat §1.6.
- **Gesekan Minimal yang Disengaja**: Sebagian besar alur kerja harus ringkas dan serba otomatis — AI boleh bebas menghasilkan tag, ringkasan, saran koneksi, dan flashcard tanpa langkah tambahan. Pengecualian sengaja dijaga sekecil mungkin: satu aksi sadar (satu ketukan, bukan formulir) tepat di titik saat tebakan mesin hendak diperlakukan sebagai fakta yang dipercaya. Prinsip ini bukan alasan untuk menambah pengaturan atau langkah baru di tempat lain.

## 1.5 Target Pengguna
Madrasah dirancang secara spesifik untuk kelompok pengguna berikut:
1. **Akademisi & Peneliti**: Membutuhkan alat untuk melacak referensi ilmiah, mensintesis makalah, dan memetakan kontribusi pemikiran mereka.
2. **Pembelajar Mandiri (Autodidak)**: Membutuhkan sistem terstruktur untuk merancang kurikulum belajar mandiri dalam menguasai topik-topik kompleks.
3. **Penulis & Kreator Konten**: Membutuhkan alur kerja yang lancar dari tahap tangkapan ide kasar, draf awal, penyuntingan, hingga penerbitan karya tulis.
4. **Profesional Pengetahuan (Knowledge Workers)**: Membutuhkan repositori aman dan cepat untuk menyimpan dokumentasi proyek, panduan teknis, dan catatan rapat penting.

## 1.6 Lapisan Ta'dib: Batas Otoritas AI
*Ditambahkan Agustus 2026 sebagai bagian baru — tidak mengganti atau menulis ulang bagian di atas. Rincian teknis penuh ada di `docs/10_tadib_layer_prd.md` dan `docs/11_reading_reflection_connecting_prd.md`.*

Madrasah dibangun di atas kerangka ta'dib (Syed Muhammad Naquib al-Attas): AI berkedudukan sebagai instrumen, bukan otoritas kebenaran. Secara praktis, ini berarti satu batas tegas:

**Madrasah tidak pernah menjadi sumber kebenaran agama.** Fitur pelacakan keyakinan (skor kepercayaan, penanda domain sensitif seperti akidah/fiqih/tasawuf) hanya alat bantu pengguna melacak keyakinannya sendiri terhadap catatannya sendiri — bukan penilaian sahih-tidaknya suatu pendapat keagamaan, dan bukan mesin fatwa dalam bentuk apa pun.

Batas ini berlaku selama Madrasah masih personal/single-user. Jika suatu saat produk ini dibuka untuk pengguna lain, batas ini tidak lagi cukup — dibutuhkan jalur validasi ulama yang sesungguhnya sebelum konten keagamaan bawaan (bukan catatan pribadi pengguna) bisa disediakan. Ini pertanyaan terbuka yang sengaja belum dijawab dokumentasi ini (lihat §12 di `docs/10_tadib_layer_prd.md`).

