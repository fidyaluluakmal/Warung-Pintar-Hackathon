// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { bacaModalAwal, simpanModalAwal, susunLaporanModal } from "./capital"
import type { BarisTransaksi, Barang, Transaksi, UtangBerjalan } from "./types"

const barang: Barang[] = [
  {
    id: "b1",
    owner_id: "o1",
    nama: "Beras Premium",
    satuan: "kg",
    stok_awal: 100,
    min_stok: 10,
    harga_modal: 14_000,
    harga_jual: 16_000,
    lead_time_hari: 2,
  },
]

const transaksi: Transaksi[] = [
  {
    id: "t1",
    owner_id: "o1",
    tipe: "jual",
    tanggal: "2026-11-10T02:00:00Z",
    sumber: "suara",
    teks_mentah: null,
    total: 160_000,
    agen: null,
  },
]

const baris: BarisTransaksi[] = [
  {
    id: "br1",
    transaksi_id: "t1",
    barang_id: "b1",
    jumlah: 10,
    satuan: "kg",
    harga_satuan: 16_000,
  },
]

const utang: UtangBerjalan[] = [
  {
    id: "u1",
    owner_id: "o1",
    pelanggan: "Pak Yono",
    barang_id: "b1",
    nama_barang: "Beras Premium",
    qty: 5,
    satuan: "kg",
    harga_satuan: 16_000,
    total: 80_000,
    dibayar: 0,
    tanggal: "2026-11-09T02:00:00Z",
    status: "belum_lunas",
    lunas_pada: null,
    sisa: 80_000,
  },
]

describe("susunLaporanModal", () => {
  it("menghitung nilai stok, laba kotor, dan piutang", () => {
    const laporan = susunLaporanModal(
      { amount: 1_000_000, since: "2026-11-01" },
      barang,
      transaksi,
      baris,
      [],
    )
    // Stok: 100 kg x 14.000 = 1.400.000
    expect(laporan.stockValue).toBe(1_400_000)
    // Laba kotor: (16.000 - 14.000) x 10 = 20.000
    expect(laporan.grossProfit).toBe(20_000)
    expect(laporan.openDebt).toBe(0)
    expect(laporan.estimatedNow).toBe(1_420_000)
  })

  it("menghitung piutang dari utang yang belum lunas", () => {
    const laporan = susunLaporanModal(
      { amount: 1_000_000, since: "2026-11-01" },
      barang,
      transaksi,
      baris,
      utang,
    )
    expect(laporan.openDebt).toBe(80_000)
    expect(laporan.estimatedNow).toBe(1_500_000)
  })

  it("menyatakan modal bertambah kalau posisi sekarang lebih besar", () => {
    const laporan = susunLaporanModal(
      { amount: 1_000_000, since: "2026-11-01" },
      barang,
      transaksi,
      baris,
      [],
    )
    expect(laporan.verdict).toBe("naik")
    expect(laporan.change).toBe(420_000)
    expect(laporan.message).toContain("bertambah")
  })

  it("menyatakan modal berkurang kalau posisi sekarang lebih kecil", () => {
    const laporan = susunLaporanModal(
      { amount: 5_000_000, since: "2026-11-01" },
      barang,
      transaksi,
      baris,
      [],
    )
    expect(laporan.verdict).toBe("turun")
    expect(laporan.message).toContain("berkurang")
    expect(laporan.message).toContain("barang hilang")
  })

  it("tidak menghitung penjualan sebelum tanggal modal awal", () => {
    const laporan = susunLaporanModal(
      { amount: 1_000_000, since: "2026-12-01" },
      barang,
      transaksi,
      baris,
      [],
    )
    expect(laporan.grossProfit).toBe(0)
  })
})

describe("modal awal di localStorage", () => {
  it("menyimpan dan membaca kembali", () => {
    simpanModalAwal({ amount: 5_000_000, since: "2026-11-01" })
    expect(bacaModalAwal()).toEqual({ amount: 5_000_000, since: "2026-11-01" })
  })

  it("mengembalikan null kalau belum diisi", () => {
    simpanModalAwal(null)
    expect(bacaModalAwal()).toBeNull()
  })

  it("mengabaikan nilai yang tidak valid", () => {
    simpanModalAwal({ amount: 0, since: "2026-11-01" })
    expect(bacaModalAwal()).toBeNull()
    simpanModalAwal(null)
  })
})
