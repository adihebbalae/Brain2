import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTodos } from '../hooks/useTodos'

type TimerState = 'WORK' | 'SHORT_BREAK' | 'LONG_BREAK'
type TimerStatus = 'idle' | 'running' | 'paused'

const TIMER_DURATIONS: Record<TimerState, number> = {
  WORK: 25 * 60, // 25 minutes in seconds
  SHORT_BREAK: 5 * 60, // 5 minutes
  LONG_BREAK: 15 * 60, // 15 minutes
}

const TIMER_LABELS: Record<TimerState, string> = {
  WORK: 'Focus Time',
  SHORT_BREAK: 'Short Break',
  LONG_BREAK: 'Long Break',
}

// Cycle: work → short → work → short → work → long → repeat
const CYCLE: TimerState[] = [
  'WORK',
  'SHORT_BREAK',
  'WORK',
  'SHORT_BREAK',
  'WORK',
  'LONG_BREAK',
]

export function FocusMode() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { todos, toggle } = useTodos()

  const [cycleIndex, setCycleIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(TIMER_DURATIONS.WORK)
  const [status, setStatus] = useState<TimerStatus>('idle')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const currentState = CYCLE[cycleIndex]
  const projectTodos = todos.filter(t => t.project === slug)

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // Timer countdown logic
  useEffect(() => {
    if (status !== 'running') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Timer completed
          playBeep()
          const nextIndex = (cycleIndex + 1) % CYCLE.length
          setCycleIndex(nextIndex)
          setStatus('idle')
          return TIMER_DURATIONS[CYCLE[nextIndex]]
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [status, cycleIndex])

  function playBeep() {
    try {
      const audioContext = new AudioContext()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = 440 // 440Hz (A4 note)
      oscillator.type = 'sine'
      gainNode.gain.value = 0.3

      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.2) // 200ms duration
    } catch (err) {
      // Silent fail if Web Audio API not available
      console.error('Failed to play beep:', err)
    }
  }

  function handleStart() {
    setStatus('running')
  }

  function handlePause() {
    setStatus('paused')
  }

  function handleReset() {
    setStatus('idle')
    setTimeRemaining(TIMER_DURATIONS[currentState])
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{slug}</h1>
          <p className="text-sm text-gray-400 mt-1">{TIMER_LABELS[currentState]}</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Exit Focus
        </button>
      </div>

      {/* Timer */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center mb-12">
          <div className="text-8xl font-bold tabular-nums tracking-tight mb-8">
            {formatTime(timeRemaining)}
          </div>

          <div className="flex items-center gap-4 justify-center">
            {status === 'idle' || status === 'paused' ? (
              <button
                onClick={handleStart}
                className="px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg flex items-center gap-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="px-8 py-4 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-semibold text-lg flex items-center gap-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Pause
              </button>
            )}

            <button
              onClick={handleReset}
              className="px-8 py-4 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-semibold text-lg flex items-center gap-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset
            </button>
          </div>
        </div>

        {/* Cycle indicator */}
        <div className="flex items-center gap-2 mb-8">
          {CYCLE.map((state, index) => (
            <div
              key={index}
              className={`w-3 h-3 rounded-full transition-colors ${
                index === cycleIndex
                  ? 'bg-blue-500'
                  : index < cycleIndex
                  ? 'bg-gray-600'
                  : 'bg-gray-800'
              }`}
              title={TIMER_LABELS[state]}
            />
          ))}
        </div>

        {/* TODO list */}
        <div className="w-full max-w-2xl bg-gray-800 rounded-xl p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-gray-200 mb-4">
            Tasks ({projectTodos.filter(t => !t.done).length} remaining)
          </h2>

          {projectTodos.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No tasks found for this project</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {projectTodos
                .filter(t => !t.done)
                .map(todo => (
                  <label
                    key={todo.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={todo.done}
                      onChange={() => toggle(todo.id)}
                      className="mt-1 w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-200 text-sm">{todo.text}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {todo.file}:{todo.line}
                      </p>
                    </div>
                  </label>
                ))}

              {projectTodos.filter(t => t.done).length > 0 && (
                <>
                  <div className="border-t border-gray-700 my-4" />
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                    Completed ({projectTodos.filter(t => t.done).length})
                  </p>
                  {projectTodos
                    .filter(t => t.done)
                    .map(todo => (
                      <label
                        key={todo.id}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer opacity-50"
                      >
                        <input
                          type="checkbox"
                          checked={todo.done}
                          onChange={() => toggle(todo.id)}
                          className="mt-1 w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-400 text-sm line-through">{todo.text}</p>
                          <p className="text-xs text-gray-600 mt-1">
                            {todo.file}:{todo.line}
                          </p>
                        </div>
                      </label>
                    ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
