import { describe, expect, it } from "vitest"
import { bagiPembayaran } from "./margin"
import { hitungSaranBeli, perluRestok, round2 } from "./inventory"
import { labelKunjungan } from "./pelanggan"
import type { BarisTransaksi, StokBarang, Transaksi } from "./types"

const HARI_INI = new Date("2026-11-14T00:00:00Z")

function stokBarang(barang: Partial<StokBarang> = {}): StokBarang {
  return {
    barang_id: "barang-1",
    owner_id: "owner-1",
    nama: "Beras",
    satuan: "kg",
    min_stok: 5,
    harga_modal: 14_000,
    harga_jual: 16_000,
    lead_time_hari: 2,
    stok_awal: 0,
    stok: 0,
    ...barang,
  }
}

function jual(id: string, tanggal: string, qty: number): [Transaksi, BarisTransaksi] {
  return [
    {
      id,
      owner_id: "owner-1",
      tipe: "jual",
      tanggal,
      sumber: "suara",
      teks_mentah: null,
      total: qty * 16_000,
      agen: null,
    },
    {
      id: `b-${id}`,
      transaksi_id: id,
      barang_id: "barang-1",
      jumlah: qty,
      satuan: "kg",
      harga_satuan: 16_000,
    },
  ]
}

describe("jendela 30 hari mesin restok", () => {
  it("penjualan di luar 30 hari tidak ikut dihitung", () => {
    // 90 kg terjual 60 hari lalu, 30 kg terjual 10 hari lalu.
    // Kalau 90 kg ikut dihitung, lajunya (120/30) = 4 kg/hari.
    // Yang benar: 30 kg dalam 10 hari = 3 kg/hari.
    const lama = jual("t-lama", "2026-09-15T02:00:00Z", 90)
    const baru = jual("t-baru", "2026-11-04T02:00:00Z", 30)

    const hasil = hitungSaranBeli(
      [stokBarang({ stok: 0, min_stok: 0, lead_time_hari: 0 })],
      [lama[1], baru[1]],
      [lama[0], baru[0]],
      HARI_INI,
    )

    // 30 kg dalam jendela 30 hari = 1 kg/hari, target 1 x (0 + 3) = 3 kg.
    // Kalau 90 kg ikut dihitung, lajunya 4 kg/hari dan sarannya 12 kg.
    expect(hasil[0].qty).toBe(3)
  })

  it("barang yang tidak laku dalam 30 hari tidak disarankan", () => {
    const lama = jual("t-lama", "2026-06-01T02:00:00Z", 50)
    const hasil = hitungSaranBeli(
      [stokBarang({ stok: 0, min_stok: 0 })],
      [lama[1]],
      [lama[0]],
      HARI_INI,
    )
    expect(hasil).toHaveLength(0)
  })

  it("alasan menyebut laju harian sesuai jendela 30 hari", () => {
    const hasil = hitungSaranBeli(
      [stokBarang({ stok: 0, min_stok: 0, lead_time_hari: 0 })],
      [jual("t", "2026-11-10T02:00:00Z", 10)[1]],
      [jual("t", "2026-11-10T02:00:00Z", 10)[0]],
      HARI_INI,
    )
    // 10 kg dalam 5 hari aktif = 2 kg/hari
    expect(hasil[0].alasan).toContain("2 kg/hari")
  })
})

describe("perluRestok", () => {
  it("mengambil barang yang punya saran beli dari mesin", () => {
    // Stok 8 (di atas minimum 5) tapi targetnya 25: mesin tetap
    // menyarankan. Layar lama memakai aturan sendiri ("stok <= minimum")
    // dan akan bilang "Aman" untuk barang yang sama.
    const hasil = hitungSaranBeli(
      [stokBarang({ stok: 8, min_stok: 5, lead_time_hari: 2 })],
      [jual("t", "2026-11-10T02:00:00Z", 25)[1]],
      [jual("t", "2026-11-10T02:00:00Z", 25)[0]],
      HARI_INI,
    )
    expect(hasil).toHaveLength(1)
    const perlu = perluRestok(hasil)
    expect(perlu.has("barang-1")).toBe(true)
  })

  it("barang dengan stok cukup tidak masuk daftar", () => {
    const perlu = perluRestok([])
    expect(perlu.size).toBe(0)
  })
})

describe("bagiPembayaran", () => {
  it("baris untuk barang yang sama tetap terpisah", () => {
    const hasil = bagiPembayaran(
      [
        { barangId: "b1", qty: 2, satuan: "kg", hargaSatuan: 10_000 },
        { barangId: "b1", qty: 1, satuan: "kg", hargaSatuan: 10_000 },
      ],
      25_000,
    )
    expect(hasil.perBaris).toHaveLength(2)
    expect(hasil.perBaris[0].index).toBe(0)
    expect(hasil.perBaris[1].index).toBe(1)
    expect(hasil.perBaris[0].utang).toBe(0)
    expect(hasil.perBaris[1].utang).toBe(5_000)
  })
})

describe("labelKunjungan", () => {
  it("pelanggan yang sudah lama tidak datang disebut jarang datang", () => {
    // Dulu datang sering, tapi sudah 6 bulan tidak mampir.
    expect(labelKunjungan(10, "2026-05-01", HARI_INI)).toBe("Jarang datang")
  })

  it("pelanggan yang rutin dan baru datang disebut rutin datang", () => {
    expect(labelKunjungan(6, "2026-11-10", HARI_INI)).toBe("Rutin datang")
  })
})

describe("round2", () => {
  it("menghindarkan galat floating point", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })
})
