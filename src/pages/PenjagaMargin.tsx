import { useState } from "react"
import { useWarung } from "../lib/store"
import { persen, rupiah } from "../lib/format"
import { MARGIN_TARGET } from "../lib/margin"

/**
 * Penjaga Margin — harga modal naik diam-diam.
 *
 * Harga modal naik tidak selalu terasa. Yang terasa belakangan: margin
 * menyusut, dan laba ikut terkikis. Halaman ini membandingkan modal dulu
 * dengan modal sekarang, lalu menawarkan harga jual baru.
 */
export function PenjagaMargin() {
  const { sinyalMargin, margin, ubahHargaJual } = useWarung()
  const [sibuk, setSibuk] = useState("")
  const [galat, setGalat] = useState("")

  async function terapkan(barangId: string, harga: number) {
    setSibuk(barangId)
    setGalat("")
    try {
      await ubahHargaJual(barangId, harga)
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal menyimpan harga.")
    } finally {
      setSibuk("")
    }
  }

  return (
    <div className="space-y-5">
      <div className="page-title">
        <div>
          <span className="date-label">Penjaga Margin</span>
          <h1>Margin yang menyusut</h1>
          <p>Harga modal naik diam-diam. Ini yang baru terasa saat tutup buku.</p>
        </div>
      </div>

      {sinyalMargin.length === 0 ? (
        <section className="panel">
          <p className="form-note">
            Tidak ada barang yang margin-nya menyusut. Harga modal semua barang
            masih sama seperti saat pembelian terakhir.
          </p>
        </section>
      ) : (
        <section className="margin-panel">
          <div className="panel-heading">
            <div>
              <h2>Perlu ditinjau</h2>
              <p>
                Target margin {MARGIN_TARGET}%. Angka dibandingkan dengan harga
                jual sekarang, jadi efek kenaikan modalnya terlihat sendiri.
              </p>
            </div>
          </div>

          {galat && <p className="form-error">{galat}</p>}

          <div>
            {sinyalMargin.map((sinyal) => {
              const baris = margin.find((m) => m.barang_id === sinyal.barangId)
              const tinggiBaru = Math.max(
                6,
                Math.round((sinyal.marginSekarang / 100) * 44),
              )
              const tinggiLama = Math.max(6, Math.round((sinyal.marginSebelumnya / 100) * 44))
              return (
                <div className="margin-row" key={sinyal.barangId}>
                  <div>
                    <strong>{sinyal.nama}</strong>
                    <p>
                      Modal {rupiah(sinyal.hargaModalSebelumnya)} →{" "}
                      {rupiah(sinyal.hargaModal)} per {sinyal.satuan} · margin{" "}
                      {persen(sinyal.marginSebelumnya)} → {persen(sinyal.marginSekarang)}
                    </p>
                    <p className="consignment-hint">{sinyal.alasan}</p>
                    <div className="margin-bars" aria-hidden="true">
                      <span className="margin-bar old" style={{ height: tinggiLama }} />
                      <span className="margin-bar now" style={{ height: tinggiBaru }} />
                    </div>
                    <div className="margin-action">
                      <span className="chip warn">
                        Jual {rupiah(sinyal.hargaJual)} → {rupiah(sinyal.hargaJualSaran)}
                      </span>
                      <button
                        type="button"
                        className="small-action brand"
                        disabled={sibuk === sinyal.barangId}
                        onClick={() => void terapkan(sinyal.barangId, sinyal.hargaJualSaran)}
                      >
                        {sibuk === sinyal.barangId ? "Menyimpan…" : "Atur harga jual"}
                      </button>
                      <button
                        type="button"
                        className="small-action"
                        disabled={sibuk === sinyal.barangId}
                        onClick={() => void terapkan(sinyal.barangId, sinyal.hargaJual)}
                      >
                        Biarkan
                      </button>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      className={sinyal.marginSekarang < MARGIN_TARGET ? "chip danger" : "chip"}
                      style={{ fontSize: 13, padding: "6px 12px" }}
                    >
                      {persen(sinyal.marginSekarang)}
                    </div>
                    <p className="form-note" style={{ marginTop: 8 }}>
                      naik {persen(sinyal.kenaikanModalPersen)}
                    </p>
                    {baris && (
                      <p className="form-note">modal {rupiah(baris.harga_modal)}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Margin semua barang</h2>
            <p>Dihitung dari harga jual dan harga modal terakhir</p>
          </div>
        </div>
        <ul className="stock-list">
          {margin.map((baris) => {
            const tipis = baris.margin_persen < MARGIN_TARGET
            return (
              <li className="stock-item" key={baris.barang_id}>
                <div className="product-code">{baris.satuan.slice(0, 2).toUpperCase()}</div>
                <div className="stock-info">
                  <div>
                    <strong>{baris.nama}</strong>
                    {tipis && <span>tipis</span>}
                  </div>
                  <small>
                    modal {rupiah(baris.harga_modal)} · jual {rupiah(baris.harga_jual)}
                  </small>
                </div>
                <b style={{ fontSize: 13 }}>{persen(baris.margin_persen)}</b>
              </li>
            )
          })}
        </ul>
        <p className="form-note">
          Margin = (harga jual − harga modal) ÷ harga jual. Target {MARGIN_TARGET}%.
        </p>
      </section>
    </div>
  )
}
