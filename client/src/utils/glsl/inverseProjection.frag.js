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
 *   5. (l, b) → texture coords (u, v)
 *   6. sample panorama; apply dim factor based on alt
 *
 * The math in steps 1-2 mirrors client/src/utils/inverseStereographic.js
 * exactly. The galactic transform constants are J2000 (Liu et al. 2011).
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
const float GAL_L_OFFSET = 2.14556962;   // 122.9320° in radians

vec3 unitVectorAltAz(float alt, float az) {
  // x = north, y = east, z = up
  float c = cos(alt);
  return vec3(c * cos(az), c * sin(az), sin(alt));
}

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

  float y = sin(dec) - sin(b) * sin(GAL_POLE_DEC);
  float x = cos(dec) * sin(ra - GAL_POLE_RA) * cos(GAL_POLE_DEC);
  l = GAL_L_OFFSET - atan(y, x);
  l = mod(l, TAU);
  if (l < 0.0) l += TAU;
}

void main() {
  vec2 fragCoord = vUv * uResolution;
  vec2 center = uResolution * 0.5;
  vec2 d = fragCoord - center;

  float halfShort = min(uResolution.x, uResolution.y) * 0.5;
  float refZenithAngle = PI * 0.5 - uReferenceAlt;
  float scale = halfShort / tan(refZenithAngle * 0.5);

  float r = length(d);
  float zenithAngle = 2.0 * atan(r / scale);
  float alt = PI * 0.5 - zenithAngle;

  // Azimuth: 0 = north (-y direction), π/2 = east (+x direction)
  float az = atan(d.x, -d.y);
  if (az < 0.0) az += TAU;

  float ra, dec;
  altAzToEquatorial(alt, az, uObserverLat, uLST, ra, dec);

  float l, b;
  equatorialToGalactic(ra, dec, l, b);

  // Galactic equirectangular texture mapping:
  //   u = l / 2π   (l = 0 / galactic center sits at the LEFT edge for most
  //                 galactic equirectangular panoramas, including ESO/S. Brunier
  //                 eso0932a. If a future panorama centers l = 0, add 0.5 here.)
  //   v = (b + π/2) / π
  vec2 uv = vec2(l / TAU, (b + PI * 0.5) / PI);

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
