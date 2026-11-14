import { describe, expect, it } from "vitest"
import {
  hitungPenjualanTitip,
  omzetTitip,
  sisaTitip,
  statistikTitip,
  saranTitip,
  teksPembayaranTitip,
} from "./titip"
import { persen } from "./format"
import type { Titip } from "./types"

function titip(keadian: Partial<Titip> = {}): Titip {
  return {
    id: "t1",
    owner_id: "owner-1",
    pemilik: "Pak Hendra",
    nama_barang: "Keripik Singkong",
    satuan: "pcs",
    qty: 40,
    terjual: 0,
    harga_pemilik: 8000,
    harga_jual: 10000,
    komisi_persen: 10,
    status: "aktif",
    catatan: null,
    dibuat_pada: "2026-11-01T00:00:00Z",
    selesai_pada: null,
    ...keadian,
  }
}

describe("sisaTitip", () => {
  it("sisa = titipan dikurangi yang sudah terjual", () => {
    expect(sisaTitip(titip({ terjual: 12 }))).toBe(28)
  })

  it("sisa tidak pernah negatif", () => {
    expect(sisaTitip(titip({ qty: 10, terjual: 12 }))).toBe(0)
  })
})

describe("hitungPenjualanTitip", () => {
  it("memisahkan komisi warung dan bagian pemilik barang", () => {
    const hasil = hitungPenjualanTitip(titip(), 10)
    expect(hasil.qty).toBe(10)
    expect(hasil.omzet).toBe(100000)
    expect(hasil.komisi).toBe(10000)
    expect(hasil.bagianPemilik).toBe(90000)
    expect(hasil.sisa).toBe(30)
  })

  it("tidak boleh melebihi sisa yang ada", () => {
    const hasil = hitungPenjualanTitip(titip({ terjual: 35 }), 10)
    expect(hasil.qty).toBe(5)
    expect(hasil.sisa).toBe(0)
  })

  it("jumlah negatif dianggap nol", () => {
    const hasil = hitungPenjualanTitip(titip(), -5)
    expect(hasil.qty).toBe(0)
    expect(hasil.omzet).toBe(0)
  })

  it("komisi 0% berarti seluruh omzet untuk pemilik barang", () => {
    const hasil = hitungPenjualanTitip(titip({ komisi_persen: 0 }), 5)
    expect(hasil.komisi).toBe(0)
    expect(hasil.bagianPemilik).toBe(50000)
  })
})

describe("statistikTitip", () => {
  it("hanya menghitung titipan yang masih aktif", () => {
    const hasil = statistikTitip([
      titip({ id: "a", terjual: 10 }),
      titip({ id: "b", terjual: 20, komisi_persen: 20, status: "selesai" }),
    ])
    expect(hasil.jumlahTitip).toBe(1)
    expect(hasil.omzet).toBe(100000)
    expect(hasil.komisi).toBe(10000)
    expect(hasil.harusDibayar).toBe(90000)
    expect(hasil.barangSisa).toBe(30)
  })

  it("nol kalau tidak ada titipan", () => {
    const hasil = statistikTitip([])
    expect(hasil.omzet).toBe(0)
    expect(hasil.komisi).toBe(0)
    expect(hasil.harusDibayar).toBe(0)
  })

  it("komisi dan bagian pemilik selalu tambah sama dengan omzet", () => {
    const hasil = statistikTitip([
      titip({ id: "a", terjual: 3, komisi_persen: 12.5 }),
      titip({ id: "b", terjual: 7, komisi_persen: 7 }),
    ])
    expect(hasil.komisi + hasil.harusDibayar).toBe(hasil.omzet)
  })
})

describe("omzetTitip", () => {
  it("menghitung dari penjualan yang sudah tercatat", () => {
    const hasil = omzetTitip(titip({ terjual: 18 }))
    expect(hasil.qty).toBe(18)
    expect(hasil.omzet).toBe(180000)
    expect(hasil.komisi).toBe(18000)
    expect(hasil.bagianPemilik).toBe(162000)
    expect(hasil.sisa).toBe(22)
  })

  it("titipan yang sudah laku semua tetap terhitung", () => {
    const hasil = omzetTitip(titip({ qty: 15, terjual: 15 }))
    expect(hasil.omzet).toBe(150000)
    expect(hasil.komisi).toBe(15000)
    expect(hasil.bagianPemilik).toBe(135000)
    expect(hasil.sisa).toBe(0)
  })
})

describe("persen", () => {
  it("bulat tanpa desimal", () => {
    expect(persen(10)).toBe("10%")
  })

  it("berdesimal satu angka", () => {
    expect(persen(12.5)).toBe("12,5%")
  })
})

describe("saranTitip", () => {
  it("bilang belum ada yang terjual", () => {
    expect(saranTitip(titip())).toBe("Belum ada yang terjual.")
  })

  it("bilang bisa dibayar kalau semua laku", () => {
    expect(saranTitip(titip({ qty: 20, terjual: 20 }))).toContain("bisa dibayar ke Pak Hendra")
  })

  it("bilang sisa masih di rak", () => {
    expect(saranTitip(titip({ terjual: 5 }))).toBe("5 pcs terjual, sisa 35 pcs masih di rak.")
  })

  it("bilang sudah selesai kalau titipannya ditutup", () => {
    expect(saranTitip(titip({ status: "selesai" }))).toContain("Selesai")
  })
})

describe("teksPembayaranTitip", () => {
  it("bilang belum ada yang terjual", () => {
    expect(teksPembayaranTitip([])).toBe("Belum ada barang titipan yang terjual.")
  })

  it("menyusun rincian per pemilik barang", () => {
    const teks = teksPembayaranTitip([titip({ terjual: 10 })])
    expect(teks).toContain("Pak Hendra")
    expect(teks).toContain("Keripik Singkong")
    expect(teks).toContain("Total bagian pemilik barang")
  })
})
