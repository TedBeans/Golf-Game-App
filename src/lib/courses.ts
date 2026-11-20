import type { Course } from "./types";
import { uid } from "./id";

export const DEFAULT_PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5];
export const DEFAULT_SI = [7, 11, 17, 1, 9, 13, 15, 5, 3, 8, 12, 18, 2, 10, 14, 16, 6, 4];

export type NearbyCourse = { key: string; name: string; city?: string; lat: number; lon: number; distanceMi: number; osm: { type: "way" | "relation" | "node"; id: number } };

export function haversineMi(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8, rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const blankCourse = (name = ""): Course => ({ id: uid(), name, tee: "", pars: [...DEFAULT_PARS], strokeIndex: [...DEFAULT_SI] });
