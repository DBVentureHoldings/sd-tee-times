/**
 * Approximate geographic coordinates for each course, used to place pins on
 * the stylized San Diego County map (app/CourseMap.tsx).
 *
 * These are hand-collected, intentionally rough — the map is illustrative,
 * not cartographic. A course missing from this table simply gets no pin.
 */
export interface CourseCoord {
  lat: number;
  lng: number;
}

export const COURSE_GEO: Record<string, CourseCoord> = {
  "torrey-pines-north": { lat: 32.9088, lng: -117.2533 },
  "torrey-pines-south": { lat: 32.905, lng: -117.252 },
  "balboa-park": { lat: 32.728, lng: -117.141 },
  "mission-bay": { lat: 32.779, lng: -117.203 },
  "coronado-muni": { lat: 32.685, lng: -117.172 },
  "rams-hill": { lat: 33.228, lng: -116.387 },
  riverwalk: { lat: 32.766, lng: -117.19 },
  "mission-trails": { lat: 32.804, lng: -117.043 },
  "rancho-bernardo-inn": { lat: 33.023, lng: -117.075 },
  "twin-oaks": { lat: 33.173, lng: -117.176 },
  "encinitas-ranch": { lat: 33.056, lng: -117.275 },
  "crossings-carlsbad": { lat: 33.126, lng: -117.316 },
  "steele-canyon": { lat: 32.732, lng: -116.918 },
  cottonwood: { lat: 32.743, lng: -116.925 },
  "national-city": { lat: 32.668, lng: -117.098 },
  "colina-park": { lat: 32.743, lng: -117.095 },
  bonita: { lat: 32.662, lng: -117.025 },
  "admiral-baker-north": { lat: 32.8, lng: -117.108 },
  "admiral-baker-south": { lat: 32.799, lng: -117.109 },
  "mt-woodson": { lat: 33.001, lng: -116.954 },
  "san-vicente": { lat: 33.019, lng: -116.895 },
  "vineyard-escondido": { lat: 33.09, lng: -117.048 },
  maderas: { lat: 33.003, lng: -117.044 },
  "links-at-lakehouse": { lat: 33.123, lng: -117.209 },
  "enagic-chula-vista": { lat: 32.662, lng: -116.972 },
  "chula-vista-muni": { lat: 32.631, lng: -117.068 },
  "goat-hill-park": { lat: 33.201, lng: -117.353 },
  "the-loma-club": { lat: 32.742, lng: -117.212 },
  "oaks-north": { lat: 33.029, lng: -117.071 },
  "welk-fountains": { lat: 33.223, lng: -117.068 },
  "welk-oaks": { lat: 33.221, lng: -117.07 },
  "lomas-santa-fe-executive": { lat: 33.001, lng: -117.248 },
};

/**
 * Map projection bounds. Tuned to frame the populated coastal+inland strip
 * of SD County where ~all courses sit. Pins outside (e.g. Rams Hill, far
 * east in Borrego) get clamped to the edge by the consumer.
 */
export const MAP_BOUNDS = {
  lngMin: -117.42, // west (coast) → x = 0
  lngMax: -116.82, // east → x = width
  latMax: 33.36, // north → y = 0
  latMin: 32.55, // south (border) → y = height
};

export const MAP_VIEWBOX = { width: 320, height: 460 };

/** Project a lat/lng to SVG x/y within MAP_VIEWBOX, clamped to bounds. */
export function projectToMap(lat: number, lng: number): { x: number; y: number } {
  const { lngMin, lngMax, latMax, latMin } = MAP_BOUNDS;
  const { width, height } = MAP_VIEWBOX;
  const rawX = ((lng - lngMin) / (lngMax - lngMin)) * width;
  const rawY = ((latMax - lat) / (latMax - latMin)) * height;
  return {
    x: Math.max(6, Math.min(width - 6, rawX)),
    y: Math.max(6, Math.min(height - 6, rawY)),
  };
}
