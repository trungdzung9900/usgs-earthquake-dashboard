import { useRef, useState } from 'react'
import { geocode } from '../hooks/useGeocoder'
import type { MapViewHandle } from './MapView'

interface Props {
  mapRef: React.RefObject<MapViewHandle | null>
}

export default function SearchBar({ mapRef }: Props) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'notfound'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setStatus('loading')
    const result = await geocode(query.trim())
    if (!result) {
      setStatus('notfound')
      return
    }
    setStatus('idle')
    mapRef.current?.flyTo(result.lat, result.lon, 8)
    inputRef.current?.blur()
  }

  return (
    <form className="search-bar" onSubmit={handleSearch}>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search place…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setStatus('idle')
        }}
      />
      <button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? '…' : 'Go'}
      </button>
      {status === 'notfound' && (
        <span className="search-notfound">Not found</span>
      )}
    </form>
  )
}
