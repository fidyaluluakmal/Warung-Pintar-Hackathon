# Skrip Demo — Warung Pintar

Durasi target: ±3 menit. Alur: **buka dengan pencatatan, tutup dengan keputusan.**

## 0. Persiapan (1 menit, sebelum presentasi)

- [ ] Buka https://warung-pintar-hackathon.vercel.app di HP **dan** laptop
- [ ] Masuk pakai akun demo (tombol **Coba akun demo**)
- [ ]_theme_: pastikan mode terang atau gelap yang paling kontras di ruangan
- [ ] Cek WiFi venue; kalau lemot, pakai tethering sendiri
- [ ] Rekaman video alur lengkap tersimpan di laptop dan HP (cadangan)
- [ ] Stopkontak sudah dibawa

## 1. Masalah (15 detik)

"Pak Andi pemilik warung kelontong. Ia catat penjualan di buku tulis, lupa
stok, dan tidak tahu laba. Kasir digital untuk minimarket tidak membantu —
warung punya cara jual sendiri: utang pakai nama panggilan, pembeli datang
saat tanggal tua, harga modal naik diam-diam."

Poin: yang hilang bukan mesin kasirnya, tapi catatan dan keputusan yang bisa
dipercaya.

## 2. Catat dengan suara (35 detik)

1. Di Beranda, tekan **Catat dengan suara**. Modalnya terbuka.
2. Ketik di kolom: `terjual 3 kilo beras`
3. Tekan **Baca**. Tunggu tabel konfirmasi muncul.
4. Tunjukkan barisnya: nama barang, jumlah, harga, badge **yakin**.
5. Tekan **Simpan penjualan**. Modalnya menutup sendiri.

Poin: "AI boleh salah, makanya semuanya dicek dulu sebelum masuk stok. Dan
stok berubah karena transaksi, bukan karena diketik."

## 3. Foto nota belanja (30 detik)

1. Tekan **Foto nota belanja**. Modalnya terbuka dengan area pindai.
2. Pilih foto nota uji.
3. Tunggu tabel koreksi muncul — kolom barang, jumlah, harga, dan total.
4. Koreksi satu baris, lalu **Simpan pembelian**.

Poin: "Nota agen jadi stok dan harga modal. Kalau totalnya beda, kami beri
tahu sebelum disimpan."

## 4. Stok barang berubah (20 detik)

1. Buka menu **Stok Barang**.
2. Tunjukkan ringkasan: total persediaan, barang perlu restok, nilai
   persediaan, potensi omzet.
3. Tunjukkan tabel: stok saat ini, nilai stok, status (Aman / Kritis), tombol
   Restok.
4. Tunjukkan filter **Perlu restok**.

Poin: "Stok bukan angka yang diketik. Hitungannya dari history transaksi,
jadi tidak mungkin melenceng."

## 5. Simpen Dulu — pelanggan bayar sebagian (30 detik)

1. Buka menu **Simpen Dulu**.
2. Tampilkan buku utang per orang: total belum lunas, catatan per pelanggan,
   dan tombol **Lunas**.
3. Kembali ke **Kasir**: tambah barang, tekan **Simpen dulu (ngutang)** di baris
   itu, isi nama peminjam dan jumlah yang dibayar, lalu simpan.
4. Tunjukkan **Pelanggan**: 5 orang, tanggal kapan terakhir datang, barang
   favorit, dan badge "Ada utang · Rp198.500 · 15 hari".

Poin: "Pelanggan warung sering cuma punya nama panggilan, jadi buku utangnya
menyimpan nama, bukan nomor telepon. Dan barang tetap keluar untuk seluruh
jumlah — bukan cuma yang dibayar."

## 6. Penjaga Margin (25 detik)

1. Buka menu **Penjaga Margin**.
2. Tunjukkan: "Modal naik 8% (15 rb → 16,2 rb), margin menyusut 11,8% → 4,7%".
3. Tekan **Atur harga jual** — harga baru terisi. Tekan sekali lagi.

Poin: "Harga modal naik tidak terasa. Yang terasa belakangan: margin
menyusut. Kasir biasa tidak tahu ini sebelum tutup buku."

## 7. Titip Jual — barang milik orang lain (20 detik)

1. Buka menu **Titip Jual**.
2. Tunjukkan ringkasan: omzet titipan, komisi warung, dan berapa yang harus
   dibayar ke pemilik barang.
3. Tunjukkan satu kartu: "Krupuk Udang dari Mas Togo, 15 pcs laku, komisi
   15% — semua laku, bisa dibayar".
4. Tekan **Rincian pembayaran** — teks siap salin.

Poin: "Warung sering jadi etalase barang tetangga. Barang titipan tidak masuk
stok warung, jadi laba warung tetap bersih. Yang dihitung cuma komisi warung
dan bagian yang harus dibayar ke pemilik barang."

## 8. Tutup buku + Laporan (25 detik)

1. Buka menu **Tutup Buku** — ringkasan penjualan, laba kotor, bersih, utang,
   dan yang perlu dibeli besok. Tunjukkan tombol salin.
2. Buka menu **Laporan** — tren penjualan 7 hari, komposisi omzet, produk
   terlaris.

Poin: "Tutup buku dan laporan membaca data yang sama, jadi angkanya selalu
cocok."

## 9. Tanya AI (20 detik)

1. Tekan ikon kilat di header → drawer **Asisten warung** terbuka.
2. Tekan chip **Beli apa besok?**.
3. Tunggu jawabannya. Tunjukkan bahwa angkanya sama dengan panel lain.

Poin: "AI menjawab dari catatan warung sendiri. Angkanya dihitung
aplikasi, bukan dikarang AI."

## 10. Tutup (10 detik)

"Kasir tahu transaksi. Yang ditanyakan pemilik warung justru: uang saya
bertambah atau berkurang? Dan kalau berkurang, mau kulakan apa besok?"

---

## Cadangan kalau ada kendala

| Kendala | Cadangan |
| --- | --- |
| Mikrofon tidak jalan | Ketik kalimatnya di kolom — alurnya sama |
| AI lambat | Tampilkan hasil AI yang sudah tersimpan; jelaskan ini fallback |
| Internet putus | Mode demo lokal: data di `localStorage`, alur tetap jalan |
| Aplikasi error | Rekaman video alur lengkap |
| Akun demo bermasalah | Daftar akun baru, lalu isi katalog manual |
| Prompt AI kosong | Tampilkan tabel stok dan saran beli yang dihitung kode |

## Angka yang bisa dikutip di presentasi

Angka ini dari data demo dan **tidak berubah** — seed-nya deterministik,
jadi demo bisa diulang persis.

| Angka | Nilai |
| --- | --- |
| Omzet hari ini | Rp238.500 (3 transaksi) |
| Laba kotor hari ini | Rp29.900 (margin 12,5%) |
| Belanja stok hari ini | Rp155.000 (dua barang dari vendors keliling) |
| Penghasilan bersih hari ini | Rp83.500 (marjin bersih 35,0%) |
| Omzet 7 hari | Rp1.675.500 (27 transaksi) |
| Laba kotor 7 hari | Rp167.460 (margin 10,0%) |
| Barang perlu restok | 4 dari 12 (Air Mineral, Beras Premium, Mi Instan, Rokok Kretek) |
| Nilai persediaan | Rp7,2 jt |
| Total utang berjalan | Rp258.500 (5 catatan, 3 pelanggan) |
| Utang terlama | Pak Yono, Rp198.500 (15 hari) |
| Menunggak lebih dari 7 hari | 2 orang |
| Pelanggan tercatat | 5 orang, semuanya punya riwayat belanja |
| Omzet titipan | Rp601.000, komisi warung Rp76.250 |
| Harus dibayar ke pemilik barang | Rp524.750 |
| Modal naik | Beras Premium Rp14.000 → Rp15.120, margin 12,5% → 5,5% |
| Modal naik | Telur Ayam Rp28.000 → Rp31.360, margin 12,5% → 2% |