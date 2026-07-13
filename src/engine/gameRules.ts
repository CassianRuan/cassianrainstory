import type { Region } from '../schemas/story'

export interface Point { x: number; y: number }

export function pointInRegion(point: Point, region: Region, tolerance = 0): boolean {
  return point.x >= region.x - tolerance && point.x <= region.x + region.width + tolerance
    && point.y >= region.y - tolerance && point.y <= region.y + region.height + tolerance
}

export function normalizedPoint(event: { clientX: number; clientY: number }, rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): Point {
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
  }
}

export function qteJudgement(nowMs: number, targetMs: number, hitWindowMs: number): 'hit' | 'early' | 'late' {
  const distance = nowMs - targetMs
  if (Math.abs(distance) <= hitWindowMs / 2) return 'hit'
  return distance < 0 ? 'early' : 'late'
}

export function nextMistakeCount(current: number, max: number): { mistakes: number; failed: boolean } {
  const mistakes = current + 1
  return { mistakes, failed: mistakes >= max }
}
