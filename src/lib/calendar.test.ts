import { describe, expect, it } from "vitest"
import { hariIniWib, jamWib, selisihHari, tanggalWib, transaksiHariIni } from "./calendar"

/**
 * Regresi zona waktu.
 *
 * Transaksi jam 23:30 WIB disimpan sebagai 16:30 UTC. Kalau dibandingkan
 * dengan tanggal UTC, transaksi itu terlihat "kemarin": omzet harian jadi
 * nol dan saran belanja meleset.
 */

describe("hariIniWib", () => {
  it("meng pakai tanggal di warung, bukan tanggal perangkat", () => {
    // 2026-11-13T16:30:00Z = 2026-11-13 23:30 WIB.
    const momen = new Date("2026-11-13T16:30:00Z")
    expect(hariIniWib(momen)).toBe("2026-11-13")
  })

  it("setiap jam lewat tengah malam UTC tetap satu hari", () => {
    // 2026-11-13T17:00:00Z = 2026-11-14 00:00 WIB -> sudah hari baru.
    expect(hariIniWib(new Date("2026-11-13T17:00:00Z"))).toBe("2026-11-14")
    // 2026-11-13T16:59:00Z = 2026-11-13 23:59 WIB -> masih hari lama.
    expect(hariIniWib(new Date("2026-11-13T16:59:00Z"))).toBe("2026-11-13")
  })
})

describe("tanggalWib", () => {
  it("mengubah timestamp menjadi tanggal warung", () => {
    expect(tanggalWib("2026-11-13T16:30:00Z")).toBe("2026-11-13")
    expect(tanggalWib("2026-11-14T02:00:00Z")).toBe("2026-11-14")
  })

  it("membaca tanggal yang sudah lokal tanpa menggesernya", () => {
    // Timestamp dengan offset eksplisit harus dipakai apa adanya.
    expect(tanggalWib("2026-11-13T23:30:00+07:00")).toBe("2026-11-13")
  })
})

describe("jamWib", () => {
  it("menampilkan jam warung", () => {
    expect(jamWib("2026-11-13T16:30:00Z")).toBe("23.30")
  })
})

describe("transaksiHariIni", () => {
  it("menilai transaksi jam malam sebagai hari ini", () => {
    const momen = new Date("2026-11-13T16:30:00Z")
    expect(transaksiHariIni("2026-11-13T16:30:00Z", momen)).toBe(true)
    expect(transaksiHariIni("2026-11-12T10:00:00Z", momen)).toBe(false)
  })
})

describe("selisihHari", () => {
  it("menghitung selisih hari di zona waktu warung", () => {
    const momen = new Date("2026-11-13T16:30:00Z")
    // Transaksi jam 23:30 WIB di hari yang sama -> 0 hari, bukan 1.
    expect(selisihHari("2026-11-13T16:30:00Z", momen)).toBe(0)
    expect(selisihHari("2026-11-12T16:30:00Z", momen)).toBe(1)
    expect(selisihHari("2026-11-06T16:30:00Z", momen)).toBe(7)
  })
})
