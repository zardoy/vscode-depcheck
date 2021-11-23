import { join } from 'path'
import { promises } from 'fs'
import vscode from 'vscode'
import depcheck, { Results } from 'depcheck'
import { PackageJson } from 'type-fest'
import { getDependenciesVersions } from './deps'

export abstract class BaseTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    onLoad: ((setMessage?: string) => void) | undefined
    hidden = true
    packageJson: PackageJson | undefined

    private readonly _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = new vscode.EventEmitter<
        vscode.TreeItem | undefined | void
    >()

    // eslint-disable-next-line zardoy-config/@typescript-eslint/member-ordering
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event
    constructor(protected readonly cwd = vscode.workspace.workspaceFolders![0]!.uri.fsPath) {}

    getTreeItem(elem) {
        return elem
    }

    refresh() {
        this._onDidChangeTreeData.fire()
    }

    async updatePackageJson() {
        this.packageJson = JSON.parse(await promises.readFile(join(this.cwd, 'package.json'), 'utf-8'))
    }

    async getChildren(elem: vscode.TreeItem) {
        if (this.hidden) return []

        if (!this.cwd) {
            // TODO allow package.json
            this.onLoad?.('No workspace opened. Open workspace with package.json first.')
            return []
        }

        return this.getChildrenInner(elem).finally(() => this.onLoad?.())
    }

    abstract getChildrenInner(element)
}

// copied from npm-the-fastest
const depsIconMap = {
    dependencies: 'package',
    devDependencies: 'tools',
    optionalDependencies: 'plug',
}

const filesToTreeItems = (paths: string[]) =>
    paths.map(path => {
        const fileUri = vscode.Uri.file(path)
        const item = new vscode.TreeItem(fileUri, vscode.TreeItemCollapsibleState.None)
        item.command = {
            command: 'vscode.open',
            title: '',
            arguments: [fileUri],
        }
        return item
    })

export class UsingDependenciesTreeDataProvider extends BaseTreeDataProvider {
    usingDeps: Results['using'] = null!
    async getChildrenInner(elem: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (elem) return filesToTreeItems(this.usingDeps[elem.label as string]!)

        await this.updatePackageJson()

        // TODO find a list with runtime-only deps
        // Uncomment if want to get output
        // if (process.env.NODE_ENV === 'development') console.log(await depcheck(cwd, {}))

        this.usingDeps = (await depcheck(this.cwd, { skipMissing: true })).using
        const pickDeps: Array<keyof PackageJson> = ['dependencies', 'devDependencies', 'optionalDependencies']
        const depsList = Object.keys(this.usingDeps)
        const dependencyVersion = Object.fromEntries(
            (await getDependenciesVersions(this.cwd, depsList)).map((version, i): [string, string] => [depsList[i]!, version]),
        )
        return Object.entries(this.usingDeps).map(([dep, files]) => {
            const { type } = pickDeps
                .map(type => {
                    const deps = (this.packageJson![type] as PackageJson['dependencies']) ?? {}
                    const declaredVersion = Object.entries(deps).find(([depInner]) => depInner === dep)?.[1]
                    // TODO Handle install version in other way

                    return (
                        declaredVersion === undefined
                            ? undefined
                            : {
                                  type: type as string,
                              }
                    )!
                })
                .find(Boolean)!
            const treeItem = new vscode.TreeItem(dep)
            // treeItem.description = `${type} ● ${declaredVersion}`
            treeItem.description = dependencyVersion[dep]
            // Add collapsable arrow if any files to display (always though)
            if (files.length > 0) treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed
            treeItem.iconPath = new vscode.ThemeIcon(depsIconMap[type])
            return treeItem
        })
    }
}

export class UnusedDependenciesTreeDataProvider extends BaseTreeDataProvider {
    async getChildrenInner(elem: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        const { dependencies, devDependencies } = await depcheck(this.cwd, { skipMissing: true })
        const depsList = [...dependencies, ...devDependencies]
        const dependencyVersion = Object.fromEntries(
            (await getDependenciesVersions(this.cwd, depsList)).map((version, i): [string, string] => [depsList[i]!, version]),
        )

        return Object.entries({ dependencies, devDependencies }).flatMap(([type, deps]) =>
            deps.map(dep => {
                const treeItem = new vscode.TreeItem(dep)
                treeItem.description = dependencyVersion[dep]
                treeItem.iconPath = new vscode.ThemeIcon(depsIconMap[type])
                return treeItem
            }),
        )
    }
}

const getParsedScopePackage = (dep: string) => {
    const match = /^@([a-z\d-~][a-z\d-._~]*)\/?([a-z\d-~][a-z\d-._~]*)$/.exec(dep)
    if (!match) return
    return { scope: match[1]!, name: match[2]! }
}

/** Workaround for some false alerts deps */
const filterDependency = (dep: string) => getParsedScopePackage(dep)?.name !== 'tsconfig'

export class MissingDependenciesTreeDataProvider extends BaseTreeDataProvider {
    missingDeps: Results['missing'] = null!

    async getChildrenInner(elem: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (elem) return filesToTreeItems(this.missingDeps[elem.label as string]!)

        this.missingDeps = Object.fromEntries(Object.entries((await depcheck(this.cwd, {})).missing).filter(([dep]) => filterDependency(dep)))

        return Object.entries(this.missingDeps).map(([dep, files]) => {
            const treeItem = new vscode.TreeItem(dep)
            treeItem.description = files.length.toString()
            // Add collapsable arrow if any files to display (always though)
            if (files.length > 0) treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed
            return treeItem
        })
    }
}
