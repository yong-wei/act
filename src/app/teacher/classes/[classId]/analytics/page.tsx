'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, Users } from 'lucide-react'

interface AbilityVector {
  computational: number
  crossDomain: number
  designTradeoff: number
  poleTimeMapping: number
  frequencyStability: number
}

interface StudentAnalyticsCard {
  userId: string
  studentNumber: string
  name: string
  post: AbilityVector
  weakTagLabel: string
}

interface ClassAnalyticsPayload {
  classInfo: {
    id: string
    name: string
    code: string
    studentCount: number
  }
  studentCards: StudentAnalyticsCard[]
}

const DIMENSIONS: Array<keyof AbilityVector> = [
  'computational',
  'crossDomain',
  'designTradeoff',
  'poleTimeMapping',
  'frequencyStability',
]

function valueArray(vector: AbilityVector) {
  return DIMENSIONS.map((key) => vector[key])
}

function MiniRadar({ values, color }: { values: number[]; color: string }) {
  const center = 56
  const radius = 42
  const axisCount = values.length

  const points = values
    .map((value, index) => {
      const angle = (-Math.PI / 2) + (index * Math.PI * 2) / axisCount
      const ratio = Math.max(0, Math.min(100, value)) / 100
      const x = center + Math.cos(angle) * radius * ratio
      const y = center + Math.sin(angle) * radius * ratio
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  const gridPolygons = [1, 0.75, 0.5, 0.25].map((scale) =>
    values
      .map((_, index) => {
        const angle = (-Math.PI / 2) + (index * Math.PI * 2) / axisCount
        const x = center + Math.cos(angle) * radius * scale
        const y = center + Math.sin(angle) * radius * scale
        return `${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(' ')
  )

  return (
    <svg viewBox="0 0 112 112" className="h-28 w-28">
      {gridPolygons.map((polygon, index) => (
        <polygon
          key={index}
          points={polygon}
          fill="none"
          stroke="rgba(148,163,184,0.25)"
          strokeWidth={0.8}
        />
      ))}
      {values.map((_, index) => {
        const angle = (-Math.PI / 2) + (index * Math.PI * 2) / axisCount
        const x = center + Math.cos(angle) * radius
        const y = center + Math.sin(angle) * radius
        return (
          <line
            key={index}
            x1={center}
            y1={center}
            x2={x}
            y2={y}
            stroke="rgba(148,163,184,0.25)"
            strokeWidth={0.8}
          />
        )
      })}
      <polygon points={points} fill={color} fillOpacity={0.24} stroke={color} strokeWidth={1.8} />
      <circle cx={center} cy={center} r={1.6} fill={color} />
    </svg>
  )
}

export default function ClassAnalyticsPage() {
  const params = useParams()
  const classId = params?.classId as string

  const [data, setData] = useState<ClassAnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/teacher/classes/${classId}/analytics`)
        if (!response.ok) {
          throw new Error('获取班级分析失败')
        }
        const payload = (await response.json()) as ClassAnalyticsPayload
        if (!cancelled) {
          setData(payload)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载失败')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    if (classId) {
      void fetchData()
    }

    return () => {
      cancelled = true
    }
  }, [classId])

  if (loading) {
    return (
      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-slate-800" />
          <div className="h-64 rounded-xl bg-slate-800" />
        </div>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <p className="text-red-400">{error || '加载失败'}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-8">
      <Link
        href={`/teacher/classes/${classId}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        返回班级详情
      </Link>

      <section className="mb-8 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 p-6">
        <h1 className="text-2xl font-bold text-white">班级学情热力图（雷达）</h1>
        <p className="mt-2 text-sm text-slate-400">
          {data.classInfo.name} · 班级码 {data.classInfo.code}
        </p>
        <div className="mt-3 inline-flex items-center rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
          <Users className="mr-1 inline h-4 w-4 text-sky-400" /> {data.classInfo.studentCount} 名学生
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">班级整体热力图</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.studentCards.map((student) => (
            <article key={student.userId} className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{student.name}</p>
                  <p className="text-xs text-slate-400">{student.studentNumber}</p>
                </div>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300">
                  {student.weakTagLabel}
                </span>
              </div>
              <div className="flex items-center justify-center">
                <MiniRadar values={valueArray(student.post)} color="rgb(56,189,248)" />
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="mt-8">
        <Link
          href="/review/extracurricular-showcase"
          className="inline-flex items-center gap-2 rounded-lg border border-sky-500/50 bg-sky-500/10 px-4 py-2 text-sm text-sky-300 transition hover:bg-sky-500/20"
        >
          前往评审聚合入口
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </main>
  )
}
