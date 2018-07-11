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
            title: "Organizing imports in folder"
        },
        async () => {
            const combinedEdits = new vscode.WorkspaceEdit();
            const commands: vscode.Command[] = [];
            for (const action of await getOrganizeImportsActionsForDirectory(dir)) {
                if (action.edit) {
                    appendWorkspaceEdits(combinedEdits, action.edit);
                }
                if (action.command) {
                    commands.push(action.command);
                }
            }

            if (combinedEdits.size > 0) {
                await vscode.workspace.applyEdit(combinedEdits);
            }
            for (const command of commands) {
                await vscode.commands.executeCommand(command.command, ...(command.arguments || []));
            }
        });
}

async function getOrganizeImportsActionsForDirectory(
    dir: vscode.Uri
): Promise<ReadonlyArray<vscode.CodeAction>> {
    const actions: vscode.CodeAction[] = [];

    const files = await vscode.workspace.findFiles(
        { base: dir.fsPath, pattern: '**/*' },
        '**/node_modules/**');

    for (const file of files) {
        const action = await getOrganizeImportsActionForFile(file);
        if (action) {
            actions.push(action);
        }
    }

    return actions;
}

async function getOrganizeImportsActionForFile(
    file: vscode.Uri
): Promise<vscode.CodeAction | undefined> {
    try {
        const allActions = (await getAllCodeActionsForFile(file)) || [];
        for (const action of allActions) {
            if (isOrganizeImportsAction(action)) {
                return action;
            }
        }
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

function appendWorkspaceEdits(
    builder: vscode.WorkspaceEdit,
    editsToAppend: vscode.WorkspaceEdit
) {
    for (const [file, textEdits] of editsToAppend.entries()) {
        for (const textEdit of textEdits) {
            builder.replace(file, textEdit.range, textEdit.newText);
        }
    }
    return builder;
}