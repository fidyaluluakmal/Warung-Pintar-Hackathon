import { useMemo, useState } from "react"
import { useWarung } from "../lib/store"
import { Icon } from "../components/Icon"
import { Modal } from "../components/Modal"
import { angka, rupiah, rupiahRingkas } from "../lib/format"
import { round2 } from "../lib/inventory"
import { SATUAN_TERSEDIA, type Satuan } from "../lib/types"
import type { NavLabel } from "../lib/nav"

type Filter = "semua" | "perlu" | "aman"

/** Formulir barang baru. */
interface FormBarang {
  nama: string
  satuan: Satuan
  stokAwal: string
  minStok: string
  hargaModal: string
  hargaJual: string
  leadTime: string
  alias: string
}

/** Formulir pembelian (barang masuk). */
interface FormPembelian {
  barangId: string
  jumlah: string
  harga: string
  agen: string
}

const FORM_BARANG_KOSONG: FormBarang = {
  nama: "",
  satuan: "pcs",
  stokAwal: "",
  minStok: "",
  hargaModal: "",
  hargaJual: "",
  leadTime: "2",
  alias: "",
}

/**
 * Stok barang.
 *
 * Tampilan tabel: nama barang, stok saat ini, nilai stok, status, dan tombol
 * restok. Ringkasan di atas menunjukkan gambaran singkat persediaan.
 *
 * Dua hal bisa dicatat dari sini: barang baru ke katalog, dan pembelian yang
 * membuat stok bertambah. Tanpa itu, tombol "Restok" dan "Tambah barang"
 * tidak punya tujuan.
 */
export function StokBarang({
  cari: cariAwal = "",
  onPindah,
}: {
  cari?: string
  onPindah?: (nav: NavLabel) => void
}) {
  const { stok, saranBeli, keluar, simpanBarang, catatPembelian } = useWarung()
  const [cari, setCari] = useState(cariAwal)
  const [filter, setFilter] = useState<Filter>("semua")

  const [formBarang, setFormBarang] = useState<FormBarang | null>(null)
  const [formPembelian, setFormPembelian] = useState<FormPembelian | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState("")

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

  async function tambahBarang() {
    if (!formBarang) return
    setSibuk(true)
    setGalat("")
    try {
      await simpanBarang({
        nama: formBarang.nama,
        satuan: formBarang.satuan,
        stokAwal: Number(formBarang.stokAwal.replace(/\D/g, "")) || 0,
        minStok: Number(formBarang.minStok.replace(/\D/g, "")) || 0,
        hargaModal: Number(formBarang.hargaModal.replace(/\D/g, "")) || 0,
        hargaJual: Number(formBarang.hargaJual.replace(/\D/g, "")) || 0,
        leadTimeHari: Number(formBarang.leadTime.replace(/\D/g, "")) || 0,
        alias: formBarang.alias.split(","),
      })
      setFormBarang(null)
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal menambah barang.")
    } finally {
      setSibuk(false)
    }
  }

  async function beliBarang() {
    if (!formPembelian) return
    setSibuk(true)
    setGalat("")
    try {
      await catatPembelian({
        barangId: formPembelian.barangId,
        jumlah: Number(formPembelian.jumlah.replace(/\D/g, "")) || 0,
        hargaSatuan: Number(formPembelian.harga.replace(/\D/g, "")) || 0,
        agen: formPembelian.agen,
      })
      setFormPembelian(null)
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal mencatat pembelian.")
    } finally {
      setSibuk(false)
    }
  }

  function bukaPembelian(barangId?: string) {
    setGalat("")
    const pertama = barangId ?? stok[0]?.barang_id ?? ""
    const asal = stok.find((s) => s.barang_id === pertama)
    setFormPembelian({
      barangId: pertama,
      jumlah: "",
      harga: asal ? String(asal.harga_modal) : "",
      agen: "",
    })
  }

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
            onClick={() => onPindah?.("Catat Suara")}
          >
            <Icon name="mic" size={16} /> Tambah lewat suara
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => bukaPembelian()}
            disabled={stok.length === 0}
          >
            <Icon name="box" size={16} /> Catat pembelian
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={() => {
              setGalat("")
              setFormBarang(FORM_BARANG_KOSONG)
            }}
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
                    Sisa {angka(barang.stok, barang.stok % 1 === 0 ? 0 : 2)} {barang.satuan} ·
                    minimum {angka(barang.min_stok, barang.min_stok % 1 === 0 ? 0 : 2)}{" "}
                    {barang.satuan}
                  </small>
                </div>
              </div>
              <div className="stock-amount">
                <strong>
                  {angka(barang.stok, barang.stok % 1 === 0 ? 0 : 2)}{" "}
                  <small>{barang.satuan}</small>
                </strong>
                <span>
                  Jual {rupiah(barang.harga_jual)} / {barang.satuan}
                </span>
                {saran && (
                  <small className="restock-tip">
                    Saran kulakan {angka(saran.qty, saran.qty % 1 === 0 ? 0 : 2)} {barang.satuan}
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
                  onClick={() => bukaPembelian(barang.barang_id)}
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

      {formBarang && (
        <Modal label="Tambah barang" onClose={() => setFormBarang(null)}>
          <span className="modal-kicker">Barang baru</span>
          <h2>Barang apa yang mau dijual?</h2>
          <p>
            Satu barang = satu nama baku. Kalau orang biasanya sebut dengan nama
            lain, masukkan sebagai alias supaya stoknya tidak jadi terpisah.
          </p>
          <div className="customer-form">
            <label>
              Nama barang
              <input
                value={formBarang.nama}
                onChange={(event) =>
                  setFormBarang({ ...formBarang, nama: event.target.value })
                }
                placeholder="Contoh: Gula Pasir"
              />
            </label>
            <label>
              Satuan
              <select
                value={formBarang.satuan}
                onChange={(event) =>
                  setFormBarang({
                    ...formBarang,
                    satuan: event.target.value as Satuan,
                  })
                }
              >
                {SATUAN_TERSEDIA.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Stok awal
              <input
                inputMode="numeric"
                value={formBarang.stokAwal}
                onChange={(event) =>
                  setFormBarang({ ...formBarang, stokAwal: event.target.value })
                }
                placeholder="mis. 24"
              />
            </label>
            <label>
              Stok minimum
              <input
                inputMode="numeric"
                value={formBarang.minStok}
                onChange={(event) =>
                  setFormBarang({ ...formBarang, minStok: event.target.value })
                }
                placeholder="mis. 6"
              />
            </label>
            <label>
              Harga modal
              <input
                inputMode="numeric"
                value={formBarang.hargaModal}
                onChange={(event) =>
                  setFormBarang({ ...formBarang, hargaModal: event.target.value })
                }
                placeholder="mis. 17000"
              />
            </label>
            <label>
              Harga jual
              <input
                inputMode="numeric"
                value={formBarang.hargaJual}
                onChange={(event) =>
                  setFormBarang({ ...formBarang, hargaJual: event.target.value })
                }
                placeholder="mis. 19000"
              />
            </label>
            <label>
              Lama barang datang (hari)
              <input
                inputMode="numeric"
                value={formBarang.leadTime}
                onChange={(event) =>
                  setFormBarang({ ...formBarang, leadTime: event.target.value })
                }
                placeholder="mis. 2"
              />
            </label>
            <label>
              Alias (pisahkan dengan koma)
              <input
                value={formBarang.alias}
                onChange={(event) =>
                  setFormBarang({ ...formBarang, alias: event.target.value })
                }
                placeholder="mis. gulpas, gula"
              />
            </label>
          </div>
          {galat && <div className="form-error">{galat}</div>}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setFormBarang(null)}
            >
              Batal
            </button>
            <button
              type="button"
              className="primary-action"
              onClick={() => void tambahBarang()}
              disabled={sibuk}
            >
              {sibuk ? "Menyimpan…" : "Simpan barang"}
            </button>
          </div>
        </Modal>
      )}

      {formPembelian && (
        <Modal label="Catat pembelian" onClose={() => setFormPembelian(null)}>
          <span className="modal-kicker">Barang masuk</span>
          <h2>Berapa yang dibeli?</h2>
          <p>
            Stok bertambah dari pembelian ini. Kalau harga belinya naik dari
            biasanya, aplikasi mencatatnya supaya margin bisa diperiksa.
          </p>
          <div className="customer-form">
            <label>
              Barang
              <select
                value={formPembelian.barangId}
                onChange={(event) => {
                  const id = event.target.value
                  const asal = stok.find((s) => s.barang_id === id)
                  setFormPembelian({
                    ...formPembelian,
                    barangId: id,
                    harga: asal ? String(asal.harga_modal) : formPembelian.harga,
                  })
                }}
              >
                {stok.map((s) => (
                  <option key={s.barang_id} value={s.barang_id}>
                    {s.nama}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Jumlah
              <input
                inputMode="numeric"
                value={formPembelian.jumlah}
                onChange={(event) =>
                  setFormPembelian({ ...formPembelian, jumlah: event.target.value })
                }
                placeholder="mis. 12"
              />
            </label>
            <label>
              Harga beli per {stok.find((s) => s.barang_id === formPembelian.barangId)?.satuan ?? "satuan"}
              <input
                inputMode="numeric"
                value={formPembelian.harga}
                onChange={(event) =>
                  setFormPembelian({ ...formPembelian, harga: event.target.value })
                }
                placeholder="mis. 17000"
              />
            </label>
            <label>
              Nama pemasok (opsional)
              <input
                value={formPembelian.agen}
                onChange={(event) =>
                  setFormPembelian({ ...formPembelian, agen: event.target.value })
                }
                placeholder="mis. Agen Beras Makmur"
              />
            </label>
          </div>
          {galat && <div className="form-error">{galat}</div>}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setFormPembelian(null)}
            >
              Batal
            </button>
            <button
              type="button"
              className="primary-action"
              onClick={() => void beliBarang()}
              disabled={sibuk}
            >
              {sibuk ? "Menyimpan…" : "Simpan pembelian"}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
