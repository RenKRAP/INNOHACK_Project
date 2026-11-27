import haeundae from "../../assets/haeundae-archive.webp";
import marineCity from "../../assets/marine-city-fog.jpg";
import gwangan from "../../assets/gwangan-bridge-fog.jpg";
import lct from "../../assets/lct-fog.png";
import dalmaji from "../../assets/dalmaji-fog.jpg";
import type { MapLocation } from "./coastalViewpoints";

interface FogPhoto {
  lat: number;
  lon: number;
  locationId?: string;
  name: string;
  title: string;
  sourceId?: string;
  src: string;
  alt: string;
  position: string;
  crop: boolean;
}

const photos: FogPhoto[] = [
  {
    lat: 35.1595, lon: 129.1604,
    name: "해운대 해무", title: "해운대 해무가 걸린 풍경", sourceId: "14737", src: haeundae,
    alt: "해운대 앞바다 너머로 흰 해무가 깔리고 고층 건물들이 솟아 있는 풍경",
    position: "52% 53%", crop: true,
  },
  {
    lat: 35.1566, lon: 129.1426,
    name: "마린시티 해무", title: "광안리 해무", sourceId: "14655", src: marineCity,
    alt: "짙은 해무 위로 마린시티 고층 건물의 윗부분이 드러난 풍경",
    position: "57% 50%", crop: false,
  },
  {
    lat: 35.1532, lon: 129.1188,
    name: "광안대교 해무", title: "광안대교 해무", sourceId: "14648", src: gwangan,
    alt: "광안대교 너머로 흰 해무가 해안과 고층 건물을 감싸는 풍경",
    position: "59% 50%", crop: false,
  },
  {
    lat: 35.1597, lon: 129.1699, locationId: "lct-observatory",
    name: "엘시티 해무", title: "엘시티 해무", src: lct,
    alt: "해운대 해변 위로 흰 해무가 깔리고 엘시티 타워가 솟은 모습",
    position: "25% 50%", crop: false,
  },
  {
    lat: 35.1568, lon: 129.1816, locationId: "dalmaji",
    name: "달맞이언덕 해무", title: "달맞이언덕 해무", src: dalmaji,
    alt: "푸른 하늘을 배경으로 고층 건물 사이를 흰 해무가 지나는 모습",
    position: "50% 50%", crop: false,
  },
];

export function nearbyFogPhoto({ id, lat, lon }: MapLocation) {
  const pinnedPhoto = photos.find((photo) => photo.locationId === id);
  if (pinnedPhoto) return pinnedPhoto;
  // Use the area shown in the photo as a reference, since capture coordinates are unavailable.
  const distance = (photo: FogPhoto) => Math.hypot(lat - photo.lat, (lon - photo.lon) * 0.82);
  return photos.reduce((nearest, photo) => distance(photo) < distance(nearest) ? photo : nearest);
}
