import { describe, expect, it } from "vitest"
import {
  bandingkanHargaPasar,
  hariLewat,
  hitungRingkasan,
  labelKesegaran,
  pilihHargaPasar,
  saranHargaJual,
  type BarangPasar,
  type CatatanHargaPasar,
} from "./hargaPasar"
import { MARGIN_TARGET, marginPersen } from "./margin"

/** "Sekarang" yang tetap: 14 November 2026, pukul 09.00 WIB. */
const SEKARANG = new Date("2026-11-14T09:00:00+07:00")

function barang(partial: Partial<BarangPasar> = {}): BarangPasar {
  return {
    id: "b1",
    nama: "Beras Premium",
    satuan: "kg",
    hargaModal: 14_000,
    hargaJual: 16_500,
    ...partial,
  }
}

function catatan(partial: Partial<CatatanHargaPasar> = {}): CatatanHargaPasar {
  return {
    id: "c1",
    barangId: "b1",
    harga: 15_000,
    tempat: "Agen Makmur",
    tanggal: "2026-11-10T00:00:00+07:00",
    ...partial,
  }
}

describe("bandingkanHargaPasar", () => {
  it("memisahkan harga termurah dari rata-rata", () => {
    const hasil = bandingkanHargaPasar(
      barang(),
      [
        catatan({ id: "c1", harga: 15_000 }),
        catatan({ id: "c2", harga: 13_000 }),
        catatan({ id: "c3", harga: 14_000 }),
      ],
      SEKARANG,
    )

    expect(hasil.jumlahCatatan).toBe(3)
    expect(hasil.hargaTermurah).toBe(13_000)
    expect(hasil.hargaRataRata).toBe(14_000)
  })

  it("beri selisih positif kalau harga di luar lebih murah", () => {
    const hasil = bandingkanHargaPasar(
      barang({ hargaModal: 14_000 }),
      [catatan({ harga: 13_000 })],
      SEKARANG,
    )

    // (14000 - 13000) / 14000 = 7,14%
    expect(hasil.selisihPersen).toBeCloseTo(7.14, 2)
    expect(hasil.selisihPersen).toBeGreaterThan(0)
  })

  it("beri selisih negatif kalau harga di luar lebih mahal", () => {
    const hasil = bandingkanHargaPasar(
      barang({ hargaModal: 14_000 }),
      [catatan({ harga: 15_000 })],
      SEKARANG,
    )

    // (14000 - 15000) / 14000 = -7,14%
    expect(hasil.selisihPersen).toBeCloseTo(-7.14, 2)
    expect(hasil.selisihPersen).toBeLessThan(0)
  })

  it("selisih nol kalau harganya sama persis", () => {
    const hasil = bandingkanHargaPasar(
      barang({ hargaModal: 14_000 }),
      [catatan({ harga: 14_000 })],
      SEKARANG,
    )

    expect(hasil.selisihPersen).toBe(0)
  })

  it("memakai catatan paling baru untuk ditampilkan", () => {
    const hasil = bandingkanHargaPasar(
      barang(),
      [
        catatan({ id: "lama", harga: 16_000, tanggal: "2026-11-01T00:00:00+07:00" }),
        catatan({ id: "baru", harga: 15_000, tanggal: "2026-11-12T00:00:00+07:00" }),
      ],
      SEKARANG,
    )

    expect(hasil.catatanTerpakai?.id).toBe("baru")
    expect(hasil.umurHari).toBe(2)
  })

  it("barang tanpa catatan tidak dianggap hemat", () => {
    const hasil = bandingkanHargaPasar(barang(), [], SEKARANG)

    expect(hasil.jumlahCatatan).toBe(0)
    expect(hasil.hargaTermurah).toBe(0)
    expect(hasil.selisihPersen).toBe(0)
  })
})

describe("pilihHargaPasar", () => {
  it("memilih catatan paling baru", () => {
    const dipilih = pilihHargaPasar([
      catatan({ id: "lama", tanggal: "2026-11-01T00:00:00+07:00" }),
      catatan({ id: "baru", tanggal: "2026-11-12T00:00:00+07:00" }),
      catatan({ id: "tengah", tanggal: "2026-11-07T00:00:00+07:00" }),
    ])

    expect(dipilih?.id).toBe("baru")
  })

  it("kalau tanggal sama, pilih yang termurah", () => {
    const dipilih = pilihHargaPasar([
      catatan({ id: "mahal", harga: 15_500, tanggal: "2026-11-12T00:00:00+07:00" }),
      catatan({ id: "murah", harga: 14_500, tanggal: "2026-11-12T00:00:00+07:00" }),
    ])

    expect(dipilih?.id).toBe("murah")
  })

  it("kembalikan null kalau tidak ada catatan", () => {
    expect(pilihHargaPasar([])).toBeNull()
  })
})

describe("saranHargaJual", () => {
  it("harga jualnya menjaga margin target", () => {
    const saran = saranHargaJual(14_000, 15_000)

    expect(saran.hargaJual).toBeGreaterThan(0)
    expect(marginPersen(saran.hargaJual, 14_000)).toBeGreaterThanOrEqual(MARGIN_TARGET)
    expect(saran.marginPersen).toBeGreaterThanOrEqual(MARGIN_TARGET)
  })

  it("bilang modal kamu lebih murah kalau modalnya di bawah harga luar", () => {
    const saran = saranHargaJual(14_000, 15_000)

    expect(saran.verdict).toBe("modal kamu lebih murah")
    expect(saran.alasan).toContain("14.000")
    expect(saran.alasan).toContain("15.000")
  })

  it("bilang di luar lebih murah kalau harga luarnya di bawah modal", () => {
    const saran = saranHargaJual(14_000, 13_000)

    expect(saran.verdict).toBe("di luar lebih murah")
    // Kalau Belanja di luar, harga jualnya boleh lebih rendah.
    expect(saran.hargaJualBeliDiLuar).toBeLessThan(saran.hargaJual)
  })

  it("bilang 'sepat' kalau harganya hampir sama", () => {
    const saran = saranHargaJual(14_000, 14_100)

    expect(saran.verdict).toBe("sepat")
  })

  it("harga jual mengikuti margin target yang diminta", () => {
    const saran = saranHargaJual(10_000, 11_000, 20)

    expect(marginPersen(saran.hargaJual, 10_000)).toBeGreaterThanOrEqual(20)
  })
})

describe("hariLewat", () => {
  it("menghitung selisih hari menurut zona waktu warung", () => {
    expect(hariLewat("2026-11-14T08:00:00+07:00", SEKARANG)).toBe(0)
    expect(hariLewat("2026-11-13T20:00:00+07:00", SEKARANG)).toBe(1)
    expect(hariLewat("2026-11-11T00:00:00+07:00", SEKARANG)).toBe(3)
  })

  it("tanggal UTC yang sudah masuk hari WIB dihitung sebagai hari ini", () => {
    // 13 November 18.00 UTC = 14 November 01.00 WIB.
    expect(hariLewat("2026-11-13T18:00:00Z", SEKARANG)).toBe(0)
  })

  it("tidak pernah negatif", () => {
    expect(hariLewat("2026-11-20T00:00:00+07:00", SEKARANG)).toBe(0)
  })
})

describe("labelKesegaran", () => {
  it("menyebut 'hari ini' untuk data hari ini", () => {
    expect(labelKesegaran("2026-11-14T08:00:00+07:00", SEKARANG)).toBe("hari ini")
  })

  it("menyebut 'kemarin' untuk data kemarin", () => {
    expect(labelKesegaran("2026-11-13T20:00:00+07:00", SEKARANG)).toBe("kemarin")
  })

  it("menyebut jumlah hari untuk data beberapa hari lalu", () => {
    expect(labelKesegaran("2026-11-11T00:00:00+07:00", SEKARANG)).toBe("3 hari lalu")
  })

  it("menyebut 'data lama' kalau sudah lewat seminggu", () => {
    expect(labelKesegaran("2026-11-01T00:00:00+07:00", SEKARANG)).toBe("data lama")
  })
})

describe("hitungRingkasan", () => {
  const catatanA: CatatanHargaPasar[] = [
    catatan({ id: "c1", barangId: "b1", harga: 13_000, tanggal: "2026-11-12T00:00:00+07:00" }),
    catatan({ id: "c2", barangId: "b2", harga: 16_000, tanggal: "2026-11-01T00:00:00+07:00" }),
  ]

  it("menghitung barang, rata-rata hemat, dan data lama", () => {
    const perbandingan = [
      bandingkanHargaPasar(
        barang({ id: "b1", hargaModal: 14_000 }),
        catatanA,
        SEKARANG,
      ),
      bandingkanHargaPasar(
        barang({ id: "b2", nama: "Minyak Goreng", hargaModal: 15_000 }),
        catatanA,
        SEKARANG,
      ),
    ]

    const ringkasan = hitungRingkasan(perbandingan, catatanA, SEKARANG)

    expect(ringkasan.jumlahBarang).toBe(2)
    // Hanya b1 yang di luar lebih murah: (14000 - 13000) / 14000 = 7,14%
    expect(ringkasan.rataRataHemat).toBeCloseTo(7.14, 2)
    // Catatan 1 November sudah lebih dari 7 hari.
    expect(ringkasan.jumlahKedaluwarsa).toBe(1)
  })

  it("nihil kalau tidak ada data sama sekali", () => {
    const ringkasan = hitungRingkasan([], [], SEKARANG)

    expect(ringkasan.jumlahBarang).toBe(0)
    expect(ringkasan.rataRataHemat).toBe(0)
    expect(ringkasan.jumlahKedaluwarsa).toBe(0)
  })
})
