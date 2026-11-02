/** Browser wheel events are pixels/lines/pages, not GLFW scroll notches. */
export function hotbarScroll(
  remainder: number,
  delta: number,
  mode: number,
  sensitivity = 1,
  discrete = false,
) {
  if (
    !Number.isFinite(delta) ||
    !Number.isFinite(sensitivity) ||
    delta === 0 ||
    sensitivity <= 0
  )
    return { steps: 0, remainder: Number.isFinite(remainder) ? remainder : 0 };
  const notches = discrete
    ? Math.sign(delta)
    : Math.max(
        -1000,
        Math.min(1000, delta / (mode === 0 ? 100 : mode === 1 ? 3 : 1)),
      );
  const old =
    Number.isFinite(remainder) && Math.sign(remainder) === Math.sign(delta)
      ? remainder
      : 0;
  const total = old + notches * Math.min(10, sensitivity);
  const steps = Math.trunc(total + Math.sign(total) * 1e-9);
  return {
    steps,
    remainder: Math.abs(total - steps) < 1e-9 ? 0 : total - steps,
  };
}
export function attackRecharge(remaining: number, duration: number) {
  if (
    !Number.isFinite(remaining) ||
    !Number.isFinite(duration) ||
    duration <= 0
  )
    return 1;
  return Math.max(0, Math.min(1, 1 - remaining / duration));
}
export function notificationDuration(multiplier = 1) {
  return (
    5000 *
    (Number.isFinite(multiplier) ? Math.max(0.5, Math.min(10, multiplier)) : 1)
  );
}
