import { ClassDeclaration, Symbol } from 'ts-morph';

export interface DecoratedClassInfo {
    className: string;
    filePath: string;
    hasTableOrSchema: boolean;
    classDecl: ClassDeclaration;
}

export interface ClassRegistry {
    getDecoratedClassInfo(symbol: Symbol): DecoratedClassInfo | undefined;
}

export type TypeMapResult =
    | { kind: 'primitive'; type: string }
    | { kind: 'set'; type: 'Set'; memberType: string }
    | { kind: 'set-warn'; type: 'Set'; message: string }
    | { kind: 'map'; type: 'Map'; memberType?: string; message?: string }
    | { kind: 'list'; type: 'List'; memberType: string }
    | { kind: 'collection'; type: 'Collection'; message: string }
    | { kind: 'document'; type: 'Document'; valueConstructorName: string; classDecl?: ClassDeclaration; targetNeedsSchema: boolean }
    | { kind: 'any'; type: 'Any'; message: string };

export interface UnresolvedField {
    filePath: string;
    line: number;
    typeText: string;
}

export interface MigratorOptions {
    patterns: string[];
    cwd: string;
    dryRun: boolean;
    typeOverrides?: Record<string, string>;
}

export interface FileChange {
    filePath: string;
    originalText: string;
    newText: string;
}

export interface MigratorResult {
    changes: FileChange[];
    warnings: string[];
}
