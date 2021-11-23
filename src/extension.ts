import vscode from 'vscode'
import { registerExtensionCommand } from 'vscode-framework'
import { BaseTreeDataProvider, MissingDependenciesTreeDataProvider, UnusedDependenciesTreeDataProvider, UsingDependenciesTreeDataProvider } from './view'

export const activate = () => {
    const treeProviders: Array<[string, BaseTreeDataProvider]> = [
        ['usingDependencies', new UsingDependenciesTreeDataProvider()],
        ['unusedDependencies', new UnusedDependenciesTreeDataProvider()],
        ['missingDependencies', new MissingDependenciesTreeDataProvider()],
    ]

    for (const [viewId, treeDataProvider] of treeProviders) {
        const treeView = vscode.window.createTreeView(viewId, {
            treeDataProvider: treeDataProvider as UsingDependenciesTreeDataProvider,
        })
        treeView.onDidChangeVisibility(({ visible }) => {
            treeDataProvider.hidden = !visible
            if (!visible) return
            treeView.message = 'Scanning dependencies'
            treeDataProvider.hidden = false
            treeDataProvider.refresh()
            treeDataProvider.onLoad = (setMessage = '') => {
                treeView.message = setMessage
            }
        })
    }

    registerExtensionCommand('refreshDependencies', () => {
        for (const [, provider] of treeProviders) provider.refresh()
    })
}
