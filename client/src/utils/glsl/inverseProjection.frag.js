/**
 * Fragment shader: warps an all-sky Milky Way panorama (galactic
 * equirectangular) onto the sky canvas via inverse stereographic AltAz
 * projection.
 *
 * Per pixel:
 *   1. screen pixel → polar (r, θ) from canvas center
 *   2. inverse stereographic → (alt, az)
 *   3. (alt, az) + (lat, LST) → equatorial (RA, Dec)
 *   4. equatorial (RA, Dec) → galactic (l, b) via fixed J2000 rotation
 *   5. (l, b) → texture coords (u, v) for the eso0932a panorama layout
 *   6. sample panorama; apply dim factor based on alt
 *
 * Orientation contracts (each one was individually wrong before 2026-07-13 —
 * verified end-to-end against Astropy ground truth, see that session's notes):
 *   - vUv has y UP (GL clip space); the Canvas 2D star layer is y DOWN.
 *     We flip to canvas convention first so both layers agree pixel-for-pixel.
 *   - Screen is the INSIDE view of the sky: north up, east LEFT, matching
 *     projection.js (x = -sin az, y = -cos az in y-down pixels).
 *   - RA/Dec derived from LST are equator-of-date; we apply the J2000
 *     galactic rotation directly. The ~0.4° precession offset (in 2026) is
 *     a couple of screen pixels on a diffuse backdrop — accepted for v1.
 *   - eso0932a texture layout (verified against the bulge + LMC/SMC pixel
 *     positions in the asset): galactic center l=0 at u=0.5, l increasing
 *     LEFTWARD (inside-view panorama); NGP (b=+90°) at the image top, and
 *     texture v=0 samples the top row (UNPACK_FLIP_Y_WEBGL not set).
 *
 * The galactic transform constants are J2000 (Liu et al. 2011).
 */
export const INVERSE_PROJECTION_FRAG = `
precision highp float;

varying vec2 vUv;

uniform vec2 uResolution;       // canvas width, height (CSS px)
uniform float uReferenceAlt;    // projection reference altitude (radians)
uniform float uLST;             // local sidereal time (radians)
uniform float uObserverLat;     // observer latitude (radians)
uniform sampler2D uMilkyWayTex;
uniform float uBelowHorizonDim; // dim factor for alt < 0 (e.g. 0.25)
uniform float uHorizonHazeStart;// alt threshold where haze begins (radians, e.g. 30°)

const float PI = 3.14159265358979323846;
const float TAU = 6.28318530717958647693;

// Galactic north pole in J2000 equatorial coords (Liu et al. 2011 / IAU).
const float GAL_POLE_RA  = 3.36603292;   // 192.8595° in radians
const float GAL_POLE_DEC = 0.4734780;    // 27.1283° in radians
const float GAL_L_OFFSET = 2.14556962;   // 122.9320° in radians (l of the NCP)

void altAzToEquatorial(float alt, float az, float lat, float lst, out float ra, out float dec) {
  // Standard astronomy formulas. az convention: 0 = N, π/2 = E.
  float sinDec = sin(alt) * sin(lat) + cos(alt) * cos(lat) * cos(az);
  dec = asin(clamp(sinDec, -1.0, 1.0));

  float y = -sin(az) * cos(alt);
  float x = sin(alt) * cos(lat) - cos(alt) * cos(az) * sin(lat);
  float ha = atan(y, x);  // hour angle
  ra = lst - ha;
  ra = mod(ra, TAU);
  if (ra < 0.0) ra += TAU;
}

void equatorialToGalactic(float ra, float dec, out float l, out float b) {
  float sinB = sin(dec) * sin(GAL_POLE_DEC) + cos(dec) * cos(GAL_POLE_DEC) * cos(ra - GAL_POLE_RA);
  b = asin(clamp(sinB, -1.0, 1.0));

  // tan(l_NCP - l) = y / x  (spherical triangle star–NCP–NGP; the same
  // atan2 form Astropy uses). Sanity anchor: Sgr A* (RA 266.417°,
  // Dec -29.008°) must land at l ≈ 359.94°, b ≈ -0.05°.
  float y = cos(dec) * sin(ra - GAL_POLE_RA);
  float x = cos(GAL_POLE_DEC) * sin(dec) - sin(GAL_POLE_DEC) * cos(dec) * cos(ra - GAL_POLE_RA);
  l = GAL_L_OFFSET - atan(y, x);
  l = mod(l, TAU);
  if (l < 0.0) l += TAU;
}

void main() {
  // Flip vUv.y so fragCoord is y-DOWN like the Canvas 2D star layer —
  // both layers must map the same pixel to the same alt/az.
  vec2 fragCoord = vec2(vUv.x, 1.0 - vUv.y) * uResolution;
  vec2 center = uResolution * 0.5;
  vec2 d = fragCoord - center;

  float halfShort = min(uResolution.x, uResolution.y) * 0.5;
  float refZenithAngle = PI * 0.5 - uReferenceAlt;
  float scale = halfShort / tan(refZenithAngle * 0.5);

  float r = length(d);
  float zenithAngle = 2.0 * atan(r / scale);
  float alt = PI * 0.5 - zenithAngle;

  // Azimuth, inside view: 0 = north (up on screen), π/2 = east (LEFT on
  // screen). Inverse of projection.js: x = -sin(az), y = -cos(az).
  float az = atan(-d.x, -d.y);
  if (az < 0.0) az += TAU;

  float ra, dec;
  altAzToEquatorial(alt, az, uObserverLat, uLST, ra, dec);

  float l, b;
  equatorialToGalactic(ra, dec, l, b);

  // eso0932a galactic equirectangular mapping (see header):
  //   u: galactic center (l=0) at 0.5, l increasing leftward → u = 0.5 - l/2π
  //   v: NGP (b=+90°) at texture v=0 (image top row) → v = (π/2 - b)/π
  vec2 uv = vec2(mod(0.5 - l / TAU, 1.0), (PI * 0.5 - b) / PI);

  vec3 rgb = texture2D(uMilkyWayTex, uv).rgb;

  // Dim factor based on altitude.
  float dim = 1.0;
  if (alt < 0.0) {
    dim = uBelowHorizonDim;
  } else if (alt < uHorizonHazeStart) {
    float t = alt / uHorizonHazeStart;
    dim = mix(uBelowHorizonDim, 1.0, t);
  }

  gl_FragColor = vec4(rgb * dim, 1.0);
}
`;
