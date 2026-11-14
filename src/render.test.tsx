import { describe, expect, it } from "vitest"
import { renderToString } from "react-dom/server"
import App from "./App"

/**
 * Uji asap: aplikasi harus bisa dirender tanpa error.
 *
 * Ini menangkap kesalahan yang tidak terlihat dari typecheck — misalnya
 * komponen yang memanggil hook di luar React, atau nama yang salah ketik.
 */
describe("render aplikasi", () => {
  it("merender tanpa error", () => {
    const html = renderToString(<App />)
    expect(html.length).toBeGreaterThan(0)
  })

  it("menyiapkan keadaan awal saat data belum siap", () => {
    const html = renderToString(<App />)
    // Sesi dimuat di efek, jadi render pertama selalu menampilkan keadaan
    // awal. Efeknya tidak jalan di renderToString.
    expect(html).toContain("Menyiapkan warung")
  })
})
