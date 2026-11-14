# Skrip Demo — Warung Pintar

Durasi target: ±3 menit. Demo bisa memakai akun demo (data 90 hari) atau mode
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

## 2. Catat penjualan lewat suara (50 detik)

1. Buka menu **Catat**.
2. Tekan **Rekam suara**, ucapkan: *"terjual 3 kilo beras dan 2 bungkus kopi sachet"*.
3. Tampilkan tabel konfirmasi yang muncul.
4. **Sengaja biarkan satu baris dengan keyakinan rendah** → tunjuk badge
   "periksa". Poin: "AI boleh salah, makanya semuanya bisa diedit dulu."
5. Ubah satu angka harga, lalu tekan **Simpan penjualan**.

Poin: "Hasil AI tidak pernah langsung masuk. Pemilik yang memutuskan."

## 3. Foto nota belanja (45 detik)

1. Tekan **Catat suara** → ganti ke **Nota** di navigasi bawah.
2. Tekan **Ambil / pilih foto nota**, pakai foto nota uji.
3. Tampilkan tabel koreksi yang muncul.
4. Tunjuk peringatan total kalau ada (`totalMismatch`).
5. Koreksi satu baris, tekan **Simpan pembelian**.

Poin: "Foto nota jadi data stok dan harga modal. Kalau totalnya beda, kami
beri tahu sebelum disimpan."

## 4. Stok berubah (20 detik)

1. Buka menu **Stok**.
2. Tunjukkan baris Beras dan Kopi — angkanya sudah berubah setelah langkah 2
   dan 3.

Poin: "Stok bukan angka yang diketik. Stok dihitung dari history transaksi,
jadi tidak mungkin melenceng."

## 5. Tanya AI + saran belanja (40 detik)

1. Buka menu **Tanya AI**.
2. Tekan chip **"Beli apa besok?"**.
3. Tunjukkan tips AI lengkap dengan alasan.
4. Di bawahnya, tunjukkan **Saran belanja (dihitung kode)**.

Poin: "Angka belanja besok dari mesin hitung yang sama, bukan dari AI. AI cuma
merapikan bahasanya. Kalau AI mati, angkanya tetap jalan."

## 6. Tutup (10 detik)

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
