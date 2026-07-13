import { useCallback, useEffect, useRef, useState } from 'react'
import { nextMistakeCount } from '../engine/gameRules'

export function useGameSession(timeLimitSec: number, maxMistakes: number, onSuccess: () => void) {
  const [attempt, setAttempt] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(timeLimitSec)
  const [mistakes, setMistakes] = useState(0)
  const [failure, setFailure] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const completedRef = useRef(false)

  useEffect(() => {
    if (failure || completed) return
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          setFailure('时间耗尽。冷静下来，再试一次。')
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [attempt, completed, failure])

  const makeMistake = useCallback((message = '判断错误') => {
    if (failure || completedRef.current) return false
    const result = nextMistakeCount(mistakes, maxMistakes)
    setMistakes(result.mistakes)
    if (result.failed) setFailure(`${message}。三次机会已经用尽。`)
    return result.failed
  }, [failure, mistakes, maxMistakes])

  const succeed = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    setCompleted(true)
    window.setTimeout(onSuccess, 900)
  }, [onSuccess])

  const retry = useCallback(() => {
    completedRef.current = false
    setAttempt((value) => value + 1)
    setSecondsLeft(timeLimitSec)
    setMistakes(0)
    setFailure(null)
    setCompleted(false)
  }, [timeLimitSec])

  return { attempt, secondsLeft, mistakes, failure, completed, makeMistake, succeed, retry }
}
