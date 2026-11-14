import { useMemo, useState } from "react"
import { useWarung } from "../lib/store"
import { Icon } from "../components/Icon"
import { angka, rupiah, rupiahRingkas } from "../lib/format"
import type { NavLabel } from "../lib/nav"

type Filter = "semua" | "perlu" | "aman"

/**
 * Stok barang.
 *
 * Tampilan tabel: nama barang, stok saat ini, nilai stok, status, dan tombol
 * restok. Ringkasan di atas menunjukkan gambaran singkat persediaan.
 */
export function StokBarang({
  cari: cariAwal = "",
  onPindah,
}: {
  cari?: string
  onPindah?: (nav: NavLabel) => void
}) {
  const { stok, saranBeli, keluar } = useWarung()
  const [cari, setCari] = useState(cariAwal)
  const [filter, setFilter] = useState<Filter>("semua")

  const ringkasan = useMemo(() => {
    const nilaiStok = stok.reduce((sum, s) => sum + s.stok * s.harga_modal, 0)
    const perluRestok = stok.filter((s) => s.stok <= s.min_stok)
    const omzetBulanIni = stok.reduce((sum, s) => sum + s.harga_jual * s.stok, 0)
    return {
      total: stok.length,
      perluRestok: perluRestok.length,
      nilaiStok: round2(nilaiStok),
      potensiOmzet: round2(omzetBulanIni),
    }
  }, [stok])

  const daftar = useMemo(() => {
    const kunci = cari.toLowerCase().trim()
    let hasil = [...stok]
    if (filter === "perlu") hasil = hasil.filter((s) => s.stok <= s.min_stok)
    if (filter === "aman") hasil = hasil.filter((s) => s.stok > s.min_stok)
    if (kunci) hasil = hasil.filter((s) => s.nama.toLowerCase().includes(kunci))
    return hasil.sort((a, b) => {
      const aTipis = a.stok <= a.min_stok ? 0 : 1
      const bTipis = b.stok <= b.min_stok ? 0 : 1
      if (aTipis !== bTipis) return aTipis - bTipis
      return a.nama.localeCompare(b.nama, "id")
    })
  }, [stok, cari, filter])

  const saranUntuk = (barangId: string) =>
    saranBeli.find((saran) => saran.barangId === barangId)

  return (
    <>
      <section className="page-title">
        <div>
          <span className="date-label">Inventori warung</span>
          <h1>Stok barang</h1>
          <p>Pantau persediaan dan rencana pembelian tanpa menebak.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="secondary-action" onClick={() => onPindah?.("Cek Stok")}>
            <Icon name="scan" size={16} /> Hitung stok
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => onPindah?.("Foto Nota")}
          >
            <Icon name="camera" size={16} /> Pindai nota
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => onPindah?.("Riwayat")}
          >
            <Icon name="receipt" size={16} /> Riwayat nota
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => onPindah?.("Kasir")}
          >
            <Icon name="mic" size={16} /> Tambah lewat suara
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={() => onPindah?.("Kasir")}
          >
            <Icon name="plus" size={16} /> Tambah barang
          </button>
        </div>
      </section>

      <section className="inventory-summary">
        <article>
          <span className="summary-icon green">
            <Icon name="box" size={19} />
          </span>
          <div>
            <small>Total persediaan</small>
            <strong>
              {ringkasan.total} <em>jenis barang</em>
            </strong>
          </div>
        </article>
        <article>
          <span className="summary-icon orange">
            <Icon name="warning" size={19} />
          </span>
          <div>
            <small>Perlu restok</small>
            <strong>
              {ringkasan.perluRestok} <em>barang</em>
            </strong>
          </div>
        </article>
        <article>
          <span className="summary-icon blue">Rp</span>
          <div>
            <small>Nilai persediaan</small>
            <strong>{rupiahRingkas(ringkasan.nilaiStok)}</strong>
          </div>
        </article>
        <article>
          <span className="summary-icon purple">
            <Icon name="chart" size={19} />
          </span>
          <div>
            <small>Potensi omzet</small>
            <strong>{rupiahRingkas(ringkasan.potensiOmzet)}</strong>
          </div>
        </article>
      </section>

      <section className="inventory-workspace">
        <div className="inventory-toolbar">
          <label>
            <Icon name="search" size={17} />
            <input
              value={cari}
              onChange={(event) => setCari(event.target.value)}
              placeholder="Cari nama barang atau alias..."
              aria-label="Cari nama barang atau alias"
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
              className={filter === "perlu" ? "active" : ""}
              onClick={() => setFilter("perlu")}
            >
              Perlu restok
            </button>
            <button
              type="button"
              className={filter === "aman" ? "active" : ""}
              onClick={() => setFilter("aman")}
            >
              Stok aman
            </button>
          </div>
        </div>

        <div className="inventory-row table-head">
          <span>Barang</span>
          <span>Stok saat ini</span>
          <span>Nilai stok</span>
          <span>Status</span>
          <span />
        </div>

        {daftar.length === 0 && (
          <div className="empty-state">
            <Icon name="search" size={26} />
            <strong>Barang tidak ditemukan</strong>
            <span>Coba kata kunci atau filter yang lain.</span>
          </div>
        )}

        {daftar.map((barang) => {
          const tipis = barang.stok <= barang.min_stok
          const saran = saranUntuk(barang.barang_id)
          return (
            <div className="inventory-row" key={barang.barang_id}>
              <div className="inventory-product">
                <span className="product-code">{barang.satuan.slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{barang.nama}</strong>
                  <small>
                    {angka(barang.stok, 2)} {barang.satuan} terjual 7 hari · minimum{" "}
                    {barang.min_stok} {barang.satuan}
                  </small>
                </div>
              </div>
              <div className="stock-amount">
                <strong>
                  {angka(barang.stok, 2)} <small>{barang.satuan}</small>
                </strong>
                <span>
                  Jual {rupiah(barang.harga_jual)} / {barang.satuan}
                </span>
                {saran && (
                  <small className="restock-tip">
                    Saran kulakan {saran.qty} {barang.satuan}
                  </small>
                )}
              </div>
              <strong className="stock-value">{rupiah(barang.stok * barang.harga_modal)}</strong>
              <span className={`status-pill ${tipis ? "low" : "ok"}`}>
                {tipis ? "Kritis" : "Aman"}
              </span>
              <div className="row-actions">
                <button
                  type="button"
                  className="row-action"
                  onClick={() => onPindah?.("Kasir")}
                  aria-label={`Tambah stok ${barang.nama}`}
                >
                  <Icon name="plus" size={17} /> <span>Restok</span>
                </button>
              </div>
            </div>
          )
        })}
      </section>

      <div className="dashboard-footnote">
        <button type="button" className="secondary-action" onClick={() => void keluar()}>
          Keluar dari akun
        </button>
      </div>
    </>
  )
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
