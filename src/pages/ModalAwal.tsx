import { useMemo, useState } from "react"
import { useWarung } from "../lib/store"
import { rupiah } from "../lib/format"
import { labaKotor, round2 } from "../lib/inventory"

/**
 * Modal Awal — "uang saya bertambah atau berkurang?"
 *
 * Pemilik warung tidak butuh laporan laba yang rumit. Dia butuh tahu:
 * modal yang saya pakai dulu, sekarang jadi berapa.
 *
 * Nilai sekarang = nilai stok + laba kotor + piutang pelanggan.
 */

const KUNCI = "warung-pintar-modal-awal"

interface ModalAwal {
  nominal: number
  mulai: string
}

function bacaModal(): ModalAwal | null {
  try {
    const mentah = window.localStorage.getItem(KUNCI)
    return mentah ? (JSON.parse(mentah) as ModalAwal) : null
  } catch {
    return null
  }
}

export function ModalAwal() {
  const { stok, transaksi, baris, utang, sesi } = useWarung()
  const [terbuka, setTerbuka] = useState(false)
  const [nominal, setNominal] = useState("")
  const [mulai, setMulai] = useState("")
  const [tersimpan, setTersimpan] = useState(false)

  const modal = useMemo(() => bacaModal(), [tersimpan])

  const posisi = useMemo(() => {
    const nilaiStok = stok.reduce((sum, s) => sum + s.stok * s.harga_modal, 0)

    const hargaModal = new Map(stok.map((s) => [s.barang_id, s.harga_modal]))
    const idsJual = new Set(transaksi.filter((t) => t.tipe === "jual").map((t) => t.id))
    const modalTerjual = baris
      .filter((row) => idsJual.has(row.transaksi_id))
      .reduce((sum, row) => sum + row.jumlah * (hargaModal.get(row.barang_id) ?? 0), 0)
    const omzet = transaksi
      .filter((t) => t.tipe === "jual")
      .reduce((sum, t) => sum + t.total, 0)

    const piutang = utang
      .filter((u) => u.status === "belum_lunas")
      .reduce((sum, u) => sum + Math.max(u.total - u.dibayar, 0), 0)

    return {
      nilaiStok: round2(nilaiStok),
      labaKotor: labaKotor(omzet, modalTerjual),
      piutang: round2(piutang),
      sekarang: round2(nilaiStok + labaKotor(omzet, modalTerjual) + piutang),
    }
  }, [stok, transaksi, baris, utang])

  function simpan() {
    const angka = Number(nominal.replace(/\D/g, ""))
    if (!Number.isFinite(angka) || angka <= 0) return
    try {
      window.localStorage.setItem(
        KUNCI,
        JSON.stringify({ nominal: angka, mulai: mulai || new Date().toISOString() }),
      )
    } catch {
      // Penyimpanan diblokir.
    }
    setTersimpan(true)
    setTerbuka(false)
  }

  const selisih = modal ? round2(posisi.sekarang - modal.nominal) : 0

  return (
    <div className="space-y-5">
      <div className="page-title">
        <div>
          <span className="date-label">Modal Awal</span>
          <h1>Uang saya bertambah atau berkurang?</h1>
          <p>Bandingkan modal yang dipakai dulu dengan posisi sekarang.</p>
        </div>
        <button type="button" className="secondary-action" onClick={() => setTerbuka(!terbuka)}>
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
          </div>
        </section>
      )}

      {!modal ? (
        <section className="panel">
          <p className="form-note">
            Belum diisi modal awal. Isi sekali, lalu aplikasi bisa menunjukkan
            apakah uangmu bertambah atau berkurang sejak itu.
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
              <strong>{rupiah(modal.nominal)}</strong>
              <small>Sejak {new Date(modal.mulai).toLocaleDateString("id-ID")}</small>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <div className="stat-icon inventory">Rp</div>
                <span className="trend positive">sekarang</span>
              </div>
              <span className="stat-label">Posisi sekarang</span>
              <strong>{rupiah(posisi.sekarang)}</strong>
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
                  ? "Uangmu bertambah."
                  : "Uangmu berkurang — cek barang hilang atau harga jual."}
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
                <b style={{ fontSize: 13 }}>{rupiah(posisi.nilaiStok)}</b>
              </li>
              <li className="stock-item">
                <div className="product-code">LB</div>
                <div className="stock-info">
                  <strong>Laba kotor</strong>
                  <small>Penjualan − modal barang terjual</small>
                </div>
                <b style={{ fontSize: 13 }}>{rupiah(posisi.labaKotor)}</b>
              </li>
              <li className="stock-item">
                <div className="product-code">UT</div>
                <div className="stock-info">
                  <strong>Piutang pelanggan</strong>
                  <small>Utang yang belum lunas</small>
                </div>
                <b style={{ fontSize: 13 }}>{rupiah(posisi.piutang)}</b>
              </li>
            </ul>
            <p className="form-note">
              Modal awal dicatat sekali, lalu dihitung ulang dari catatan
              warung. Bukan angka yang diubah manual.
            </p>
            <p className="form-note">
              Dipakai untuk {sesi?.warung ?? "warungmu"}.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
