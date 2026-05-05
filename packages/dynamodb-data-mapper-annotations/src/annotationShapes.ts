import {ZeroArgumentsConstructor} from '@k2mobility/dynamodb-data-marshaller';

// Accepts both legacy (experimentalDecorators) and TC39 Stage 3 decorator APIs.
export interface ClassAnnotation {
    (targetOrValue: ZeroArgumentsConstructor<any>, context?: unknown): any;
}

export interface PropertyAnnotation {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (targetOrValue: any, contextOrKey: any): any;
}
