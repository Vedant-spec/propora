import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { relativeTime } from '../lib/format'
import { Button, EmptyState, cx } from './ui'

interface Notification {
  id: number
  title: string
  message?: string
  kind: string
  link?: string | null
  is_read: boolean
  created_at?: string
}

const KIND_STYLES: Record<string, string> = {
  rent: 'bg-warning-soft text-warning',
  maintenance: 'bg-info-soft text-info',
  lease: 'bg-accent-soft text-accent',
  info: 'bg-ink-100 text-ink-600',
}

const KIND_ICONS: Record<string, string> = {
  rent: 'M3 10h18M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
  maintenance: 'm14.7 6.3 3 3M3 21l3.5-.7L20 6.8a2 2 0 0 0 0-2.8l-.9-.9a2 2 0 0 0-2.8 0L2.8 16.6 3 21Z',
  lease: 'M9 12h6m-6 4h6M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z',
  info: 'M12 16v-5m0-3h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
}

export default function NotificationsPanel() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const data = await api<{ items: Notification[]; unread: number }>('/notifications')
      setItems(data.items)
      setUnread(data.unread)
    } catch {
      // A failed poll should never break the page chrome.
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(load, 60_000)
    return () => window.clearInterval(timer)
  }, [load])

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openItem = async (item: Notification) => {
    if (!item.is_read) {
      await api(`/notifications/${item.id}/read`, { method: 'POST' }).catch(() => undefined)
    }
    setOpen(false)
    await load()
    if (item.link) navigate(item.link)
  }

  const markAll = async () => {
    setLoading(true)
    await api('/notifications/read-all', { method: 'POST' }).catch(() => undefined)
    await load()
    setLoading(false)
  }

  const dismiss = async (id: number) => {
    await api(`/notifications/${id}`, { method: 'DELETE' }).catch(() => undefined)
    await load()
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-brand-contrast">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-ink-200 bg-raised shadow-raised">
          <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
            <p className="text-sm font-semibold text-ink-900">
              Notifications
              {unread > 0 && <span className="ml-1.5 text-xs font-normal text-ink-500">{unread} new</span>}
            </p>
            {unread > 0 && (
              <button
                onClick={markAll}
                disabled={loading}
                className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <EmptyState title="You are all caught up" message="No notifications right now." />
            ) : (
              <ul className="divide-y divide-ink-200">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className={cx('group relative', !item.is_read && 'bg-brand-50/40')}
                  >
                    <button
                      onClick={() => openItem(item)}
                      className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-100"
                    >
                      <span
                        className={cx(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                          KIND_STYLES[item.kind] ?? KIND_STYLES.info,
                        )}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d={KIND_ICONS[item.kind] ?? KIND_ICONS.info}
                          />
                        </svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-ink-900">{item.title}</span>
                          {!item.is_read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />}
                        </span>
                        {item.message && (
                          <span className="mt-0.5 block text-xs text-ink-500">{item.message}</span>
                        )}
                        <span className="mt-1 block text-xs text-ink-500">
                          {relativeTime(item.created_at)}
                        </span>
                      </span>
                    </button>
                    <button
                      onClick={() => dismiss(item.id)}
                      aria-label="Dismiss notification"
                      className="absolute right-2 top-2 rounded p-1 text-ink-400 opacity-0 transition-opacity hover:bg-ink-200 hover:text-ink-700 focus:opacity-100 group-hover:opacity-100"
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M4.7 3.6a.75.75 0 0 0-1.1 1.1L6.9 8l-3.3 3.3a.75.75 0 1 0 1.1 1.1L8 9.1l3.3 3.3a.75.75 0 0 0 1.1-1.1L9.1 8l3.3-3.3a.75.75 0 0 0-1.1-1.1L8 6.9 4.7 3.6Z" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-ink-200 bg-sunken px-4 py-2.5">
            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setOpen(false)
                navigate('/settings/notifications')
              }}
            >
              Notification settings
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
