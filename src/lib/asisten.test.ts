import { describe, expect, it } from "vitest"
import {
  bangunKonteks,
  instruksiUntukSesi,
  judulOtomatis,
  kelompokkanSesi,
  namaProyekDefault,
  sapaan,
  sesiTanpaProyek,
  urutProyek,
  type SesiLengkap,
} from "./asisten"
import type { BarisTransaksi, Barang, Proyek, SaranBeli, StokBarang, Transaksi, UtangBerjalan } from "./types"

const HARI_INI = new Date("2026-11-14T02:00:00Z") // 09.00 WIB

function sesi(partial: Partial<SesiLengkap> = {}): SesiLengkap {
  return {
    id: "s1",
    owner_id: "o1",
    judul: "Sesi baru",
    proyek_id: null,
    dibuat_pada: "2026-11-14T01:00:00Z",
    diperbarui_pada: "2026-11-14T01:00:00Z",
    jumlahPesan: 0,
    ...partial,
  }
}

function proyek(partial: Partial<Proyek> = {}): Proyek {
  return {
    id: "p1",
    owner_id: "o1",
    nama: "Utang Pak Yono",
    instruksi: "Fokus saja utang Pak Yono",
    dibuat_pada: "2026-11-01T00:00:00Z",
    ...partial,
  }
}

describe("judulOtomatis", () => {
  it("memakai kalimat utuh kalau pendek", () => {
    expect(judulOtomatis("Beli apa besok?")).toBe("Beli apa besok?")
  })

  it("memotong di batas kata kalau panjang", () => {
    const judul = judulOtomatis("Beli apa besok kalau stok beras masih cukup untuk semana ini?")
    expect(judul.length).toBeLessThanOrEqual(43)
    expect(judul.endsWith("…")).toBe(true)
    expect(judul).not.toContain("  ")
  })

  it("kalimat kosong jadi Sesi baru", () => {
    expect(judulOtomatis("   ")).toBe("Sesi baru")
  })
})

describe("sapaan", () => {
  it("memakai nama depan pemilik", () => {
    expect(sapaan("Pak Andi")).toBe("Halo Pak Andi, siap untuk bertanya?")
  })

  it("tidak mengulang nama kalau pemilik tidak ada", () => {
    expect(sapaan(null)).toBe("Halo, siap untuk bertanya?")
    expect(sapaan("  ")).toBe("Halo, siap untuk bertanya?")
  })
})

describe("kelompokkanSesi", () => {
  it("mengelompokkan per waktu dan mengurutkan terbaru dulu", () => {
    const hasil = kelompokkanSesi(
      [
        sesi({ id: "a", diperbarui_pada: "2026-11-14T01:00:00Z" }),
        sesi({ id: "b", diperbarui_pada: "2026-11-13T01:00:00Z" }),
        sesi({ id: "c", diperbarui_pada: "2026-11-01T01:00:00Z" }),
      ],
      HARI_INI,
    )
    expect(hasil.map((g) => g.label)).toEqual(["Hari ini", "Kemarin", "Lebih lama"])
    expect(hasil[0].sesi[0].id).toBe("a")
  })

  it("sesi tanpa tanggal tidak membuat kelompok rusak", () => {
    const hasil = kelompokkanSesi([sesi({ diperbarui_pada: "bukan tanggal" })], HARI_INI)
    expect(hasil.length).toBeGreaterThan(0)
  })
})

describe("proyek", () => {
  it("sesi tanpa proyek dipisahkan dari sesi berproyek", () => {
    const hasil = sesiTanpaProyek([
      sesi({ id: "a" }),
      sesi({ id: "b", proyek_id: "p1" }),
    ])
    expect(hasil.map((s) => s.id)).toEqual(["a"])
  })

  it("instruksi proyek ikut untuk sesinya", () => {
    const hasil = instruksiUntukSesi(sesi({ proyek_id: "p1" }), [proyek()])
    expect(hasil).toBe("Fokus saja utang Pak Yono")
  })

  it("sesi tanpa proyek tidak punya instruksi tambahan", () => {
    expect(instruksiUntukSesi(sesi(), [proyek()])).toBe("")
    expect(instruksiUntukSesi(null, [proyek()])).toBe("")
  })

  it("proyek yang paling baru dipakai urut di atas", () => {
    const hasil = urutProyek(
      [proyek({ id: "lama" }), proyek({ id: "baru" })],
      [sesi({ id: "s1", proyek_id: "baru", diperbarui_pada: "2026-11-10T00:00:00Z" })],
    )
    expect(hasil[0].id).toBe("baru")
  })

  it("nama proyek bawaan memakai nama depan pemilik", () => {
    expect(namaProyekDefault("Pak Andi")).toBe("Proyek Pak Andi")
    expect(namaProyekDefault(null)).toBe("Proyek warung")
  })
})

describe("bangunKonteks", () => {
  const barang: Barang[] = [
    {
      id: "b1",
      owner_id: "o1",
      nama: "Beras Premium",
      satuan: "kg",
      stok_awal: 0,
      min_stok: 10,
      harga_modal: 14_000,
      harga_jual: 16_000,
      lead_time_hari: 2,
    },
  ]

  const stok: StokBarang[] = [
    {
      barang_id: "b1",
      owner_id: "o1",
      nama: "Beras Premium",
      satuan: "kg",
      min_stok: 10,
      harga_modal: 14_000,
      harga_jual: 16_000,
      lead_time_hari: 2,
      stok_awal: 0,
      stok: 8,
    },
  ]

  const transaksi: Transaksi[] = [
    {
      id: "t1",
      owner_id: "o1",
      tipe: "jual",
      tanggal: "2026-11-14T01:00:00Z",
      sumber: "suara",
      teks_mentah: null,
      total: 32_000,
      agen: null,
    },
    {
      id: "t2",
      owner_id: "o1",
      tipe: "jual",
      tanggal: "2026-11-01T01:00:00Z",
      sumber: "suara",
      teks_mentah: null,
      total: 16_000,
      agen: null,
    },
  ]

  const baris: BarisTransaksi[] = [
    {
      id: "br1",
      transaksi_id: "t1",
      barang_id: "b1",
      jumlah: 2,
      satuan: "kg",
      harga_satuan: 16_000,
    },
    {
      id: "br2",
      transaksi_id: "t2",
      barang_id: "b1",
      jumlah: 1,
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
      qty: 2,
      satuan: "kg",
      harga_satuan: 16_000,
      total: 32_000,
      dibayar: 0,
      tanggal: "2026-11-10T00:00:00Z",
      status: "belum_lunas",
      lunas_pada: null,
      sisa: 32_000,
    },
  ]

  const saranBeli: SaranBeli[] = [
    { barangId: "b1", nama: "Beras Premium", satuan: "kg", qty: 6, alasan: "stok tipis" },
  ]

  it("laba kotor bukan sama dengan omzet", () => {
    // 2 kg x 16.000 = 32.000, modal 2 x 14.000 = 28.000, laba 4.000.
    const konteks = bangunKonteks(
      { transaksi, baris, barang, stok, utang, saranBeli },
      HARI_INI,
    )
    expect(konteks.omzetHariIni).toBe(32_000)
    expect(konteks.labaKotorHariIni).toBe(4_000)
    expect(konteks.transaksiHariIni).toBe(1)
  })

  it("omzet 7 hari memakai kalender warung", () => {
    const konteks = bangunKonteks(
      { transaksi, baris, barang, stok, utang, saranBeli },
      HARI_INI,
    )
    // 1 November itu 13 hari lalu, jadi di luar jendela 7 hari.
    expect(konteks.omzetMingguIni).toBe(32_000)
    expect(konteks.labaKotorMingguIni).toBe(4_000)
  })

  it("stok tipis mengikuti saran dari mesin restok", () => {
    const konteks = bangunKonteks(
      { transaksi, baris, barang, stok, utang, saranBeli },
      HARI_INI,
    )
    expect(konteks.stokTipis).toEqual([{ nama: "Beras Premium", stok: 8, satuan: "kg" }])
  })

  it("piutang pelanggan ikut terkirim", () => {
    const konteks = bangunKonteks(
      { transaksi, baris, barang, stok, utang, saranBeli },
      HARI_INI,
    )
    expect(konteks.pelangganUtang).toEqual([{ nama: "Pak Yono", sisa: 32_000 }])
  })
})
