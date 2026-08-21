import { Link } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import { money } from '../lib/format'
import {
  Card,
  CardHeader,
  ErrorState,
  PageHeader,
  StatCard,
  StatSkeleton,
} from '../components/ui'

interface ReportsDashboardData {
  reports: { value: string; label: string; description: string }[]
  headline: {
    properties: number
    occupancy_rate: number
    tenants: number
    active_leases: number
    billed_to_date: number
    collected_to_date: number
    outstanding: number
    collection_rate: number
    maintenance_total: number
    maintenance_open: number
    maintenance_cost: number
  }
}

const REPORT_ICONS: Record<string, string> = {
  rent: 'M3 10h18M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
  payments: 'M12 8v8m-3-5.5h6M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  properties: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z',
  tenants: 'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  leases: 'M9 12h6m-6 4h6M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z',
  maintenance: 'm14.7 6.3 3 3M3 21l3.5-.7L20 6.8a2 2 0 0 0 0-2.8l-.9-.9a2 2 0 0 0-2.8 0L2.8 16.6 3 21Z',
}

export default function ReportsDashboard() {
  const { data, loading, error, reload } = useResource<ReportsDashboardData>('/reports/dashboard')

  if (loading) {
    return (
      <>
        <PageHeader title="Reports" subtitle="Central reporting and analytics." />
        <StatSkeleton />
      </>
    )
  }
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return null

  const { headline, reports } = data

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Central reporting and analytics — generate, filter and export."
        action={
          <Link
            to="/reports/generate"
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-brand-contrast transition-colors hover:bg-brand-500"
          >
            Generate a report
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Portfolio"
          value={headline.properties}
          hint={`${headline.occupancy_rate}% occupied`}
          tone="brand"
        />
        <StatCard
          label="Tenants"
          value={headline.tenants}
          hint={`${headline.active_leases} active leases`}
          tone="neutral"
        />
        <StatCard
          label="Collected to date"
          value={money(headline.collected_to_date)}
          hint={`${headline.collection_rate}% collection rate`}
          tone={headline.collection_rate >= 80 ? 'green' : 'amber'}
        />
        <StatCard
          label="Outstanding"
          value={money(headline.outstanding)}
          hint={`of ${money(headline.billed_to_date)} billed`}
          tone={headline.outstanding > 0 ? 'amber' : 'green'}
        />
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Available reports"
          subtitle="Each report supports date range, property, tenant and status filters, with PDF, Excel and CSV export."
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <Link
              key={report.value}
              to={`/reports/generate?report=${report.value}`}
              className="group rounded-xl border border-ink-200 bg-sunken p-5 transition-colors hover:border-brand-300 hover:bg-brand-50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 group-hover:bg-surface">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={REPORT_ICONS[report.value] ?? REPORT_ICONS.rent}
                  />
                </svg>
              </span>
              <h3 className="mt-4 font-semibold text-ink-900">{report.label}</h3>
              <p className="mt-1 text-sm text-ink-500">{report.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600">
                Generate
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path
                    fillRule="evenodd"
                    d="M7.3 4.3a1 1 0 0 0 0 1.4L11.6 10l-4.3 4.3a1 1 0 1 0 1.4 1.4l5-5a1 1 0 0 0 0-1.4l-5-5a1 1 0 0 0-1.4 0Z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Rent collection at a glance" />
          <dl className="divide-y divide-ink-200">
            {[
              { label: 'Total billed to date', value: money(headline.billed_to_date) },
              { label: 'Total collected', value: money(headline.collected_to_date) },
              { label: 'Outstanding balance', value: money(headline.outstanding) },
              { label: 'Collection rate', value: `${headline.collection_rate}%` },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between px-5 py-3.5">
                <dt className="text-sm text-ink-500">{row.label}</dt>
                <dd className="font-medium text-ink-900">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Maintenance at a glance" />
          <dl className="divide-y divide-ink-200">
            {[
              { label: 'Total requests', value: headline.maintenance_total },
              { label: 'Currently open', value: headline.maintenance_open },
              {
                label: 'Resolved',
                value: headline.maintenance_total - headline.maintenance_open,
              },
              { label: 'Total spend', value: money(headline.maintenance_cost) },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between px-5 py-3.5">
                <dt className="text-sm text-ink-500">{row.label}</dt>
                <dd className="font-medium text-ink-900">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </>
  )
}
