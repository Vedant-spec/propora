import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'

/** Fetch a JSON resource, re-fetching whenever `params` changes. */
export function useResource<T>(path: string, params?: Record<string, string | number | undefined>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const key = JSON.stringify(params ?? {})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await api<T>(path, { params: JSON.parse(key) }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load data')
    } finally {
      setLoading(false)
    }
  }, [path, key])

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, error, reload: load, setData }
}
