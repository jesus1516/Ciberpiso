export type GibsId = 'ndvi' | 'imerg' | 'smap'

export type GibsLayer = { id: GibsId; layer: string; level: number; resolution: string; legend: string }

const LEGENDS = 'https://gibs.earthdata.nasa.gov/legends'

// Verified against GIBS GetCapabilities (EPSG:3857 "best"), all image/png.
export const GIBS_LAYERS: GibsLayer[] = [
  { id: 'ndvi', layer: 'MODIS_Terra_NDVI_8Day', level: 9, resolution: '~250 m', legend: `${LEGENDS}/MODIS_NDVI_H.svg` },
  { id: 'imerg', layer: 'IMERG_Precipitation_Rate', level: 6, resolution: '~10 km', legend: `${LEGENDS}/GPM_Precipitation_Rate_H.svg` },
  { id: 'smap', layer: 'SMAP_L4_Analyzed_Surface_Soil_Moisture', level: 6, resolution: '~9 km', legend: `${LEGENDS}/SMAP_Analyzed_Soil_Moisture_H.svg` },
]

export const gibsTiles = (l: GibsLayer, date: string) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${l.layer}/default/${date}/GoogleMapsCompatible_Level${l.level}/{z}/{y}/{x}.png`

export function daysAgo(n: number) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

export const GIBS_MIN_DATE = '2015-04-01'
