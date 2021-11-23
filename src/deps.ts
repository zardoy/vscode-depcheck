import fsExtra from 'fs'
import { join } from 'path'

export const getDependenciesVersions = async (cwd: string, deps: string[]) =>
    Promise.all(
        deps.map(async dep =>
            (async () =>
                // TODO use typed-jsonfile
                JSON.parse(await fsExtra.promises.readFile(join(cwd, 'node_modules', dep, 'package.json'), 'utf-8')).version as string)(),
        ),
    )
