import { marshallValue, Schema } from '@k2mobility/dynamodb-data-marshaller';
import { AttributeValue } from '@aws-sdk/client-dynamodb';

type Key = Record<string, AttributeValue>;

/**
 * @internal
 */
export function marshallStartKey(
    schema: Schema,
    startKey: {[key: string]: any}
): Key {
    const key: Key = {};
    for (const propertyName of Object.keys(startKey)) {
        const propSchema = schema[propertyName];
        const { attributeName = propertyName } = propSchema;
        if (propSchema) {
            key[attributeName] = marshallValue(
                propSchema,
                startKey[propertyName]
            )!;
        }
    }

    return key;
}
