/**
 * Approximate sunset (within a couple of minutes) for San Diego County on the
 * day of `at`, as a UTC timestamp. Standard sunrise-equation math; one fixed
 * point (33.0 N, 117.1 W) is close enough for every course we list.
 */
export function sunsetUtcMs(at: Date): number {
  const rad = Math.PI / 180;
  const lat = 33.0;
  const lonEast = -117.1;
  // Julian date of the tee time, then the solar transit nearest local noon.
  const jd = at.getTime() / 86_400_000 + 2440587.5;
  const n = Math.round(jd - 2451545.0 + 0.0008 + lonEast / 360);
  const jStar = n - lonEast / 360;
  const m = (357.5291 + 0.98560028 * jStar) % 360;
  const c =
    1.9148 * Math.sin(m * rad) +
    0.02 * Math.sin(2 * m * rad) +
    0.0003 * Math.sin(3 * m * rad);
  const lambda = (m + c + 180 + 102.9372) % 360;
  const jTransit =
    2451545.0 +
    jStar +
    0.0053 * Math.sin(m * rad) -
    0.0069 * Math.sin(2 * lambda * rad);
  const sinDec = Math.sin(lambda * rad) * Math.sin(23.4397 * rad);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosW =
    (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sinDec) /
    (Math.cos(lat * rad) * cosDec);
  const w = Math.acos(Math.max(-1, Math.min(1, cosW))) / rad;
  const jSet = jTransit + w / 360;
  return (jSet - 2440587.5) * 86_400_000;
}
