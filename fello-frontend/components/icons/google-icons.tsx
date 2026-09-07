"use client"

/**
 * Google Workspace product icons (brand glyphs, not lucide line icons).
 *
 * These carry their own colors/gradients, so render them WITHOUT a tinted
 * wrapper square — the icon already has its rounded colored background.
 */

import * as React from "react"

export function GoogleFormsIcon({ className }: { className?: string }) {
  const id = React.useId()
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8C6FE0" />
          <stop offset="1" stopColor="#5E35B1" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="24" height="24" rx="3.5" fill={`url(#${id})`} />
      {/* check / bullets */}
      <circle cx="7.2" cy="7.5" r="1.15" fill="#fff" />
      <circle cx="7.2" cy="12" r="1.15" fill="#fff" />
      <circle cx="7.2" cy="16.5" r="1.15" fill="#fff" />
      {/* lines */}
      <rect x="10.4" y="6.7" width="7" height="1.6" rx="0.8" fill="#fff" />
      <rect x="10.4" y="11.2" width="7" height="1.6" rx="0.8" fill="#fff" />
      <rect x="10.4" y="15.7" width="7" height="1.6" rx="0.8" fill="#fff" />
    </svg>
  )
}

export function GoogleDocsIcon({ className }: { className?: string }) {
  const id = React.useId()
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4FC3F7" />
          <stop offset="1" stopColor="#1565C0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="24" height="24" rx="3.5" fill={`url(#${id})`} />
      {/* document lines */}
      <rect x="6" y="6.5" width="12" height="1.6" rx="0.8" fill="#fff" />
      <rect x="6" y="10" width="12" height="1.6" rx="0.8" fill="#fff" />
      <rect x="6" y="13.5" width="8" height="1.6" rx="0.8" fill="#fff" />
    </svg>
  )
}

export function GoogleSheetsIcon({ className }: { className?: string }) {
  const id = React.useId()
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#66BB6A" />
          <stop offset="1" stopColor="#1B5E20" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="24" height="24" rx="3.5" fill={`url(#${id})`} />
      {/* grid: 3 columns × 3 rows of cells */}
      {/* vertical dividers */}
      <rect x="10" y="5.5" width="1" height="13" rx="0.5" fill="#fff" fillOpacity="0.6" />
      <rect x="15" y="5.5" width="1" height="13" rx="0.5" fill="#fff" fillOpacity="0.6" />
      {/* horizontal dividers */}
      <rect x="5.5" y="9" width="13" height="1" rx="0.5" fill="#fff" fillOpacity="0.6" />
      <rect x="5.5" y="13" width="13" height="1" rx="0.5" fill="#fff" fillOpacity="0.6" />
      {/* header row highlight */}
      <rect x="5.5" y="5.5" width="13" height="3.5" rx="0.5" fill="#fff" fillOpacity="0.25" />
    </svg>
  )
}

export function GoogleSlidesIcon({ className }: { className?: string }) {
  const id = React.useId()
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFD54F" />
          <stop offset="1" stopColor="#E65100" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="24" height="24" rx="3.5" fill={`url(#${id})`} />
      {/* slide frame */}
      <rect x="4.5" y="6.5" width="15" height="11" rx="1" fill="#fff" fillOpacity="0.3" />
      {/* slide content lines */}
      <rect x="7" y="9" width="10" height="1.5" rx="0.75" fill="#fff" />
      <rect x="7" y="12" width="7" height="1.2" rx="0.6" fill="#fff" fillOpacity="0.8" />
    </svg>
  )
}

export function GoogleDriveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 87.3 78" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  )
}
