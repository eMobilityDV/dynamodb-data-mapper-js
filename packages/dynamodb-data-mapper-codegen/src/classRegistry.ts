import { ClassDeclaration, Node, SourceFile, Symbol } from 'ts-morph';
import { CLASS_DECORATORS, PROPERTY_DECORATORS, SKIP_DECORATORS } from './constants';
import { ClassRegistry, DecoratedClassInfo } from './types';

export class ClassRegistryImpl implements ClassRegistry {
    private readonly map: Map<string, DecoratedClassInfo>;

    constructor(sourceFiles: SourceFile[]) {
        this.map = ClassRegistryImpl.buildMap(sourceFiles);
    }

    getDecoratedClassInfo(sym: Symbol): DecoratedClassInfo | undefined {
        const decl = sym.getDeclarations()[0];
        if (!decl) return undefined;

        const registered = this.map.get(`${sym.getName()}@${decl.getSourceFile().getFilePath()}`);
        if (registered) return registered;

        // Fallback: class not in glob but referenced via import — inspect its declaration.
        if (Node.isClassDeclaration(decl) && ClassRegistryImpl.hasDynamoDbPropertyDecorator(decl)) {
            return {
                className: sym.getName(),
                filePath: decl.getSourceFile().getFilePath(),
                hasTableOrSchema: ClassRegistryImpl.hasDynamoDbClassDecorator(decl),
                classDecl: decl,
            };
        }

        return undefined;
    }

    entries(): IterableIterator<DecoratedClassInfo> {
        return this.map.values();
    }

    static hasDynamoDbPropertyDecorator(classDecl: ClassDeclaration): boolean {
        return classDecl.getProperties().some(p =>
            p.getDecorators().some(d => PROPERTY_DECORATORS.has(d.getName())));
    }

    static hasNonSkipPropertyDecorator(classDecl: ClassDeclaration): boolean {
        return classDecl.getProperties().some(p =>
            p.getDecorators().some(d => PROPERTY_DECORATORS.has(d.getName()) && !SKIP_DECORATORS.has(d.getName())));
    }

    static hasDynamoDbClassDecorator(classDecl: ClassDeclaration): boolean {
        return classDecl.getDecorators().some(d => CLASS_DECORATORS.has(d.getName()));
    }

    private static buildMap(sourceFiles: SourceFile[]): Map<string, DecoratedClassInfo> {
        const map = new Map<string, DecoratedClassInfo>();
        for (const sf of sourceFiles) {
            for (const classDecl of sf.getClasses()) {
                if (ClassRegistryImpl.hasDynamoDbPropertyDecorator(classDecl)) {
                    const name = classDecl.getName() ?? '(anonymous)';
                    map.set(`${name}@${sf.getFilePath()}`, {
                        className: name,
                        filePath: sf.getFilePath(),
                        hasTableOrSchema: ClassRegistryImpl.hasDynamoDbClassDecorator(classDecl),
                        classDecl,
                    });
                }
            }
        }
        return map;
    }
}
