import { useState, useEffect } from "react";
import { portraitGameplayBlocked } from "./screen";
import { onViewportChange } from "./viewport";

export function useLandscapeRequired(): boolean {
  const [blocked, setBlocked] = useState(portraitGameplayBlocked);
  useEffect(
    () => onViewportChange(() => setBlocked(portraitGameplayBlocked())),
    [],
  );
  return blocked;
}
