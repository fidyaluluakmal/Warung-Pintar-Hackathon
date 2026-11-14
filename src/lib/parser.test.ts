import { describe, expect, it } from "vitest"
import { cariPeminjam, parseHarga, parseKalimat } from "./parser"

describe("parseHarga", () => {
  it("membaca harga dalam bentuk kata", () => {
    expect(parseHarga("14 ribu")).toBe(14_000)
    expect(parseHarga("1,5 juta")).toBe(1_500_000)
    expect(parseHarga("17.000")).toBe(17_000)
    expect(parseHarga("rp 3000")).toBe(3000)
  })
})

describe("parseKalimat", () => {
  it("memisahkan beberapa barang dalam satu kalimat", () => {
    const hasil = parseKalimat("terjual 3 kilo beras dan 2 bungkus kopi")
    expect(hasil.items).toHaveLength(2)
    expect(hasil.items[0].name).toBe("beras")
    expect(hasil.items[0].qty).toBe(3)
    expect(hasil.items[0].unit).toBe("kg")
    expect(hasil.items[1].name).toBe("kopi")
    expect(hasil.items[1].qty).toBe(2)
    expect(hasil.items[1].unit).toBe("bungkus")
  })

  it("membaca satuan dasar", () => {
    const hasil = parseKalimat("terjual 5 liter minyak goreng")
    expect(hasil.items[0].unit).toBe("liter")
    expect(hasil.items[0].qty).toBe(5)
  })

  it("membaca harga sebagai harga, bukan jumlah", () => {
    const hasil = parseKalimat("gula harga 17000")
    expect(hasil.items[0].price).toBe(17_000)
    expect(hasil.items[0].qty).toBe(1)
  })

  it("membaca 'harga 14 ribu' sebagai harga, bukan jumlah", () => {
    const hasil = parseKalimat("beras harga 14 ribu")
    expect(hasil.items[0].price).toBe(14_000)
    expect(hasil.items[0].qty).toBe(1)
    // "ribu" bukan nama barang.
    expect(hasil.items[0].name).toBe("beras")
  })

  it("membaca 'harga 1,5 juta' dengan kelipatan juta", () => {
    const hasil = parseKalimat("bisa harga 1,5 juta")
    expect(hasil.items[0].price).toBe(1_500_000)
  })

  it("mencari nama peminjam dari pola ngutang", () => {
    const hasil = parseKalimat("terjual 4 pisang untuk pak yono")
    expect(hasil.debtor).toBe("Pak Yono")
  })

  it("mengembalikan daftar kosong untuk kalimat kosong", () => {
    expect(parseKalimat("").items).toHaveLength(0)
    expect(parseKalimat("").debtor).toBeNull()
  })

  it("tidak menebak barang yang tidak disebut", () => {
    const hasil = parseKalimat("terjual 3 kilo")
    // "kilo" adalah satuan, jadi tidak ada nama barang.
    expect(hasil.items).toHaveLength(0)
  })
})

describe("cariPeminjam", () => {
  it("mengembalikan null kalau tidak ada pola", () => {
    expect(cariPeminjam("terjual 3 kilo beras")).toBeNull()
  })
})
