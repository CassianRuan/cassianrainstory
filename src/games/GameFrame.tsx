import type { ReactNode } from 'react'

interface Props {
  title: string
  intro: string
  secondsLeft: number
  mistakes: number
  maxMistakes: number
  progress: string
  failure: string | null
  completed: boolean
  onRetry: () => void
  children: ReactNode
}

export function GameFrame(props: Props) {
  return (
    <section className="game-frame" aria-label={props.title}>
      <header className="game-hud">
        <div>
          <span className="eyebrow">侦探搜寻模式</span>
          <h2>{props.title}</h2>
          <p>{props.intro}</p>
        </div>
        <div className="game-stats">
          <span className={props.secondsLeft <= 10 ? 'danger' : ''}>时间 <strong>{props.secondsLeft}</strong></span>
          <span>失误 <strong>{props.mistakes} / {props.maxMistakes}</strong></span>
          <span>进度 <strong>{props.progress}</strong></span>
        </div>
      </header>
      <div className="game-stage">{props.children}</div>
      {(props.failure || props.completed) && (
        <div className="result-overlay" role="dialog" aria-modal="true">
          <div className={props.completed ? 'result-card success' : 'result-card'}>
            <span className="result-symbol">{props.completed ? '✓' : '×'}</span>
            <h3>{props.completed ? '调查完成' : '挑战失败'}</h3>
            <p>{props.completed ? '线索已经拼合，剧情即将继续。' : props.failure}</p>
            {!props.completed && <button className="primary-button" onClick={props.onRetry}>重新尝试</button>}
          </div>
        </div>
      )}
    </section>
  )
}
