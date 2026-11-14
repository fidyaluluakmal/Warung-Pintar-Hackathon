import { describe, expect, it } from "vitest"
import {
  barisPenyesuaian,
  catatHitung,
  hapusHitung,
  hitungOpname,
  hitungSelisih,
  mulaiSesiOpname,
  ringkasanOpname,
  statusSelisih,
  type BarangOpname,
} from "./opname"

function barang(partial: Partial<BarangOpname> = {}): BarangOpname {
  return {
    barangId: "barang-1",
    nama: "Gula Pasir",
    satuan: "bungkus",
    stokSistem: 10,
    hargaModal: 14000,
    ...partial,
  }
}

describe("mulaiSesiOpname", () => {
  it("sesi baru mulai kosong", () => {
    const sesi = mulaiSesiOpname([barang(), barang({ barangId: "barang-2", nama: "Beras" })])

    expect(sesi.hitungan).toEqual({})
    expect(Object.keys(sesi.hitungan)).toHaveLength(0)

    const hasil = hitungOpname(sesi)
    expect(hasil).toHaveLength(2)
    expect(hasil.every((item) => item.status === "belum")).toBe(true)
    expect(hasil.every((item) => item.selisih === null)).toBe(true)
    expect(hasil.every((item) => item.beda === false)).toBe(true)

    const ringkasan = ringkasanOpname(hasil)
    expect(ringkasan.barangDihitung).toBe(0)
    expect(ringkasan.barangBeda).toBe(0)
    expect(ringkasan.nilaiSusut).toBe(0)
    expect(barisPenyesuaian(hasil)).toHaveLength(0)
  })
})

describe("hitungSelisih", () => {
  it("fisik dikurangi sistem", () => {
    expect(hitungSelisih(10, 7)).toBe(-3)
    expect(hitungSelisih(10, 10)).toBe(0)
    expect(hitungSelisih(10, 12)).toBe(2)
  })

  it("dibulatkan dua desimal", () => {
    expect(hitungSelisih(0.3, 0.1)).toBe(-0.2)
  })
})

describe("statusSelisih", () => {
  it("membedakan belum, cocok, kurang, dan lebih", () => {
    expect(statusSelisih(null)).toBe("belum")
    expect(statusSelisih(0)).toBe("cocok")
    expect(statusSelisih(-2)).toBe("kurang")
    expect(statusSelisih(3)).toBe("lebih")
  })
})

describe("hitungOpname", () => {
  it("tidak ada selisih: barang cocok, tidak ikut penyesuaian", () => {
    const sesi = catatHitung(mulaiSesiOpname([barang()]), "barang-1", 10)
    const hasil = hitungOpname(sesi)

    expect(hasil[0].selisih).toBe(0)
    expect(hasil[0].status).toBe("cocok")
    expect(hasil[0].beda).toBe(false)
    expect(hasil[0].nilaiSelisih).toBe(0)
    expect(barisPenyesuaian(hasil)).toHaveLength(0)
  })

  it("barang kurang: selisih negatif dan nilainya negatif", () => {
    const sesi = catatHitung(mulaiSesiOpname([barang()]), "barang-1", 7)
    const hasil = hitungOpname(sesi)

    expect(hasil[0].selisih).toBe(-3)
    expect(hasil[0].status).toBe("kurang")
    expect(hasil[0].beda).toBe(true)
    expect(hasil[0].nilaiSelisih).toBe(-42000)
    expect(hasil[0].alasan).toContain("Kurang 3 bungkus")
  })

  it("barang lebih: selisih positif dan nilainya positif", () => {
    const sesi = catatHitung(mulaiSesiOpname([barang()]), "barang-1", 12)
    const hasil = hitungOpname(sesi)

    expect(hasil[0].selisih).toBe(2)
    expect(hasil[0].status).toBe("lebih")
    expect(hasil[0].beda).toBe(true)
    expect(hasil[0].nilaiSelisih).toBe(28000)
    expect(hasil[0].alasan).toContain("Lebih 2 bungkus")
  })

  it("alasan barang cocok berbahasa sehari-hari", () => {
    const sesi = catatHitung(mulaiSesiOpname([barang()]), "barang-1", 10)
    const hasil = hitungOpname(sesi)

    expect(hasil[0].alasan).toContain("Sama persis")
    expect(hasil[0].alasan).toContain("Gula Pasir")
  })

  it("hapus hitung mengembalikan barang ke keadaan belum dihitung", () => {
    let sesi = catatHitung(mulaiSesiOpname([barang()]), "barang-1", 7)
    sesi = hapusHitung(sesi, "barang-1")

    const hasil = hitungOpname(sesi)
    expect(hasil[0].selisih).toBeNull()
    expect(hasil[0].status).toBe("belum")
  })
})

describe("barisPenyesuaian", () => {
  it("barang dengan selisih nol tidak ikut baris penyesuaian", () => {
    const sesi = mulaiSesiOpname([
      barang({ barangId: "barang-1", nama: "Gula Pasir", stokSistem: 10 }),
      barang({ barangId: "barang-2", nama: "Beras", satuan: "kg", stokSistem: 20, hargaModal: 15000 }),
      barang({ barangId: "barang-3", nama: "Minyak", satuan: "botol", stokSistem: 5, hargaModal: 16000 }),
    ])
    const terhitung = catatHitung(
      catatHitung(catatHitung(sesi, "barang-1", 10), "barang-2", 18),
      "barang-3",
      7,
    )

    const baris = barisPenyesuaian(hitungOpname(terhitung))

    expect(baris).toHaveLength(2)
    expect(baris.map((b) => b.barangId)).toEqual(["barang-2", "barang-3"])
    expect(baris[0].delta).toBe(-2)
    expect(baris[0].nilai).toBe(-30000)
    expect(baris[1].delta).toBe(2)
    expect(baris[1].nilai).toBe(32000)
  })

  it("barang yang belum dihitung tidak ikut baris penyesuaian", () => {
    const sesi = catatHitung(mulaiSesiOpname([barang(), barang({ barangId: "barang-2" })]), "barang-1", 8)
    const baris = barisPenyesuaian(hitungOpname(sesi))

    expect(baris).toHaveLength(1)
    expect(baris[0].barangId).toBe("barang-1")
    expect(baris[0].delta).toBe(-2)
  })
})

describe("ringkasanOpname", () => {
  it("menghitung barang dihitung, barang beda, dan nilai barang hilang", () => {
    const sesi = mulaiSesiOpname([
      barang({ barangId: "barang-1", nama: "Gula Pasir", stokSistem: 10, hargaModal: 14000 }),
      barang({ barangId: "barang-2", nama: "Beras", satuan: "kg", stokSistem: 20, hargaModal: 15000 }),
      barang({ barangId: "barang-3", nama: "Minyak", satuan: "botol", stokSistem: 5, hargaModal: 16000 }),
    ])
    const terhitung = catatHitung(
      catatHitung(catatHitung(sesi, "barang-1", 10), "barang-2", 18),
      "barang-3",
      7,
    )

    const ringkasan = ringkasanOpname(hitungOpname(terhitung))

    expect(ringkasan.barangDihitung).toBe(3)
    expect(ringkasan.barangBeda).toBe(2)
    // Beras kurang 2 kg x Rp15.000 = Rp30.000 hilang.
    expect(ringkasan.nilaiSusut).toBe(30000)
    // Minyak lebih 2 botol x Rp16.000 = Rp32.000.
    expect(ringkasan.nilaiLebih).toBe(32000)
    expect(ringkasan.nilaiBersih).toBe(2000)
    expect(ringkasan.rincian).toHaveLength(2)
    expect(ringkasan.rincian[0].alasan).toContain("Kurang 2 kg")
    expect(ringkasan.rincian[1].alasan).toContain("Lebih 2 botol")
  })

  it("sesi kosong tidak punya barang beda atau barang hilang", () => {
    const ringkasan = ringkasanOpname(hitungOpname(mulaiSesiOpname([barang()])))

    expect(ringkasan.barangDihitung).toBe(0)
    expect(ringkasan.barangBeda).toBe(0)
    expect(ringkasan.nilaiSusut).toBe(0)
    expect(ringkasan.nilaiLebih).toBe(0)
    expect(ringkasan.nilaiBersih).toBe(0)
    expect(ringkasan.rincian).toHaveLength(0)
  })
})
