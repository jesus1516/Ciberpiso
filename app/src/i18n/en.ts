export const en = {
  appName: 'Ciberpiso',
  appTagline: 'Crop rotation explorer',
  about: 'About / Data sources',
  disclaimer: 'Decision-support only. Validate with local agronomists and extension services.',

  map: {
    searchPlaceholder: 'Search a place…',
    search: 'Search',
    searching: 'Searching…',
    noResults: 'No places found.',
    searchError: 'Search is unavailable right now.',
    drawField: 'Draw my field',
    dropPoint: 'Click a point',
    drawHint: 'Click to add corners. Click the first corner to close the field.',
    pointHint: 'Click on the map: we will create a ~500 m square around that point.',
    cancel: 'Cancel',
    area: (ha: number) => `${ha.toLocaleString('en', { maximumFractionDigits: ha < 10 ? 1 : 0 })} ha`,
    confirm: 'Analyse this field',
    redraw: 'Redraw',
    intro: 'Find your farm, then draw your field to explore rotation options with NASA Earth observations.',
    webglError: 'Your browser could not start the 3D map (WebGL). Try another browser or device.',
    flatFallback: '3D terrain could not load. Showing a flat map.',
  },

  dashboard: {
    title: 'Your field',
    newField: 'New field',
    collapse: 'Hide panel',
    expand: 'Show panel',
    tabs: {
      conditions: 'Conditions',
      layers: 'Map layers',
      priorities: 'Priorities',
      rotations: 'Rotations',
    },
  },
}

export type Strings = typeof en
