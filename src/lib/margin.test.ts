import { describe, expect, it } from "vitest"
import {
  bagiPembayaran,
  bulatkanHarga,
  cariSinyalMargin,
  hargaJualUntukMargin,
  marginPersen,
  MARGIN_TARGET,
} from "./margin"
import type { MarginBarang } from "./types"

function barang(barang: Partial<MarginBarang> = {}): MarginBarang {
  return {
    barang_id: "b1",
    owner_id: "o1",
    nama: "Telur Ayam",
    satuan: "kg",
    harga_jual: 32000,
    harga_modal: 28000,
    modal_sebelumnya: 28000,
    margin_persen: 12.5,
    ...barang,
  }
}

describe("bulatkanHarga", () => {
  it("membulatkan ke atas ke kelipatan 100", () => {
    expect(bulatkanHarga(15_400)).toBe(15_400)
    expect(bulatkanHarga(15_401)).toBe(15_500)
    expect(bulatkanHarga(15_450)).toBe(15_500)
  })

  it("mengembalikan 0 untuk harga tidak valid", () => {
    expect(bulatkanHarga(0)).toBe(0)
    expect(bulatkanHarga(-100)).toBe(0)
  })
})

describe("marginPersen", () => {
  it("menghitung margin dari harga jual dan modal", () => {
    expect(marginPersen(20_000, 16_000)).toBe(20)
    expect(marginPersen(32_000, 28_000)).toBe(12.5)
  })

  it("mengembalikan 0 bukan NaN saat harga jual nol", () => {
    expect(marginPersen(0, 10_000)).toBe(0)
  })
})

describe("hargaJualUntukMargin", () => {
  it("mempertahankan margin target", () => {
    const harga = hargaJualUntukMargin(28_000, MARGIN_TARGET)
    // Harga dibulatkan ke atas, jadi margin jadi sedikit di atas target.
    expect(marginPersen(harga, 28_000)).toBeGreaterThanOrEqual(MARGIN_TARGET)
  })

  it("membatasi margin target supaya tidak membagi nol", () => {
    expect(hargaJualUntukMargin(10_000, 100)).toBe(200_000)
  })
})

describe("cariSinyalMargin", () => {
  it("mendeteksi modal naik yang menyusutkan margin", () => {
    const hasil = cariSinyalMargin([
      barang({ harga_modal: 28_000, modal_sebelumnya: 26_000, harga_jual: 32_000 }),
    ])
    expect(hasil).toHaveLength(1)
    expect(hasil[0].kenaikanModalPersen).toBe(7.69)
    expect(hasil[0].marginSekarang).toBe(12.5)
    expect(hasil[0].marginSebelumnya).toBe(18.75)
    expect(hasil[0].hargaJualSaran).toBeGreaterThan(32_000)
  })

  it("mengabaikan barang yang modalnya tidak berubah", () => {
    const hasil = cariSinyalMargin([barang({ harga_modal: 28_000, modal_sebelumnya: 28_000 })])
    expect(hasil).toHaveLength(0)
  })

  it("mengabaikan barang tanpa riwayat harga modal", () => {
    const hasil = cariSinyalMargin([barang({ modal_sebelumnya: 0 })])
    expect(hasil).toHaveLength(0)
  })

  it("mengurutkan kenaikan modal terbesar di atas", () => {
    const hasil = cariSinyalMargin([
      barang({ barang_id: "kecil", harga_modal: 10_000, modal_sebelumnya: 9_800 }),
      barang({ barang_id: "besar", harga_modal: 30_000, modal_sebelumnya: 25_000 }),
    ])
    expect(hasil[0].barangId).toBe("besar")
  })

  it("menghitung margin sebelumnya memakai harga jual yang sekarang", () => {
    // Margin "sebelumnya" = margin kalau modalnya tidak naik, dengan harga
    // jual yang sama. Ini mengisolasi efek kenaikan modal saja.
    // Modal 26000 -> 28000, harga jual tetap 32000.
    //   sebelumnya: (32000-26000)/32000 = 18,75%
    //   sekarang:  (32000-28000)/32000 = 12,5%
    const hasil = cariSinyalMargin([
      barang({ harga_modal: 28_000, modal_sebelumnya: 26_000, harga_jual: 32_000 }),
    ])
    expect(hasil).toHaveLength(1)
    expect(hasil[0].marginSebelumnya).toBe(18.75)
    expect(hasil[0].marginSekarang).toBe(12.5)
  })
})

describe("bagiPembayaran", () => {
  it("membayar penuh kalau uang cukup", () => {
    const hasil = bagiPembayaran(
      [
        { barangId: "b1", qty: 2, satuan: "pcs", hargaSatuan: 10_000 },
        { barangId: "b2", qty: 1, satuan: "pcs", hargaSatuan: 5_000 },
      ],
      25_000,
    )
    expect(hasil.dibayar).toBe(25_000)
    expect(hasil.utang).toBe(0)
  })

  it("membagi sebagian dan sisa jadi utang", () => {
    const hasil = bagiPembayaran(
      [
        { barangId: "b1", qty: 1, satuan: "pcs", hargaSatuan: 10_000 },
        { barangId: "b2", qty: 1, satuan: "pcs", hargaSatuan: 5_000 },
      ],
      10_000,
    )
    expect(hasil.dibayar).toBe(10_000)
    expect(hasil.utang).toBe(5_000)
    // Barang pertama lunas, barang kedua jadi utang.
    expect(hasil.perBaris[0].utang).toBe(0)
    expect(hasil.perBaris[1].utang).toBe(5_000)
  })

  it("memotong sebagian satu barang kalau uangnya tidak cukup", () => {
    const hasil = bagiPembayaran(
      [{ barangId: "b1", qty: 2, satuan: "pcs", hargaSatuan: 10_000 }],
      5_000,
    )
    expect(hasil.dibayar).toBe(5_000)
    expect(hasil.utang).toBe(15_000)
    expect(hasil.perBaris[0].dibayar).toBe(5_000)
  })

  it("baris untuk barang yang sama tetap terpisah", () => {
    // Satu kalimat bisa menyebut barang yang sama dua kali: "2 beras dan 1 beras".
    // Dua baris itu harus dihitung terpisah, bukan digabung.
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
    // Baris pertama lunas, baris kedua jadi utang.
    expect(hasil.perBaris[0].utang).toBe(0)
    expect(hasil.perBaris[1].utang).toBe(5_000)
  })

  it("tidak pernah bayar melebihi total", () => {
    const hasil = bagiPembayaran(
      [{ barangId: "b1", qty: 1, satuan: "pcs", hargaSatuan: 10_000 }],
      999_999,
    )
    expect(hasil.dibayar).toBe(10_000)
    expect(hasil.utang).toBe(0)
  })

  it("uang negatif dianggap nol", () => {
    const hasil = bagiPembayaran(
      [{ barangId: "b1", qty: 1, satuan: "pcs", hargaSatuan: 10_000 }],
      -5_000,
    )
    expect(hasil.dibayar).toBe(0)
    expect(hasil.utang).toBe(10_000)
  })
})
