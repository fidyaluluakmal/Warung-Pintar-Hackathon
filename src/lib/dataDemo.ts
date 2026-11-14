/**
 * Data contoh untuk mode demo lokal.
 *
 * Tanpa Supabase, aplikasi masih harus jalan: pemilik warung bisa login
 * dengan nama saja, lalu mencatat penjualan. Kalau datanya kosong, aplikasi
 * jadi tidak bisa dicoba sama sekali — jadi ada katalog kecil dan beberapa
 * transaksi supaya alurnya bisa dijalankan.
 *
 * Datanya sengaja dibuat dari fungsi murni, bukan `random()`, supaya
 * demo lokal selalu sama setiap dibuka.
 */

import type { Alias, BarisTransaksi, Barang, Titip, Transaksi, Utang } from "./types"
import type { DataPelanggan } from "./pelanggan"

export interface DataWarungLokal {
  barang: Barang[]
  alias: Alias[]
  transaksi: Transaksi[]
  baris: BarisTransaksi[]
  utang: Utang[]
  titip: Titip[]
  pelanggan: DataPelanggan[]
}

interface BibitBarang {
  id: string
  nama: string
  satuan: Barang["satuan"]
  stok_awal: number
  min_stok: number
  harga_modal: number
  harga_jual: number
  lead_time_hari: number
  alias: string[]
}

const BIBIT: BibitBarang[] = [
  {
    id: "demo-beras",
    nama: "Beras Premium",
    satuan: "kg",
    stok_awal: 40,
    min_stok: 10,
    harga_modal: 14_000,
    harga_jual: 16_000,
    lead_time_hari: 2,
    alias: ["beras", "beras premium"],
  },
  {
    id: "demo-gula",
    nama: "Gula Pasir",
    satuan: "pcs",
    stok_awal: 30,
    min_stok: 8,
    harga_modal: 17_000,
    harga_jual: 19_000,
    lead_time_hari: 3,
    alias: ["gulpas", "gula"],
  },
  {
    id: "demo-minyak",
    nama: "Minyak Goreng",
    satuan: "liter",
    stok_awal: 24,
    min_stok: 6,
    harga_modal: 15_000,
    harga_jual: 17_000,
    lead_time_hari: 2,
    alias: ["minyak", "minyak goreng"],
  },
  {
    id: "demo-kopi",
    nama: "Kopi Sachet",
    satuan: "sachet",
    stok_awal: 60,
    min_stok: 15,
    harga_modal: 1_200,
    harga_jual: 1_500,
    lead_time_hari: 7,
    alias: ["kopi", "kopi sachet"],
  },
  {
    id: "demo-telur",
    nama: "Telur Ayam",
    satuan: "kg",
    stok_awal: 20,
    min_stok: 5,
    harga_modal: 28_000,
    harga_jual: 32_000,
    lead_time_hari: 1,
    alias: ["telur", "telur ayam"],
  },
  {
    id: "demo-rokok",
    nama: "Rokok Kretek",
    satuan: "bungkus",
    stok_awal: 25,
    min_stok: 10,
    harga_modal: 22_000,
    harga_jual: 25_000,
    lead_time_hari: 5,
    alias: ["rokok", "kretek"],
  },
]

const OWNER = "lokal"

/** Transaksi demo: 10 hari terakhir, tiap hari 1-2 penjualan. */
function transaksiDemo(): { transaksi: Transaksi[]; baris: BarisTransaksi[] } {
  const transaksi: Transaksi[] = []
  const baris: BarisTransaksi[] = []

  const pola: Array<Array<[number, number]>> = [
    [[0, 2]],
    [[0, 1], [4, 3]],
    [[1, 3]],
    [[2, 1], [3, 5]],
    [[0, 2], [5, 2]],
    [[4, 4]],
    [[1, 2], [2, 4]],
    [[0, 1]],
    [[3, 2], [4, 3]],
    [[0, 2], [1, 1]],
  ]

  pola.forEach((isiHari, hariKe) => {
    const tanggal = new Date()
    tanggal.setDate(tanggal.getDate() - (pola.length - 1 - hariKe))
    tanggal.setHours(9, 30, 0, 0)

    isiHari.forEach(([indeksBarang, jumlah], urutanBaris) => {
      const bib = BIBIT[indeksBarang]
      if (!bib) return
      const id = `demo-trx-${hariKe}-${urutanBaris}`
      const total = bib.harga_jual * jumlah
      transaksi.push({
        id,
        owner_id: OWNER,
        tipe: "jual",
        tanggal: tanggal.toISOString(),
        sumber: urutanBaris === 0 ? "suara" : "manual",
        teks_mentah: urutanBaris === 0 ? `terjual ${jumlah} ${bib.satuan} ${bib.nama}` : null,
        total,
        agen: null,
      })
      baris.push({
        id: `${id}-0`,
        transaksi_id: id,
        barang_id: bib.id,
        jumlah,
        satuan: bib.satuan,
        harga_satuan: bib.harga_jual,
      })
    })
  })

  return { transaksi, baris }
}

/** Utang demo: satu pelanggan bayar sebagian. */
function utangDemo(): Utang[] {
  return [
    {
      id: "demo-utang-1",
      owner_id: OWNER,
      pelanggan: "Pak Yono",
      barang_id: "demo-telur",
      qty: 3,
      satuan: "kg",
      harga_satuan: 32_000,
      total: 96_000,
      tanggal: new Date(Date.now() - 4 * 86_400_000).toISOString(),
      status: "belum_lunas",
      dibayar: 20_000,
      lunas_pada: null,
    },
  ]
}

/** Buku pelanggan demo: nama panggilan, nomor telepon opsional. */
function pelangganDemo(): DataPelanggan[] {
  return [
    {
      id: "demo-plg-1",
      owner_id: OWNER,
      nama: "Pak Yono",
      telepon: "0812-3456-7890",
      catatan: "Langganan tetap, beli barang bulanan saja",
    },
    {
      id: "demo-plg-2",
      owner_id: OWNER,
      nama: "Bu Sri",
      telepon: null,
      catatan: "Sering beli kopi sachet",
    },
    {
      id: "demo-plg-3",
      owner_id: OWNER,
      nama: "Mas Togo",
      telepon: null,
      catatan: "Datang sore, suka barang segar",
    },
  ]
}

/**
 * Susun data demo lokal.
 *
 * Semua id dibuat dari pola yang tetap, jadi data lokal selalu sama —
 * tidak ada `random()` yang bikin berbeda tiap dibuka.
 */
export function dataDemoLokal(): DataWarungLokal {
  const barang: Barang[] = BIBIT.map((b) => ({
    id: b.id,
    owner_id: OWNER,
    nama: b.nama,
    satuan: b.satuan,
    stok_awal: b.stok_awal,
    min_stok: b.min_stok,
    harga_modal: b.harga_modal,
    harga_jual: b.harga_jual,
    lead_time_hari: b.lead_time_hari,
  }))

  const alias: Alias[] = BIBIT.flatMap((b) =>
    b.alias.map((nama, index) => ({
      id: `${b.id}-alias-${index}`,
      owner_id: OWNER,
      barang_id: b.id,
      alias: nama,
    })),
  )

  const { transaksi, baris } = transaksiDemo()

  return {
    barang,
    alias,
    transaksi,
    baris,
    utang: utangDemo(),
    titip: [],
    pelanggan: pelangganDemo(),
  }
}
