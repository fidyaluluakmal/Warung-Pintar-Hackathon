import { useMemo, useState } from "react"
import { useWarung } from "../lib/store"
import { rupiah, tanggalPanjang } from "../lib/format"
import { hariIniWib } from "../lib/calendar"
import { bacaModalAwal, simpanModalAwal, susunLaporanModal } from "../lib/capital"

/**
 * Modal Awal — "uang saya bertambah atau berkurang?"
 *
 * Pemilik warung tidak butuh laporan laba yang rumit. Dia butuh tahu:
 * modal yang saya pakai dulu, sekarang jadi berapa.
 *
 * Perhitungannya sama dengan panel di Beranda — keduanya baca fungsi yang
 * sama di `src/lib/capital.ts`, jadi angkanya tidak mungkin berbeda.
 */
export function ModalAwal() {
  const { stok, transaksi, baris, utang, sesi } = useWarung()
  const [terbuka, setTerbuka] = useState(false)
  const [nominal, setNominal] = useState("")
  const [mulai, setMulai] = useState("")
  const [tersimpan, setTersimpan] = useState(false)
  const [galat, setGalat] = useState("")

  const modal = useMemo(() => bacaModalAwal(), [tersimpan])

  const laporan = useMemo(
    () =>
      modal
        ? susunLaporanModal(modal, stok, transaksi, baris, utang)
        : null,
    [modal, stok, transaksi, baris, utang],
  )

  function simpan() {
    const angka = Number(nominal.replace(/\D/g, ""))
    if (!Number.isFinite(angka) || angka <= 0) {
      setGalat("Modal awal harus lebih dari nol.")
      return
    }
    simpanModalAwal({ amount: angka, since: mulai || hariIniWib() })
    setTersimpan((nilai) => !nilai)
    setGalat("")
    setTerbuka(false)
  }

  function bukaForm() {
    setNominal(modal ? String(modal.amount) : "")
    setMulai(modal?.since ?? hariIniWib())
    setGalat("")
    setTerbuka((nilai) => !nilai)
  }

  const selisih = laporan?.change ?? 0

  return (
    <div className="space-y-5">
      <div className="page-title">
        <div>
          <span className="date-label">Modal Awal</span>
          <h1>Uang saya bertambah atau berkurang?</h1>
          <p>Bandingkan modal yang dipakai dulu dengan posisi sekarang.</p>
        </div>
        <button type="button" className="secondary-action" onClick={bukaForm}>
          {modal ? "Ubah modal" : "Isi modal awal"}
        </button>
      </div>

      {terbuka && (
        <section className="panel">
          <div style={{ display: "grid", gap: 14, maxWidth: 420 }}>
            <div>
              <label className="label" htmlFor="modal-nominal">
                Modal awal (rupiah)
              </label>
              <input
                id="modal-nominal"
                className="input"
                inputMode="numeric"
                value={nominal}
                onChange={(event) => setNominal(event.target.value)}
                placeholder="mis. 5000000"
              />
            </div>
            <div>
              <label className="label" htmlFor="modal-mulai">
                Mulai dari tanggal
              </label>
              <input
                id="modal-mulai"
                type="date"
                className="input"
                value={mulai}
                onChange={(event) => setMulai(event.target.value)}
              />
            </div>
            <div>
              <button type="button" className="primary-action" onClick={simpan}>
                Simpan modal awal
              </button>
            </div>
            {galat && <div className="form-error">{galat}</div>}
          </div>
        </section>
      )}

      {!modal || !laporan ? (
        <section className="panel">
          <p className="form-note">
            Belum diisi modal awal. Isi sekali, lalu aplikasi bisa menunjukkan
            apakah uang Anda bertambah atau berkurang sejak itu.
          </p>
        </section>
      ) : (
        <>
          <div className="stats-grid">
            <article className="stat-card">
              <div className="stat-top">
                <div className="stat-icon revenue">Rp</div>
                <span className={selisih >= 0 ? "trend positive" : "trend warning"}>
                  {selisih >= 0 ? "bertambah" : "berkurang"}
                </span>
              </div>
              <span className="stat-label">Modal awal</span>
              <strong>{rupiah(laporan.initial)}</strong>
              <small>Sejak {tanggalPanjang(`${laporan.since}T00:00:00+07:00`)}</small>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <div className="stat-icon inventory">Rp</div>
                <span className="trend positive">sekarang</span>
              </div>
              <span className="stat-label">Posisi sekarang</span>
              <strong>{rupiah(laporan.estimatedNow)}</strong>
              <small>Stok + laba kotor + piutang</small>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <div className="stat-icon profit">
                  {selisih >= 0 ? "+" : "-"}
                </div>
                <span className={selisih >= 0 ? "trend positive" : "trend warning"}>
                  {selisih >= 0 ? "naik" : "turun"}
                </span>
              </div>
              <span className="stat-label">Selisih</span>
              <strong>{rupiah(Math.abs(selisih))}</strong>
              <small>
                {selisih >= 0
                  ? "Uang Anda bertambah."
                  : "Uang Anda berkurang — cek barang hilang atau harga jual."}
              </small>
            </article>
          </div>

          <section className="panel" style={{ marginTop: 16 }}>
            <div className="panel-heading">
              <div>
                <h2>Dari mana posisinya?</h2>
                <p>Rincian nilai sekarang</p>
              </div>
            </div>
            <ul className="stock-list">
              <li className="stock-item">
                <div className="product-code">ST</div>
                <div className="stock-info">
                  <strong>Nilai stok di rak</strong>
                  <small>Stok sekarang × harga modal</small>
                </div>
                <b style={{ fontSize: 13 }}>{rupiah(laporan.stockValue)}</b>
              </li>
              <li className="stock-item">
                <div className="product-code">LB</div>
                <div className="stock-info">
                  <strong>Laba kotor</strong>
                  <small>Penjualan − modal barang terjual</small>
                </div>
                <b style={{ fontSize: 13 }}>{rupiah(laporan.grossProfit)}</b>
              </li>
              <li className="stock-item">
                <div className="product-code">UT</div>
                <div className="stock-info">
                  <strong>Piutang pelanggan</strong>
                  <small>Utang yang belum lunas</small>
                </div>
                <b style={{ fontSize: 13 }}>{rupiah(laporan.openDebt)}</b>
              </li>
            </ul>
            <p className="form-note">
              Modal awal dicatat sekali, lalu dihitung ulang dari catatan
              warung. Bukan angka yang diubah manual.
            </p>
            <p className="form-note">Dipakai untuk {sesi?.warung ?? "warung Anda"}.</p>
          </section>
        </>
      )}
    </div>
  )
}
