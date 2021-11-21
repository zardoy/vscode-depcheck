import vscode from 'vscode'

export const activate = () => {
    vscode.window.registerTreeDataProvider('', treeDataProvider)
}
