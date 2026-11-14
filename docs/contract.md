# Kontrak Output AI

Dokumen ini adalah satu-satunya sumber kebenaran bentuk data yang keluar dari
Edge Function. Kalau bentuknya berubah, dokumen ini dan `src/lib/types.ts`
harus berubah bareng.

Semua fungsi AI mengembalikan JSON. Tidak ada teks bebas di luar JSON.

## Aturan yang berlaku untuk semua prompt

Aturan ini ada di setiap system prompt dan tidak boleh dilonggarkan:

1. **Hanya pakai angka yang ada di DATA.** Model tidak boleh menghitung ulang,
   menambah, atau mengarang angka.
2. **Jangan menyebut "laba bersih".** Kalau menyebut laba, sebut "laba kotor".
3. **Balas hanya JSON valid.** Tanpa penjelasan di luar JSON.
4. **Boleh bilang tidak tahu.** Kalau data kurang, itu jawaban yang benar.

---

## `ai-extract-voice`

Menerima kalimat speech-to-text, mengembalikan daftar barang.

**Request**

```json
{
  "transcript": "terjual 3 kilo beras dan 2 bungkus kopi",
  "products": [{ "name": "Beras Premium", "unit": "kg", "aliases": ["beras"] }]
}
```

`products` opsional. Kalau diisi, model memakai nama dari daftar itu supaya
tidak mengarang barang baru.

**Response**

```json
{
  "items": [
    { "name": "beras", "qty": 3, "unit": "kg", "confidence": 0.92 },
    { "name": "kopi", "qty": 2, "unit": "bungkus", "confidence": 0.88 }
  ],
  "needsClarification": []
}
```

| Field | Tipe | Aturan |
| --- | --- | --- |
| `items[].name` | string | Huruf kecil, ada di kalimat, atau nama dari `products` |
| `items[].qty` | number | > 0 |
| `items[].unit` | string | Satu dari satuan yang dikenal; default `pcs` |
| `items[].confidence` | number | 0–1. Di bawah 0,7 ditandai "periksa" |
| `needsClarification` | string[] | Bagian kalimat yang ambigu |

**Error**

| Status | Arti |
| --- | --- |
| 400 | `transcript` kosong |
| 413 | Kalimat lebih dari 2000 karakter |
| 422 | Tidak ada barang yang terbaca |
| 502 | Gagal menghubungi penyedia AI |

---

## `ai-read-receipt`

Menerima foto nota, mengembalikan baris barang dan total.

**Request**

```json
{ "imageBase64": "<base64 tanpa prefix data URL>", "mimeType": "image/jpeg" }
```

`mimeType` harus `image/jpeg`, `image/png`, atau `image/webp`. Batas ukuran
base64: 8 MB.

**Response**

```json
{
  "items": [
    { "name": "Minyak Goreng", "qty": 5, "unit": "liter", "unitPrice": 15000, "confidence": 0.9 }
  ],
  "total": 75000,
  "totalMismatch": false
}
```

| Field | Tipe | Aturan |
| --- | --- | --- |
| `items[].name` | string | Capitalisasi rapi, apa adanya di nota |
| `items[].qty` | number | > 0 |
| `items[].unit` | string | Satuan yang dikenal; default `pcs` |
| `items[].unitPrice` | number | ≥ 0. 0 kalau tidak terbaca — model tidak menebak |
| `items[].confidence` | number | 0–1 |
| `total` | number | Total tertulis di nota; kalau tidak ada, jumlah baris |
| `totalMismatch` | boolean | `true` kalau total tertulis beda jauh dari jumlah baris |

`totalMismatch` penting: pemilik warung harus tahu kalau hasil baca dan
angka di nota tidak cocok, sebelum menyimpan.

**Error**

| Status | Arti |
| --- | --- |
| 400 | `imageBase64` kosong / format gambar tidak didukung |
| 413 | Gambar terlalu besar |
| 422 | Tidak ada baris barang yang terbaca |
| 502 | Gagal menghubungi penyedia AI |

---

## `ai-advise`

Menerima angka yang sudah dihitung aplikasi, mengembalikan saran beralasan.

**Request**

Semua angka sudah dihitung aplikasi. `MingguIni` berarti 7 hari terakhir di
kalender warung (Asia/Jakarta) — bukan omzet hari ini.

```json
{
  "omzetMingguIni": 1850000,
  "labaKotorMingguIni": 650000,
  "stokTipis": [{ "nama": "Beras Premium", "stok": 8, "satuan": "kg" }],
  "saranBeli": [{ "nama": "Gula Pasir", "qty": 5, "satuan": "kg" }]
}
```

**Response**

```json
{
  "tips": [
    {
      "text": "Siapkan stok beras sebelum besok.",
      "reason": "Rata-rata terjual 4 kg/hari; stok tersisa 8 kg."
    }
  ]
}
```

Maksimal 3 tips. Field `text` = tindakan, `reason` = alasan berbasis angka
dari DATA.

**Error**

| Status | Arti |
| --- | --- |
| 400 | Body bukan JSON |
| 502 | Model tidak mengembalikan tips yang bisa dipakai |

---

## `ai-ask`

Menjawab pertanyaan bebas dari catatan warung sendiri. Angka dikirim sebagai
konteks, jadi model hanya menyusun kalimat — tidak pernah menghitung ulang.

**Request**

```json
{
  "question": "Beli apa besok?",
  "context": {
    "omzetHariIni": 238500,
    "labaKotorHariIni": 29900,
    "transaksiHariIni": 3,
    "omzetMingguIni": 1675500,
    "labaKotorMingguIni": 167460,
    "stokTipis": [{ "nama": "Air Mineral", "stok": 61, "satuan": "botol" }],
    "saranBeli": [{ "nama": "Air Mineral", "qty": 19, "satuan": "botol" }],
    "pelangganUtang": [{ "nama": "Pak Yono", "sisa": 198500 }],
    "totalTransaksi": 363,
    "jumlahBaris": 1054
  }
}
```

`MingguIni` berarti 7 hari terakhir di kalender warung (Asia/Jakarta).

**Response**

```json
{
  "answer": "Besok bisa beli Air Mineral 19 botol. Datanya estimasi dari catatan stok tipis."
}
```

**Error**

| Status | Arti |
| --- | --- |
| 400 | `question` kosong atau terlalu panjang |
| 502 | Model tidak mengembalikan jawaban yang bisa dipakai |
