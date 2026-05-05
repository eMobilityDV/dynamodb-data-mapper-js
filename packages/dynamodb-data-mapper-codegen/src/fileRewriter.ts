import { Node, ObjectLiteralExpression, SourceFile } from 'ts-morph';
import { PROPERTY_DECORATORS, SKIP_DECORATORS } from './constants';
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

                    if (result.kind === 'any' || result.kind === 'map' || result.kind === 'set-warn' || result.kind === 'collection') {
                        warnings.push(`${sf.getFilePath()}:${prop.getStartLineNumber()}: ${result.message}`);
                    }

                    const typeStr = result.type;
                    const memberTypeStr = (result.kind === 'set' || result.kind === 'list') ? result.memberType : undefined;
                    const valueConstructorStr = result.kind === 'document' ? result.valueConstructorName : undefined;

                    if (args.length === 0) {
                        const props: string[] = [`type: '${typeStr}'`];
                        if (memberTypeStr) props.push(`memberType: '${memberTypeStr}'`);
                        if (valueConstructorStr) props.push(`valueConstructor: ${valueConstructorStr}`);
                        callExpr.addArgument(`{ ${props.join(', ')} }`);
                    } else {
                        const objLit = args[0] as ObjectLiteralExpression;
                        objLit.insertPropertyAssignment(0, { name: 'type', initializer: `'${typeStr}'` });
                        if (memberTypeStr && !FileRewriter.hasPropertyInObjectLiteral(objLit, 'memberType')) {
                            objLit.addPropertyAssignment({ name: 'memberType', initializer: `'${memberTypeStr}'` });
                        }
                        if (valueConstructorStr && !FileRewriter.hasPropertyInObjectLiteral(objLit, 'valueConstructor')) {
                            objLit.addPropertyAssignment({ name: 'valueConstructor', initializer: valueConstructorStr });
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

    private static hasPropertyInObjectLiteral(objLit: ObjectLiteralExpression, name: string): boolean {
        return objLit.getProperties().some(p =>
            (Node.isPropertyAssignment(p) || Node.isShorthandPropertyAssignment(p)) && p.getName() === name
        );
    }
}
