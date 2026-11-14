import { useState } from "react"
import { useWarung } from "../lib/store"

/**
 * Layar masuk.
 *
 * Dua mode:
 *  - Dengan Supabase: email + sandi. Akun demo punya tombol sekali klik.
 *  - Tanpa Supabase: nama warung + nama penjual, disimpan di browser.
 */
export function LayarMasuk() {
  const { masuk, modeLokal } = useWarung()
  const [email, setEmail] = useState(modeLokal ? "Pak Andi" : "")
  const [sandi, setSandi] = useState(modeLokal ? "" : "")
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState("")

  async function kirim(nilaiEmail: string, nilaiSandi: string) {
    setSibuk(true)
    setGalat("")
    try {
      await masuk(nilaiEmail, nilaiSandi)
    } catch (kesalahan) {
      const pesan = kesalahan instanceof Error ? kesalahan.message : "Gagal masuk."
      setGalat(pesan.includes("Invalid login") ? "Email atau sandi salah." : pesan)
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">
            <span>W</span>
          </div>
          <div>
            <strong>Warung</strong>
            <b>Pintar</b>
          </div>
        </div>

        <span className="auth-kicker">Asisten pencatatan warung</span>
        <h1>Cukup bicara dan foto.</h1>
        <p className="auth-copy">
          Catat penjualan lewat suara, pindai nota agen, lalu dapat saran
          belanja besok yang ada alasannya. Semua angka bisa dicek sebelum
          disimpan.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            void kirim(email, sandi)
          }}
        >
          <div className="auth-field">
            <label htmlFor="email">{modeLokal ? "Nama warung" : "Email"}</label>
            <input
              id="email"
              className="input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="sandi">{modeLokal ? "Nama penjual" : "Sandi"}</label>
            <input
              id="sandi"
              type={modeLokal ? "text" : "password"}
              className="input"
              value={sandi}
              onChange={(event) => setSandi(event.target.value)}
              autoComplete="current-password"
              required={!modeLokal}
            />
          </div>

          {galat && <p className="form-error">{galat}</p>}

          <button type="submit" className="auth-submit" disabled={sibuk}>
            {sibuk ? "Membuka…" : "Masuk"}
          </button>

          {!modeLokal && (
            <>
              <button
                type="button"
                className="secondary-action"
                style={{ width: "100%", marginTop: 10 }}
                disabled={sibuk}
                onClick={() => void kirim("demo@warungpintar.app", "warungpintar2026")}
              >
                Coba akun demo
              </button>
            </>
          )}
        </form>

        <p className="auth-footnote">
          Akun demo dipakai bersama-sama. Jangan pakai untuk data sungguhan.
        </p>
      </div>
    </div>
  )
}
