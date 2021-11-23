import pkg from 'fs-extra'
const { ensureDir, copy, readdir } = pkg
import { join } from 'path'
await ensureDir('out')

const base = 'node_modules/depcheck/dist/'
for (let dir of await readdir(base, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    dir = dir.name
    copy(join(base, dir), join('out', dir))
}
