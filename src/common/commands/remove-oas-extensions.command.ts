import * as vscode from 'vscode';
import * as fs from 'fs';
import * as jsYaml from 'js-yaml';
import { isOpenAPISpecification, removeOASExtensions } from '../../utils/oas-extensions.utils';

/**
 * Command to remove OAS extensions from the current file
 */
export const removeOASExtensionsCommand = async (): Promise<void> => {
  // Get the active text editor
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor found');
    return;
  }

  // Get the document
  const document = editor.document;
  const fileName = document.fileName;
  const fileContent = document.getText();
  
  // Check if the file is JSON or YAML
  let specification: unknown;
  try {
    if (fileName.endsWith('.json')) {
      specification = JSON.parse(fileContent);
    } else if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) {
      specification = jsYaml.load(fileContent);
    } else {
      vscode.window.showErrorMessage('The current file must be a JSON or YAML file');
      return;
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to parse the file: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  // Validate that it's an OpenAPI specification
  if (!isOpenAPISpecification(specification)) {
    vscode.window.showErrorMessage('The current file is not an OpenAPI specification');
    return;
  }

  // Show input box to get allowed extensions
  const allowedExtensionsInput = await vscode.window.showInputBox({
    prompt: 'Enter comma-separated list of allowed OAS extensions (with x- prefix)',
    placeHolder: 'e.g., x-discriminator,x-nullable,x-example'
  });

  if (allowedExtensionsInput === undefined) {
    // User cancelled
    return;
  }

  // Parse allowed extensions
  const allowedExtensions = allowedExtensionsInput
    .split(',')
    .map(ext => ext.trim())
    .filter(ext => ext);

  // Process the specification
  const processedSpecification = removeOASExtensions(specification as object, allowedExtensions);

  // Format the output
  let outputContent: string;
  if (fileName.endsWith('.json')) {
    outputContent = JSON.stringify(processedSpecification, null, 2);
  } else {
    outputContent = jsYaml.dump(processedSpecification);
  }

  // Replace the content of the file
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(fileContent.length)
  );

  // Create edit to replace the entire content
  await editor.edit(editBuilder => {
    editBuilder.replace(fullRange, outputContent);
  });

  vscode.window.showInformationMessage('OAS extensions have been processed');
}; 