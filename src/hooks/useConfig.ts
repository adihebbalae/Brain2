import { useState, useEffect } from 'react'

interface Config {
  vaultName: string
  projectsDir: string
}

export function useConfig() {
  const [config, setConfig] = useState<Config>({ vaultName: 'SecondBrain', projectsDir: '' })

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(setConfig)
      .catch(() => {}) // fall back to default
  }, [])

  return config
}
