import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'

export const EMPTY = { type: 'FeatureCollection' as const, features: [] }
export const BASE_LAYER = 'municipalities-fill'
export const GOLD = '#facc15'
export const NOT_FARMLAND = ['urbano', 'agua', 'publico']
export const LIMITED = ['monte', 'pendiente', 'roca']
export const HATCH = 'hatch'

export function hatchImage(size = 12) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'
  ctx.lineWidth = 1.5
  for (const offset of [-size, 0, size]) {
    ctx.beginPath()
    ctx.moveTo(offset, size)
    ctx.lineTo(offset + size, 0)
    ctx.stroke()
  }
  return ctx.getImageData(0, 0, size, size)
}

const state = (key: string): ExpressionSpecification => ['boolean', ['feature-state', key], false]

export const municipalityPaint = {
  province: {
    'fill-color': ['case', state('hover'), GOLD, '#0b0b0b'] as ExpressionSpecification,
    'fill-opacity': ['case', state('hover'), 0.3, 0.12] as ExpressionSpecification,
  },
  municipality: {
    'fill-color': '#0b0b0b',
    'fill-opacity': ['case', state('active'), 0, state('hover'), 0.3, 0.5] as ExpressionSpecification,
  },
}

export const style: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    },
    municipalities: { type: 'geojson', data: EMPTY, promoteId: 'mun' },
    farms: { type: 'geojson', data: EMPTY, promoteId: 'id', attribution: 'Farms: SIGPAC (FEGA, CC BY 4.0)' },
    field: { type: 'geojson', data: EMPTY },
    pulse: { type: 'geojson', data: EMPTY },
  },
  layers: [
    { id: 'esri', type: 'raster', source: 'esri' },
    { id: 'municipalities-fill', type: 'fill', source: 'municipalities', paint: municipalityPaint.province },
    {
      id: 'municipalities-line',
      type: 'line',
      source: 'municipalities',
      paint: { 'line-color': '#ffffff', 'line-opacity': 0.7, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 12, 1.5] },
    },
    {
      id: 'municipalities-focus',
      type: 'line',
      source: 'municipalities',
      paint: {
        'line-color': GOLD,
        'line-width': ['case', state('active'), 3, state('hover'), 2.5, 0],
        'line-opacity': ['case', state('active'), 1, state('hover'), 0.9, 0],
      },
    },
    { id: 'farms-fill', type: 'fill', source: 'farms', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.04, 'fill-opacity-transition': { duration: 700 } } },
    {
      id: 'farms-line',
      type: 'line',
      source: 'farms',
      paint: {
        'line-color': '#ffffff',
        'line-opacity': 0.5,
        'line-opacity-transition': { duration: 700 },
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.3, 15, 1.2],
      },
    },
    {
      id: 'farms-limited',
      type: 'fill',
      source: 'farms',
      filter: ['in', ['get', 'apt'], ['literal', LIMITED]],
      paint: { 'fill-color': '#0b0b0b', 'fill-opacity': 0.42 },
    },
    {
      id: 'farms-blocked-tint',
      type: 'fill',
      source: 'farms',
      filter: ['in', ['get', 'apt'], ['literal', NOT_FARMLAND]],
      paint: { 'fill-color': '#3f3f46', 'fill-opacity': 0.6 },
    },
    {
      id: 'farms-blocked',
      type: 'fill',
      source: 'farms',
      filter: ['in', ['get', 'apt'], ['literal', NOT_FARMLAND]],
      paint: { 'fill-pattern': HATCH },
    },
    { id: 'farms-candidate-fill', type: 'fill', source: 'farms', filter: ['==', ['get', 'id'], -1], paint: { 'fill-color': GOLD, 'fill-opacity': 0.08 } },
    {
      id: 'farms-candidate-line',
      type: 'line',
      source: 'farms',
      filter: ['==', ['get', 'id'], -1],
      paint: { 'line-color': GOLD, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 15, 3], 'line-opacity': 0.9 },
    },
    { id: 'farms-hover-fill', type: 'fill', source: 'farms', paint: { 'fill-color': '#ffffff', 'fill-opacity': ['case', state('hover'), 0.22, 0] } },
    { id: 'farms-hover-line', type: 'line', source: 'farms', paint: { 'line-color': '#ffffff', 'line-width': 2.5, 'line-opacity': ['case', state('hover'), 1, 0] } },
    { id: 'field-fill', type: 'fill', source: 'field', paint: { 'fill-color': GOLD, 'fill-opacity': 0.22 } },
    { id: 'field-glow', type: 'line', source: 'field', paint: { 'line-color': GOLD, 'line-width': 10, 'line-opacity': 0.3, 'line-blur': 4 } },
    { id: 'field-line', type: 'line', source: 'field', paint: { 'line-color': GOLD, 'line-width': 3 } },
    { id: 'pulse-fill', type: 'fill', source: 'pulse', paint: { 'fill-opacity': 0 } },
    { id: 'pulse-line-1', type: 'line', source: 'pulse', paint: { 'line-opacity': 0 } },
    { id: 'pulse-line-2', type: 'line', source: 'pulse', paint: { 'line-opacity': 0 } },
  ],
}
