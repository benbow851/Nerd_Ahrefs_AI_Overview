'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  Link2,
  SlidersHorizontal,
} from 'lucide-react'
import { normalizeRootDomain, slugify } from '@/lib/utils'
import type { ClientFormValues } from '@/types'
import { toast } from '@/components/ui/use-toast'

const schema = z.object({
  name: z.string().min(1, 'Project name is required'),
  domain: z
    .string()
    .min(1, 'Domain is required')
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, 'Enter a valid domain (e.g. example.com)'),
  slug: z
    .string()
    .min(1, 'URL slug is required')
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, and hyphens only'),
  kpi_keyword_target: z.coerce.number().int().min(1).max(9_999_999),
})

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-[var(--text-muted)]">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-[var(--status-danger)]">{error}</p>
      )}
    </div>
  )
}

const inputCls = (hasError?: boolean) =>
  [
    'w-full px-3 py-2.5 rounded-lg text-sm',
    'bg-[var(--bg-surface)] border text-[var(--text-primary)]',
    'placeholder:text-[var(--text-muted)]',
    'focus:outline-none focus:ring-1 focus:ring-[var(--blue)] transition-colors',
    hasError
      ? 'border-[var(--status-danger)]'
      : 'border-[var(--border)] focus:border-[var(--blue)]',
  ].join(' ')

export default function NewClientPage() {
  const router = useRouter()
  const [slugManual, setSlugManual] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ClientFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      domain: '',
      slug: '',
      kpi_keyword_target: 30,
    },
  })

  const watchedName = watch('name')
  const watchedDomain = watch('domain')
  const watchedSlug = watch('slug')
  const watchedKpi = watch('kpi_keyword_target')

  useEffect(() => {
    if (!slugManual) {
      setValue('slug', slugify(watchedName), { shouldValidate: true })
    }
  }, [watchedName, slugManual, setValue])

  const { onBlur: domainOnBlur, ...domainRegister } = register('domain')

  const onSubmit = async (data: ClientFormValues) => {
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          domain: normalizeRootDomain(data.domain),
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError('root', {
          message: json?.error ?? 'Failed to create project.',
        })
        return
      }

      const json = await res.json()
      const slug = json?.slug ?? data.slug
      toast({
        variant: 'success',
        title: 'Project created',
        description: `${data.name} is ready. Add URLs and pull a snapshot.`,
      })
      router.push(`/clients/${slug}`)
    } catch {
      setError('root', { message: 'Network error — please try again.' })
    }
  }

  const summaryDomain =
    watchedDomain.trim() !== ''
      ? normalizeRootDomain(watchedDomain) || '—'
      : '—'
  const summarySlug = watchedSlug?.trim() !== '' ? watchedSlug : '—'

  return (
    <div className="flex-1 p-6 pb-12">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-8 transition-colors"
      >
        <ArrowLeft size={15} strokeWidth={1.75} />
        Back to Projects
      </Link>

      <header className="hero-co-brand rounded-xl px-5 py-6 md:px-8 md:py-8 mb-8 max-w-5xl">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="badge-partner">Ahrefs data</span>
          <span className="text-xs text-[var(--text-muted)] font-medium">
            NerdOptimize
          </span>
        </div>
        <h1
          className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] tracking-tight mb-2"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          New project
        </h1>
        <p className="text-sm md:text-base text-[var(--text-secondary)] max-w-2xl leading-relaxed">
          Set up a project to track AI Overview citations using Ahrefs Site Explorer
          keywords. Add URLs next, then pull a monthly snapshot.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 max-w-5xl items-start">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="card-nerd p-6 md:p-8 space-y-6"
        >
          {errors.root && (
            <div
              role="alert"
              className="rounded-lg px-4 py-3 text-sm bg-[var(--status-danger)]/10 border border-[var(--status-danger)]/30 text-[var(--status-danger)]"
            >
              {errors.root.message}
            </div>
          )}

          <div className="space-y-5">
            <Field label="Project name" error={errors.name?.message}>
              <input
                {...register('name')}
                placeholder="e.g. Acme Corp"
                autoComplete="organization"
                className={inputCls(!!errors.name)}
              />
            </Field>

            <Field
              label="Root domain"
              hint="We strip https:// and www. automatically on leave"
              error={errors.domain?.message}
            >
              <input
                {...domainRegister}
                onBlur={(e) => {
                  domainOnBlur(e)
                  const n = normalizeRootDomain(e.target.value)
                  if (n && n !== e.target.value) {
                    setValue('domain', n, { shouldValidate: true })
                  }
                }}
                placeholder="e.g. acmecorp.com or https://www.acmecorp.com"
                autoComplete="url"
                className={inputCls(!!errors.domain)}
              />
            </Field>
          </div>

          <div className="pt-2 border-t border-[var(--border)] space-y-4">
            <div className="flex items-center gap-2 text-[var(--text-primary)]">
              <SlidersHorizontal size={16} className="text-[var(--blue)]" />
              <h2 className="text-sm font-semibold">Project KPI</h2>
            </div>
            <Field
              label="Keyword / citation goal"
              hint="ใช้บนการ์ด Dashboard และ progress bar — ตั้ง fetch limit ต่อ URL ได้ที่ Manage URLs หลังสร้างโปรเจกต์"
              error={errors.kpi_keyword_target?.message}
            >
              <input
                type="number"
                min={1}
                max={9_999_999}
                {...register('kpi_keyword_target', { valueAsNumber: true })}
                className={inputCls(!!errors.kpi_keyword_target)}
              />
            </Field>
          </div>

          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setAdvancedOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors"
            >
              <span>Advanced</span>
              <ChevronDown
                size={18}
                className={`shrink-0 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {advancedOpen && (
              <div className="px-4 pb-4 pt-0 border-t border-[var(--border)] bg-[var(--bg-secondary)]/40">
                <label className="flex items-center gap-2 cursor-pointer select-none pt-4">
                  <input
                    type="checkbox"
                    checked={slugManual}
                    onChange={(e) => {
                      const on = e.target.checked
                      setSlugManual(on)
                      if (!on) {
                        setValue('slug', slugify(watch('name')), {
                          shouldValidate: true,
                        })
                      }
                    }}
                    className="rounded border-[var(--border)] bg-[var(--bg-surface)] text-[var(--blue)] focus:ring-[var(--blue)]"
                  />
                  <span className="text-sm text-[var(--text-primary)]">
                    Customize project URL slug
                  </span>
                </label>
              </div>
            )}
          </div>

          {slugManual ? (
            <Field
              label="URL slug"
              hint="Used in /clients/your-slug — lowercase, hyphens only"
              error={errors.slug?.message}
            >
              <input
                type="text"
                {...register('slug')}
                placeholder="e.g. acme-corp"
                className={inputCls(!!errors.slug)}
              />
            </Field>
          ) : (
            <input type="hidden" {...register('slug')} />
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold text-white bg-[var(--blue)] hover:bg-[var(--accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            {isSubmitting ? 'Creating…' : 'Create project'}
          </button>
        </form>

        <aside className="lg:sticky lg:top-6 space-y-4">
          <div className="card-nerd p-5 space-y-4 border-[var(--border-strong)]">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Summary
            </h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-[var(--text-muted)] text-xs mb-0.5">
                  Project
                </dt>
                <dd className="text-[var(--text-primary)] font-medium break-words">
                  {watchedName?.trim() || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)] text-xs mb-0.5">
                  Domain
                </dt>
                <dd className="text-[var(--text-primary)] font-mono text-xs break-all">
                  {summaryDomain}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)] text-xs mb-0.5 flex items-center gap-1">
                  <Link2 size={12} />
                  App path
                </dt>
                <dd className="text-[var(--partner-accent)] font-mono text-xs break-all">
                  {summarySlug === '—' ? '…' : `/clients/${summarySlug}`}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)] text-xs mb-0.5">
                  KPI target
                </dt>
                <dd className="text-[var(--text-primary)] tabular-nums">
                  {typeof watchedKpi === 'number' ? watchedKpi : '—'}
                </dd>
              </div>
            </dl>
          </div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed px-1">
            API keys stay in Settings — never in the browser. Use a rotated key in
            your environment.
          </p>
        </aside>
      </div>
    </div>
  )
}
