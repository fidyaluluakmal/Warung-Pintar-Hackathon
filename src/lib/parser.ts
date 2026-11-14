/**
 * Parser lokal untuk kalimat voice.
 *
 * Berjalan 100% di browser, tanpa AI dan tanpa internet. Jadi daftar barang
 * tetap bisa diisi walau AI sedang tidak bisa menjawab atau jaringan putus.
 *
 * Aturan: harga hanya dikenali dari sinyal yang jelas ("14 ribu", "17.000",
 * "1,5 juta"). Angka polos dibaca sebagai jumlah, bukan harga.
 */

import type { Satuan } from "./types"

export interface HasilParse {
  items: Array<{ name: string; qty: number; unit: Satuan; price?: number }>
  debtor: string | null
}

/** Kata pengikut yang menandai sebuah angka adalah harga. */
const PETA_HARGA = new Set(["harga", "jual", "modal", "beli", "rp", "rupiah"])

/** Kata yang menandai jumlah, bukan harga. */
const PETA_JUMLAH = new Set(["terjual", "jual", "terbeli", "beli", "stock", "stok", "sisa"])

const SATUAN_KATA: Record<string, Satuan> = {
  kg: "kg",
  kilogram: "kg",
  kilo: "kg",
  g: "g",
  gram: "g",
  liter: "liter",
  l: "liter",
  ml: "ml",
  pcs: "pcs",
  bungkus: "bungkus",
  sak: "bungkus",
  sachet: "sachet",
  dus: "dus",
  botol: "botol",
  kaleng: "kaleng",
  pouch: "pouch",
  pak: "pak",
  papan: "papan",
  pgn: "papan",
  renteng: "renteng",
  box: "box",
  lusin: "lusin",
  biji: "biji",
}

const STOPWORD = new Set([
  "hari",
  "ini",
  "tadi",
  "baru",
  "kemarin",
  "satu",
  "dua",
  "tiga",
  "empat",
  "lima",
  "enam",
  "tujuh",
  "delapan",
  "sembilan",
  "sepuluh",
  "yang",
  "dan",
  "dengan",
  "untuk",
  "dari",
  "saya",
  "tadi",
  "terjual",
  "terbeli",
  "jual",
  "beli",
  "harga",
  "sudah",
  "sudah",
  "sudah",
  "masih",
])

/**
 * Parse kalimat jadi daftar barang.
 *
 * Dipakai untuk dua hal:
 *  1. Fallback saat AI tidak tersedia.
 *  2. Draft cepat sebelum AI refined: hasilnya selalu bisa diedit.
 */
export function parseKalimat(teks: string): HasilParse {
  const kalimat = teks.toLowerCase().trim()
  if (!kalimat) return { items: [], debtor: null }

  const debtor = cariPeminjam(kalimat)
  const items: HasilParse["items"] = []

  // Potong per koma dan "lalu"/"dan" supaya beberapa barang terpisah.
  // Koma hanya jadi pemisah kalau diikuti spasi atau akhir kalimat: kalau
  // tidak, "1,5 juta" ikut terpotong jadi "1" dan "5 juta".
  const potongan = kalimat
    .split(/[,;](?=\s|$)|\bdan\b|\blalu\b|\btapi\b|\bnanti\b/)
    .map((bagian) => bagian.trim())
    .filter(Boolean)

  for (const bagian of potongan) {
    const item = parsePotongan(bagian)
    if (item) items.push(item)
  }

  return { items, debtor }
}

function parsePotongan(bagian: string): HasilParse["items"][number] | null {
  const kata = bagian.split(/\s+/).filter(Boolean)
  if (kata.length === 0) return null

  let qty: number | undefined
  let price: number | undefined
  let unit: Satuan | undefined
  const namaKata: string[] = []
  let lihatHarga = false
  let lihatJumlah = false

  for (let i = 0; i < kata.length; i += 1) {
    const kataIni = kata[i].replace(/[^a-z0-9]/g, "")
    if (!kataIni) continue

    if (PETA_JUMLAH.has(kataIni)) {
      lihatJumlah = true
      lihatHarga = false
      continue
    }
    if (PETA_HARGA.has(kataIni)) {
      lihatHarga = true
      lihatJumlah = false
      continue
    }

    const satuan = SATUAN_KATA[kataIni]
    if (satuan) {
      unit = satuan
      continue
    }

    // Angka setelah "harga/jual/modal" dibaca sebagai harga, dan kata
    // pengikutnya ("ribu", "juta") ikut dipakai sebagai kelipatan.
    // Token mentah dipakai supaya koma desimalnya tidak hilang.
    if (lihatHarga && !lihatJumlah) {
      const pengikut = kata[i + 1]?.replace(/[^a-z0-9]/g, "") ?? ""
      const pakaiKelipatan = /^(ribu|juta|rb)$/.test(pengikut)
      const teksHarga = pakaiKelipatan ? `${kata[i]} ${pengikut}` : kata[i]
      const harga = parseHarga(teksHarga)
      if (harga !== null) {
        price = harga
        // Habuskan kata pengikut supaya tidak ikut jadi nama barang.
        if (pakaiKelipatan) i += 1
        lihatHarga = false
        continue
      }
    }

    const angka = parseAngkaIndo(kata[i])
    if (angka !== null) {
      // Angka polos tanpa penanda harga = jumlah.
      qty = angka
      continue
    }

    if (!STOPWORD.has(kataIni)) namaKata.push(kataIni)
  }

  const nama = namaKata.join(" ").trim()
  if (!nama) return null
  if (qty === undefined && price === undefined) return null

  // "3 kg" tanpa nama tidak masuk katalog, jadi lewati.
  if (qty === undefined) qty = 1

  const hasil: HasilParse["items"][number] = {
    name: nama,
    qty,
    unit: unit ?? "pcs",
  }
  if (price !== undefined) hasil.price = price
  return hasil
}

/**
 * Parse angka dengan aturan pemisah ribuan/desimal ala Indonesia.
 *
 * Titik sebagai pemisah ribuan kalau diikuti tepat 3 digit dan tidak ada koma
 * ("17.000" = 17000). Kalau tidak, titik itu desimal ("3.5" = 3,5).
 * Koma selalu desimal ("1,5" = 1,5).
 */
export function parseAngkaIndo(teks: string): number | null {
  const cocok = /(\d+(?:[.,]\d+)?)/.exec(teks)
  if (!cocok) return null

  const angka = cocok[1]
  const pakaiTitikRibuan = !angka.includes(",") && /\.\d{3}$/.test(angka)
  const normalisasi = pakaiTitikRibuan ? angka.replace(/\./g, "") : angka.replace(",", ".")

  const nilai = Number(normalisasi)
  return Number.isFinite(nilai) ? nilai : null
}

/**
 * Parse harga dalam bentuk kata: "14 ribu", "1,5 juta", "17.000".
 *
 * Angka polos tanpa kata "ribu/juta" TIDAK dianggap harga di sini -
 * pemanggil yang memutuskan, supaya "3 kg" tidak jadi harga 3.
 */
export function parseHarga(kata: string): number | null {
  const bersih = kata.toLowerCase().replace(/rp\.?/g, "").trim()
  const angka = parseAngkaIndo(bersih)
  if (angka === null) return null

  if (/juta/.test(bersih)) return angka * 1_000_000
  if (/ribu|rb\b/.test(bersih)) return angka * 1_000
  return angka
}

/** Cari nama peminjam dari pola "untuk pak yono", "kredit pak andi". */
export function cariPeminjam(kalimat: string): string | null {
  const pola = /(?:untuk|kredit|pinjam|ngutang)\s+((?:pak|bu|mas|mba|bpk)\s+\w+)/i
  const cocok = kalimat.match(pola)
  if (!cocok) return null
  return cocok[1]
    .split(" ")
    .map((kata) => kata[0].toUpperCase() + kata.slice(1))
    .join(" ")
}
