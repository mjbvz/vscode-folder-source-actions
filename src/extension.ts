import * as vscode from 'vscode';

const fakeWholeDocumentRange = new vscode.Range(0, 0, 99999, 0);

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('folderSourceActions.organizeImports', organizeImportsInDirectory));
}

async function organizeImportsInDirectory(dir: vscode.Uri) {
    vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Window,
            title: "Organizing Imports in Folder"
        },
        async () => {
            const files = await getPotentialFilesToOrganize(dir);
            return Promise.all(files
                .map(getOrganizeImportsActionForFile)
                .map(action => action.then(tryApplyCodeAction)));
        });
}

async function getPotentialFilesToOrganize(
    dir: vscode.Uri
): Promise<ReadonlyArray<vscode.Uri>> {
    return vscode.workspace.findFiles(
        { base: dir.fsPath, pattern: '**/*' },
        '**/node_modules/**');
}

async function getOrganizeImportsActionForFile(
    file: vscode.Uri
): Promise<vscode.CodeAction | undefined> {
    try {
        const allActions = (await getAllCodeActionsForFile(file)) || [];
        return allActions.find(isOrganizeImportsAction)
    } catch  {
        // noop 
    }
    return undefined;
}

function getAllCodeActionsForFile(file: vscode.Uri): Thenable<ReadonlyArray<vscode.CodeAction> | undefined> {
    // We need make sure VS Code knows about the file before trying to request code actions
    return vscode.workspace.openTextDocument(file).then(() =>
        vscode.commands.executeCommand('vscode.executeCodeActionProvider', file, fakeWholeDocumentRange));
}

function isOrganizeImportsAction(action: vscode.CodeAction): boolean {
    return action && !!action.kind && vscode.CodeActionKind.SourceOrganizeImports.contains(action.kind);
}

async function tryApplyCodeAction(
    action: vscode.CodeAction | undefined
) {
    if (!action) {
        return;
    }

    if (action.edit && action.edit.size > 0) {
        await vscode.workspace.applyEdit(action.edit);
    }
    if (action.command) {
        await vscode.commands.executeCommand(action.command.command, ...(action.command.arguments || []));
    }
}