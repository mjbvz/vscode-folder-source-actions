import * as vscode from 'vscode';

const fakeWholeDocumentRange = new vscode.Range(0, 0, 99999, 0);

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('folderSourceActions.organizeImports',
            createFolderSourceAction(
                vscode.CodeActionKind.SourceOrganizeImports,
                "Organizing Imports in Folder"
            )));

    context.subscriptions.push(
        vscode.commands.registerCommand('folderSourceActions.fixAll',
            createFolderSourceAction(
                vscode.CodeActionKind.SourceFixAll,
                "Fixing All in Folder"
            )));
}

function createFolderSourceAction(
    kind: vscode.CodeActionKind,
    progressLabel: string,
) {
    return function (dir: vscode.Uri) {
        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Window,
                title: progressLabel
            },
            async () => {
                const files = await getPotentialFilesForSourceAction(dir);
                return Promise.all(files
                    .map(file => getSourceActionForFile(kind, file))
                    .map(action => action.then(tryApplyCodeAction)));
            });
    }
}

async function getPotentialFilesForSourceAction(
    dir: vscode.Uri
): Promise<ReadonlyArray<vscode.Uri>> {
    return vscode.workspace.findFiles(
        { base: dir.fsPath, pattern: '**/*' },
        '**/node_modules/**');
}

async function getSourceActionForFile(
    kind: vscode.CodeActionKind,
    file: vscode.Uri
): Promise<vscode.CodeAction | undefined> {
    try {
        const allActions = (await getAllCodeActionsForFile(file, kind)) || [];
        return allActions.find(actionFilter(kind));
    } catch  {
        // noop 
    }
    return undefined;
}

function getAllCodeActionsForFile(file: vscode.Uri, kind: vscode.CodeActionKind): Thenable<ReadonlyArray<vscode.CodeAction> | undefined> {
    // We need make sure VS Code knows about the file before trying to request code actions
    return vscode.workspace.openTextDocument(file).then(doc =>
        vscode.commands.executeCommand('vscode.executeCodeActionProvider',
            file,
            fakeWholeDocumentRange,
            kind));
}

function actionFilter(targetKind: vscode.CodeActionKind) {
    return function (action: vscode.CodeAction): boolean {
        return action && !!action.kind && targetKind.contains(action.kind);
    };
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