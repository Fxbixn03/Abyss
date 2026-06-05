/**
 * The Abyss brand mark — the same artwork as the app/launcher icon
 * (resources/icon.svg), inlined so it ships with the renderer and scales
 * crisply at any size. Self-contained (its own squircle background), so it
 * needs no wrapper.
 */
export function AbyssLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      className={className}
      role="img"
      aria-label="Abyss"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="abyssBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#171B27" />
          <stop offset="1" stopColor="#0B0D12" />
        </linearGradient>
        <radialGradient id="abyssGlow" cx="0.5" cy="0.44" r="0.62">
          <stop offset="0" stopColor="#818CF8" stopOpacity="0.2" />
          <stop offset="0.55" stopColor="#818CF8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="abyssVoid" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#05060A" />
          <stop offset="1" stopColor="#0A0C12" />
        </radialGradient>
      </defs>

      <rect x="64" y="64" width="896" height="896" rx="208" fill="url(#abyssBg)" />
      <rect
        x="65"
        y="65"
        width="894"
        height="894"
        rx="207"
        fill="none"
        stroke="#2B3454"
        strokeWidth="2"
      />
      <rect
        x="64"
        y="64"
        width="896"
        height="896"
        rx="208"
        fill="url(#abyssGlow)"
      />

      <g fill="none">
        <circle
          cx="512"
          cy="496"
          r="298"
          stroke="#818CF8"
          strokeOpacity="0.16"
          strokeWidth="26"
        />
        <circle
          cx="512"
          cy="506"
          r="230"
          stroke="#818CF8"
          strokeOpacity="0.3"
          strokeWidth="26"
        />
        <circle
          cx="512"
          cy="516"
          r="166"
          stroke="#8E97FA"
          strokeOpacity="0.48"
          strokeWidth="26"
        />
        <circle
          cx="512"
          cy="526"
          r="108"
          stroke="#A8AEFF"
          strokeOpacity="0.78"
          strokeWidth="24"
        />
      </g>
      <circle cx="512" cy="534" r="64" fill="url(#abyssVoid)" />
    </svg>
  )
}
