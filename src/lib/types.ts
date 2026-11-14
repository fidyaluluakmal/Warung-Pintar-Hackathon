/**
 * Kontrak data aplikasi.
 *
 * Satu tempat supaya frontend, Edge Function, dan SQL tidak berbeda bendanya.
 * Field yang dipakai AI selalu angka: bukan teks bebas.
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

/** Utang pelanggan dari penjualan "simpen dulu". */
export interface Utang {
  id: string
  owner_id: string
  pelanggan: string
  barang_id: string
  qty: number
  satuan: Satuan
  harga_satuan: number
  total: number
  tanggal: string
  status: "belum_lunas" | "lunas"
  dibayar: number
  lunas_pada: string | null
}

/** Utang yang masih berjalan, dengan sisa yang harus dibayar. */
export interface UtangBerjalan extends Utang {
  nama_barang: string
  sisa: number
}

/** Margin per barang, dari view `margin_barang`. */
export interface MarginBarang {
  barang_id: string
  owner_id: string
  nama: string
  satuan: Satuan
  harga_jual: number
  harga_modal: number
  modal_sebelumnya: number
  margin_persen: number
}

/** Satu baris riwayat harga modal. */
export interface HargaModalRiwayat {
  id: string
  owner_id: string
  barang_id: string
  harga_modal: number
  tanggal: string
}

/**
 * Barang titipan (konsinyasi).
 *
 * Barang milik orang lain yang dijual warung. Tidak masuk stok warung -
 * yang dihitung cuma komisi warung dan bagian untuk pemilik barang.
 */
export interface Titip {
  id: string
  owner_id: string
  /** Nama yang menitipkan barang. */
  pemilik: string
  nama_barang: string
  satuan: Satuan
  /** Berapa yang dititipkan. */
  qty: number
  /** Berapa yang sudah laku. */
  terjual: number
  /** Harga dari pemilik barang (informasi). */
  harga_pemilik: number
  /** Harga jual ke pelanggan. */
  harga_jual: number
  /** Komisi warung dalam persen dari omzet. */
  komisi_persen: number
  status: "aktif" | "selesai"
  catatan: string | null
  dibuat_pada: string
  selesai_pada: string | null
}

/** Proyek asisten: kelompok percakapan dengan instruksi bersama. */
export interface Proyek {
  id: string
  owner_id: string
  nama: string
  /** Instruksi yang berlaku untuk semua pertanyaan di proyek ini. */
  instruksi: string | null
  dibuat_pada: string
}

/** Satu percakapan dengan asisten warung. */
export interface SesiAsisten {
  id: string
  owner_id: string
  judul: string
  /** Proyek tempat sesi ini tinggal. Null = tanpa proyek. */
  proyek_id: string | null
  dibuat_pada: string
  diperbarui_pada: string
}

/** Satu pesan dalam percakapan. */
export interface PesanAsisten {
  id: string
  owner_id: string
  sesi_id: string
  role: "user" | "assistant"
  teks: string
  dibuat_pada: string
}
