#!/usr/bin/env node

import { Command } from 'commander';
import { unifiedDiff } from './diff';
import { Migrator } from './migrator';

async function runMigration(patterns: string[], opts: { dryRun: boolean }): Promise<void> {
    const migrator = new Migrator({ patterns, cwd: process.cwd(), dryRun: opts.dryRun });

    const unresolved = migrator.scan();
    if (unresolved.length > 0) {
        for (const field of unresolved) {
            const short = field.filePath.split('/').slice(-1)[0];
            process.stderr.write(
                `[ERROR] ${short}:${field.line}: cannot map type '${field.typeText}'\n` +
                `  Create a @schema-decorated class for this type and use it as the field type, then re-run.\n`,
            );
        }
        process.exit(1);
    }

    const result = migrator.run();

    for (const w of result.warnings) {
        process.stderr.write(`[WARN] ${w}\n`);
    }

    for (const change of result.changes) {
        if (opts.dryRun) {
            process.stdout.write(`[DRY-RUN] Would modify: ${change.filePath}\n`);
            process.stdout.write(unifiedDiff(change.originalText, change.newText, change.filePath) + '\n');
        } else {
            process.stdout.write(`[MODIFIED] ${change.filePath}\n`);
        }
    }

    if (opts.dryRun && result.changes.length > 0) {
        process.exit(1);
    }
}

const program = new Command();

program
    .name('dynamodb-data-mapper-codegen')
    .description('Codemod tool for DynamoDB Data Mapper TypeScript migrations');

const migrate = program
    .command('migrate')
    .description('Run a migration by type');

migrate
    .command('explicit-types <patterns...>')
    .description('Add explicit type arguments to DynamoDB property decorators for TypeScript 5 compatibility')
    .option('--dry-run', 'Report changes without writing files', false)
    .action((patterns: string[], opts: { dryRun: boolean }) => runMigration(patterns, opts));

program.parseAsync(process.argv);
