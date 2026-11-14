/**
 * Kontrak data aplikasi.
 *
 * Satu tempat supaya frontend, Edge Function, dan SQL tidak berbeda bendanya.
 * Field yang dipakai AI selalu angka — bukan teks bebas.
 */

/** Satuan yang dipakai di seluruh aplikasi. */
export type Satuan =
  | "kg"
  | "g"
  | "liter"
  | "ml"
  | "pcs"
  | "bungkus"
  | "sachet"
  | "dus"
  | "botol"
  | "kaleng"
  | "pouch"
  | "pak"
  | "papan"
  | "renteng"
  | "box"
  | "lusin"
  | "biji"

export const SATUAN_TERSEDIA: Satuan[] = [
  "kg",
  "g",
  "liter",
  "ml",
  "pcs",
  "bungkus",
  "sachet",
  "dus",
  "botol",
  "kaleng",
  "pouch",
  "pak",
  "papan",
  "renteng",
  "box",
  "lusin",
]

export interface Barang {
  id: string
  owner_id: string
  nama: string
  satuan: Satuan
  stok_awal: number
  min_stok: number
  harga_modal: number
  harga_jual: number
  lead_time_hari: number
}

export interface Alias {
  id: string
  barang_id: string
  alias: string
}

export type TipeTransaksi = "jual" | "beli" | "sesuaikan"
export type SumberTransaksi = "suara" | "nota" | "manual"

export interface Transaksi {
  id: string
  owner_id: string
  tipe: TipeTransaksi
  tanggal: string
  sumber: SumberTransaksi
  teks_mentah: string | null
  total: number
  agen: string | null
}

export interface BarisTransaksi {
  id: string
  transaksi_id: string
  barang_id: string
  jumlah: number
  satuan: Satuan
  harga_satuan: number
}

/** Baris stok dari view `stok_barang`. */
export interface StokBarang {
  barang_id: string
  owner_id: string
  nama: string
  satuan: Satuan
  min_stok: number
  harga_modal: number
  harga_jual: number
  lead_time_hari: number
  stok_awal: number
  stok: number
}

/** Hasil ekstraksi AI dari kalimat suara. */
export interface ItemTerEkstrak {
  name: string
  qty: number
  unit: Satuan
  confidence: number
}

/** Hasil pembacaan AI dari foto nota. */
export interface ItemNota {
  name: string
  qty: number
  unit: Satuan
  unitPrice: number
  confidence: number
}

export interface TipsAi {
  text: string
  reason: string
}

/** Saran beli: hasil hitungan kode, bukan tebakan AI. */
export interface SaranBeli {
  barangId: string
  nama: string
  satuan: Satuan
  qty: number
  alasan: string
}
