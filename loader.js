import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

register('./register-paths.js', pathToFileURL('./'))