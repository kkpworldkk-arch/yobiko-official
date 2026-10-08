export function countWithinDays(isoDates: string[], days: number): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return isoDates.filter((iso) => new Date(iso).getTime() >= cutoff).length;
}
