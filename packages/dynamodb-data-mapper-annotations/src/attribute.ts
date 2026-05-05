import 'reflect-metadata';
import {PropertyAnnotation} from './annotationShapes';
import {METADATA_TYPE_KEY, PENDING_SCHEMA} from './constants';
import {deriveBaseSchema, isNewDecoratorContext} from './schemaUtils';
import {BinarySet, NumberValueSet} from "@k2mobility/dynamodb-auto-marshaller";
import {DynamoDbSchema} from '@k2mobility/dynamodb-data-mapper';
import {
    DocumentType,
    KeyableType,
    SchemaType,
    SetType
} from "@k2mobility/dynamodb-data-marshaller";

/**
 * Declare a property in a TypeScript class to be part of a DynamoDB schema.
 *
 * Supports both legacy `experimentalDecorators` mode and the TC39 Stage 3
 * decorator standard (TypeScript 5+ without `experimentalDecorators`).
 *
 * In legacy mode, type inference is automatic via `emitDecoratorMetadata`.
 * In new TC39 mode, `emitDecoratorMetadata` is unavailable — unknown types
 * fall back to `'Any'`. Pass an explicit `{ type: '...' }` for precise mapping.
 *
 * @see https://www.typescriptlang.org/docs/handbook/decorators.html
 */
export function attribute(
    parameters: Partial<SchemaType> = {}
): PropertyAnnotation {
    return (targetOrValue: any, contextOrKey: any) => {
        if (isNewDecoratorContext(contextOrKey)) {
            const context = contextOrKey as {
                name: string | symbol;
                metadata: Record<PropertyKey, unknown>;
            };

            const schemaType = metadataToSchemaType(undefined, parameters);

            if (
                (
                    (schemaType as KeyableType).keyType ||
                    (schemaType as KeyableType).indexKeyConfigurations
                ) &&
                ['Binary', 'Custom', 'Date', 'Number', 'String'].indexOf(schemaType.type) < 0
            ) {
                throw new Error(
                    `Properties of type ${schemaType.type} may not be used as index or table keys.`
                );
            }

            if (!context.metadata[PENDING_SCHEMA]) {
                (context.metadata as any)[PENDING_SCHEMA] = {};
            }
            (context.metadata[PENDING_SCHEMA] as any)[context.name] = schemaType;
        } else {
            // Legacy experimentalDecorators mode
            const target = targetOrValue;
            const propertyKey = contextOrKey as string | symbol;

            if (!Object.prototype.hasOwnProperty.call(target, DynamoDbSchema)) {
                Object.defineProperty(
                    target,
                    DynamoDbSchema as any,
                    {value: deriveBaseSchema(target)}
                );
            }

            const schemaType = metadataToSchemaType(
                Reflect.getMetadata(METADATA_TYPE_KEY, target, propertyKey),
                parameters
            );

            if (
                (
                    (schemaType as KeyableType).keyType ||
                    (schemaType as KeyableType).indexKeyConfigurations
                ) &&
                [
                    'Binary',
                    'Custom',
                    'Date',
                    'Number',
                    'String',
                ].indexOf(schemaType.type) < 0
            ) {
                throw new Error(
                    `Properties of type ${schemaType.type} may not be used as index or table keys. If you are relying on automatic type detection and have encountered this error, please ensure that the 'emitDecoratorMetadata' TypeScript compiler option is enabled. Please see https://www.typescriptlang.org/docs/handbook/decorators.html#metadata for more information on this compiler option.`
                );
            }

            (target as any)[DynamoDbSchema][propertyKey] = schemaType;
        }
    };
}

function metadataToSchemaType(
    ctor: {new (): any}|undefined,
    declaration: Partial<SchemaType>
): SchemaType {
    let {type, ...rest} = declaration;
    if (type === undefined) {
        if (ctor) {
            if (ctor === String) {
                type = 'String';
            } else if (ctor === Number) {
                type = 'Number';
            } else if (ctor === Boolean) {
                type = 'Boolean';
            } else if (ctor === Date || ctor.prototype instanceof Date) {
                type = 'Date';
            } else if (
                ctor === BinarySet ||
                ctor.prototype instanceof BinarySet
            ) {
                type = 'Set';
                (rest as SetType).memberType = 'Binary';
            } else if (
                ctor === NumberValueSet ||
                ctor.prototype instanceof NumberValueSet
            ) {
                type = 'Set';
                (rest as SetType).memberType = 'Number';
            } else if (ctor === Set || ctor.prototype instanceof Set) {
                type = 'Set';
                if (!('memberType' in rest)) {
                    throw new Error(
                        'Invalid set declaration. You must specify a memberType'
                    );
                }
            } else if (ctor === Map || ctor.prototype instanceof Map) {
                type = 'Map';
                if (!('memberType' in rest)) {
                    throw new Error(
                        'Invalid map declaration. You must specify a memberType'
                    );
                }
            } else if (ctor.prototype[DynamoDbSchema]) {
                type = 'Document';
                (rest as DocumentType).members = ctor.prototype[DynamoDbSchema];
                (rest as DocumentType).valueConstructor = ctor;
            } else if (isBinaryType(ctor)) {
                type = 'Binary';
            } else if (ctor === Array || ctor.prototype instanceof Array) {
                if ('members' in declaration) {
                    type = 'Tuple';
                } else if ('memberType' in declaration) {
                    type = 'List';
                } else {
                    type = 'Collection';
                }
            } else {
                type = 'Any';
            }
        } else {
            type = 'Any';
        }
    }

    if (
        type === 'Document' &&
        !(rest as DocumentType).members &&
        (rest as DocumentType).valueConstructor
    ) {
        (rest as DocumentType).members =
            (rest as DocumentType).valueConstructor!.prototype[DynamoDbSchema];
    }

    return {
        ...rest,
        type
    } as SchemaType;
}

/**
 * ArrayBuffer.isView will only evaluate if an object instance is an
 * ArrayBufferView, but TypeScript metadata gives us a reference to the class.
 *
 * This function checks if the provided constructor is or extends the built-in
 * `ArrayBuffer` constructor, the `DataView` constructor, or any `TypedArray`
 * constructor.
 */
function isBinaryType(arg: any): boolean {
    return arg === Uint8Array || arg.prototype instanceof Uint8Array ||
        arg === Uint8ClampedArray || arg.prototype instanceof Uint8ClampedArray ||
        arg === Uint16Array || arg.prototype instanceof Uint16Array ||
        arg === Uint32Array || arg.prototype instanceof Uint32Array ||
        arg === Int8Array || arg.prototype instanceof Int8Array ||
        arg === Int16Array || arg.prototype instanceof Int16Array ||
        arg === Int32Array || arg.prototype instanceof Int32Array ||
        arg === Float32Array || arg.prototype instanceof Float32Array ||
        arg === Float64Array || arg.prototype instanceof Float64Array ||
        arg === ArrayBuffer || arg.prototype instanceof ArrayBuffer ||
        arg === DataView || arg.prototype instanceof DataView;
}
