import type { LocationType } from "./schemas";

export function nextLocationTypes(currentTypes: LocationType[], type: LocationType): LocationType[] {
  if (currentTypes.includes(type)) return currentTypes.filter((item) => item !== type);
  if (type === "pool-area") return ["pool-area"];
  return [...currentTypes.filter((item) => item !== "pool-area"), type].slice(0, 3);
}
