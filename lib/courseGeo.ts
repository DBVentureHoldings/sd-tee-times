/**
 * Pin positions for the vintage illustrated map (public/sd-county-map.png),
 * used by app/CourseMap.tsx.
 *
 * Coordinates are FRACTIONAL — {x, y} each in 0..1, relative to the square
 * map image (x = left→right, y = top→bottom). They are hand-tuned by eye
 * against that specific artwork, NOT derived from real lat/lng — a pictorial
 * map is artistically distorted, so a projection wouldn't line up.
 *
 * To nudge a pin: tweak its x/y here. A course missing from this table
 * simply gets no pin.
 */
export interface MapPos {
  x: number;
  y: number;
}

export const COURSE_MAP_POS: Record<string, MapPos> = {
  // --- North coast ---
  "goat-hill-park": { x: 0.16, y: 0.1 },
  "crossings-carlsbad": { x: 0.165, y: 0.15 },
  "encinitas-ranch": { x: 0.205, y: 0.215 },
  "lomas-santa-fe-executive": { x: 0.265, y: 0.275 },
  // --- North inland ---
  "twin-oaks": { x: 0.35, y: 0.14 },
  "links-at-lakehouse": { x: 0.305, y: 0.185 },
  "welk-fountains": { x: 0.585, y: 0.135 },
  "welk-oaks": { x: 0.625, y: 0.15 },
  "vineyard-escondido": { x: 0.5, y: 0.215 },
  "rancho-bernardo-inn": { x: 0.56, y: 0.355 },
  "oaks-north": { x: 0.61, y: 0.33 },
  maderas: { x: 0.47, y: 0.415 },
  "mt-woodson": { x: 0.63, y: 0.305 },
  "san-vicente": { x: 0.675, y: 0.34 },
  // --- Central coast / metro ---
  "torrey-pines-north": { x: 0.2, y: 0.305 },
  "torrey-pines-south": { x: 0.215, y: 0.325 },
  "mission-bay": { x: 0.285, y: 0.455 },
  "the-loma-club": { x: 0.25, y: 0.55 },
  riverwalk: { x: 0.42, y: 0.525 },
  "balboa-park": { x: 0.47, y: 0.575 },
  "admiral-baker-north": { x: 0.52, y: 0.495 },
  "admiral-baker-south": { x: 0.54, y: 0.515 },
  "mission-trails": { x: 0.575, y: 0.475 },
  "colina-park": { x: 0.5, y: 0.57 },
  // --- East ---
  cottonwood: { x: 0.66, y: 0.555 },
  "steele-canyon": { x: 0.66, y: 0.635 },
  // --- South ---
  "coronado-muni": { x: 0.345, y: 0.775 },
  "national-city": { x: 0.47, y: 0.715 },
  bonita: { x: 0.535, y: 0.785 },
  "chula-vista-muni": { x: 0.45, y: 0.875 },
  "enagic-chula-vista": { x: 0.585, y: 0.825 },
  // --- Far-east outlier: Rams Hill is in Borrego Springs, off this map's
  //     frame. Clamp to the east edge so it still appears.
  "rams-hill": { x: 0.96, y: 0.28 },
};

/** The map background image lives in /public. */
export const MAP_IMAGE_SRC = "/sd-county-map.png";
