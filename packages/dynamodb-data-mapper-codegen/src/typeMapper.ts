import { Type } from 'ts-morph';
import { TYPED_ARRAY_NAMES } from './constants';
import { ClassRegistry, TypeMapResult } from './types';

const VALID_OVERRIDE_TYPES = new Set(['String', 'Number', 'Boolean', 'Date', 'Binary', 'Any']);

export class TypeMapper {
    constructor(
        private readonly registry: ClassRegistry,
        private readonly overrides: Record<string, string> = {},
    ) {}

    map(rawType: Type): TypeMapResult {
        const type = this.unwrapOptional(rawType);
        if (!type) {
            return { kind: 'any', type: 'Any', message: `Union type '${rawType.getText()}' cannot be mapped` };
        }

        if (type.isString() || type.isStringLiteral()) {
            return { kind: 'primitive', type: 'String' };
        }
        if (type.isNumber() || type.isNumberLiteral()) {
            return { kind: 'primitive', type: 'Number' };
        }
        if (type.isBoolean() || type.isBooleanLiteral()) {
            return { kind: 'primitive', type: 'Boolean' };
        }

        const symbol = type.getSymbol();
        const symbolName = symbol?.getName();

        if (symbolName === 'Date') {
            return { kind: 'primitive', type: 'Date' };
        }

        if (symbolName && TYPED_ARRAY_NAMES.has(symbolName)) {
            return { kind: 'primitive', type: 'Binary' };
        }

        if (symbolName === 'Set') {
            const typeArgs = type.getTypeArguments();
            if (typeArgs.length > 0) {
                const memberType = this.mapScalarMemberType(typeArgs[0].getNonNullableType());
                if (memberType) {
                    return { kind: 'set', type: 'Set', memberType };
                }
            }
            return { kind: 'set-warn', type: 'Set', message: 'Set<T> with non-scalar T — add memberType manually' };
        }

        if (symbolName === 'Map') {
            return { kind: 'map', type: 'Map', message: 'Map<K,V> — add memberType manually' };
        }

        if (symbolName === 'Array' || type.isArray()) {
            const typeArgs = type.getTypeArguments();
            if (typeArgs.length > 0) {
                const memberType = this.mapScalarMemberType(typeArgs[0].getNonNullableType());
                if (memberType) {
                    return { kind: 'list', type: 'List', memberType };
                }
            }
            return { kind: 'collection', type: 'Collection', message: 'Array<T> with complex T — add memberType manually' };
        }

        if (symbol) {
            const info = this.registry.getDecoratedClassInfo(symbol);
            if (info) {
                return {
                    kind: 'document',
                    type: 'Document',
                    valueConstructorName: info.className,
                    classDecl: info.classDecl,
                    targetNeedsSchema: !info.hasTableOrSchema,
                };
            }
        }

        const indexValueType = type.getStringIndexType();
        if (indexValueType) {
            const memberType = this.mapScalarMemberType(indexValueType.getNonNullableType());
            if (memberType) {
                return { kind: 'map', type: 'Map', memberType };
            }
            return { kind: 'map', type: 'Map', message: 'Record<string,V> with complex V — add memberType manually' };
        }

        const override = this.overrides[rawType.getText()];
        if (override) {
            if (override.startsWith('Document:')) {
                const valueConstructorName = override.slice('Document:'.length);
                return { kind: 'document', type: 'Document', valueConstructorName, targetNeedsSchema: false };
            }
            if (VALID_OVERRIDE_TYPES.has(override)) {
                return { kind: 'primitive', type: override };
            }
        }

        return { kind: 'any', type: 'Any', message: `Unrecognized type '${rawType.getText()}' — defaulting to Any. If this is an interface or external class, create a @schema-decorated class and use it instead` };
    }

    // boolean? expands to true | false | undefined internally.
    // String enums expand to their literal members | undefined.
    // Strip undefined/null; collapse homogeneous literal unions to a representative member.
    private unwrapOptional(type: Type): Type | null {
        if (!type.isUnion()) {
            return type;
        }
        const nonNullable = type.getUnionTypes().filter(t => !t.isUndefined() && !t.isNull());
        if (nonNullable.length === 0) {
            return null;
        }
        if (nonNullable.length === 1) {
            return nonNullable[0];
        }
        if (nonNullable.every(t => t.isBooleanLiteral())) {
            return nonNullable[0];
        }
        if (nonNullable.every(t => t.isStringLiteral())) {
            return nonNullable[0];
        }
        if (nonNullable.every(t => t.isNumberLiteral())) {
            return nonNullable[0];
        }
        return null;
    }

    private mapScalarMemberType(type: Type): string | null {
        if (type.isString() || type.isStringLiteral()) return 'String';
        if (type.isNumber() || type.isNumberLiteral()) return 'Number';
        const name = type.getSymbol()?.getName();
        if (name && TYPED_ARRAY_NAMES.has(name)) return 'Binary';
        return null;
    }
}
