import { Router } from 'express'
import { config } from 'dotenv'
config()

const router = Router()

router.get('/', (_req, res) => {
  res.json({
    vaultName: process.env.VAULT_NAME || 'SecondBrain',
    projectsDir: process.env.PROJECTS_DIR || '',
  })
})

export { router as configRouter }
