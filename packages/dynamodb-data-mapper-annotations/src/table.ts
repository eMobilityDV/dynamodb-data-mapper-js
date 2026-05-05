import {ClassAnnotation} from './annotationShapes';
import {finalizeSchema, isNewDecoratorContext} from './schemaUtils';
import {DynamoDbTable} from '@k2mobility/dynamodb-data-mapper';

/**
 * Declare a TypeScript class to represent items in a DynamoDB table.
 *
 * Supports both legacy `experimentalDecorators` mode and the TC39 Stage 3
 * decorator standard. In new TC39 mode, also finalizes any `@attribute`
 * schema entries accumulated in decorator metadata onto the class prototype.
 *
 * @see https://www.typescriptlang.org/docs/handbook/decorators.html
 */
export function table(tableName: string): ClassAnnotation {
    return (targetOrValue: any, context?: any) => {
        if (isNewDecoratorContext(context)) {
            const ctor = targetOrValue;
            finalizeSchema(ctor.prototype, context.metadata);
            ctor.prototype[DynamoDbTable] = tableName;
        } else {
            targetOrValue.prototype[DynamoDbTable] = tableName;
        }
    };
}
