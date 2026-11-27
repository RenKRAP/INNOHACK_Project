import React, { useEffect, useRef, useState } from "react";
import { Move3d, RotateCcw } from "lucide-react";
import { HOURLY_FORECAST, VIEWPOINT_SPOTS, type FogStatus, type HourlyForecastPoint, type ViewpointFilter, type ViewpointSpot } from "../data/haemugakData";
import { drawTerrainScene, makeProjection, metersToWorld, spotCoordinates, terrainHeight, type ProjectedPoint } from "../data/terrainScene";

interface Viewpoint3DSceneProps {
  selectedId: string;
  onSelectSpot: (id: string) => void;
  activeFilter: ViewpointFilter;
  forecast: HourlyForecastPoint;
  onForecastSelect: (forecast: HourlyForecastPoint) => void;
}

interface CameraPose {
  yaw: number;
  pitch: number;
  targetX: number;
  targetZ: number;
  zoom: number;
}

const overview: CameraPose = { yaw: -0.27, pitch: 0.62, targetX: 0.02, targetZ: 0.23, zoom: 1.16 };
const dragYawPerPixel = 0.0035;
const dragPitchPerPixel = 0.003;
const CAMERA_PRESETS = [
  { id: "overview", label: "전체 조망", pose: overview },
  { id: "cross", label: "해무 단면", pose: { ...overview, yaw: -0.06, pitch: 0.23 } },
  { id: "lct", label: "엘시티·해변 쪽", pose: { yaw: 0.38, pitch: 0.48, targetX: 0.39, targetZ: 0.25, zoom: 1.48 } },
] as const;

function fogStatus(elevation: number, fogHeight: number): FogStatus | "해무 없음" {
  if (fogHeight === 0) return "해무 없음";
  const difference = elevation - fogHeight;
  if (Math.abs(difference) <= 50) return "경계";
  return difference > 0 ? "해무 위" : "해무 속";
}

function getPinColors(status: FogStatus | "해무 없음") {
  if (status === "해무 없음") return { fill: "#31594e", ring: "#a4ba9d" };
  if (status === "해무 위") return { fill: "#14253d", ring: "#c68b3e" };
  if (status === "경계") return { fill: "#2c6e7a", ring: "#7fb4bd" };
  return { fill: "#5c7694", ring: "#9bb1c7" };
}

export function Viewpoint3DScene({
  selectedId,
  onSelectSpot,
  activeFilter,
  forecast,
  onForecastSelect,
}: Viewpoint3DSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [yaw, setYaw] = useState(overview.yaw);
  const [pitch, setPitch] = useState(overview.pitch);
  const [targetX, setTargetX] = useState(overview.targetX);
  const [targetZ, setTargetZ] = useState(overview.targetZ);
  const [zoom, setZoom] = useState(overview.zoom);
  const [heightOverride, setHeightOverride] = useState<number | null>(null);
  const fogHeightMeters = heightOverride ?? forecast.fogTopMeters;
  const [activePreset, setActivePreset] = useState<string>("overview");
  const [canvasSize, setCanvasSize] = useState({ width: 680, height: 460 });

  const cameraRef = useRef<CameraPose>({ ...overview });
  const previousSelection = useRef(selectedId);
  const animFrameRef = useRef<number | null>(null);

  const animateCameraTo = (nextPose: CameraPose) => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
    }
    const wrapAngleDelta = (from: number, to: number) => {
      const twoPi = Math.PI * 2;
      return ((((to - from) % twoPi) + twoPi * 1.5) % twoPi) - Math.PI;
    };
    const start = { ...cameraRef.current };
    const deltaYaw = wrapAngleDelta(start.yaw, nextPose.yaw);
    const deltaPitch = wrapAngleDelta(start.pitch, nextPose.pitch);
    const duration = 520;
    const startTime = performance.now();

    const step = (now: number) => {
      const rawT = Math.min(1, (now - startTime) / duration);
      const t = 1 - Math.pow(1 - rawT, 3); // easeOutCubic
      const cur: CameraPose = {
        yaw: start.yaw + deltaYaw * t,
        pitch: start.pitch + deltaPitch * t,
        targetX: start.targetX + (nextPose.targetX - start.targetX) * t,
        targetZ: start.targetZ + (nextPose.targetZ - start.targetZ) * t,
        zoom: start.zoom + (nextPose.zoom - start.zoom) * t,
      };
      cameraRef.current = cur;
      setYaw(cur.yaw);
      setPitch(cur.pitch);
      setTargetX(cur.targetX);
      setTargetZ(cur.targetZ);
      setZoom(cur.zoom);

      if (rawT < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        animFrameRef.current = null;
      }
    };
    animFrameRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    const point = spotCoordinates[selectedId];
    if (point && previousSelection.current !== selectedId) {
      previousSelection.current = selectedId;
      setActivePreset("");
      animateCameraTo({ ...overview, pitch: 0.48, targetX: point.x, targetZ: point.z, zoom: 1.42 });
    }
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [selectedId]);

  const dragStateRef = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    startYaw: number;
    startPitch: number;
    moved: boolean;
  }>({
    dragging: false,
    startX: 0,
    startY: 0,
    startYaw: yaw,
    startPitch: pitch,
    moved: false,
  });

  // Store projected pin positions for click hit-testing
  const pinHitBoxesRef = useRef<
    Array<{ id: string; sx: number; sy: number }>
  >([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setCanvasSize({ width, height });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = canvasSize;

    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const project = makeProjection(yaw, pitch, width, height, targetX, targetZ, zoom);
    drawTerrainScene(ctx, width, height, project, fogHeightMeters, activePreset === "cross");

    // 6. Draw 5 Viewpoint Pins in 3D space
    const projectedSpots: Array<{
      spot: ViewpointSpot;
      base: ProjectedPoint;
      head: ProjectedPoint;
    }> = [];

    for (const spot of VIEWPOINT_SPOTS) {
      const coord = spotCoordinates[spot.id];
      if (!coord) continue;

      const elevation = spot.id === "lct-observatory"
        ? spot.elevationMeters
        : Math.max(terrainHeight(coord.x, coord.z), spot.elevationMeters);
      const stemHeight = spot.id === "haeundae-beach" ? 120 : 65;
      const base = project({ ...coord, y: metersToWorld(elevation) });
      const head = project({ ...coord, y: metersToWorld(elevation + stemHeight) });
      projectedSpots.push({ spot, base, head });
    }

    projectedSpots.sort((a, b) => b.head.depth - a.head.depth);
    pinHitBoxesRef.current = [];

    for (const item of projectedSpots) {
      const { spot, base, head } = item;
      const isSelected = spot.id === selectedId;
      const isVisible =
        activeFilter === "전체" || spot.status === activeFilter;
      const colors = getPinColors(fogStatus(spot.elevationMeters, fogHeightMeters));

      ctx.save();
      ctx.globalAlpha = isVisible ? 1 : 0.28;

      // Vertical stem
      ctx.beginPath();
      ctx.moveTo(base.sx, base.sy);
      ctx.lineTo(head.sx, head.sy);
      ctx.strokeStyle = isSelected ? "#14253d" : "rgba(20, 37, 61, 0.5)";
      ctx.lineWidth = isSelected ? 1.8 : 1.2;
      ctx.stroke();

      // Selection halo
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(head.sx, head.sy, 14, 0, Math.PI * 2);
        ctx.fillStyle = colors.ring;
        ctx.globalAlpha = isVisible ? 0.25 : 0.1;
        ctx.fill();
        ctx.globalAlpha = isVisible ? 1 : 0.28;
      }

      // Pin circle
      ctx.beginPath();
      ctx.arc(head.sx, head.sy, isSelected ? 7.5 : 6, 0, Math.PI * 2);
      ctx.fillStyle = colors.fill;
      ctx.fill();
      ctx.strokeStyle = "#f4f8fb";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner status dot
      ctx.beginPath();
      ctx.arc(head.sx, head.sy, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = colors.ring;
      ctx.fill();

      // Label
      ctx.font = `${isSelected ? "600 12px" : "500 11px"} "Noto Sans KR", sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "#fffaf0";
      ctx.strokeText(spot.name, head.sx, head.sy - 13);
      ctx.fillStyle = "#14253d";
      ctx.fillText(spot.name, head.sx, head.sy - 13);

      ctx.restore();

      pinHitBoxesRef.current.push({
        id: spot.id,
        sx: head.sx,
        sy: head.sy,
      });
    }
  }, [yaw, pitch, targetX, targetZ, zoom, fogHeightMeters, selectedId, activeFilter, activePreset, canvasSize]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startYaw: yaw,
      startPitch: pitch,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragStateRef.current;
    if (!drag.dragging) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 4) {
      drag.moved = true;
      setActivePreset("");
    }
    const nextYaw = drag.startYaw - dx * dragYawPerPixel;
    const nextPitch = Math.min(1.22, Math.max(0.12, drag.startPitch + dy * dragPitchPerPixel));
    cameraRef.current.yaw = nextYaw;
    cameraRef.current.pitch = nextPitch;
    setYaw(nextYaw);
    setPitch(nextPitch);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragStateRef.current;
    drag.dragging = false;

    // If it was a tap/click (not a drag), check if a 3D pin was clicked
    if (!drag.moved && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      let closestId: string | null = null;
      let minDist = 22;
      for (const pin of pinHitBoxesRef.current) {
        const d = Math.hypot(cx - pin.sx, cy - pin.sy);
        if (d < minDist) {
          minDist = d;
          closestId = pin.id;
        }
      }
      if (closestId) {
        onSelectSpot(closestId);
      }
    }
  };

  const selectedSpot = VIEWPOINT_SPOTS.find(({ id }) => id === selectedId) ?? VIEWPOINT_SPOTS[0];

  return (
    <div className="rounded-sm border border-border bg-card/85">
      {/* Header & Camera Presets */}
      <div className="flex flex-col justify-between gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <Move3d className="h-4 w-4 text-accent" />
            <h1 className="font-display text-lg text-foreground sm:text-xl">
              3D 지형 · 해무 높이 입체 보기
            </h1>
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              예시 데이터
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {CAMERA_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setActivePreset(preset.id);
                animateCameraTo(preset.pose);
              }}
              className={`cursor-pointer rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                activePreset === preset.id
                  ? "border-foreground bg-foreground text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            aria-label="시점 초기화"
            onClick={() => {
              setHeightOverride(null);
              setActivePreset("overview");
              animateCameraTo(overview);
            }}
            className="cursor-pointer rounded-full border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-secondary/45 px-5 py-2.5 text-xs sm:px-6">
        <label htmlFor="terrain-forecast-time" className="font-medium text-foreground">예보 시각</label>
        <select
          id="terrain-forecast-time"
          value={forecast.time}
          onChange={(event) => {
            const selectedTime = HOURLY_FORECAST.find(({ time }) => time === event.target.value);
            if (!selectedTime) return;
            setHeightOverride(null);
            onForecastSelect(selectedTime);
          }}
          className="font-tabular min-h-8 rounded-sm border border-border bg-card px-2.5 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {HOURLY_FORECAST.map(({ time }) => <option key={time} value={time}>{time}</option>)}
        </select>
        <p id="terrain-forecast-reference" aria-live="polite" className="text-muted-foreground">
          예상 해무층 높이 <strong className="font-tabular font-medium text-foreground">{forecast.fogTopMeters} m</strong>
        </p>
      </div>

      {/* Interactive 3D Canvas */}
      <div className="relative h-[340px] w-full overflow-hidden bg-secondary sm:h-[460px]">
        <canvas
          ref={canvasRef}
          aria-label="황령산과 장산, 해운대 해안, 빌딩과 해무를 입체로 보여주는 지형"
          role="img"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
        />

        {/* Subtle floating hint */}
        <div className="pointer-events-none absolute top-3 left-4 rounded-sm border border-border/70 bg-card/85 px-2.5 py-1 font-tabular text-[11px] text-muted-foreground backdrop-blur-xs">
          드래그해서 회전 · 지점 선택
        </div>
      </div>

      {/* Bottom Fog Ceiling Control Bar */}
      <div className="flex flex-col justify-between gap-3 border-t border-border bg-card px-5 py-3.5 text-xs sm:px-6 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <label
            htmlFor="fog-height-slider"
            className="whitespace-nowrap font-medium text-foreground"
          >
            해무 상단 고도
          </label>
          <input
            id="fog-height-slider"
            type="range"
            min={0}
            max={Math.max(500, forecast.fogTopMeters)}
            step={1}
            value={fogHeightMeters}
            aria-describedby="terrain-forecast-reference"
            onChange={(event) => {
              const height = Number(event.target.value);
              setHeightOverride(height === forecast.fogTopMeters ? null : height);
            }}
            className="h-1.5 w-24 cursor-pointer accent-primary sm:w-40"
          />
          <output htmlFor="fog-height-slider" className="font-tabular font-medium text-accent">
            {fogHeightMeters} m
          </output>
          {heightOverride !== null && (
            <button type="button" onClick={() => setHeightOverride(null)} className="rounded-sm border border-border px-2 py-1.5 font-medium text-accent hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              예보 높이로 복원
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="terrain-spot" className="sr-only">전망 지점 선택</label>
          <select id="terrain-spot" value={selectedId} onChange={(event) => onSelectSpot(event.target.value)} className="rounded-sm border border-border bg-background px-2 py-1.5 text-xs text-foreground">
            {VIEWPOINT_SPOTS.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
          <span className="text-[11px] text-muted-foreground">
            해발 {selectedSpot.elevationMeters} m · {fogStatus(selectedSpot.elevationMeters, fogHeightMeters)}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 border-t border-border px-5 py-2 text-[11px] text-muted-foreground sm:px-6">
        <span>실지형 기반 · 고도 강조 · 건물과 해무는 시연용 모형</span>
        <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">SRTM 자료 USGS · Mapzen Terrain Tiles</a>
      </div>
    </div>
  );
}
