import {schema} from './schema';
import {attribute} from './attribute';
import {DynamoDbSchema} from '@k2mobility/dynamodb-data-mapper';
import {PENDING_SCHEMA} from './constants';

describe('schema', () => {
    describe('legacy mode', () => {
        it('should be a no-op when called with a single target argument', () => {
            const proto: any = {};
            proto[DynamoDbSchema] = {existing: {type: 'String'}};

            const ctor = function() {} as any;
            ctor.prototype = proto;

            schema()(ctor);

            expect(proto[DynamoDbSchema]).toEqual({existing: {type: 'String'}});
        });
    });

    describe('new TC39 mode', () => {
        it('should finalize pending schema from metadata onto the prototype', () => {
            const metadata: Record<PropertyKey, unknown> = {};
            (metadata as any)[PENDING_SCHEMA] = {
                name: {type: 'String'},
                age: {type: 'Number'},
            };

            const proto: any = {};
            const ctor = function() {} as any;
            ctor.prototype = proto;

            schema()(ctor, {kind: 'class', name: 'TestClass', metadata});

            expect(proto[DynamoDbSchema]).toEqual({
                name: {type: 'String'},
                age: {type: 'Number'},
            });
        });

        it('should create an empty schema when no attributes have been decorated', () => {
            const metadata: Record<PropertyKey, unknown> = {};
            const proto: any = {};
            const ctor = function() {} as any;
            ctor.prototype = proto;

            schema()(ctor, {kind: 'class', name: 'Empty', metadata});

            expect(proto[DynamoDbSchema]).toEqual({});
        });

        it('should inherit schema from parent prototype', () => {
            const parentProto: any = {};
            Object.defineProperty(parentProto, DynamoDbSchema, {
                value: {parentProp: {type: 'String'}},
            });

            const proto: any = Object.create(parentProto);
            const ctor = function() {} as any;
            ctor.prototype = proto;

            const metadata: Record<PropertyKey, unknown> = {};
            (metadata as any)[PENDING_SCHEMA] = {childProp: {type: 'Number'}};

            schema()(ctor, {kind: 'class', name: 'Child', metadata});

            expect(proto[DynamoDbSchema]).toEqual({
                parentProp: {type: 'String'},
                childProp: {type: 'Number'},
            });
        });

        it('should work end-to-end with @attribute in new mode', () => {
            const metadata: Record<PropertyKey, unknown> = {};

            attribute({type: 'String'})(
                undefined,
                {kind: 'field', name: 'street', metadata}
            );
            attribute({type: 'Number'})(
                undefined,
                {kind: 'field', name: 'zip', metadata}
            );

            const proto: any = {};
            const ctor = function() {} as any;
            ctor.prototype = proto;

            schema()(ctor, {kind: 'class', name: 'Address', metadata});

            expect(proto[DynamoDbSchema]).toEqual({
                street: {type: 'String'},
                zip: {type: 'Number'},
            });
        });
    });
});
