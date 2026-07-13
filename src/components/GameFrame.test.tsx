import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GameFrame } from '../games/GameFrame'

describe('GameFrame', () => {
  it('shows countdown, mistakes and retry after failure', () => {
    render(<GameFrame title="调查" intro="寻找线索" secondsLeft={0} mistakes={3} maxMistakes={3} progress="1 / 4" failure="时间耗尽" completed={false} onRetry={vi.fn()}><div>stage</div></GameFrame>)
    expect(screen.getByText('挑战失败')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重新尝试' })).toBeInTheDocument()
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
  })
})
