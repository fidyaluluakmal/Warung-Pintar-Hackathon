import { useEffect, useState } from "react"
import { Icon, type IconName } from "../components/Icon"
import { UserAvatar } from "../components/UserAvatar"
import { useWarung } from "../lib/store"
import { useTema, type Tema } from "../lib/theme"

/**
 * Pengaturan: akun warung, tampilan, sumber data, dan tentang aplikasi.
 *
 * Nama warung dan nama pemilik disimpan sendiri di perangkat ini (kunci
 * `warung-pintar-akun`) supaya katalog dan catatan warung tidak tertukar
 * dengan warung lain.
 */
export function Pengaturan() {
  const { sesi, keluar, resetDemo, muatData, barang, transaksi, utang, modeLokal } = useWarung()
  const { tema, ganti } = useTema()
  const [warung, setWarung] = useState(sesi?.warung ?? "")
  const [pemilik, setPemilik] = useState(sesi?.pemilik ?? "")
  const [pesan, setPesan] = useState("")
  const [galat, setGalat] = useState("")

  // Sesi bisa berubah setelah halaman dibuka (mis. baru saja masuk).
  useEffect(() => {
    setWarung(sesi?.warung ?? "")
    setPemilik(sesi?.pemilik ?? "")
  }, [sesi?.warung, sesi?.pemilik])

  function notify(text: string) {
    setPesan(text)
    window.setTimeout(() => setPesan(""), 2500)
  }

  const berubah =
    warung.trim() !== (sesi?.warung ?? "") || pemilik.trim() !== (sesi?.pemilik ?? "")

  function simpanAkun() {
    setGalat("")
    try {
      window.localStorage.setItem(
        "warung-pintar-akun",
        JSON.stringify({ warung: warung.trim(), pemilik: pemilik.trim() }),
      )
      notify("Nama warung dan pemilik tersimpan")
    } catch {
      setGalat("Penyimpanan perangkat diblokir, nama belum tersimpan.")
    }
  }

  const opsiTema: Array<{
    nilai: Tema
    label: string
    ikon: IconName
    pratinjau: string
  }> = [
    { nilai: "terang", label: "Terang", ikon: "sun", pratinjau: "light-preview" },
    { nilai: "gelap", label: "Gelap", ikon: "moon", pratinjau: "dark-preview" },
    { nilai: "sistem", label: "Ikuti sistem", ikon: "settings", pratinjau: "system-preview" },
  ]

  return (
    <div className="space-y-5">
      <section className="page-title">
        <div>
          <span className="date-label">Preferensi aplikasi</span>
          <h1>Pengaturan</h1>
          <p>Akun, tampilan, sumber data, dan informasi aplikasi.</p>
        </div>
        {pesan && (
          <span className="settings-toast">
            <Icon name="check" size={16} /> {pesan}
          </span>
        )}
      </section>

      <div className="settings-layout">
        <section className="settings-card account-settings">
          <div className="settings-card-head">
            <UserAvatar name={pemilik || "Pemilik Warung"} className="settings-avatar" />
            <div>
              <h2>{pemilik || "Pemilik Warung"}</h2>
              <p>{warung || "Warung Saya"}</p>
            </div>
          </div>
          <div className="settings-list">
            <div>
              <span>
                <strong>Status akun</strong>
                <small>
                  {modeLokal
                    ? "Akun lokal di perangkat ini. Data tidak dikirim ke cloud."
                    : "Akun Supabase. Data warung ini tersimpan di cloud."}
                </small>
              </span>
              <span className={`source-badge ${modeLokal ? "demo" : "supabase"}`}>
                {modeLokal ? "Lokal" : "Cloud"}
              </span>
            </div>
            <div>
              <span>
                <strong>Sesi login</strong>
                <small>Tetap masuk di perangkat ini sampai Anda menekan tombol keluar.</small>
              </span>
            </div>
          </div>
          <div className="settings-actions account-actions">
            <button type="button" className="logout-button" onClick={() => void keluar()}>
              <Icon name="logout" size={17} /> Keluar dari akun
            </button>
          </div>
        </section>

        <section className="settings-card appearance-settings">
          <div className="settings-card-head">
            <span className="settings-card-icon">
              <Icon name={tema === "gelap" ? "moon" : "sun"} />
            </span>
            <div>
              <h2>Tampilan aplikasi</h2>
              <p>Pilih tema yang nyaman untuk mata Anda.</p>
            </div>
          </div>
          <div className="theme-options">
            {opsiTema.map((opsi) => (
              <button
                key={opsi.nilai}
                type="button"
                className={tema === opsi.nilai ? "active" : ""}
                onClick={() => ganti(opsi.nilai)}
              >
                <span className={`theme-preview ${opsi.pratinjau}`}>
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  <Icon name={opsi.ikon} size={16} />
                  <strong>{opsi.label}</strong>
                </span>
                <i className="theme-check">
                  <Icon name="check" size={13} />
                </i>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-head">
            <span className="settings-card-icon orange">
              <Icon name="scan" />
            </span>
            <div>
              <h2>Sumber data</h2>
              <p>Status koneksi dan data yang sedang dipakai.</p>
            </div>
          </div>
          <div className="settings-list">
            <div>
              <span>
                <strong>Mode aplikasi</strong>
                <small>
                  {modeLokal
                    ? "Mode demo lokal (data disimpan di browser ini)."
                    : "Terhubung ke Supabase (data cloud)."}
                </small>
              </span>
              <span className={`source-badge ${modeLokal ? "demo" : "supabase"}`}>
                {modeLokal ? "Demo" : "Supabase"}
              </span>
            </div>
            <div>
              <span>
                <strong>Data tersimpan</strong>
                <small>
                  {barang.length} barang · {transaksi.length} transaksi · {utang.length} catatan utang
                </small>
              </span>
            </div>
          </div>
          <div className="settings-actions">
            <button
              type="button"
              onClick={() => {
                void muatData()
                  .then(() => notify("Data berhasil dimuat ulang"))
                  .catch(() => notify("Gagal memuat ulang data"))
              }}
            >
              <Icon name="arrow" size={17} /> Muat ulang data
            </button>
            <button
              type="button"
              onClick={() => {
                resetDemo()
                notify("Data demo berhasil direset")
              }}
            >
              Reset data demo <span>lokal</span>
            </button>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-head">
            <span className="settings-card-icon purple">
              <Icon name="chart" />
            </span>
            <div>
              <h2>Cara kerja angka</h2>
              <p>Aturan yang dipakai aplikasi ini.</p>
            </div>
          </div>
          <div className="settings-list">
            <div>
              <span>
                <strong>Stok</strong>
                <small>
                  Stok awal + pembelian − penjualan − penyesuaian. Satuan mengikuti produk.
                </small>
              </span>
            </div>
            <div>
              <span>
                <strong>Laba kotor</strong>
                <small>
                  Penjualan − modal barang terjual. Belum dipotong biaya lain seperti listrik dan
                  sewa.
                </small>
              </span>
            </div>
            <div>
              <span>
                <strong>Saran pembelian</strong>
                <small>
                  Proyeksi terjual per hari × (lead time + 3 hari) − stok saat ini. Semua layar
                  memakai mesin yang sama, jadi angkanya tidak berbeda antar layar.
                </small>
              </span>
            </div>
            <div>
              <span>
                <strong>Hari dan jam</strong>
                <small>
                  Semua perhitungan hari memakai zona waktu warung (WIB), sama dengan jam yang
                  ditampilkan.
                </small>
              </span>
            </div>
          </div>
        </section>

        <section className="settings-card account-settings">
          <div className="settings-card-head">
            <span className="settings-card-icon blue">
              <Icon name="home" />
            </span>
            <div>
              <h2>Akun warung</h2>
              <p>Data warung ini tersimpan sendiri dan tidak bisa dilihat warung lain.</p>
            </div>
          </div>
          <div className="settings-fields">
            <label>
              <span>
                <strong>Nama warung</strong>
                <small>Tampil di sidebar dan judul halaman.</small>
              </span>
              <input
                className="input"
                style={{ maxWidth: 260 }}
                value={warung}
                onChange={(event) => setWarung(event.target.value)}
                placeholder="Warung Sumber Rejeki"
                aria-label="Nama warung"
              />
            </label>
            <label>
              <span>
                <strong>Nama pemilik</strong>
                <small>Dipakai untuk menyapa di Beranda.</small>
              </span>
              <input
                className="input"
                style={{ maxWidth: 260 }}
                value={pemilik}
                onChange={(event) => setPemilik(event.target.value)}
                placeholder="Pak Andi"
                aria-label="Nama pemilik"
              />
            </label>
            <label>
              <span>
                <strong>Email</strong>
                <small>Alamat untuk masuk ke akun ini.</small>
              </span>
              <input
                className="input"
                style={{ maxWidth: 260 }}
                value={sesi?.email ?? ""}
                readOnly
                aria-label="Email akun"
              />
            </label>
          </div>
          <div className="settings-actions">
            <button type="button" onClick={simpanAkun} disabled={!berubah}>
              Simpan perubahan akun
            </button>
            <button type="button" className="logout-button" onClick={() => void keluar()}>
              <Icon name="logout" size={17} /> Keluar dari akun
            </button>
          </div>
          {galat && <div className="form-error settings-error">{galat}</div>}
        </section>

        <section className="settings-card about-settings">
          <div className="settings-card-head">
            <span className="settings-card-icon">
              <Icon name="home" />
            </span>
            <div>
              <h2>Tentang Warung Pintar</h2>
              <p>Asisten pencatatan untuk warung kecil.</p>
            </div>
          </div>
          <div className="about-row">
            <span>Versi aplikasi</span>
            <strong>1.0.0</strong>
          </div>
          <div className="about-row">
            <span>Konfirmasi sebelum simpan</span>
            <strong>Selalu</strong>
          </div>
          <div className="about-row">
            <span>Angka saran restok</span>
            <strong>Satu mesin untuk semua layar</strong>
          </div>
          <div className="about-row">
            <span>Peran AI</span>
            <strong>Hanya mengusulkan, pemilik yang mengonfirmasi</strong>
          </div>
          <div className="about-row">
            <span>Kunci AI</span>
            <strong>Hanya di server</strong>
          </div>
        </section>
      </div>
    </div>
  )
}
