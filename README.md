# Warung Pintar

**Cytech National AI Hackathon 2026 | Telkom AI Center Padang**

**Demo live:** https://warung-pintar-hackathon.vercel.app

Asisten pencatatan warung: catat penjualan lewat suara, pindai nota belanja,
lalu dapat saran belanja besok yang ada alasannya.

> Prinsip utama: **AI hanya mengusulkan, pemilik warung yang mengonfirmasi.**
> Tidak ada angka yang masuk database tanpa diperiksa pemilik dulu.

## Masalah

Warung kecil mencatat penjualan di buku tulis. Stok tidak terpantau, belanja
berikutan berdasarkan perkiraan, dan laba tidak pernah dihitung. Kasir digital
untuk minimarket tidak membantu: warung punya cara jual sendiri — utang pakai
nama panggilan, pembeli datang saat tanggal tua, harga modal naik diam-diam.

## Solusi

**Cukup bicara dan foto.** Pemilik warung mencatat penjualan dengan suara,
memotret nota agen, lalu aplikasi mengubahnya jadi data stok dan saran
pembelian. Setiap hasil AI tampil di layar konfirmasi yang bisa diedit
sebelum disimpan.

## Yang sudah jalan

| Alur | Status |
| --- | --- |
| Catat penjualan lewat suara (speech-to-text + ekstraksi AI) | Berjalan |
| Pindai nota belanja (model multimodal + tabel koreksi) | Berjalan |
| Stok otomatis dari history transaksi | Berjalan |
| Saran belanja besok + alasan (dihitung kode) | Berjalan |
| Tanya warung (AI menjawab dari data warung sendiri) | Berjalan |
| Akun demo + RLS per pemilik warung | Berjalan |
| **Simpen Dulu** — pelanggan bayar sebagian, sisanya jadi utang | Berjalan |
| **Penjaga Margin** — harga modal naik diam-diam, tawarkan harga baru | Berjalan |
| Kasir desktop + panel notifikasi + tema gelap | Berjalan |

## Prinsip yang dijaga

1. **AI hanya mengusulkan.** Semua hasil AI masuk ke layar konfirmasi dulu.
2. **Angka dihitung kode, bukan AI.** AI hanya merapikan bahasa. Saran
   belanja, stok, dan laba kotor dihitung di `src/lib/inventory.ts` — satu
   mesin, jadi dua layar tidak pernah berbeda.
3. **Laba kotor, bukan laba bersih.** Selalu disebut "laba kotor" di seluruh
   tampilan.
4. **Prediksi adalah estimasi.** Setiap saran menyebut asumsinya.
5. **Kunci AI hanya di server.** Tidak pernah di frontend atau repositori.

## Menjalankan lokal

```bash
pnpm install
pnpm dev
```

Tanpa environment Supabase, aplikasi jalan dalam **mode demo lokal**: data
disimpan di `localStorage`, tanpa perlu akun. Supabase hanya perlu kalau mau
menguji pemanggilan AI sungguhan.

### Dengan Supabase

Salin `.env.example` jadi `.env` lalu isi:

```bash
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Lalu jalankan migrasi dan seed:

```bash
supabase link --project-ref <project-ref>
supabase db push --remote
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

Seed membuat akun demo, 12 barang, 28 alias, dan ±90 hari transaksi
simulasi.

### Edge Function (AI)

```bash
supabase secrets set \
  AI_API_KEY=... \
  AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai \
  AI_MODEL=gemini-3.5-flash-lite

supabase functions deploy ai-extract-voice
supabase functions deploy ai-read-receipt
supabase functions deploy ai-advise
```

Kunci hanya lived di Supabase Secrets. Tidak pernah masuk `.env` frontend
atau repositori.

## Demo

Akun demo:

```txt
email    demo@warungpintar.app
sandi    warungpintar2026
warung   Warung Sumber Rejeki
```

Atau tekan **Coba akun demo** di layar masuk.

Alur demo (±3 menit) ada di [`docs/demo.md`](docs/demo.md).

## Struktur

```
src/
  lib/          mesin hitung, parser, kalender, tipe, lapisan API
  pages/        Beranda, Kasir, Stok Barang, Simpen Dulu, Penjaga Margin,
                Cek Stok, Pelanggan, Harga Pasar, Modal Awal, Tutup Buku,
                Riwayat, Pengaturan, Catat Suara, Pindai Nota, Tanya AI
supabase/
  migrations/   skema + RLS per pemilik warung
  functions/    Edge Function AI (kunci hanya di server)
  seed.sql      data simulasi
docs/           kontrak AI, skrip demo
```

### Sistem desain

Satu set kelas CSS untuk semua layar, jadi tampilan konsisten dari dashboard
sampai layar konfirmasi.

| Token | Terang | Gelap |
| --- | --- | --- |
| `--green` (warna utama) | `#006494` | `#4fc3f7` |
| `--orange` (aksen) | `#00a6fb` | `#00a6fb` |
| `--ink` (teks) | `#051923` | `#e8f1f8` |
| `--muted` | `#5b6b78` | `#93a4b2` |
| `--line` | `#dbe4ec` | `#1e3346` |
| `--cream` (latar) | `#f5f9fc` | `#051923` |

Turunan token dihitung supaya semua pasangan teks/latar lolos **WCAG AA**
di mode terang dan gelap. Warna accent dan status memakai token yang sama,
jadi tidak ada hex yang ditulis manual di komponen.

### Mesin hitung

| Modul | Tugas |
| --- | --- |
| `src/lib/inventory.ts` | Stok dari history, saran beli, laba kotor |
| `src/lib/margin.ts` | Deteksi margin menyusut, pembagian "simpen dulu" |
| `src/lib/parser.ts` | Parser kalimat Indonesia (lokal, tanpa AI) |
| `src/lib/format.ts` | Format rupiah dan tanggal (WIB) |

Rumus saran beli:

```txt
proyeksi per hari = (qty terjual ÷ hari aktif) × faktor musim
target stok       = proyeksi per hari × (lead time + 3 hari)
saran beli        = target stok − stok, minimal sampai stok minimum
```

"Hari aktif" = hari sejak barang pertama terjual, dibatasi 30 hari. Warung yang
baru buka dua hari tidak ikut dibagi 30.

### Dua fitur pembeda

**Simpen Dulu** — di kasir, pelanggan bisa bayar sebagian. Barang tetap keluar
seluruhnya (stok turun untuk semua), tapi uang yang belum dibayar dicatat di
buku utang. Pelanggan warung sering cuma punya nama panggilan ("Pak Yono"),
jadi buku utang menyimpan nama, bukan kontak.

**Penjaga Margin** — aplikasi menyimpan riwayat harga modal setiap kali ada
pembelian. Kalau harga modal naik diam-diam, margin menyusut, dan aplikasi
menawarkan harga jual baru supaya owner bisa putuskan sendiri.

Margin dihitung pada harga jual yang sekarang, jadi yang terlihat adalah
efek kenaikan modal itu sendiri:

```txt
margin sekarang   = (harga jual − modal sekarang) ÷ harga jual
margin sebelumnya = (harga jual − modal dulu)     ÷ harga jual
harga jual saran  = modal sekarang ÷ (1 − target margin)
```

## Pengujian

```bash
pnpm typecheck
pnpm test
pnpm build
```

CI GitHub Actions menjalankan typecheck, test, build, dan pengecekan Edge
Function di setiap pull request.

## Credits

Semua pustaka, model AI, dan dataset dicatat di [`CREDITS.md`](CREDITS.md).

## Lisensi

MIT — lihat [`LICENSE`](LICENSE).
