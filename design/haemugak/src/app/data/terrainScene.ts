import survey from "../../assets/haeundae-terrain.json";

export interface WorldPoint { x: number; y: number; z: number }
export interface ProjectedPoint { sx: number; sy: number; depth: number; scale: number }

const width = 2.24;
const length = 1.96;
const [west, south, east, north] = survey.bounds;
const { columns, rows } = survey;
const bytes = Uint8Array.from(atob(survey.elevations), (char) => char.charCodeAt(0));
const packed = new DataView(bytes.buffer);
const elevations = Array.from({ length: columns * rows }, (_, index) => packed.getInt16(index * 2, true));
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const roughness = (x: number, z: number) => {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

export const metersToWorld = (height: number) => height * 0.00062;

function location(longitude: number, latitude: number) {
  return {
    x: ((longitude - west) / (east - west) - 0.5) * width,
    z: ((north - latitude) / (north - south) - 0.5) * length,
  };
}

export const spotCoordinates: Record<string, { x: number; z: number }> = {
  hwangnyeongsan: location(129.0824, 35.1574),
  jangsan: location(129.1447, 35.1940),
  dongbaek: location(129.1513, 35.1532),
  "haeundae-beach": location(129.1606, 35.1585),
  "lct-observatory": location(129.1689, 35.1595),
};

export function terrainHeight(x: number, z: number) {
  const col = clamp(x / width + 0.5) * (columns - 1);
  const row = clamp(z / length + 0.5) * (rows - 1);
  const left = Math.min(columns - 2, Math.floor(col));
  const upper = Math.min(rows - 2, Math.floor(row));
  const tx = col - left;
  const tz = row - upper;
  const i = upper * columns + left;
  const top = elevations[i] * (1 - tx) + elevations[i + 1] * tx;
  const bottom = elevations[i + columns] * (1 - tx) + elevations[i + columns + 1] * tx;
  return Math.max(0, top * (1 - tz) + bottom * tz);
}

export function makeProjection(yaw: number, pitch: number, viewWidth: number, viewHeight: number, targetX: number, targetZ: number, zoom: number) {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const distance = 3.5 / zoom;
  const focal = Math.min(viewWidth * 1.03, viewHeight * 1.76);

  return ({ x, y, z }: WorldPoint): ProjectedPoint => {
    const rx = x - targetX;
    const rz = z - targetZ;
    const horizontal = rx * cosY - rz * sinY;
    const toward = rx * sinY + rz * cosY;
    const depth = -toward * cosP - y * sinP;
    const scale = focal / Math.max(0.35, distance + depth);
    return {
      sx: viewWidth * 0.5 + horizontal * scale,
      sy: viewHeight * 0.49 - (y * cosP - toward * sinP) * scale,
      depth,
      scale,
    };
  };
}

const points = elevations.map((elevation, index) => ({
  x: (index % columns / (columns - 1) - 0.5) * width,
  y: metersToWorld(Math.max(0, elevation)),
  z: (Math.floor(index / columns) / (rows - 1) - 0.5) * length,
}));

function groundColor(a: number, b: number, c: number, d: number, x: number, z: number) {
  const elevation = (a + b + c + d) / 4;
  const texture = roughness(x, z);
  if (elevation <= 0.4) {
    const ripple = Math.sin(x * 15 + z * 24) * 2 + texture * 4;
    return `rgb(${68 + ripple}, ${112 + ripple}, ${132 + ripple})`;
  }
  const nx = -metersToWorld((b + c - a - d) / 2) / (width / (columns - 1));
  const nz = -metersToWorld((c + d - a - b) / 2) / (length / (rows - 1));
  const sun = clamp((-0.48 * nx + 0.79 + 0.38 * nz) / Math.hypot(nx, 1, nz));
  const forest = clamp((elevation - 24) / 135 + Math.hypot(nx, nz) * 0.22);
  const sand = clamp((10 - elevation) / 10) * 14;
  const light = 0.65 + sun * 0.43;
  const color = [170 - 71 * forest + sand, 171 - 46 * forest + sand * 0.65, 155 - 65 * forest + sand * 0.12];
  return `rgb(${color.map((channel) => Math.round((channel + (texture - 0.55) * 14) * light)).join(",")})`;
}

const ground = [] as Array<{ indices: number[]; color: string }>;
for (let z = 0; z < rows - 1; z++) {
  for (let x = 0; x < columns - 1; x++) {
    const i = z * columns + x;
    const indices = [i, i + 1, i + 1 + columns, i + columns];
    ground.push({ indices, color: groundColor(elevations[i], elevations[i + 1], elevations[i + 1 + columns], elevations[i + columns], x, z) });
  }
}

type Building = { x: number; z: number; meters: number; breadth: number; depth: number; tint: number };

function tower(longitude: number, latitude: number, meters: number, breadth: number, tint: number): Building {
  return { ...location(longitude, latitude), meters, breadth, depth: breadth * 0.8, tint };
}

const skyline: Building[] = [
  tower(129.1689, 35.1595, 411, 0.024, 0),
  tower(129.1684, 35.1592, 339, 0.019, 1),
  tower(129.1694, 35.1591, 333, 0.018, 1),
  tower(129.1442, 35.1556, 301, 0.023, 1),
  tower(129.1454, 35.1559, 270, 0.020, 2),
  tower(129.1449, 35.1549, 292, 0.020, 0),
  tower(129.1442, 35.1549, 234, 0.018, 2),
];

for (const [longitude, latitude, span] of [[129.151, 35.164, 0.22], [129.114, 35.152, 0.16], [129.165, 35.169, 0.16]]) {
  const center = location(longitude, latitude);
  for (let i = 1; i <= 26; i++) {
    const x = center.x + (roughness(i, latitude) - 0.5) * span;
    const z = center.z + (roughness(longitude, i) - 0.5) * 0.16;
    const height = terrainHeight(x, z);
    if (height > 3 && height < 36) {
      skyline.push({ x, z, meters: 17 + roughness(i, longitude) * 60, breadth: 0.009 + roughness(i, z) * 0.007, depth: 0.009, tint: 3 });
    }
  }
}

type Face = { vertices: WorldPoint[]; color: string };
const facades = [
  ["#29495d", "#54778b", "#34596f", "#638495"],
  ["#385263", "#708896", "#475f70", "#8b9ea6"],
  ["#446173", "#7e9ca8", "#587785", "#93a9b2"],
  ["#72828a", "#adb6b3", "#86979b", "#bcc4bb"],
];

const structures: Face[] = skyline.flatMap(({ x, z, meters, breadth, depth, tint }) => {
  const base = terrainHeight(x, z);
  const columns = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const ring = (elevation: number, taper = 1) => columns.map(([dx, dz]) => ({
    x: x + dx * breadth * 0.5 * taper,
    z: z + dz * depth * 0.5 * taper,
    y: metersToWorld(elevation),
  }));
  const bands = Math.max(1, Math.ceil(meters / 42));
  const faces: Face[] = [];
  for (let band = 0; band < bands; band++) {
    const lower = ring(base + meters * band / bands);
    const upper = ring(base + meters * (band + 1) / bands, band === bands - 1 && meters > 300 ? 0.84 : 1);
    for (let side = 0; side < 4; side++) {
      const next = (side + 1) % 4;
      faces.push({ vertices: [lower[side], lower[next], upper[next], upper[side]], color: facades[tint][side] });
    }
    if (band === bands - 1) faces.push({ vertices: upper, color: "#a2b4b9" });
  }
  return faces;
});

const cutFaces: Face[] = [];
function addCutEdge(indices: number[]) {
  for (let i = 1; i < indices.length; i++) {
    const left = points[indices[i - 1]];
    const right = points[indices[i]];
    cutFaces.push({
      vertices: [left, right, { ...right, y: -0.038 }, { ...left, y: -0.038 }],
      color: left.y + right.y > 0.015 ? "#687a70" : "#386277",
    });
  }
}
addCutEdge(Array.from({ length: columns }, (_, index) => index));
addCutEdge(Array.from({ length: columns }, (_, index) => (rows - 1) * columns + index));
addCutEdge(Array.from({ length: rows }, (_, index) => index * columns));
addCutEdge(Array.from({ length: rows }, (_, index) => (index + 1) * columns - 1));

const cloudPositions: Array<{ x: number; z: number; size: number; opacity: number; rise: number; groundHeight: number }> = [];
for (let row = 0; row < 13; row++) {
  for (let col = 0; col < 28; col++) {
    const random = roughness(col + 1, row + 1);
    const x = -1.04 + (col + random * 0.92) * 0.077;
    const z = 0.06 + (row + roughness(row, col) * 1.25) * 0.067 + Math.sin(x * 4) * 0.054;
    const groundHeight = terrainHeight(x, z);
    if (groundHeight > 235) continue;
    const edge = clamp((1.13 - Math.abs(x)) * 3.5) * clamp((1.02 - z) * 3.4);
    cloudPositions.push({ x, z, groundHeight, size: 0.074 + random * 0.12, opacity: (0.23 + random * 0.51) * edge, rise: 0.39 + roughness(col + 3, row) * 0.53 });
  }
}

let cloudTexture: HTMLCanvasElement | undefined;
function getCloudTexture() {
  if (cloudTexture) return cloudTexture;
  const image = document.createElement("canvas");
  image.width = 160;
  image.height = 96;
  const ctx = image.getContext("2d");
  if (!ctx) return image;
  ctx.scale(1, 0.62);
  for (const [x, y, radius, opacity] of [[78, 74, 52, .36], [51, 79, 42, .30], [109, 79, 40, .30], [88, 56, 29, .28], [65, 62, 24, .27], [38, 74, 27, .19], [120, 82, 23, .19]]) {
    const tint = ctx.createRadialGradient(x, y, 0, x, y, radius);
    tint.addColorStop(0, `rgba(246,250,251,${opacity})`);
    tint.addColorStop(0.48, `rgba(234,243,247,${opacity * 0.72})`);
    tint.addColorStop(1, "rgba(225,239,245,0)");
    ctx.fillStyle = tint;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  cloudTexture = image;
  return image;
}

type Projection = ReturnType<typeof makeProjection>;
type Facet = { depth: number; vertices: ProjectedPoint[]; color: string; seam: boolean };
type Cloud = { depth: number; center: ProjectedPoint; halfWidth: number; halfHeight: number; opacity: number };

function facet(vertices: ProjectedPoint[], color: string, seam: boolean): Facet {
  return { vertices, color, seam, depth: vertices.reduce((total, point) => total + point.depth, 0) / vertices.length };
}

export function drawTerrainScene(ctx: CanvasRenderingContext2D, viewWidth: number, viewHeight: number, project: Projection, fogHeight: number, showCut: boolean) {
  const sky = ctx.createLinearGradient(0, 0, 0, viewHeight);
  sky.addColorStop(0, "#fffaf0");
  sky.addColorStop(0.54, "#f3ecdd");
  sky.addColorStop(1, "#dfd5c1");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  const projected = points.map(project);
  const elements: Array<Facet | Cloud> = ground.map(({ indices, color }) => facet(indices.map((index) => projected[index]), color, true));
  for (const { vertices, color } of cutFaces) elements.push(facet(vertices.map(project), color, true));
  for (const { vertices, color } of structures) elements.push(facet(vertices.map(project), color, false));

  if (fogHeight > 0) {
    for (const { x, z, size, opacity, rise, groundHeight } of cloudPositions) {
      const height = fogHeight * rise;
      if (height <= groundHeight) continue;
      const center = project({ x, y: metersToWorld(height), z });
      const halfWidth = Math.max(6, center.scale * size * 0.85);
      elements.push({
        depth: center.depth - 0.012,
        center,
        halfWidth,
        halfHeight: Math.max(5, halfWidth * (0.38 + rise * 0.18)),
        opacity: opacity * clamp((height - groundHeight) / 42) * clamp(fogHeight / 42),
      });
    }
  }

  elements.sort((a, b) => b.depth - a.depth);
  const texture = fogHeight > 0 ? getCloudTexture() : undefined;
  for (const item of elements) {
    if ("center" in item) {
      if (texture) {
        ctx.globalAlpha = item.opacity;
        const { sx, sy } = item.center;
        ctx.drawImage(texture, sx - item.halfWidth, sy - item.halfHeight, item.halfWidth * 2, item.halfHeight * 2);
        ctx.globalAlpha = 1;
      }
      continue;
    }

    ctx.beginPath();
    item.vertices.forEach(({ sx, sy }, index) => index === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy));
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.strokeStyle = item.seam ? item.color : "rgba(220,232,235,0.34)";
    ctx.lineWidth = item.seam ? 0.7 : 0.5;
    ctx.stroke();
  }

  if (!showCut || fogHeight <= 0) return;
  const left = project({ x: -1.03, y: metersToWorld(fogHeight), z: 0.56 });
  const right = project({ x: 1.03, y: metersToWorld(fogHeight), z: 0.56 });
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(left.sx, left.sy);
  ctx.lineTo(right.sx, right.sy);
  ctx.strokeStyle = "rgba(245,250,252,0.93)";
  ctx.lineWidth = 1.4;
  ctx.setLineDash([6, 5]);
  ctx.stroke();
  ctx.font = '600 12px "Noto Sans KR", sans-serif';
  ctx.textAlign = "right";
  ctx.fillStyle = "#173c51";
  ctx.fillText(`${fogHeight} m`, Math.min(viewWidth - 12, right.sx), right.sy - 8);
  ctx.restore();
}
