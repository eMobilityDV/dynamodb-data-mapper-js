import {ClassAnnotation} from './annotationShapes';
import {finalizeSchema, isNewDecoratorContext} from './schemaUtils';

/**
 * Finalize `@attribute` schema entries on an embedded document class that
 * does not use `@table`.
 *
 * In legacy `experimentalDecorators` mode this decorator is a no-op — `@attribute`
 * writes schema directly to the prototype. In TC39 Stage 3 decorator mode
 * (TypeScript 5+ without `experimentalDecorators`), `@attribute` accumulates
 * entries in decorator metadata and `@schema()` finalizes them onto the prototype.
 *
 * Apply `@schema()` to any class that uses `@attribute` but not `@table`.
 *
 * @example
 *  // New TC39 mode — required on embedded classes
 *  \@schema()
 *  export class AddressEntity {
 *      \@attribute({ type: 'String' })
 *      street: string;
 *  }
 */
export function schema(): ClassAnnotation {
    return (targetOrValue: any, context?: any) => {
        if (isNewDecoratorContext(context)) {
            finalizeSchema(targetOrValue.prototype, context.metadata);
        }
        // Legacy mode: no-op
    };
}
