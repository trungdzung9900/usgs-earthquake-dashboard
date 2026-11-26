interface GeocoderResult {
  lat: number
  lon: number
  displayName: string
}

export async function geocode(placeName: string): Promise<GeocoderResult | null> {
  const params = new URLSearchParams({
    q: placeName,
    format: 'json',
    limit: '1',
  })
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { 'User-Agent': 'usgs-earthquake-dashboard/1.0' } },
  )
  if (!res.ok) return null
  const results = (await res.json()) as Array<{
    lat: string
    lon: string
    display_name: string
  }>
  if (!results.length) return null
  return {
    lat: parseFloat(results[0].lat),
    lon: parseFloat(results[0].lon),
    displayName: results[0].display_name,
  }
}
