import { Node, ObjectLiteralExpression, SourceFile } from 'ts-morph';
import { DATA_MAPPER_PKG, PROPERTY_DECORATORS, SKIP_DECORATORS } from './constants';
import { TypeMapper } from './typeMapper';
import { UnresolvedField } from './types';

export class FileRewriter {
    constructor(private readonly typeMapper: TypeMapper) {}

    rewrite(sf: SourceFile): string[] {
        const warnings: string[] = [];

        for (const classDecl of sf.getClasses()) {
            for (const prop of classDecl.getProperties()) {
                for (const decorator of prop.getDecorators()) {
                    const name = decorator.getName();
                    if (!PROPERTY_DECORATORS.has(name) || SKIP_DECORATORS.has(name)) {
                        continue;
                    }

                    const callExpr = decorator.getCallExpression();
                    if (!callExpr) continue;

                    const args = callExpr.getArguments();

                    if (args.length > 0) {
                        const arg0 = args[0];
                        if (!Node.isObjectLiteralExpression(arg0)) {
                            warnings.push(
                                `${sf.getFilePath()}:${prop.getStartLineNumber()}: @${name}(${arg0.getText()}) — non-literal arg, skipping`
                            );
                            continue;
                        }
                        if (FileRewriter.hasPropertyInObjectLiteral(arg0, 'type')) {
                            continue;
                        }
                    }

                    const result = this.typeMapper.map(prop.getType());

                    if ((result.kind === 'any' || result.kind === 'set-warn' || result.kind === 'collection') ||
                        (result.kind === 'map' && result.message)) {
                        warnings.push(`${sf.getFilePath()}:${prop.getStartLineNumber()}: ${result.message}`);
                    }

                    const typeStr = result.type;
                    const memberTypeStr = (result.kind === 'set' || result.kind === 'list' || result.kind === 'map') ? result.memberType : undefined;

                    // Bug 2: Document → embed(ClassName) so members are populated at runtime
                    if (result.kind === 'document') {
                        if (args.length > 0) callExpr.removeArgument(0);
                        callExpr.addArgument(`embed(${result.valueConstructorName})`);
                        this.ensureEmbedImported(sf);
                    } else if (args.length === 0) {
                        const props: string[] = [`type: '${typeStr}'`];
                        if (result.kind === 'set' && memberTypeStr) props.push(`memberType: '${memberTypeStr}'`);
                        if ((result.kind === 'list' || result.kind === 'map') && memberTypeStr) props.push(`memberType: { type: '${memberTypeStr}' }`);
                        callExpr.addArgument(`{ ${props.join(', ')} }`);
                    } else {
                        const objLit = args[0] as ObjectLiteralExpression;
                        objLit.insertPropertyAssignment(0, { name: 'type', initializer: `'${typeStr}'` });
                        if (result.kind === 'set' && memberTypeStr && !FileRewriter.hasPropertyInObjectLiteral(objLit, 'memberType')) {
                            objLit.addPropertyAssignment({ name: 'memberType', initializer: `'${memberTypeStr}'` });
                        }
                        if ((result.kind === 'list' || result.kind === 'map') && memberTypeStr && !FileRewriter.hasPropertyInObjectLiteral(objLit, 'memberType')) {
                            objLit.addPropertyAssignment({ name: 'memberType', initializer: `{ type: '${memberTypeStr}' }` });
                        }
                    }
                }
            }
        }

        return warnings;
    }

    collectUnresolved(sf: SourceFile): UnresolvedField[] {
        const results: UnresolvedField[] = [];
        for (const classDecl of sf.getClasses()) {
            for (const prop of classDecl.getProperties()) {
                for (const decorator of prop.getDecorators()) {
                    const name = decorator.getName();
                    if (!PROPERTY_DECORATORS.has(name) || SKIP_DECORATORS.has(name)) continue;
                    const callExpr = decorator.getCallExpression();
                    if (!callExpr) continue;
                    const args = callExpr.getArguments();
                    if (args.length > 0) {
                        const arg0 = args[0];
                        if (!Node.isObjectLiteralExpression(arg0)) continue;
                        if (FileRewriter.hasPropertyInObjectLiteral(arg0 as ObjectLiteralExpression, 'type')) continue;
                    }
                    const result = this.typeMapper.map(prop.getType());
                    if (result.kind === 'any') {
                        results.push({ filePath: sf.getFilePath(), line: prop.getStartLineNumber(), typeText: prop.getType().getText() });
                    }
                }
            }
        }
        return results;
    }

    private ensureEmbedImported(sf: SourceFile): void {
        const existing = sf.getImportDeclarations().find(
            d => d.getModuleSpecifierValue() === DATA_MAPPER_PKG
        );
        if (existing) {
            if (!existing.getNamedImports().some(i => i.getName() === 'embed')) {
                existing.addNamedImport('embed');
            }
        } else {
            sf.addImportDeclaration({ moduleSpecifier: DATA_MAPPER_PKG, namedImports: ['embed'] });
        }
    }

    private static hasPropertyInObjectLiteral(objLit: ObjectLiteralExpression, name: string): boolean {
        return objLit.getProperties().some(p =>
            (Node.isPropertyAssignment(p) || Node.isShorthandPropertyAssignment(p)) && p.getName() === name
        );
    }
}
