/** Avatar pemilik warung: inisial nama. */
export function UserAvatar({
  name,
  className = "avatar",
}: {
  name: string
  className?: string
}) {
  const inisial = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((kata) => kata[0]?.toUpperCase() ?? "")
    .join("")

  return (
    <div className={className} aria-hidden="true">
      {inisial || "WP"}
    </div>
  )
}
