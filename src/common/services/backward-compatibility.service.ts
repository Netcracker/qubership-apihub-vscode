import { Diagnostic, DiagnosticCollection, DiagnosticSeverity, Disposable, languages, Position, Range, Uri, workspace, window } from 'vscode';
import simpleGit, { SimpleGit } from 'simple-git';
import { apiDiff, breaking, nonBreaking, risky, annotation, unclassified, deprecated, Diff } from '@netcracker/qubership-apihub-api-diff';
import { parseWithPointers as parseJsonWithPointers, getLocationForJsonPath as getLocationForJsonPathJson } from '@stoplight/json';
import { parseWithPointers as parseYamlWithPointers, getLocationForJsonPath as getLocationForJsonPathYaml } from '@stoplight/yaml';
import { FilePath, WorkfolderPath } from '../models/common.model';
import { BWC_DIAGNOSTIC_SOURCE } from '../constants/backward-compatibility.constants';
import path from 'path';

export class BackwardCompatibilityService implements Disposable {
    private readonly _diagnosticCollection: DiagnosticCollection;
    private readonly _git: SimpleGit;
    private readonly _disposables: Disposable[] = [];
    private readonly _diffsCache: Map<string, {
        diffs: Diff[];
        fileType: 'json' | 'yaml' | 'graphql' | 'unknown';
        content: string;
        parsedContent?: any;
    }> = new Map();
    // Cache for baseline files: key = `${filePath}:${baselineRef}`
    private readonly _baselineCache: Map<string, { content: string; parsed: any }> = new Map();
    // Cache for current document parsed content: key = `${filePath}:${content}`
    private readonly _currentContentCache: Map<string, any> = new Map();

    constructor() {
        this._diagnosticCollection = languages.createDiagnosticCollection(BWC_DIAGNOSTIC_SOURCE);
        this._git = simpleGit();
        this._disposables.push(this._diagnosticCollection);
    }

    public dispose(): void {
        this._disposables.forEach((d) => d.dispose());
    }

    public async validateGitReference(reference: string, workspacePath: WorkfolderPath): Promise<boolean> {
        try {
            const git = simpleGit(workspacePath);
            await git.revparse(['--verify', reference]);
            return true;
        } catch (error) {
            return false;
        }
    }

    public async runBackwardCompatibilityCheck(
        filePaths: FilePath[],
        baselineReference: string,
        workspacePath: WorkfolderPath,
        excludeComponentsScope: boolean = true
    ): Promise<void> {
        if (filePaths.length === 0) {
            window.showInformationMessage('No documents selected for backward compatibility check. Please select documents in "Documents" section.');
            return;
        }

        const git = simpleGit(workspacePath);
        let processedFiles = 0;
        let skippedFiles = 0;
        let totalDiagnostics = 0;

        for (const filePath of filePaths) {
            try {
                const relativePath = path.relative(workspacePath, filePath);
                // Git uses forward slashes even on Windows
                const gitPath = relativePath.replace(/\\/g, '/');

                // Get baseline version from git (with caching)
                const baselineCacheKey = `${filePath}:${baselineReference}`;
                let baselineContent: string;
                let baselineParsed: any;

                if (this._baselineCache.has(baselineCacheKey)) {
                    // Use cached baseline
                    const cached = this._baselineCache.get(baselineCacheKey)!;
                    baselineContent = cached.content;
                    baselineParsed = cached.parsed;
                    console.log(`Using cached baseline for ${path.basename(filePath)}`);
                } else {
                    // Fetch from git
                    try {
                        baselineContent = await git.show([`${baselineReference}:${gitPath}`]);
                    } catch (error) {
                        // File doesn't exist in baseline, skip silently
                        console.log(`File ${relativePath} not found in baseline ${baselineReference}, skipping`);
                        skippedFiles++;
                        continue;
                    }
                }

                // Get current version
                const currentUri = Uri.file(filePath);
                const currentDocument = await workspace.openTextDocument(currentUri);
                const currentContent = currentDocument.getText();

                // Detect file type
                const fileType = this.detectFileType(filePath, currentContent);

                let beforeSpec: unknown;
                let afterSpec: unknown;

                if (fileType === 'graphql') {
                    // For GraphQL, pass as string - api-diff should handle it
                    beforeSpec = baselineContent;
                    afterSpec = currentContent;
                } else if (fileType === 'json') {
                    // Parse baseline (use cached if available)
                    if (baselineParsed !== undefined) {
                        beforeSpec = baselineParsed;
                    } else {
                        beforeSpec = JSON.parse(baselineContent);
                        baselineParsed = beforeSpec;
                    }
                    // Parse current
                    afterSpec = JSON.parse(currentContent);
                } else if (fileType === 'yaml') {
                    const yaml = await import('yaml');
                    // Parse baseline (use cached if available)
                    if (baselineParsed !== undefined) {
                        beforeSpec = baselineParsed;
                    } else {
                        beforeSpec = yaml.parse(baselineContent);
                        baselineParsed = beforeSpec;
                    }
                    // Parse current
                    afterSpec = yaml.parse(currentContent);
                } else {
                    // Unknown type, skip
                    console.log(`Unknown file type for ${filePath}, skipping`);
                    skippedFiles++;
                    continue;
                }

                // Cache baseline if not already cached
                if (!this._baselineCache.has(baselineCacheKey)) {
                    this._baselineCache.set(baselineCacheKey, { content: baselineContent, parsed: baselineParsed });
                }

                // Calculate diffs using api-diff
                const { diffs } = apiDiff(beforeSpec, afterSpec, {
                    beforeSource: beforeSpec,
                    afterSource: afterSpec,
                });

                console.log(`Found ${diffs.length} diffs for ${path.basename(filePath)}`);

                // Parse current content for location lookup (with caching)
                let parsedContent: any = undefined;
                const currentContentCacheKey = `${filePath}:${currentContent}`;

                if (this._currentContentCache.has(currentContentCacheKey)) {
                    // Use cached parsed content
                    parsedContent = this._currentContentCache.get(currentContentCacheKey);
                    console.log(`Using cached parsed content for ${path.basename(filePath)}`);
                } else {
                    // Parse and cache
                    if (fileType === 'json') {
                        parsedContent = parseJsonWithPointers(currentContent);
                    } else if (fileType === 'yaml') {
                        parsedContent = parseYamlWithPointers(currentContent);
                    }

                    if (parsedContent !== undefined) {
                        this._currentContentCache.set(currentContentCacheKey, parsedContent);
                    }
                }

                // Cache the diffs with parsed content
                this._diffsCache.set(filePath, { diffs, fileType, content: currentContent, parsedContent });

                // Transform diffs to diagnostics with filtering
                const diagnostics = await this.transformDiffsToDiagnostics(diffs, currentContent, fileType, filePath, excludeComponentsScope, parsedContent);

                // Set diagnostics for this file
                this._diagnosticCollection.set(currentUri, diagnostics);
                processedFiles++;
                totalDiagnostics += diagnostics.length;
            } catch (error) {
                // If there's an error processing this file, show error
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`Error processing file ${filePath}:`, error);
                window.showErrorMessage(`BWC Check Error for ${path.basename(filePath)}: ${errorMessage}`);
            }
        }

        // Show summary
        if (processedFiles > 0) {
            const message = totalDiagnostics > 0
                ? `BWC Check completed: Found ${totalDiagnostics} issue(s) in ${processedFiles} file(s)`
                : `BWC Check completed: No compatibility issues found in ${processedFiles} file(s)`;
            console.log(message);
        }
    }

    public clearDiagnostics(): void {
        this._diagnosticCollection.clear();
        this._diffsCache.clear();
        // Keep baseline and content caches - they're still useful
    }

    public clearDiagnosticsForFile(filePath: FilePath): void {
        const uri = Uri.file(filePath);
        this._diagnosticCollection.delete(uri);
        this._diffsCache.delete(filePath);
        // Keep baseline and content caches for this file - they're still useful
    }

    public clearAllCaches(): void {
        this._diagnosticCollection.clear();
        this._diffsCache.clear();
        this._baselineCache.clear();
        this._currentContentCache.clear();
    }

    public async reapplyFilteringForCachedDiffs(excludeComponentsScope: boolean): Promise<void> {
        // Reapply filtering to all cached diffs (uses cached parsed content for performance)
        for (const [filePath, cached] of this._diffsCache.entries()) {
            const diagnostics = await this.transformDiffsToDiagnostics(
                cached.diffs,
                cached.content,
                cached.fileType,
                filePath,
                excludeComponentsScope,
                cached.parsedContent
            );
            const uri = Uri.file(filePath);
            this._diagnosticCollection.set(uri, diagnostics);
        }
    }

    private detectFileType(filePath: string, content: string): 'json' | 'yaml' | 'graphql' | 'unknown' {
        const ext = path.extname(filePath).toLowerCase();

        if (ext === '.json') {
            return 'json';
        } else if (ext === '.yaml' || ext === '.yml') {
            return 'yaml';
        } else if (ext === '.graphql' || ext === '.gql') {
            return 'graphql';
        }

        // Try to detect by content
        const trimmedContent = content.trim();
        if (trimmedContent.startsWith('{') || trimmedContent.startsWith('[')) {
            return 'json';
        }

        return 'unknown';
    }

    private async transformDiffsToDiagnostics(
        diffs: Diff[],
        currentContent: string,
        fileType: 'json' | 'yaml' | 'graphql' | 'unknown',
        filePath: string,
        excludeComponentsScope: boolean = true,
        parsedContent?: any
    ): Promise<Diagnostic[]> {
        const diagnostics: Diagnostic[] = [];

        // Filter diffs based on excludeComponentsScope setting
        const filteredDiffs = excludeComponentsScope
            ? diffs.filter(diff => diff.scope !== 'components')
            : diffs;

        for (const diff of filteredDiffs) {
            const severity = this.mapDiffSeverityToDiagnosticSeverity(diff.type);
            const message = diff.description || `${diff.action} ${diff.type}`;

            // Calculate location (using cached parsed content if available)
            const range = await this.calculateLocation(diff, currentContent, fileType, parsedContent);

            const diagnostic = new Diagnostic(range, message, severity);
            diagnostic.source = BWC_DIAGNOSTIC_SOURCE;
            diagnostics.push(diagnostic);
        }

        return diagnostics;
    }

    private mapDiffSeverityToDiagnosticSeverity(diffType: string): DiagnosticSeverity {
        switch (diffType) {
            case breaking:
                return DiagnosticSeverity.Error;
            case risky:
            case nonBreaking:
                return DiagnosticSeverity.Warning;
            case annotation:
            case unclassified:
            case deprecated:
                return DiagnosticSeverity.Information;
            default:
                return DiagnosticSeverity.Information;
        }
    }

    private async calculateLocation(
        diff: Diff,
        currentContent: string,
        fileType: 'json' | 'yaml' | 'graphql' | 'unknown',
        parsedContent?: any
    ): Promise<Range> {
        // For GraphQL, always return start of file
        if (fileType === 'graphql') {
            return new Range(new Position(0, 0), new Position(0, 0));
        }

        // Get the relevant path - prefer afterDeclarationPath, fallback to beforeDeclarationPath
        let jsonPath: (string | number)[] = [];

        if ('afterDeclarationPaths' in diff && diff.afterDeclarationPaths.length > 0) {
            const path = diff.afterDeclarationPaths[0] || [];
            jsonPath = this.filterJsonPath(path);
        } else if ('beforeDeclarationPaths' in diff && diff.beforeDeclarationPaths.length > 0) {
            const path = diff.beforeDeclarationPaths[0] || [];
            jsonPath = this.filterJsonPath(path);
        }

        // If no path, return start of file
        if (jsonPath.length === 0) {
            return new Range(new Position(0, 0), new Position(0, 0));
        }

        // Try to get location with fallback logic (using cached parsed content if available)
        const location = this.getLocationWithFallback(currentContent, jsonPath, fileType, parsedContent);

        if (location) {
            const startPos = new Position(location.range.start.line, location.range.start.character);
            const endPos = new Position(location.range.end.line, location.range.end.character);
            return new Range(startPos, endPos);
        }

        // Final fallback: start of file
        return new Range(new Position(0, 0), new Position(0, 0));
    }

    private getLocationWithFallback(
        content: string,
        jsonPath: (string | number)[],
        fileType: 'json' | 'yaml' | 'graphql' | 'unknown',
        parsedContent?: any
    ): { range: { start: { line: number; character: number }; end: { line: number; character: number } } } | null {
        // Try with full path first, then progressively remove last segments
        let currentPath = [...jsonPath];

        while (currentPath.length > 0) {
            try {
                const location = this.getLocationForPath(content, currentPath, fileType, parsedContent);
                if (location) {
                    return location;
                }
            } catch (error) {
                // Path not found, continue to fallback
            }

            // Remove last segment and try again
            currentPath = currentPath.slice(0, -1);
        }

        return null;
    }

    private getLocationForPath(
        content: string,
        jsonPath: (string | number)[],
        fileType: 'json' | 'yaml' | 'graphql' | 'unknown',
        parsedContent?: any
    ): { range: { start: { line: number; character: number }; end: { line: number; character: number } } } | null {
        try {
            if (fileType === 'json') {
                // Use cached parsed content if available, otherwise parse
                const parsed = parsedContent || parseJsonWithPointers(content);
                const location = getLocationForJsonPathJson(parsed, jsonPath);
                return location || null;
            } else if (fileType === 'yaml') {
                // Use cached parsed content if available, otherwise parse
                const parsed = parsedContent || parseYamlWithPointers(content);
                const location = getLocationForJsonPathYaml(parsed, jsonPath);
                return location || null;
            }
        } catch (error) {
            // Path not found or parsing error
            return null;
        }

        return null;
    }

    private filterJsonPath(path: (string | number | symbol)[]): (string | number)[] {
        // Filter out symbols from the path as they're not supported by location lookup
        return path.filter((segment): segment is string | number => typeof segment !== 'symbol');
    }
}

