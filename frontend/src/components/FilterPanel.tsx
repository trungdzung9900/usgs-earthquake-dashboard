interface Props {
  starttime: string
  endtime: string
  minmagnitude: number
  onStarttimeChange: (v: string) => void
  onEndtimeChange: (v: string) => void
  onMinmagnitudeChange: (v: number) => void
  count: number | null
  loading: boolean
  tooMany: boolean
  tooManyCount: number | null
  error: string | null
}

export default function FilterPanel({
  starttime,
  endtime,
  minmagnitude,
  onStarttimeChange,
  onEndtimeChange,
  onMinmagnitudeChange,
  count,
  loading,
  tooMany,
  tooManyCount,
  error,
}: Props) {
  return (
    <div className="filter-panel">
      <h2 className="panel-title">Filters</h2>

      <label className="field-label">
        Start date
        <input
          type="date"
          value={starttime}
          max={endtime}
          onChange={(e) => onStarttimeChange(e.target.value)}
        />
      </label>

      <label className="field-label">
        End date
        <input
          type="date"
          value={endtime}
          min={starttime}
          onChange={(e) => onEndtimeChange(e.target.value)}
        />
      </label>

      <label className="field-label">
        Min magnitude — <strong>M{minmagnitude.toFixed(1)}</strong>
        <input
          type="range"
          min={0}
          max={9}
          step={0.5}
          value={minmagnitude}
          onChange={(e) => onMinmagnitudeChange(parseFloat(e.target.value))}
        />
      </label>

      <div className="status">
        {loading && <span className="status-loading">Loading…</span>}
        {!loading && tooMany && (
          <span className="status-error">
            Too many events ({tooManyCount?.toLocaleString()}).
            <br />Zoom in or raise magnitude.
          </span>
        )}
        {!loading && error && (
          <span className="status-error">{error}</span>
        )}
        {!loading && !tooMany && !error && count !== null && (
          <span className="status-count">
            {count.toLocaleString()} event{count !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  )
}
