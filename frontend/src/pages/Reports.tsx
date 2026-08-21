import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, download, readError } from '../lib/api'
import { useResource } from '../hooks/useResource'
import { useToast } from '../context/ToastContext'
import { money } from '../lib/format'
import BackLink from '../components/BackLink'
import {
  Alert,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  TableSkeleton,
  Td,
} from '../components/ui'
import type { Property, ReportData, Tenant } from '../lib/types'

const STATUS_OPTIONS: Record<string, { value: string; label: string }[]> = {
  rent: [
    { value: 'all', label: 'All statuses' },
    { value: 'paid', label: 'Paid' },
    { value: 'partial', label: 'Partially paid' },
    { value: 'pending', label: 'Pending' },
    { value: 'overdue', label: 'Overdue' },
  ],
  payments: [
    { value: 'all', label: 'All statuses' },
    { value: 'paid', label: 'Paid' },
    { value: 'partial', label: 'Partially paid' },
  ],
  properties: [
    { value: 'all', label: 'All statuses' },
    { value: 'available', label: 'Available' },
    { value: 'occupied', label: 'Occupied' },
    { value: 'maintenance', label: 'Under maintenance' },
  ],
  maintenance: [
    { value: 'all', label: 'All statuses' },
    { value: 'open', label: 'Open' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'closed', label: 'Closed' },
  ],
}

export default function Reports() {
  const [params, setParams] = useSearchParams()
  const toast = useToast()

  const { data: types } = useResource<{ value: string; label: string; description: string }[]>(
    '/reports/types',
  )
  const { data: properties } = useResource<Property[]>('/properties')
  const { data: tenants } = useResource<Tenant[]>('/tenants')

  const [report, setReport] = useState(params.get('report') ?? 'rent')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [status, setStatus] = useState('all')

  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState('')
  const [error, setError] = useState('')

  // Keep the URL in step so a generated report can be linked to.
  useEffect(() => {
    setParams(report === 'rent' ? {} : { report }, { replace: true })
    setStatus('all')
  }, [report, setParams])

  const filters = {
    report,
    start_date: startDate,
    end_date: endDate,
    property_id: propertyId,
    tenant_id: tenantId,
    status,
  }

  const generate = async (event?: React.FormEvent) => {
    event?.preventDefault()
    setLoading(true)
    setError('')
    try {
      setData(await api<ReportData>('/reports', { params: filters }))
    } catch (err) {
      setError(readError(err).message)
    } finally {
      setLoading(false)
    }
  }

  const exportAs = async (format: 'csv' | 'excel' | 'pdf') => {
    setExporting(format)
    setError('')
    const extension = format === 'excel' ? 'xlsx' : format
    try {
      await download('/reports/export', { ...filters, format }, `propora-${report}.${extension}`)
      toast.success(`${format.toUpperCase()} export downloaded`)
    } catch (err) {
      const message = readError(err).message
      setError(message)
      toast.error(message)
    } finally {
      setExporting('')
    }
  }

  const reset = () => {
    setStartDate('')
    setEndDate('')
    setPropertyId('')
    setTenantId('')
    setStatus('all')
  }

  const active = types?.find((item) => item.value === report)
  const statusOptions = STATUS_OPTIONS[report]
  const moneyColumns = new Set(data?.money_columns ?? [])

  return (
    <>
      <PageHeader
        back={<BackLink to="/reports" label="Reports dashboard" />}
        title={active?.label ?? 'Generate report'}
        subtitle={active?.description ?? 'Filter by date range, property, tenant and status.'}
      />

      <Card className="mb-4">
        <CardHeader title="Report filters" />
        <form onSubmit={generate} className="p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Report type">
              <Select value={report} onChange={(event) => setReport(event.target.value)}>
                {(types ?? []).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="From date">
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </Field>
            <Field label="To date">
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </Field>
            <Field label="Property">
              <Select value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>
                <option value="">All properties</option>
                {(properties ?? []).map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tenant">
              <Select value={tenantId} onChange={(event) => setTenantId(event.target.value)}>
                <option value="">All tenants</option>
                {(tenants ?? []).map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            {statusOptions && (
              <Field label="Status">
                <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-200 pt-5">
            <Button type="submit" disabled={loading}>
              {loading ? 'Generating…' : 'Generate report'}
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Clear filters
            </Button>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={!data || Boolean(exporting)}
                onClick={() => exportAs('pdf')}
              >
                {exporting === 'pdf' ? 'Preparing…' : 'Export PDF'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!data || Boolean(exporting)}
                onClick={() => exportAs('excel')}
              >
                {exporting === 'excel' ? 'Preparing…' : 'Export Excel'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!data || Boolean(exporting)}
                onClick={() => exportAs('csv')}
              >
                {exporting === 'csv' ? 'Preparing…' : 'Export CSV'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!data}
                onClick={() => window.print()}
              >
                Print
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {error && (
        <div className="mb-4">
          <Alert message={error} />
        </div>
      )}

      {loading ? (
        <Card>
          <TableSkeleton rows={8} columns={6} />
        </Card>
      ) : !data ? (
        <Card>
          <EmptyState
            title="No report generated yet"
            message="Choose your filters above, then select Generate report."
            action={<Button onClick={() => generate()}>Generate report</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(data.totals).map(([label, value]) => (
              <Card key={label} className="p-4">
                <p className="text-sm text-ink-500">{label}</p>
                <p className="mt-1 text-xl font-semibold text-ink-900">
                  {moneyColumns.has(label) ||
                  ['Billed', 'Paid', 'Balance', 'Cost', 'Amount', 'Rent roll', 'Deposit'].includes(label)
                    ? money(Number(value))
                    : String(value)}
                </p>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader
              title={data.label}
              subtitle={
                <>
                  Generated {data.generated_at} · {data.rows.length} row
                  {data.rows.length === 1 ? '' : 's'}
                  {data.start_date || data.end_date
                    ? ` · ${data.start_date ?? 'beginning'} to ${data.end_date ?? 'today'}`
                    : ''}
                </>
              }
            />
            {data.rows.length === 0 ? (
              <EmptyState title="No records in this range" message="Widen the filters and try again." />
            ) : (
              <div className="max-h-[70vh] overflow-y-auto">
                <Table columns={data.columns} minWidth={data.columns.length * 120}>
                  {data.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-ink-100/60">
                      {row.map((cell, cellIndex) => (
                        <Td
                          key={cellIndex}
                          className={cellIndex === 0 ? 'font-medium text-ink-900' : undefined}
                        >
                          {moneyColumns.has(data.columns[cellIndex]) && typeof cell === 'number'
                            ? money(cell)
                            : String(cell)}
                        </Td>
                      ))}
                    </tr>
                  ))}
                </Table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  )
}
