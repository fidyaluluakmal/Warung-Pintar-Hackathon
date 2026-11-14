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
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-3xl">🏪</p>
          <h1 className="mt-2 text-xl font-semibold">Warung Pintar</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--teks-lembut)" }}>
            Cukup bicara dan foto. Stok ikut keurus.
          </p>
        </div>

        <form
          className="kartu space-y-4 p-5"
          onSubmit={(event) => {
            event.preventDefault()
            void kirim(email, sandi)
          }}
        >
          <div>
            <label className="label" htmlFor="email">
              {modeLokal ? "Nama warung" : "Email"}
            </label>
            <input
              id="email"
              className="input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="sandi">
              {modeLokal ? "Nama penjual" : "Sandi"}
            </label>
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

          {galat && (
            <p className="text-sm" style={{ color: "var(--bahaya)" }}>
              {galat}
            </p>
          )}

          <button type="submit" className="tombol-utama w-full" disabled={sibuk}>
            {sibuk ? "Membuka…" : "Masuk"}
          </button>

          {!modeLokal && (
            <>
              <div className="flex items-center gap-3 text-xs" style={{ color: "var(--teks-lembut)" }}>
                <span className="h-px flex-1" style={{ background: "var(--garis)" }} />
                atau
                <span className="h-px flex-1" style={{ background: "var(--garis)" }} />
              </div>

              <button
                type="button"
                className="tombol-sekunder w-full"
                disabled={sibuk}
                onClick={() => void kirim("demo@warungpintar.app", "warungpintar2026")}
              >
                Coba akun demo
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
