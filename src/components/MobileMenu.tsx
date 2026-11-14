import { useEffect, useRef } from "react"
import { Icon } from "./Icon"
import { nav, navLain, type NavLabel } from "../lib/nav"

/**
 * Menu lengkap untuk HP.
 *
 * Di layar kecil, sidebar disembunyikan dan nav bawah hanya memuat 4 menu
 * utama. Halaman lain (Pelanggan, Harga Pasar, Tutup Buku, Pengaturan) tetap
 * harus bisa dibuka: lewat menu ini.
 */
export function MobileMenu({
  activeNav,
  onNavigate,
  onClose,
}: {
  activeNav: NavLabel
  onNavigate: (nav: NavLabel) => void
  onClose: () => void
}) {
  const panelRef = useRef<HTMLElement>(null)

  // Dialog harus bisa ditutup dengan Escape dan fokusnya harus masuk ke
  // panel: kalau tidak, pengguna keyboard tersesat di overlay.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    const pertama = panelRef.current?.querySelector<HTMLElement>("button")
    pertama?.focus()
    const sebelumnya = document.activeElement as HTMLElement | null
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      sebelumnya?.focus()
    }
  }, [onClose])

  const buka = (label: NavLabel) => {
    onNavigate(label)
    onClose()
  }

  return (
    <div
      className="mobile-menu-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Menu aplikasi"
      onClick={onClose}
    >
      <nav className="mobile-menu" ref={panelRef} onClick={(event) => event.stopPropagation()}>
        <div className="mobile-menu-head">
          <div className="mobile-menu-title">
            <span className="brand-mark">
              <span>W</span>
            </span>
            <strong>Warung Pintar</strong>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Tutup menu">
            <Icon name="close" />
          </button>
        </div>
        <p className="mobile-menu-hint">Semua halaman Warung Pintar.</p>
        <div className="mobile-menu-grid">
          {nav.map((entry) => (
            <button
              key={entry.label}
              className={activeNav === entry.label ? "active" : ""}
              onClick={() => buka(entry.label)}
            >
              <Icon name={entry.icon} />
              <span>{entry.label}</span>
            </button>
          ))}
          {navLain.map((entry) => (
            <button
              key={entry.label}
              className={activeNav === entry.label ? "active" : ""}
              onClick={() => buka(entry.label)}
            >
              <Icon name={entry.icon} />
              <span>{entry.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
