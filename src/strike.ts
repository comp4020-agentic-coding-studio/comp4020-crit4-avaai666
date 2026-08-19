// Constant-power mix between a bell's two tones, from the strike position.
// See DESIGN.md "The mechanic" — this is the whole thing, no bell-specific
// data belongs here.
export function mix(x: number): { zhenggu: number; cegu: number } {
  const clamped = Math.min(1, Math.max(0, x));
  const d = Math.abs(clamped - 0.5) * 2;
  return {
    zhenggu: Math.cos((d * Math.PI) / 2),
    cegu: Math.sin((d * Math.PI) / 2),
  };
}
