import {DynamoDbSchema} from '@k2mobility/dynamodb-data-mapper';
import {Schema, SchemaType} from '@k2mobility/dynamodb-data-marshaller';
import {PENDING_SCHEMA} from './constants';

export function isNewDecoratorContext(second: unknown): boolean {
    return typeof second === 'object' && second !== null && 'kind' in second;
}

export function deriveBaseSchema(target: any): Schema {
    if (target && typeof target === 'object') {
        const prototype = Object.getPrototypeOf(target);
        if (prototype) {
            return {
                ...deriveBaseSchema(prototype),
                ...Object.prototype.hasOwnProperty.call(prototype, DynamoDbSchema)
                    ? prototype[DynamoDbSchema]
                    : {}
            };
        }
    }
    return {};
}

export function finalizeSchema(proto: any, metadata: Record<PropertyKey, unknown>): void {
    if (!Object.prototype.hasOwnProperty.call(proto, DynamoDbSchema)) {
        Object.defineProperty(
            proto,
            DynamoDbSchema as any,
            {value: deriveBaseSchema(proto), writable: true}
        );
    }
    const pending = metadata[PENDING_SCHEMA] as Record<string|symbol, SchemaType> | undefined;
    if (pending) {
        Object.assign(proto[DynamoDbSchema], pending);
    }
}
