import {table} from "./table";
import {DynamoDbTable, DynamoDbSchema} from '@k2mobility/dynamodb-data-mapper';
import {PENDING_SCHEMA} from './constants';

describe('table', () => {
    it(
        'should bind the provided table name to the target in a way compatible with the DynamoDbTable protocol',
        () => {
            class MyDocument {}
            const tableName = 'tableName';
            const decorator = table(tableName);
            decorator(MyDocument);

            expect((new MyDocument() as any)[DynamoDbTable]).toBe(tableName);
        }
    );

    describe('new TC39 decorator mode', () => {
        it('should set table name and finalize schema onto the prototype', () => {
            const metadata: Record<PropertyKey, unknown> = {};
            (metadata as any)[PENDING_SCHEMA] = {
                id: {type: 'String', keyType: 'HASH'},
                name: {type: 'String'},
            };

            const proto: any = {};
            const ctor = function() {} as any;
            ctor.prototype = proto;

            table('my-table')(ctor, {kind: 'class', name: 'MyEntity', metadata});

            expect(proto[DynamoDbTable]).toBe('my-table');
            expect(proto[DynamoDbSchema]).toEqual({
                id: {type: 'String', keyType: 'HASH'},
                name: {type: 'String'},
            });
        });

        it('should set table name even when no attributes are present', () => {
            const metadata: Record<PropertyKey, unknown> = {};
            const proto: any = {};
            const ctor = function() {} as any;
            ctor.prototype = proto;

            table('empty-table')(ctor, {kind: 'class', name: 'Empty', metadata});

            expect(proto[DynamoDbTable]).toBe('empty-table');
            expect(proto[DynamoDbSchema]).toEqual({});
        });
    });
});
