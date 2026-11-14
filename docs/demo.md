# Skrip Demo — Warung Pintar

Durasi target: ±3 menit (15 + 40 + 30 + 30 + 25 + 10 + 25 + 10 = 185 detik). Demo bisa memakai akun demo (data 90 hari) atau mode
demo lokal.

Prinsip: **buka dengan pencatatan, tutup dengan keputusan.** Effek AI terlihat
paling jelas kalau demostrar barang → stok → saran.

## 0. Persiapan (1 menit, sebelum presentasi)

- [ ] Buka `https://<deploy>.vercel.app` di HP dan laptop
- [ ] Masuk pakai akun demo (atau tekan **Coba akun demo**)
- [ ] Pastikan HP di mode gelap untuk kontras layar
- [ ] Cek WiFi venue; kalau lemot, pakai tethering sendiri
- [ ] Rekaman video alur lengkap tersimpan di laptop (cadangan)

## 1. Masalah (15 detik)

"Pak Andi pemilik warung kelontong. Ia catat penjualan di buku tulis, lupa
stok, dan tidak tahu laba. Kasir digital untuk minimarket tidak membantu —
warung punya cara jual sendiri: utang pakai nama panggilan, pembeli datang
saat tanggal tua, harga modal naik diam-diam."

Poin: yang hilang bukan mesin kasirnya, tapi catatan dan keputusan yang bisa
dipercaya.

## 2. Catat penjualan lewat suara (40 detik)

1. Buka menu **Catat**.
2. Tekan **Rekam suara**, ucapkan: *"terjual 3 kilo beras dan 2 bungkus kopi sachet"*.
3. Tampilkan tabel konfirmasi yang muncul.
4. **Sengaja biarkan satu baris dengan keyakinan rendah** → tunjuk badge
   "periksa". Poin: "AI boleh salah, makanya semuanya bisa diedit dulu."
5. Ubah satu angka harga, lalu tekan **Simpan penjualan**.

Poin: "Hasil AI tidak pernah langsung masuk. Pemilik yang memutuskan."

## 3. Foto nota belanja (30 detik)

1. Tekan **Catat suara** → ganti ke **Nota** di navigasi bawah.
2. Tekan **Ambil / pilih foto nota**, pakai foto nota uji.
3. Tampilkan tabel koreksi yang muncul.
4. Tunjuk peringatan total kalau ada (`totalMismatch`).
5. Koreksi satu baris, tekan **Simpan pembelian**.

Poin: "Foto nota jadi data stok dan harga modal. Kalau totalnya beda, kami
beri tahu sebelum disimpan."

## 4. Simpen Dulu — pelanggan bayar sebagian (30 detik)

1. Buka menu **Kasir**.
2. Tambahkan barang: ketuk **Tambah ke keranjang** untuk RNAi Premium × 2 dan
   Gula Pasir × 1.
3. Centak **Simpen dulu**, isi nama **Pak Yono**, isi **dibayar sekarang**
   `20000`.
4. Tunjukkan baris: "Dibayar Rp20.000 · sisa jadi utang Rp12.000".
5. Tekan **Simpan penjualan**.

Poin: "Stok tetap turun untuk seluruh barang, termasuk yang diutangkan. Dan
pelanggan warung cuma punya nama panggilan — jadi buku utangnya menyimpan
nama, bukan nomor telepon."

5. Buka menu **Simpen Dulu** → tunjukkan buku utangnya. Poin: "Buku utang
bersih atau ada tagihan, kelihatan hari ini juga."

## 5. Penjaga Margin — modal naik diam-diam (25 detik)

1. Buka menu **Penjaga Margin**.
2. Tunjukkan "Modal naik 12% (28 rb → 31,4 rb), margin menyusut 12,5% → 2%".
3. Tekan **Atur harga jual** → harga baru terisi. Tekan sekali lagi.

Poin: "Harga modal naik tidak terasa. Yang terasa belakangan: margin
menyusut. Kasir biasa tidak tahu ini sebelum tutup buku."

## 6. Stok berubah (10 detik)

1. Buka menu **Stok**.
2. Tunjukkan baris Beras dan Kopi — angkanya sudah berubah setelah langkah 2
   dan 3.

Poin: "Stok bukan angka yang diketik. Stok dihitung dari history transaksi,
jadi tidak mungkin melenceng."

## 7. Tanya AI + saran belanja (25 detik)

1. Buka menu **Tanya AI**.
2. Tekan chip **"Beli apa besok?"**.
3. Tunjukkan tips AI lengkap dengan alasan.
4. Di bawahnya, tunjukkan **Saran belanja (dihitung kode)**.

Poin: "Angka belanja besok dari mesin hitung yang sama, bukan dari AI. AI cuma
merapikan bahasanya. Kalau AI mati, angkanya tetap jalan."

## 8. Tutup (10 detik)

"Kasir tahu transaksi. Yang ditanyakan pemilik warung justru: uang saya
bertambah atau berkurang? Dan kalau berkurang, mau kulakan apa besok?"

---

## Cadangan kalau ada kendala

| Kendala | Cadangan |
| --- | --- |
| Mikrofon tidak jalan | Ketik kalimatnya di kolom teks — alurnya sama |
| AI lambat | Tampilkan hasil AI yang sudah tersimpan, jelaskan ini fallback |
| Internet putus | Mode demo lokal: data di `localStorage`, alur tetap jalan |
| Aplikasi error | Rekaman video alur lengkap |
| Demo account bermasalah | Daftar akun baru, lalu isi katalog manual |
