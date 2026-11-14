import { useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "./Icon"
import { UserAvatar } from "./UserAvatar"
import { useWarung } from "../lib/store"
import { rupiah } from "../lib/format"

export function AppHeader({
  query,
  onQueryChange,
  onNavigate,
  onBukaAi,
  nama,
  warung,
}: {
  query: string
  onQueryChange: (value: string) => void
  onNavigate: (nav: "Stok Barang") => void
  onBukaAi: () => void
  nama: string
  warung: string
}) {
  const { stok, utang, sinyalMargin } = useWarung()
  const [notice, setNotice] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const stokTipis = useMemo(
    () => stok.filter((barang) => barang.stok <= barang.min_stok),
    [stok],
  )
  const utangJalan = useMemo(
    () => utang.filter((item) => item.status === "belum_lunas"),
    [utang],
  )
  const totalUtang = useMemo(
    () => utangJalan.reduce((sum, item) => sum + Math.max(item.total - item.dibayar, 0), 0),
    [utangJalan],
  )
  const adaPerhatian = stokTipis.length > 0 || utangJalan.length > 0 || sinyalMargin.length > 0

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <header>
      <div className="search">
        <Icon name="search" size={19} />
        <input
          ref={searchRef}
          aria-label="Cari barang"
          aria-keyshortcuts="Control+K Meta+K"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onNavigate("Stok Barang")
          }}
          placeholder="Cari barang..."
        />
        <kbd>⌘ K</kbd>
      </div>

      <div className="header-actions">
        <button className="notification" aria-label="Tanya AI" onClick={onBukaAi}>
          <Icon name="spark" />
        </button>
        <button
          className="notification"
          aria-label="Notifikasi"
          onClick={() => setNotice(!notice)}
          aria-expanded={notice}
        >
          <Icon name="bell" />
          {adaPerhatian && <i />}
        </button>
        <div className="mini-profile">
          <UserAvatar name={nama} />
          <span>
            <b>{nama}</b>
            <small>{warung}</small>
          </span>
        </div>
      </div>

      {notice && (
        <div className="notice-popover">
          <div className="notice-head">
            <strong>Perlu dilihat</strong>
            <button onClick={() => setNotice(false)} aria-label="Tutup notifikasi">
              <Icon name="close" size={17} />
            </button>
          </div>

          <div className="notice-group">
            <span className="notice-group-label">
              Stok menipis
              <em>{stokTipis.length > 0 ? `${stokTipis.length} barang` : "aman"}</em>
            </span>
            {stokTipis.slice(0, 3).map((barang) => (
              <p key={barang.barang_id}>
                <span className="alert-dot" /> {barang.nama} tinggal {barang.stok} {barang.satuan}.
              </p>
            ))}
            {stokTipis.length === 0 && (
              <p>
                <span className="info-dot" /> Semua stok di atas batas minimum.
              </p>
            )}
          </div>

          <div className="notice-group">
            <span className="notice-group-label">
              Utang pelanggan
              <em>{utangJalan.length > 0 ? rupiah(totalUtang) : "bersih"}</em>
            </span>
            {utangJalan.slice(0, 3).map((item) => (
              <p key={item.id}>
                <span className="orange-dot" /> {item.pelanggan} — {item.nama_barang}{" "}
                {rupiah(Math.max(item.total - item.dibayar, 0))}.
              </p>
            ))}
            {utangJalan.length === 0 && (
              <p>
                <span className="info-dot" /> Tidak ada utang berjalan.
              </p>
            )}
          </div>

          {sinyalMargin.length > 0 && (
            <div className="notice-group">
              <span className="notice-group-label">
                Margin menyusut
                <em>{sinyalMargin.length} barang</em>
              </span>
              {sinyalMargin.slice(0, 2).map((sinyal) => (
                <p key={sinyal.barangId}>
                  <span className="orange-dot" /> {sinyal.nama} — modal naik{" "}
                  {sinyal.kenaikanModalPersen}%.
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  )
}
