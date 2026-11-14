import { useMemo, useState } from "react"
import { Icon } from "../components/Icon"
import { Modal } from "../components/Modal"
import { useWarung } from "../lib/store"
import { pesanUntukUser } from "../lib/pesan"
import { angka, persen, rupiah } from "../lib/format"
import {
  hitungPenjualanTitip,
  omzetTitip,
  saranTitip,
  sisaTitip,
  statistikTitip,
  teksPembayaranTitip,
} from "../lib/titip"
import { SATUAN_TERSEDIA, type Satuan } from "../lib/types"

/**
 * Satuan yang diketik bebas, tapi aplikasi hanya mengenal satuan yang
 * dipakai di katalog. Kalau tidak dikenal, dipakai "pcs".
 */
function satuanValid(nilai: string): Satuan {
  const cari = SATUAN_TERSEDIA.find((s) => s.toLowerCase() === nilai.trim().toLowerCase())
  return cari ?? "pcs"
}

/**
 * Titip Jual (konsinyasi).
 *
 * Warung jadi etalase barang milik orang lain. Yang dihitung bukan stok
 * warung, tapi komisi warung dan bagian yang harus dibayar ke pemilik barang.
 */
export function TitipJual() {
  const { titip, simpanTitip, catatTitipTerjual, tutupTitip } = useWarung()
  const [baruTerbuka, setBaruTerbuka] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState("")
  const [tersalin, setTersalin] = useState(false)
  const [jualUntuk, setJualUntuk] = useState<string | null>(null)
  const [jumlahJual, setJumlahJual] = useState("")
  const [form, setForm] = useState({
    pemilik: "",
    namaBarang: "",
    satuan: "pcs",
    qty: "",
    hargaPemilik: "",
    hargaJual: "",
    komisiPersen: "10",
  })

  const stats = useMemo(() => statistikTitip(titip), [titip])
  const aktif = titip.filter((row) => row.status === "aktif")
  const selesai = titip.filter((row) => row.status === "selesai")
  const rowJual = jualUntuk ? titip.find((row) => row.id === jualUntuk) : null

  async function tambah() {
    setSibuk(true)
    setGalat("")
    try {
      await simpanTitip({
        pemilik: form.pemilik,
        namaBarang: form.namaBarang,
        satuan: satuanValid(form.satuan),
        qty: Number(form.qty.replace(/\D/g, "")) || 0,
        hargaPemilik: Number(form.hargaPemilik.replace(/\D/g, "")) || 0,
        hargaJual: Number(form.hargaJual.replace(/\D/g, "")) || 0,
        komisiPersen: Math.min(
          100,
          Math.max(0, Number(form.komisiPersen.replace(",", ".").replace(/[^\d.]/g, "")) || 0),
        ),
      })
      setForm({
        pemilik: "",
        namaBarang: "",
        satuan: "pcs",
        qty: "",
        hargaPemilik: "",
        hargaJual: "",
        komisiPersen: "10",
      })
      setBaruTerbuka(false)
    } catch (kesalahan) {
      setGalat(pesanUntukUser(kesalahan, "Gagal menambah titipan. Coba lagi."))
    } finally {
      setSibuk(false)
    }
  }

  async function catatTerjual() {
    if (!rowJual) return
    const qty = Number(jumlahJual.replace(/\D/g, "")) || 0
    if (qty <= 0) {
      setGalat("Jumlah yang terjual harus lebih dari nol.")
      return
    }
    setSibuk(true)
    setGalat("")
    try {
      await catatTitipTerjual(rowJual.id, qty)
      setJualUntuk(null)
      setJumlahJual("")
    } catch (kesalahan) {
      setGalat(pesanUntukUser(kesalahan, "Gagal mencatat penjualan titipan. Coba lagi."))
    } finally {
      setSibuk(false)
    }
  }

  async function salinRincian() {
    try {
      await navigator.clipboard.writeText(teksPembayaranTitip(titip))
      setTersalin(true)
      window.setTimeout(() => setTersalin(false), 2500)
    } catch {
      setTersalin(false)
    }
  }

  return (
    <div className="consignments-page">
      <section className="page-title">
        <div>
          <span className="date-label">Titip jual</span>
          <h1>Barang titipan</h1>
          <p>
            Warung jadi etalase barang milik orang lain. Hitung komisi warung dan bagian yang
            harus dibayar ke pemilik barang.
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="secondary-action"
            onClick={() => void salinRincian()}
            disabled={stats.jumlahTitip === 0}
          >
            <Icon name={tersalin ? "check" : "receipt"} size={18} />
            {tersalin ? "Tersalin" : "Rincian pembayaran"}
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={() => {
              setGalat("")
              setBaruTerbuka(true)
            }}
          >
            <Icon name="plus" size={18} /> Tambah titipan
          </button>
        </div>
      </section>

      <section className="inventory-summary">
        <article>
          <span className="summary-icon green">
            <Icon name="box" />
          </span>
          <div>
            <small>Omzet titipan</small>
            <strong>{rupiah(stats.omzet)}</strong>
          </div>
        </article>
        <article>
          <span className="summary-icon orange">
            <Icon name="spark" />
          </span>
          <div>
            <small>Komisi warung</small>
            <strong>{rupiah(stats.komisi)}</strong>
          </div>
        </article>
        <article>
          <span className="summary-icon blue">
            <Icon name="receipt" />
          </span>
          <div>
            <small>Harus dibayar ke pemilik</small>
            <strong>{rupiah(stats.harusDibayar)}</strong>
          </div>
        </article>
        <article>
          <span className="summary-icon purple">
            <Icon name="user" />
          </span>
          <div>
            <small>Sisa di rak</small>
            <strong>
              {angka(stats.barangSisa)} <em>barang</em>
            </strong>
          </div>
        </article>
      </section>

      {titip.length === 0 ? (
        <section className="empty-state">
          <Icon name="box" size={26} />
          <strong>Belum ada barang titipan</strong>
          <span>
            Warung sering dititipi barang tetangga. Catat di sini supaya komisi dan bagian pemilik
            barang tidak tertukar.
          </span>
        </section>
      ) : (
        <div className="consignments-list">
          {aktif.map((row) => {
            const sisa = sisaTitip(row)
            const jual = omzetTitip(row)
            return (
              <article className="consignment-card" key={row.id}>
                <div className="consignment-head">
                  <div>
                    <strong>{row.nama_barang}</strong>
                    <small>
                      dari {row.pemilik} · {angka(row.qty)} {row.satuan} · komisi{" "}
                      {persen(row.komisi_persen)}
                    </small>
                  </div>
                  <span className="consignment-sisa">
                    sisa {angka(sisa)} {row.satuan}
                  </span>
                </div>
                <div className="consignment-metrics">
                  <div>
                    <small>Terjual</small>
                    <strong>
                      {angka(row.terjual)} {row.satuan}
                    </strong>
                  </div>
                  <div>
                    <small>Omzet</small>
                    <strong>{rupiah(jual.omzet)}</strong>
                  </div>
                  <div>
                    <small>Komisi warung</small>
                    <strong>{rupiah(jual.komisi)}</strong>
                  </div>
                  <div>
                    <small>Bagian pemilik</small>
                    <strong>{rupiah(jual.bagianPemilik)}</strong>
                  </div>
                </div>
                <p className="consignment-hint">{saranTitip(row)}</p>
                <div className="consignment-actions">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => {
                      setJualUntuk(row.id)
                      setJumlahJual("")
                      setGalat("")
                    }}
                    disabled={sisa <= 0}
                  >
                    <Icon name="plus" size={15} /> Catat yang terjual
                  </button>
                  <button
                    type="button"
                    className="row-action"
                    onClick={() => void tutupTitip(row.id)}
                    disabled={sibuk}
                  >
                    <Icon name="check" size={14} /> Selesai &amp; bayar
                  </button>
                </div>
              </article>
            )
          })}

          {selesai.length > 0 && (
            <section className="consignment-done">
              <h2>Sudah selesai</h2>
              {selesai.map((row) => {
                const jual = omzetTitip(row)
                return (
                  <p key={row.id}>
                    {row.nama_barang} dari {row.pemilik}: {angka(row.terjual)} {row.satuan} laku,
                    bagian pemilik {rupiah(jual.bagianPemilik)}.
                  </p>
                )
              })}
            </section>
          )}
        </div>
      )}

      {baruTerbuka && (
        <Modal label="Tambah barang titipan" onClose={() => setBaruTerbuka(false)}>
          <span className="modal-kicker">Barang titipan</span>
          <h2>Siapa yang menitipkan?</h2>
          <p>
            Barang titipan tidak masuk stok warung. Yang dicatat: komisi warung dan bagian yang
            harus dibayar ke pemilik barang.
          </p>
          <div className="customer-form">
            <label>
              Nama pemilik barang
              <input
                value={form.pemilik}
                onChange={(event) => setForm({ ...form, pemilik: event.target.value })}
                placeholder="Contoh: Pak Hendra"
              />
            </label>
            <label>
              Nama barang
              <input
                value={form.namaBarang}
                onChange={(event) => setForm({ ...form, namaBarang: event.target.value })}
                placeholder="Contoh: Keripik Singkong"
              />
            </label>
            <label>
              Satuan
              <input
                value={form.satuan}
                onChange={(event) => setForm({ ...form, satuan: event.target.value })}
                placeholder="pcs"
              />
            </label>
            <label>
              Jumlah titipan
              <input
                inputMode="numeric"
                value={form.qty}
                onChange={(event) => setForm({ ...form, qty: event.target.value })}
                placeholder="40"
              />
            </label>
            <label>
              Harga dari pemilik
              <input
                inputMode="numeric"
                value={form.hargaPemilik}
                onChange={(event) => setForm({ ...form, hargaPemilik: event.target.value })}
                placeholder="8000"
              />
            </label>
            <label>
              Harga jual ke pelanggan
              <input
                inputMode="numeric"
                value={form.hargaJual}
                onChange={(event) => setForm({ ...form, hargaJual: event.target.value })}
                placeholder="10000"
              />
            </label>
            <label>
              Komisi warung (%)
              <input
                inputMode="numeric"
                value={form.komisiPersen}
                onChange={(event) => setForm({ ...form, komisiPersen: event.target.value })}
                placeholder="10"
              />
            </label>
          </div>
          {galat && <div className="form-error">{galat}</div>}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setBaruTerbuka(false)}
            >
              Batal
            </button>
            <button
              type="button"
              className="primary-action"
              onClick={() => void tambah()}
              disabled={sibuk}
            >
              {sibuk ? "Menyimpan…" : "Simpan titipan"}
            </button>
          </div>
        </Modal>
      )}

      {rowJual && (
        <Modal
          label={`Catat yang terjual: ${rowJual.nama_barang}`}
          onClose={() => setJualUntuk(null)}
        >
          <span className="modal-kicker">Penjualan titipan</span>
          <h2>Berapa yang terjual?</h2>
          <p>
            Sisa titipan {angka(sisaTitip(rowJual))} {rowJual.satuan} dari {rowJual.pemilik}.
          </p>
          <div className="customer-form">
            <label>
              Jumlah terjual
              <input
                inputMode="numeric"
                value={jumlahJual}
                onChange={(event) => setJumlahJual(event.target.value)}
                placeholder="Contoh: 5"
                autoFocus
              />
            </label>
          </div>
          {jumlahJual !== "" && (
            <div className="consignment-preview">
              <p>
                {(() => {
                  const jual = hitungPenjualanTitip(
                    rowJual,
                    Number(jumlahJual.replace(/\D/g, "")) || 0,
                  )
                  return `Omzet ${rupiah(jual.omzet)} · komisi warung ${rupiah(jual.komisi)} · bagian pemilik ${rupiah(jual.bagianPemilik)}`
                })()}
              </p>
            </div>
          )}
          {galat && <div className="form-error">{galat}</div>}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setJualUntuk(null)}
            >
              Batal
            </button>
            <button
              type="button"
              className="primary-action"
              onClick={() => void catatTerjual()}
              disabled={sibuk}
            >
              {sibuk ? "Menyimpan…" : "Catat yang terjual"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
