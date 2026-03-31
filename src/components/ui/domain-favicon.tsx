'use client'

import { useState } from 'react'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

export function domainFaviconSrc(domain: string): string {
  const d = domain.replace(/^www\./i, '').trim()
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`
}

type DomainFaviconProps = {
  domain: string
  size?: number
  className?: string
}

export function DomainFavicon({ domain, size = 20, className }: DomainFaviconProps) {
  const [failed, setFailed] = useState(false)
  const d = domain.trim()

  if (!d || failed) {
    return (
      <Globe
        size={size}
        className={cn('shrink-0 text-[var(--text-muted)]', className)}
        aria-hidden
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={domainFaviconSrc(d)}
      alt=""
      width={size}
      height={size}
      className={cn('shrink-0 rounded object-contain', className)}
      onError={() => setFailed(true)}
    />
  )
}
