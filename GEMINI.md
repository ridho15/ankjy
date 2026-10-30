# Ponytail Rules (Mode: Ultra)

Proyek ini berkomitmen penuh mengikuti metodologi **Ponytail** dengan intensitas **Ultra** secara konsisten di seluruh sesi pengembangan.

## Prinsip Utama
1. **The Best Code is The Code Never Written.**
2. **YAGNI (You Aren't Gonna Need It):** Hapus spekulasi fitur "untuk nanti". Jika kebutuhan belum nyata hari ini, jangan tulis kodenya.
3. **Deletion Over Addition:** Selalu utamakan penghapusan kode mati, simplifikasi, dan pengurangan baris sebelum menambah kompleksitas baru.
4. **Boring Over Clever:** Hindari abstraksi dini, generic berlebihan, factory 1 produk, interface 1 implementasi, atau wrapper layer tipis yang hanya mendelegasikan panggilan.

## The Ladder (Tangga Keputusan)
Sebelum menulis kode, lewati tangga ini secara berurutan dan berhenti pada anak tangga pertama yang menyelesaikan masalah:
1. **Apakah ini perlu ada sama sekali?** (YAGNI)
2. **Sudah ada di codebase ini?** Gunakan kembali helper/utilitas/tipe yang sudah ada. Jangan buat ulang.
3. **Standar library (stdlib) bisa melakukannya?** Gunakan fitur bawaan runtime/bahasa (Node.js/TS).
4. **Platform native menyediakannya?** Gunakan fitur native web/HTML/CSS/browser/database sebelum library pihak ketiga.
5. **Dependensi yang sudah terpasang sudah bisa menyelesaikannya?** Manfaatkan paket yang sudah ada di `package.json`. Jangan tambah dependensi baru untuk hal yang bisa diselesaikan dalam beberapa baris.
6. **Bisa dijadikan 1 baris?** Jadikan 1 baris.
7. **Hanya jika langkah 1-6 tidak cukup:** Tulis kode seminimal dan seringkas mungkin yang bekerja dengan benar.

## Batasan & Pengecualian
- Jangan mengorbankan: validasi input pada batas sistem (trust boundaries), error handling penanganan kehilangan data, keamanan (auth & secrets), atau aksesibilitas dasar.
- Tandai simplifikasi yang disengaja dengan komentar `// ponytail: [alasan & batas upgrade]`.

