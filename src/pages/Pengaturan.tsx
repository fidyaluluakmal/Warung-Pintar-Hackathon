import { useState } from "react"
import { useWarung } from "../lib/store"
import { useTema, type Tema } from "../lib/theme"
import { Icon } from "../components/Icon"

/**
 * Pengaturan: tampilan, akun warung, dan data demo.
 */
export function Pengaturan() {
  const { sesi, keluar, resetDemo, barang, transaksi, utang } = useWarung()
  const { tema, ganti } = useTema()
  const [warung, setWarung] = useState(sesi?.warung ?? "")
  const [pemilik, setPemilik] = useState(sesi?.pemilik ?? "")
  const [tersimpan, setTersimpan] = useState(false)

  function simpanAkun() {
    try {
      window.localStorage.setItem("warung-pintar-akun", JSON.stringify({ warung, pemilik }))
    } catch {
      // Penyimpanan diblokir: tidak apa-apa.
    }
    setTersimpan(true)
    window.setTimeout(() => setTersimpan(false), 2500)
  }

  const opsiTema: Array<{ nilai: Tema; label: string; ikon: "sun" | "moon" | "settings" }> = [
    { nilai: "terang", label: "Terang", ikon: "sun" },
    { nilai: "gelap", label: "Gelap", ikon: "moon" },
    { nilai: "sistem", label: "Ikuti sistem", ikon: "settings" },
  ]

  return (
    <div className="space-y-5">
      <div className="page-title">
        <div>
          <span className="date-label">Pengaturan</span>
          <h1>Pengaturan warung</h1>
          <p>Tampilan, akun, dan data contoh.</p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Tampilan</h2>
            <p>Terang, gelap, atau ikut pengaturan perangkat.</p>
          </div>
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {opsiTema.map((opsi) => (
            <button
              key={opsi.nilai}
              type="button"
              className={tema === opsi.nilai ? "small-action brand" : "small-action"}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 38 }}
              onClick={() => ganti(opsi.nilai)}
            >
              <Icon name={opsi.ikon} size={15} />
              {opsi.label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Akun warung</h2>
            <p>Nama warung dan nama pemilik yang tampil di aplikasi.</p>
          </div>
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
          <div>
            <label className="label" htmlFor="nama-warung">
              Nama warung
            </label>
            <input
              id="nama-warung"
              className="input"
              value={warung}
              onChange={(event) => setWarung(event.target.value)}
              placeholder="Warung Sumber Rejeki"
            />
          </div>
          <div>
            <label className="label" htmlFor="nama-pemilik">
              Nama pemilik
            </label>
            <input
              id="nama-pemilik"
              className="input"
              value={pemilik}
              onChange={(event) => setPemilik(event.target.value)}
              placeholder="Pak Andi"
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" className="primary-action" onClick={simpanAkun}>
              Simpan
            </button>
            {tersimpan && <span className="chip">Tersimpan</span>}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Data contoh</h2>
            <p>
              {barang.length} barang · {transaksi.length} transaksi · {utang.length} catatan utang
            </p>
          </div>
        </div>
        <p className="form-note">
          Data di demo adalah simulasi. Reset hanya menghapus transaksi dan
          catatan utang — katalog barang tetap ada.
        </p>
        <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="secondary-action" onClick={resetDemo}>
            Reset data demo
          </button>
          <button type="button" className="secondary-action" onClick={() => void keluar()}>
            Keluar dari akun
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Tentang aplikasi</h2>
            <p>Warung Pintar — dibangun saat Hackathon Cybertech 2026.</p>
          </div>
        </div>
        <p className="form-note">
          AI hanya mengusulkan, pemilik yang mengonfirmasi. Semua angka dihitung
          di kode, bukan dikarang AI. Kunci API hanya ada di server.
        </p>
      </section>
    </div>
  )
}
