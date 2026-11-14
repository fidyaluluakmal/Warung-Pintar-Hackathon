import { describe, expect, it } from "vitest"
import { hitungStok, hitungSaranBeli, labaKotor, round2 } from "./inventory"
import type { BarisTransaksi, StokBarang, Transaksi } from "./types"

function transaksi(id: string, tipe: Transaksi["tipe"], tanggal: string): Transaksi {
  return {
    id,
    owner_id: "owner-1",
    tipe,
    tanggal,
    sumber: "manual",
    teks_mentah: null,
    total: 0,
    agen: null,
  }
}

function baris(
  id: string,
  transaksi_id: string,
  jumlah: number,
  harga_satuan = 10000,
): BarisTransaksi {
  return {
    id,
    transaksi_id,
    barang_id: "barang-1",
    jumlah,
    satuan: "pcs",
    harga_satuan,
  }
}

describe("hitungStok", () => {
  it("menghitung stok awal + masuk - keluar", () => {
    const tipe = new Map<string, Transaksi["tipe"]>([
      ["t1", "beli"],
      ["t2", "jual"],
    ])
    const hasil = hitungStok(
      10,
      [baris("b1", "t1", 20), baris("b2", "t2", 5)],
      tipe,
    )
    expect(hasil).toBe(25)
  })

  it("sesuaikan menambah kalau positif dan mengurangi kalau negatif", () => {
    const tipe = new Map<string, Transaksi["tipe"]>([["t1", "sesuaikan"]])
    expect(hitungStok(10, [baris("b1", "t1", 4)], tipe)).toBe(14)
    expect(hitungStok(10, [baris("b1", "t1", -4)], tipe)).toBe(6)
  })

  it("baris tanpa tipe diabaikan", () => {
    expect(hitungStok(10, [baris("b1", "tidak-ada", 99)], new Map())).toBe(10)
  })
})

describe("hitungSaranBeli", () => {
  const hariIni = new Date("2026-11-14T00:00:00Z")

  function stokBarang(barang: Partial<StokBarang> = {}): StokBarang {
    return {
      barang_id: "barang-1",
      owner_id: "owner-1",
      nama: "Beras",
      satuan: "kg",
      min_stok: 5,
      harga_modal: 14000,
      harga_jual: 16000,
      lead_time_hari: 2,
      stok_awal: 0,
      stok: 0,
      ...barang,
    }
  }

  it("tidak menyarankan beli kalau stok masih di atas target", () => {
    const hasil = hitungSaranBeli(
      [stokBarang({ stok: 1000 })],
      [baris("b1", "t1", 5)],
      [transaksi("t1", "jual", "2026-11-10")],
      hariIni,
    )
    expect(hasil).toHaveLength(0)
  })

  it("menghitung saran dari laju jual dan lead time", () => {
    // 10 kg terjual dalam 5 hari aktif = 2 kg/hari. Lead time 2 hari.
    // Target = 2 x (2 + 3) = 10 kg. Stok 0, min_stok 5 -> saran 10 kg.
    const hasil = hitungSaranBeli(
      [stokBarang({ stok: 0, min_stok: 5, lead_time_hari: 2 })],
      [baris("b1", "t1", 10)],
      [transaksi("t1", "jual", "2026-11-10")],
      hariIni,
    )
    expect(hasil).toHaveLength(1)
    expect(hasil[0].qty).toBe(10)
    expect(hasil[0].nama).toBe("Beras")
  })

  it("hari aktif dibatasi 30 hari, bukan pembagi tetap", () => {
    // 300 kg terjual. Kalau dibagi 30 -> 10 kg/hari. Kalau hari aktif 10 ->
    // 30 kg/hari, jadi saran lebih besar.
    const hasil = hitungSaranBeli(
      [stokBarang({ stok: 0, min_stok: 0, lead_time_hari: 0 })],
      [baris("b1", "t1", 300)],
      [transaksi("t1", "jual", "2026-11-05")],
      new Date("2026-11-14T00:00:00Z"),
    )
    // 10 hari aktif: 30 kg/hari x 3 = 90 kg.
    expect(hasil[0].qty).toBe(90)
  })

  it("barang yang belum pernah terjual tidak ikut disarakankan", () => {
    const hasil = hitungSaranBeli(
      [stokBarang({ stok: 0 })],
      [],
      [],
      hariIni,
    )
    expect(hasil).toHaveLength(0)
  })

  it("faktor musim menaikkan kebutuhan", () => {
    const tanpaMusim = hitungSaranBeli(
      [stokBarang({ stok: 0, min_stok: 0, lead_time_hari: 0 })],
      [baris("b1", "t1", 10)],
      [transaksi("t1", "jual", "2026-11-10")],
      hariIni,
    )
    const denganMusim = hitungSaranBeli(
      [stokBarang({ stok: 0, min_stok: 0, lead_time_hari: 0 })],
      [baris("b1", "t1", 10)],
      [transaksi("t1", "jual", "2026-11-10")],
      hariIni,
      { "barang-1": 2 },
    )
    expect(tanpaMusim[0].qty).toBe(6)
    expect(denganMusim[0].qty).toBe(12)
  })

  it("barang di bawah minimum tetap disarakankan walau target lebih kecil", () => {
    const hasil = hitungSaranBeli(
      [stokBarang({ stok: 2, min_stok: 8, lead_time_hari: 0 })],
      [baris("b1", "t1", 1)],
      [transaksi("t1", "jual", "2026-11-10")],
      hariIni,
    )
    // Target kecil (1 x 3 = 3) tapi min_stok 8 jadi saran 6 kg.
    expect(hasil[0].qty).toBe(6)
  })
})

describe("labaKotor", () => {
  it("penjualan dikurangi modal barang terjual", () => {
    expect(labaKotor(1_000_000, 600_000)).toBe(400_000)
  })

  it("boleh negatif kalau barang laku tapi modal naik", () => {
    expect(labaKotor(500_000, 700_000)).toBe(-200_000)
  })
})

describe("round2", () => {
  it("menghindarkan galat floating point", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })
})
