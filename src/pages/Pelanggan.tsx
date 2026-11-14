import { useMemo, useState } from "react"
import { Icon } from "../components/Icon"
import { Modal } from "../components/Modal"
import { angkaRapi, rupiah, tanggalShort } from "../lib/format"
import {
  hitungRingkasanPelanggan,
  inisialPelanggan,
  rataRataBelanja,
  urutPelanggan,
  type UrutanPelanggan,
} from "../lib/pelanggan"
import { selisihHari } from "../lib/calendar"
import { pesanUntukUser } from "../lib/pesan"
import { useWarung } from "../lib/store"
import type { NavLabel } from "../lib/nav"

type Filter = "semua" | "utang" | "lunas"

/**
 * Pelanggan.
 *
 * Kasir mencatat barang; buku ini mengingat orangnya. Pelanggan warung sering
 * cuma punya nama panggilan, jadi nama adalah identitas utamanya dan nomor
 * telepon opsional.
 */
export function Pelanggan({ onPindah }: { onPindah?: (nav: NavLabel) => void }) {
  const { pelanggan, transaksi, baris, barang, utang, simpanPelanggan } = useWarung()
  const [cari, setCari] = useState("")
  const [filter, setFilter] = useState<Filter>("semua")
  const [urutan, setUrutan] = useState<UrutanPelanggan>("utang")
  const [nama, setNama] = useState("")
  const [telepon, setTelepon] = useState("")
  const [sibuk, setSibuk] = useState(false)
  const [pesan, setPesan] = useState("")
  const [galat, setGalat] = useState("")
  const [dipilih, setDipilih] = useState<string | null>(null)

  /**
   * Ringkasan per pelanggan.
   *
   * Dihitung dari data store, bukan dibaca langsung dari database — jadi
   * halaman ini jalan juga di mode demo lokal.
   */
  const ringkasan = useMemo(
    () =>
      hitungRingkasanPelanggan(
        pelanggan,
        transaksi.filter((t) => t.tipe === "jual"),
        baris,
        barang.map((b) => ({ id: b.id, nama: b.nama })),
        utang.map((u) => ({
          pelanggan: u.pelanggan,
          total: u.total,
          dibayar: u.dibayar,
          status: u.status,
        })),
      ),
    [pelanggan, transaksi, baris, barang, utang],
  )

  const detail = useMemo(
    () => ringkasan.find((p) => p.nama === dipilih) ?? null,
    [ringkasan, dipilih],
  )

  const daftar = useMemo(() => {
    const kunci = cari.toLowerCase().trim()
    let hasil = ringkasan
    if (filter === "utang") hasil = hasil.filter((p) => p.totalUtang > 0)
    if (filter === "lunas") hasil = hasil.filter((p) => p.totalUtang === 0)
    if (kunci) {
      hasil = hasil.filter(
        (p) =>
          p.nama.toLowerCase().includes(kunci) || (p.telepon ?? "").includes(kunci),
      )
    }
    return urutPelanggan(hasil, urutan)
  }, [ringkasan, filter, cari, urutan])

  async function tambah() {
    if (!nama.trim()) {
      setGalat("Isi dulu nama pelanggan.")
      return
    }
    setSibuk(true)
    setGalat("")
    setPesan("")
    try {
      await simpanPelanggan({
        nama: nama.trim(),
        telepon: telepon.trim() || undefined,
      })
      setNama("")
      setTelepon("")
      setPesan(`${nama.trim()} sudah masuk buku pelanggan.`)
    } catch (kesalahan) {
      setGalat(pesanUntukUser(kesalahan, "Gagal menyimpan pelanggan. Coba lagi."))
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="customers-page">
      <section className="page-title">
        <div>
          <span className="date-label">Buku pelanggan</span>
          <h1>Pelanggan</h1>
          <p>Kasir mencatat barang; buku ini mengingat orangnya — utang, favorit, kapan datang.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="primary-action" onClick={() => void tambah()}>
            <Icon name="plus" size={16} /> Tambah pelanggan
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => onPindah?.("Simpen Dulu")}
          >
            <Icon name="receipt" size={16} /> Tambah utang
          </button>
        </div>
      </section>

      <section className="inventory-summary">
        <article>
          <span className="summary-icon orange">
            <Icon name="user" size={19} />
          </span>
          <div>
            <small>Total pelanggan</small>
            <strong>
              {ringkasan.length} <em>orang</em>
            </strong>
          </div>
        </article>
        <article>
          <span className="summary-icon green">
            <Icon name="receipt" size={19} />
          </span>
          <div>
            <small>Utang berjalan</small>
            <strong>{rupiah(totalUtang(ringkasan))}</strong>
          </div>
        </article>
        <article>
          <span className="summary-icon blue">
            <Icon name="warning" size={19} />
          </span>
          <div>
            <small>Menunggak lebih dari 7 hari</small>
            <strong>
              {ringkasan.filter((p) => p.totalUtang > 0 && p.utangTerlama !== null && selisihHari(p.utangTerlama) > 7).length}{" "}
              <em>orang</em>
            </strong>
          </div>
        </article>
      </section>

      <div className="customers-toolbar">
        <label>
          <Icon name="search" size={17} />
          <input
            value={cari}
            onChange={(event) => setCari(event.target.value)}
            placeholder="Cari nama atau nomor..."
            aria-label="Cari pelanggan"
          />
        </label>
        <div className="filter-pills">
          <button
            type="button"
            className={filter === "semua" ? "active" : ""}
            onClick={() => setFilter("semua")}
          >
            Semua
          </button>
          <button
            type="button"
            className={filter === "utang" ? "active" : ""}
            onClick={() => setFilter("utang")}
          >
            Ada utang
          </button>
          <button
            type="button"
            className={filter === "lunas" ? "active" : ""}
            onClick={() => setFilter("lunas")}
          >
            Lunas
          </button>
        </div>
      </div>

      <div className="filter-pills" style={{ marginTop: 8 }}>
        <button
          type="button"
          className={urutan === "utang" ? "active" : ""}
          onClick={() => setUrutan("utang")}
        >
          Utang terbesar
        </button>
        <button
          type="button"
          className={urutan === "belanja" ? "active" : ""}
          onClick={() => setUrutan("belanja")}
        >
          Belanja terbesar
        </button>
        <button
          type="button"
          className={urutan === "nama" ? "active" : ""}
          onClick={() => setUrutan("nama")}
        >
          Nama
        </button>
      </div>

      <section className="panel" style={{ marginTop: 14 }}>
        <div className="panel-heading">
          <div>
            <h2>Tambah pelanggan</h2>
            <p>Nama boleh tanpa nomor telepon — warung banyak pelanggan yang cuma punya nama panggilan.</p>
          </div>
        </div>
        <div className="capital-form" style={{ marginTop: 14 }}>
          <label>
            Nama pelanggan
            <input
              value={nama}
              onChange={(event) => setNama(event.target.value)}
              placeholder="mis. Pak Yono"
            />
          </label>
          <label>
            Nomor telepon (opsional)
            <input
              inputMode="tel"
              value={telepon}
              onChange={(event) => setTelepon(event.target.value)}
              placeholder="0812-3456-7890"
            />
          </label>
          <button className="primary-action" onClick={() => void tambah()} disabled={sibuk}>
            <Icon name="plus" size={16} /> {sibuk ? "Menyimpan…" : "Tambah pelanggan"}
          </button>
        </div>
        {pesan && <p className="ask-note">{pesan}</p>}
        {galat && <p className="form-error">{galat}</p>}
      </section>

      <div className="customers-grid" style={{ marginTop: 16 }}>
        {daftar.map((pelanggan) => (
          <button
            type="button"
            className="customer-card"
            key={pelanggan.id ?? pelanggan.nama}
            onClick={() => setDipilih(pelanggan.nama)}
          >
            <div className="customer-head">
              <span className="customer-avatar">{inisialPelanggan(pelanggan.nama)}</span>
              <div>
                <strong>{pelanggan.nama}</strong>
                <small>
                  {pelanggan.telepon ?? "Tanpa nomor"}
                  {pelanggan.kunjunganTerakhir !== null
                    ? ` · ${selisihHari(pelanggan.kunjunganTerakhir)} hari lalu`
                    : ""}
                </small>
              </div>
            </div>
            <div className="customer-meta">
              {pelanggan.totalUtang > 0 ? (
                <span className="customer-status menunggak">
                  Ada utang · {rupiah(pelanggan.totalUtang)}
                  {pelanggan.utangTerlama ? ` · ${selisihHari(pelanggan.utangTerlama)} hari` : ""}
                </span>
              ) : (
                <span className="customer-status lunas">Lunas</span>
              )}
              {!pelanggan.telepon && <span className="customer-status belum">Lengkapi nomor</span>}
              {pelanggan.barangFavorit && (
                <small>favorit: {pelanggan.barangFavorit}</small>
              )}
            </div>
          </button>
        ))}
        {daftar.length === 0 && (
          <div className="empty-state">
            <Icon name="user" size={26} />
            <strong>Belum ada pelanggan</strong>
            <span>Catat pelanggan lewat suara, atau tambahkan di atas.</span>
          </div>
        )}
      </div>

      {detail && (
        <Modal
          label={`Riwayat ${detail.nama}`}
          onClose={() => setDipilih(null)}
        >
          <span className="modal-kicker">Buku pelanggan</span>
          <h2>{detail.nama}</h2>
          <p>
            {detail.telepon ?? "Tanpa nomor telepon"}
            {detail.kunjunganTerakhir !== null
              ? ` · terakhir datang ${selisihHari(detail.kunjunganTerakhir)} hari lalu`
              : " · belum pernah datang"}
            {` · ${detail.labelKunjungan}`}
          </p>
          {detail.catatan && <p className="form-note">{detail.catatan}</p>}

          <ul className="debt-list" style={{ marginTop: 16 }}>
            <li className="debt-item">
              <div className="debt-avatar">Rp</div>
              <div>
                <strong>Total belanja</strong>
                <small>
                  {detail.jumlahKunjungan} kunjungan · rata-rata{" "}
                  {rupiah(rataRataBelanja([detail]))}
                </small>
              </div>
              <b>{rupiah(detail.totalBelanja)}</b>
            </li>
            <li className="debt-item">
              <div className="debt-avatar">{detail.initials}</div>
              <div>
                <strong>Barang favorit</strong>
                <small>
                  {detail.barangFavorit
                    ? `${detail.nama} · ${angkaRapi(detail.qtyFavorit)}`
                    : "belum ada"}
                </small>
              </div>
              <b>{detail.labelUtang}</b>
            </li>
            <li className="debt-item">
              <div className="debt-avatar">UT</div>
              <div>
                <strong>Utang berjalan</strong>
                <small>
                  {detail.utangTerlama
                    ? `terlama ${selisihHari(detail.utangTerlama)} hari`
                    : "tidak ada"}
                </small>
              </div>
              <b>{rupiah(detail.totalUtang)}</b>
            </li>
          </ul>

          <div className="panel-heading" style={{ marginTop: 20 }}>
            <div>
              <h2>Riwayat pembelian</h2>
              <p>Transaksi yang menyebut nama pelanggan ini</p>
            </div>
          </div>

          {detail.pembelian.length === 0 ? (
            <p className="form-note" style={{ marginTop: 12 }}>
              Belum ada pembelian yang menyebut nama ini.
            </p>
          ) : (
            <ul className="debt-list" style={{ marginTop: 12 }}>
              {detail.pembelian.slice(0, 12).map((item, index) => (
                <li className="debt-item" key={`${item.transaksiId}-${index}`}>
                  <div className="debt-avatar">{item.jumlah}</div>
                  <div>
                    <strong>{item.namaBarang}</strong>
                    <small>
                      {tanggalShort(item.tanggal)} · {angkaRapi(item.jumlah)} {item.satuan}
                    </small>
                  </div>
                  <b>{rupiah(item.total)}</b>
                </li>
              ))}
            </ul>
          )}

          <div className="modal-actions">
            <button type="button" className="secondary-action" onClick={() => setDipilih(null)}>
              Tutup
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function totalUtang(daftar: Array<{ totalUtang: number }>): number {
  return daftar.reduce((sum, p) => sum + p.totalUtang, 0)
}
