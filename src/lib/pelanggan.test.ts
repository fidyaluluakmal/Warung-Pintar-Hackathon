import { describe, expect, it } from "vitest"
import {
  BATAS_JARANG_HARI,
  BATAS_RUTIN,
  gabungNamaDuplikat,
  gabungPelangganDuplikat,
  hitungRingkasanPelanggan,
  inisialPelanggan,
  labelKunjungan,
  labelUtang,
  normalisasiNama,
  rataRataBelanja,
  urutPelanggan,
  type DataPelanggan,
} from "./pelanggan"
import type { BarisTransaksi, Transaksi } from "./types"

const HARI_INI = new Date("2026-11-14T00:00:00Z")

function pelanggan(nama: string, id = nama, telepon: string | null = null): DataPelanggan {
  return { id, owner_id: "owner-1", nama, telepon, catatan: null }
}

function jual(id: string, tanggal: string, teksMentah: string | null): Transaksi {
  return {
    id,
    owner_id: "owner-1",
    tipe: "jual",
    tanggal,
    sumber: "suara",
    teks_mentah: teksMentah,
    total: 0,
    agen: null,
  }
}

function baris(
  id: string,
  transaksi_id: string,
  barang_id: string,
  jumlah: number,
  harga_satuan: number,
): BarisTransaksi {
  return { id, transaksi_id, barang_id, jumlah, satuan: "pcs", harga_satuan }
}

const BARANG = [
  { id: "b-minyak", nama: "Minyak goreng" },
  { id: "b-gula", nama: "Gula pasir" },
  { id: "b-kopi", nama: "Kopi" },
]

describe("normalisasiNama", () => {
  it("memangkas spasi dan membuat huruf kecil", () => {
    expect(normalisasiNama("  Pak   Yono  ")).toBe("pak yono")
  })

  it("nama berbeda huruf besar-kecil dianggap sama", () => {
    expect(normalisasiNama("pak yono")).toBe(normalisasiNama("Pak Yono"))
  })
})

describe("gabungNamaDuplikat", () => {
  it("menggabungkan nama yang sama huruf besar-kecil", () => {
    expect(gabungNamaDuplikat(["pak yono", "Pak Yono", "Bu Endah"])).toEqual([
      "pak yono",
      "Bu Endah",
    ])
  })

  it("memangkas spasi dan membuang nama kosong", () => {
    expect(gabungNamaDuplikat(["  Pak Yono  ", "   ", "Bu Endah"])).toEqual([
      "Pak Yono",
      "Bu Endah",
    ])
  })
})

describe("gabungPelangganDuplikat", () => {
  it("menggabungkan dua catatan dengan nama sama jadi satu", () => {
    const hasil = gabungPelangganDuplikat([
      pelanggan("pak yono", "p1"),
      pelanggan("Pak Yono", "p2", "0812"),
    ])
    expect(hasil).toHaveLength(1)
    expect(hasil[0].nama).toBe("pak yono")
  })

  it("mengisi telepon yang kosong dari baris duplikat", () => {
    const hasil = gabungPelangganDuplikat([
      pelanggan("Pak Yono", "p1"),
      pelanggan("pak yono", "p2", "0812-1111"),
    ])
    expect(hasil[0].telepon).toBe("0812-1111")
  })

  it("telepon kosong di baris pertama tetap diisi dari baris berikutnya", () => {
    const kosong = { ...pelanggan("Pak Yono", "p1"), telepon: "  " }
    const hasil = gabungPelangganDuplikat([kosong, pelanggan("pak yono", "p2", "0812-1111")])
    expect(hasil[0].telepon).toBe("0812-1111")
  })
})

describe("inisialPelanggan", () => {
  it("mengambil huruf pertama dari dua kata", () => {
    expect(inisialPelanggan("Pak Yono")).toBe("PY")
  })

  it("huruf kecil tetap jadi huruf besar", () => {
    expect(inisialPelanggan("bu endah")).toBe("BE")
  })

  it("satu kata cukup satu huruf", () => {
    expect(inisialPelanggan("yono")).toBe("Y")
  })

  it("nama kosong tidak error", () => {
    expect(inisialPelanggan("   ")).toBe("?")
  })
})

describe("labelKunjungan", () => {
  it("pelanggan yang belum pernah datang disebut baru", () => {
    expect(labelKunjungan(0, null, HARI_INI)).toBe("Pelanggan baru")
  })

  it("satu kunjungan dan baru saja datang disebut sekali datang", () => {
    expect(labelKunjungan(1, "2026-11-13", HARI_INI)).toBe("Sekali datang")
  })

  it("kunjungan banyak sampai ambang rutin", () => {
    expect(labelKunjungan(BATAS_RUTIN, "2026-11-10", HARI_INI)).toBe("Rutin datang")
  })

  it("kunjungan di bawah ambang rutin tidak disebut rutin", () => {
    expect(labelKunjungan(BATAS_RUTIN - 1, "2026-11-13", HARI_INI)).toBe("Kadang datang")
  })

  it("sudah lama tidak datang disebut jarang datang", () => {
    const lama = "2026-09-01"
    expect(labelKunjungan(2, lama, HARI_INI)).toBe("Jarang datang")
    expect(selisih(lama)).toBeGreaterThan(BATAS_JARANG_HARI)
  })

  it("baru beberapa hari lalu masih dihitung datang", () => {
    expect(labelKunjungan(1, "2026-11-12", HARI_INI)).toBe("Sekali datang")
  })
})

describe("labelUtang", () => {
  it("tanpa utang disebut kulang", () => {
    expect(labelUtang(0)).toBe("Kulang")
  })

  it("ada sisa utang disebut punya utang", () => {
    expect(labelUtang(15000)).toBe("Punya utang")
  })
})

describe("hitungRingkasanPelanggan", () => {
  it("menjumlahkan belanja dari setiap baris transaksi", () => {
    const hasil = hitungRingkasanPelanggan(
      [pelanggan("Pak Yono", "p1")],
      [jual("t1", "2026-11-10", "minyak buat pak yono")],
      [baris("b1", "t1", "b-minyak", 2, 15000)],
      BARANG,
      [],
      HARI_INI,
    )
    expect(hasil).toHaveLength(1)
    expect(hasil[0].totalBelanja).toBe(30000)
  })

  it("tiap transaksi jual dihitung satu kunjungan", () => {
    const hasil = hitungRingkasanPelanggan(
      [pelanggan("Pak Yono", "p1")],
      [
        jual("t1", "2026-11-10", "minyak buat pak yono"),
        jual("t2", "2026-11-11", "gula buat pak yono"),
      ],
      [baris("b1", "t1", "b-minyak", 1, 15000), baris("b2", "t2", "b-gula", 1, 14000)],
      BARANG,
      [],
      HARI_INI,
    )
    expect(hasil[0].jumlahKunjungan).toBe(2)
    expect(hasil[0].totalBelanja).toBe(29000)
  })

  it("kunjungan terakhir diambil dari tanggal paling akhir", () => {
    const hasil = hitungRingkasanPelanggan(
      [pelanggan("Pak Yono", "p1")],
      [
        jual("t1", "2026-11-01", "minyak buat pak yono"),
        jual("t2", "2026-11-12", "gula buat pak yono"),
        jual("t3", "2026-11-05", "gula buat pak yono"),
      ],
      [
        baris("b1", "t1", "b-minyak", 1, 15000),
        baris("b2", "t2", "b-gula", 1, 14000),
        baris("b3", "t3", "b-gula", 1, 14000),
      ],
      BARANG,
      [],
      HARI_INI,
    )
    expect(hasil[0].kunjunganTerakhir).toBe("2026-11-12")
  })

  it("barang favorit adalah yang quantity-nya paling banyak", () => {
    const hasil = hitungRingkasanPelanggan(
      [pelanggan("Pak Yono", "p1")],
      [
        jual("t1", "2026-11-10", "gula buat pak yono"),
        jual("t2", "2026-11-11", "minyak buat pak yono"),
      ],
      [
        baris("b1", "t1", "b-gula", 1, 14000),
        baris("b2", "t2", "b-minyak", 3, 15000),
      ],
      BARANG,
      [],
      HARI_INI,
    )
    expect(hasil[0].barangFavorit).toBe("Minyak goreng")
    expect(hasil[0].qtyFavorit).toBe(3)
  })

  it("kalau quantity seri, yang paling sering dibeli jadi favorit", () => {
    const hasil = hitungRingkasanPelanggan(
      [pelanggan("Pak Yono", "p1")],
      [
        jual("t1", "2026-11-01", "gula buat pak yono"),
        jual("t2", "2026-11-02", "gula buat pak yono"),
        jual("t3", "2026-11-03", "minyak buat pak yono"),
      ],
      [
        baris("b1", "t1", "b-gula", 1, 14000),
        baris("b2", "t2", "b-gula", 1, 14000),
        baris("b3", "t3", "b-minyak", 1, 15000),
      ],
      BARANG,
      [],
      HARI_INI,
    )
    expect(hasil[0].barangFavorit).toBe("Gula pasir")
  })

  it("penjualan yang tidak menyebut pelanggan diabaikan", () => {
    const hasil = hitungRingkasanPelanggan(
      [pelanggan("Pak Yono", "p1")],
      [jual("t1", "2026-11-10", "gula biasa")],
      [baris("b1", "t1", "b-gula", 5, 14000)],
      BARANG,
      [],
      HARI_INI,
    )
    expect(hasil[0].jumlahKunjungan).toBe(0)
    expect(hasil[0].totalBelanja).toBe(0)
    expect(hasil[0].barangFavorit).toBeNull()
    expect(hasil[0].labelKunjungan).toBe("Pelanggan baru")
  })

  it("nama pelanggan dicocokkan tanpa regard huruf besar-kecil", () => {
    const hasil = hitungRingkasanPelanggan(
      [pelanggan("Pak Yono", "p1")],
      [jual("t1", "2026-11-10", "beli minyak buat PAK YONO")],
      [baris("b1", "t1", "b-minyak", 1, 15000)],
      BARANG,
      [],
      HARI_INI,
    )
    expect(hasil[0].jumlahKunjungan).toBe(1)
  })

  it("nama yang lebih panjang menang kalau ada dua yang cocok", () => {
    const hasil = hitungRingkasanPelanggan(
      [pelanggan("Pak Yono", "p1"), pelanggan("Pak Yono Saja", "p2")],
      [jual("t1", "2026-11-10", "minyak buat pak yono saja")],
      [baris("b1", "t1", "b-minyak", 1, 15000)],
      BARANG,
      [],
      HARI_INI,
    )
    const detail = hasil.find((p) => p.id === "p2")
    expect(detail?.jumlahKunjungan).toBe(1)
    expect(hasil.find((p) => p.id === "p1")?.jumlahKunjungan).toBe(0)
  })

  it("utang dihitung dari sisa yang belum dibayar", () => {
    const hasil = hitungRingkasanPelanggan(
      [pelanggan("Pak Yono", "p1")],
      [],
      [],
      BARANG,
      [
        { pelanggan: "pak yono", total: 50000, dibayar: 20000 },
        { pelanggan: "Pak Yono", total: 30000, dibayar: 0 },
      ],
      HARI_INI,
    )
    expect(hasil[0].totalUtang).toBe(60000)
    expect(hasil[0].labelUtang).toBe("Punya utang")
  })

  it("utang yang sudah lunas tidak dihitung", () => {
    const hasil = hitungRingkasanPelanggan(
      [pelanggan("Pak Yono", "p1")],
      [],
      [],
      BARANG,
      [{ pelanggan: "Pak Yono", total: 50000, dibayar: 50000 }],
      HARI_INI,
    )
    expect(hasil[0].totalUtang).toBe(0)
    expect(hasil[0].labelUtang).toBe("Kulang")
  })

  it("riwayat pembelian diurutkan terbaru dulu", () => {
    const hasil = hitungRingkasanPelanggan(
      [pelanggan("Pak Yono", "p1")],
      [
        jual("t1", "2026-11-01", "gula buat pak yono"),
        jual("t2", "2026-11-12", "minyak buat pak yono"),
      ],
      [baris("b1", "t1", "b-gula", 1, 14000), baris("b2", "t2", "b-minyak", 1, 15000)],
      BARANG,
      [],
      HARI_INI,
    )
    expect(hasil[0].pembelian.map((p) => p.namaBarang)).toEqual([
      "Minyak goreng",
      "Gula pasir",
    ])
    expect(hasil[0].pembelian[0].total).toBe(15000)
  })

  it("pelanggan yang belum pernah belanja tetap masuk buku", () => {
    const hasil = hitungRingkasanPelanggan(
      [pelanggan("Bu Endah", "p2")],
      [],
      [],
      BARANG,
      [],
      HARI_INI,
    )
    expect(hasil).toHaveLength(1)
    expect(hasil[0].nama).toBe("Bu Endah")
    expect(hasil[0].initials).toBe("BE")
  })
})

describe("rataRataBelanja", () => {
  it("hanya menghitung pelanggan yang sudah belanja", () => {
    const hasil = hitungRingkasanPelanggan(
      [pelanggan("Pak Yono", "p1"), pelanggan("Bu Endah", "p2")],
      [jual("t1", "2026-11-10", "minyak buat pak yono")],
      [baris("b1", "t1", "b-minyak", 2, 15000)],
      BARANG,
      [],
      HARI_INI,
    )
    expect(rataRataBelanja(hasil)).toBe(30000)
  })

  it("nol kalau belum ada yang belanja", () => {
    const hasil = hitungRingkasanPelanggan(
      [pelanggan("Pak Yono", "p1")],
      [],
      [],
      BARANG,
      [],
      HARI_INI,
    )
    expect(rataRataBelanja(hasil)).toBe(0)
  })
})

describe("urutPelanggan", () => {
  const daftar = hitungRingkasanPelanggan(
    [pelanggan("Pak Yono", "p1"), pelanggan("Bu Endah", "p2")],
    [jual("t1", "2026-11-10", "minyak buat pak yono")],
    [baris("b1", "t1", "b-minyak", 2, 15000)],
    BARANG,
    [{ pelanggan: "Bu Endah", total: 40000, dibayar: 0 }],
    HARI_INI,
  )

  it("bawaan: utang terbesar dulu", () => {
    expect(urutPelanggan(daftar)[0].nama).toBe("Bu Endah")
  })

  it("bisa diurutkan berdasarkan nama", () => {
    expect(urutPelanggan(daftar, "nama")[0].nama).toBe("Bu Endah")
  })

  it("bisa diurutkan berdasarkan belanja", () => {
    expect(urutPelanggan(daftar, "belanja")[0].nama).toBe("Pak Yono")
  })
})

/** Selisih hari dari helper yang sama dengan dipakai modul. */
function selisih(tanggal: string): number {
  const dari = new Date(`${tanggal}T00:00:00Z`).getTime()
  const sampai = new Date("2026-11-14T00:00:00Z").getTime()
  return Math.round((sampai - dari) / 86_400_000)
}
