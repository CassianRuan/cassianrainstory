import { useState } from 'react'
import type { QuizNode } from '../schemas/story'
import { audioManager } from '../audio/audioManager'

export function QuizGame({ node, onComplete }: { node: QuizNode; onComplete: () => void }) {
  const [wrong, setWrong] = useState(false)
  const [success, setSuccess] = useState(false)

  const choose = (id: string) => {
    if (id !== node.correctOptionId) {
      audioManager.playSfx('quiz-wrong')
      setWrong(true)
      return
    }
    setSuccess(true)
    audioManager.playSfx('quiz-correct')
    window.setTimeout(onComplete, 1500)
  }

  return (
    <section className="quiz-stage" style={{ backgroundImage: `linear-gradient(#05090ddd,#050403cc),url(${node.scene})` }}>
      <div className="quiz-card">
        <span className="eyebrow">圣马丁石桥 · 应急控制终端</span>
        <h2>{node.title}</h2>
        <p className="quiz-intro">{node.intro}</p>
        {node.questionImage
          ? <figure className="quiz-question-image"><img src={node.questionImage} alt={node.question} /></figure>
          : <div className="question-box"><span>桥梁校验题</span><strong>{node.question}</strong></div>}
        <div className="quiz-options">
          {node.options.map((option, index) => {
            const letter = String.fromCharCode(65 + index)
            return <button key={option.id} aria-label={`选择 ${letter}`} onClick={() => choose(option.id)} disabled={success}>
              <i>{letter}</i>{!node.questionImage && option.text}
            </button>
          })}
        </div>
      </div>
      {(wrong || success) && <div className="result-overlay"><div className={`result-card ${success ? 'success' : ''}`}>
        <span className="result-symbol">{success ? '✓' : '×'}</span><h3>{success ? '验证通过' : '答案错误'}</h3>
        <p>{success ? node.successMessage : node.wrongMessage}</p>
        {wrong && <button className="primary-button" onClick={() => setWrong(false)}>重新计算</button>}
      </div></div>}
    </section>
  )
}
