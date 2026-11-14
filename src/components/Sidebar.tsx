import { Icon } from "./Icon"
import { UserAvatar } from "./UserAvatar"
import { nav, type NavLabel } from "../lib/nav"

export function Sidebar({
  activeNav,
  onNavigate,
  collapsed,
  onToggle,
  nama,
  warung,
}: {
  activeNav: NavLabel
  onNavigate: (nav: NavLabel) => void
  collapsed: boolean
  onToggle: () => void
  nama: string
  warung: string
}) {
  return (
    <aside className={collapsed ? "sidebar collapsed" : "sidebar"}>
      <button
        className="sidebar-toggle"
        onClick={onToggle}
        aria-label={collapsed ? "Buka menu" : "Tutup menu"}
        aria-expanded={!collapsed}
        title={collapsed ? "Buka menu" : "Tutup menu"}
      >
        <Icon name="arrow" size={16} />
      </button>

      <div className="brand">
        <div className="brand-mark">
          <span>W</span>
        </div>
        <div>
          <strong>Warung</strong>
          <b>Pintar</b>
        </div>
      </div>

      <nav className="side-nav" aria-label="Navigasi utama">
        <p>Menu utama</p>
        {nav.map((item) => (
          <button
            className={activeNav === item.label ? "active" : ""}
            onClick={() => onNavigate(item.label)}
            key={item.label}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="help-card">
        <div className="help-icon">
          <Icon name="spark" size={19} />
        </div>
        <strong>Butuh bantuan?</strong>
        <span>Catat penjualan lewat suara, lalu periksa hasilnya sebelum disimpan.</span>
      </div>

      <div className="profile">
        <UserAvatar name={nama} />
        <div>
          <strong>{nama}</strong>
          <span>{warung}</span>
        </div>
        <span className="profile-more" aria-hidden="true">
          •••
        </span>
      </div>
    </aside>
  )
}
