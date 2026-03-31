'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Save } from 'lucide-react'
import { cn, normalizeRootDomain } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  domain: z
    .string()
    .min(1, 'Required')
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, 'Valid domain e.g. example.com'),
  kpi_keyword_target: z.coerce.number().int().min(1).max(9_999_999),
})

type FormValues = z.infer<typeof schema>

const inputCls = (hasError?: boolean) =>
  cn(
    'w-full px-3 py-2.5 rounded-lg text-sm',
    'bg-[var(--bg-surface)] border text-[var(--text-primary)]',
    'focus:outline-none focus:ring-1 focus:ring-[var(--blue)]',
    hasError ? 'border-[var(--status-danger)]' : 'border-[var(--border)]',
  )

interface ProjectSettingsFormProps {
  clientSlug: string
  initial: FormValues
}

export default function ProjectSettingsForm({
  clientSlug,
  initial,
}: ProjectSettingsFormProps) {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  })

  const onSubmit = async (data: FormValues) => {
    try {
      const res = await fetch(`/api/clients/${clientSlug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          domain: normalizeRootDomain(data.domain),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError('root', { message: String(json?.error ?? 'Save failed') })
        return
      }
      router.push(`/clients/${clientSlug}`)
      router.refresh()
    } catch {
      setError('root', { message: 'Network error' })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-5">
      {errors.root && (
        <p className="text-sm text-[var(--status-danger)]">{errors.root.message}</p>
      )}

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-1.5">
          Project name
        </label>
        <input {...register('name')} className={inputCls(!!errors.name)} />
        {errors.name && (
          <p className="mt-1 text-xs text-[var(--status-danger)]">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-1.5">
          Root domain
        </label>
        <input {...register('domain')} className={inputCls(!!errors.domain)} />
        {errors.domain && (
          <p className="mt-1 text-xs text-[var(--status-danger)]">{errors.domain.message}</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-1.5">
          KPI keyword / citation target
        </label>
        <input
          type="number"
          min={1}
          max={9_999_999}
          {...register('kpi_keyword_target', { valueAsNumber: true })}
          className={inputCls(!!errors.kpi_keyword_target)}
        />
        <p className="mt-1.5 text-xs text-[var(--text-muted)] leading-relaxed">
          ใช้สำหรับการ์ด Dashboard และ progress — ค่าจะถูกเก็บในโปรเจกต์และใช้คำนวณเปอร์เซ็นต์
          จนกว่าจะแก้อีกครั้ง (ไม่ต้อง Pull ใหม่ถ้าแก้เฉพาะเป้า)
        </p>
        {errors.kpi_keyword_target && (
          <p className="mt-1 text-xs text-[var(--status-danger)]">
            {errors.kpi_keyword_target.message}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[var(--blue)] hover:bg-[var(--accent-hover)] disabled:opacity-60"
        >
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save changes
        </button>
        <button
          type="button"
          onClick={() => router.push(`/clients/${clientSlug}`)}
          className="px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
