import { DynamoDbPaginator } from './DynamoDbPaginator';
import { DynamoDbResultsPage } from './DynamoDbResultsPage';
import { DynamoDB, QueryInput } from '@aws-sdk/client-dynamodb';

export class QueryPaginator extends DynamoDbPaginator {
    private nextRequest?: QueryInput;

    constructor(
        private readonly client: DynamoDB,
        input: QueryInput,
        limit?: number
    ) {
        super(limit);
        this.nextRequest = {...input};
    }

    protected async getNext(): Promise<IteratorResult<DynamoDbResultsPage>> {
        if (this.nextRequest) {
            const output = await this.client.query({
                ...this.nextRequest,
                Limit: this.getNextPageSize(this.nextRequest.Limit)
            });

            if (this.nextRequest && output.LastEvaluatedKey) {
                this.nextRequest = {
                    ...this.nextRequest,
                    ExclusiveStartKey: output.LastEvaluatedKey
                };
            } else {
                this.nextRequest = undefined;
            }

            return { value: output, done: false };
        }

        return {done: true} as IteratorResult<DynamoDbResultsPage>;
    }
}
