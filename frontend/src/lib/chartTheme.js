/**
 * Chart tokens.
 *
 * The two revenue streams are the only categorical series in the app, and their
 * hues are assigned in fixed order — rooms is always blue, food is always amber
 * — so a filtered chart never repaints the survivors.
 *
 * These are *chart* steps, not the UI's primary-800 / accent-500. The brand
 * navy is too dark and too desaturated to work as a data mark: it fails the
 * lightness band and reads as grey next to amber. These two were validated
 * against the light chart surface and pass all six checks — lightness band,
 * chroma floor, CVD separation (ΔE 21.8 protan), normal-vision separation
 * (ΔE 25.3) and 3:1 contrast. Do not hand-tune them without re-validating.
 */

export const SERIES = {
  rooms: { key: 'rooms', label: 'Rooms', color: '#2F6FB5' },
  food: { key: 'food', label: 'Food', color: '#B07C34' },
}

/** Fixed order. A third stream would be added here, never generated. */
export const SERIES_ORDER = [SERIES.rooms, SERIES.food]

/** Recessive chart furniture — the data should be the only assertive thing. */
export const CHART = {
  grid: '#E7E1D8', // neutral-200
  axis: '#A79D8E', // neutral-400
  axisLabel: '#7C7367', // neutral-500
  surface: '#FFFFFF',
  tooltipBorder: '#E7E1D8',
}

/** Shared axis/tick props so every chart in the app is furnished identically. */
export const axisProps = {
  stroke: CHART.axis,
  tickLine: false,
  axisLine: false,
  tick: { fill: CHART.axisLabel, fontSize: 11 },
}
