import { Project } from 'ts-morph';
import { ClassRegistryImpl } from './classRegistry';
import { FileRewriter } from './fileRewriter';
import { Migrator } from './migrator';
import { TypeMapper } from './typeMapper';

function createProject(files: Record<string, string>): Project {
    const project = new Project({
        useInMemoryFileSystem: true,
        compilerOptions: {
            strict: true,
            skipLibCheck: true,
            target: 7 /* ES2019 */,
            lib: ['lib.es2019.d.ts'],
        },
    });
    for (const [name, content] of Object.entries(files)) {
        project.createSourceFile(`/${name}`, content);
    }
    return project;
}

function migrate(files: Record<string, string>) {
    const project = createProject(files);
    const migrator = new Migrator({ patterns: [], cwd: '', dryRun: true });
    const result = migrator.run(project);
    const texts: Record<string, string> = {};
    for (const sf of project.getSourceFiles()) {
        texts[sf.getFilePath().replace(/^\//, '')] = sf.getFullText();
    }
    return { texts, warnings: result.warnings };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('DynamoDB decorator migration', () => {
    describe('primitive type mapping', () => {
        it('maps string', () => {
            const { texts } = migrate({
                'test.ts': `
class Foo { @attribute() name?: string; }
function attribute(p?: any) { return () => {}; }
`,
            });
            expect(texts['test.ts']).toContain("@attribute({ type: 'String' })");
        });

        it('maps number', () => {
            const { texts } = migrate({
                'test.ts': `
class Foo { @attribute() count?: number; }
function attribute(p?: any) { return () => {}; }
`,
            });
            expect(texts['test.ts']).toContain("@attribute({ type: 'Number' })");
        });

        it('maps boolean', () => {
            const { texts } = migrate({
                'test.ts': `
class Foo { @attribute() active?: boolean; }
function attribute(p?: any) { return () => {}; }
`,
            });
            expect(texts['test.ts']).toContain("@attribute({ type: 'Boolean' })");
        });

        it('maps Date', () => {
            const { texts } = migrate({
                'test.ts': `
class Foo { @attribute() createdAt?: Date; }
function attribute(p?: any) { return () => {}; }
`,
            });
            expect(texts['test.ts']).toContain("@attribute({ type: 'Date' })");
        });

        it('maps Uint8Array to Binary', () => {
            const { texts } = migrate({
                'test.ts': `
class Foo { @attribute() photo?: Uint8Array; }
function attribute(p?: any) { return () => {}; }
`,
            });
            expect(texts['test.ts']).toContain("@attribute({ type: 'Binary' })");
        });

        it('maps Float32Array to Binary', () => {
            const { texts } = migrate({
                'test.ts': `
class Foo { @attribute() data?: Float32Array; }
function attribute(p?: any) { return () => {}; }
`,
            });
            expect(texts['test.ts']).toContain("@attribute({ type: 'Binary' })");
        });

        it('strips optional union before mapping', () => {
            const { texts } = migrate({
                'test.ts': `
class Foo { @attribute() name?: string; }
function attribute(p?: any) { return () => {}; }
`,
            });
            expect(texts['test.ts']).toContain("type: 'String'");
        });
    });

    describe('Set type mapping', () => {
        it('maps Set<string> with memberType', () => {
            const { texts } = migrate({
                'test.ts': `
class Foo { @attribute() tags?: Set<string>; }
function attribute(p?: any) { return () => {}; }
`,
            });
            expect(texts['test.ts']).toContain("type: 'Set'");
            expect(texts['test.ts']).toContain("memberType: 'String'");
        });

        it('maps Set<number> with memberType', () => {
            const { texts } = migrate({
                'test.ts': `
class Foo { @attribute() scores?: Set<number>; }
function attribute(p?: any) { return () => {}; }
`,
            });
            expect(texts['test.ts']).toContain("type: 'Set'");
            expect(texts['test.ts']).toContain("memberType: 'Number'");
        });

        it('does not duplicate memberType when already present', () => {
            const { texts } = migrate({
                'test.ts': `
class Foo { @attribute({ memberType: 'String' }) tags?: Set<string>; }
function attribute(p?: any) { return () => {}; }
`,
            });
            expect(texts['test.ts']).toContain("type: 'Set'");
            const count = (texts['test.ts'].match(/memberType/g) ?? []).length;
            expect(count).toBe(1);
        });

        it('warns for Set<T> with non-scalar T', () => {
            const { warnings } = migrate({
                'test.ts': `
class Bar {}
class Foo { @attribute() items?: Set<Bar>; }
function attribute(p?: any) { return () => {}; }
`,
            });
            expect(warnings.some(w => w.includes('non-scalar'))).toBe(true);
        });
    });

    describe('enum type mapping', () => {
        it('maps string enum to String', () => {
            const { texts, warnings } = migrate({
                'test.ts': `
enum Status { Active = 'ACTIVE', Inactive = 'INACTIVE' }
class Foo { @attribute() status?: Status; }
function attribute(p?: any) { return () => {}; }
`,
            });
            expect(texts['test.ts']).toContain("@attribute({ type: 'String' })");
            expect(warnings.some(w => w.includes('cannot be mapped') || w.includes('Unrecognized'))).toBe(false);
        });

        it('maps numeric enum to Number', () => {
            const { texts, warnings } = migrate({
                'test.ts': `
enum Priority { Low = 1, Medium = 2, High = 3 }
class Foo { @attribute() priority?: Priority; }
function attribute(p?: any) { return () => {}; }
`,
            });
            expect(texts['test.ts']).toContain("@attribute({ type: 'Number' })");
            expect(warnings.some(w => w.includes('cannot be mapped') || w.includes('Unrecognized'))).toBe(false);
        });
    });

    describe('Record type mapping', () => {
        it('maps Record<string, string> to Map and warns', () => {
            const { texts, warnings } = migrate({
                'test.ts': `
class Foo { @attribute() meta?: Record<string, string>; }
function attribute(p?: any) { return () => {}; }
`,
            });
            expect(texts['test.ts']).toContain("type: 'Map'");
            expect(warnings.some(w => w.includes('memberType manually'))).toBe(true);
        });
    });

    describe('Map and Array', () => {
        it('adds type: Map for Map properties and warns', () => {
            const { texts, warnings } = migrate({
                'test.ts': `
class Foo { @attribute({ memberType: { type: 'String' } }) handles?: Map<string, string>; }
function attribute(p?: any) { return () => {}; }
`,
            });
            expect(texts['test.ts']).toContain("type: 'Map'");
            expect(warnings.some(w => w.includes('memberType manually'))).toBe(true);
        });

        it('adds type: List for Array<string>', () => {
            const { texts } = migrate({
                'test.ts': `
class Foo { @attribute() items?: Array<string>; }
function attribute(p?: any) { return () => {}; }
`,
            });
            expect(texts['test.ts']).toContain("type: 'List'");
            expect(texts['test.ts']).toContain("memberType: 'String'");
        });

        it('adds type: List when memberType already present for Array', () => {
            const { texts } = migrate({
                'test.ts': `
class Foo { @attribute({ memberType: { type: 'String' } }) corrections?: Array<string>; }
function attribute(p?: any) { return () => {}; }
`,
            });
            expect(texts['test.ts']).toContain("type: 'List'");
        });

        it('adds type: Collection for Array<complex T> and warns', () => {
            const { texts, warnings } = migrate({
                'test.ts': `
class Bar {}
class Foo { @attribute() items?: Array<Bar>; }
function attribute(p?: any) { return () => {}; }
`,
            });
            expect(texts['test.ts']).toContain("type: 'Collection'");
            expect(warnings.some(w => w.includes('memberType manually'))).toBe(true);
        });
    });

    describe('idempotency', () => {
        it('does not modify decorator arg that already has type (but adds @schema)', () => {
            const source = `
class Foo { @attribute({ type: 'String' }) name?: string; }
function attribute(p?: any) { return () => {}; }
`;
            const { texts } = migrate({ 'test.ts': source });
            // The explicit type is not changed — @schema() is added but decorator arg is preserved
            expect(texts['test.ts']).toContain("@attribute({ type: 'String' })");
            expect(texts['test.ts']).not.toContain("type: 'String', type:");
        });

        it('skips @versionAttribute', () => {
            const source = `
class Foo { @versionAttribute() version?: number; }
function versionAttribute() { return () => {}; }
`;
            const { texts } = migrate({ 'test.ts': source });
            expect(texts['test.ts']).toBe(source);
        });

        it('skips @autoGeneratedHashKey', () => {
            const source = `
class Foo { @autoGeneratedHashKey() id?: string; }
function autoGeneratedHashKey() { return () => {}; }
`;
            const { texts } = migrate({ 'test.ts': source });
            expect(texts['test.ts']).toBe(source);
        });

        it('warns for non-literal decorator arg and skips that arg', () => {
            const source = `
const opts = { type: 'String' };
class Foo { @attribute(opts) name?: string; }
function attribute(p?: any) { return () => {}; }
`;
            const { texts, warnings } = migrate({ 'test.ts': source });
            // The non-literal arg is left unchanged
            expect(texts['test.ts']).toContain('@attribute(opts)');
            expect(warnings.some(w => w.includes('non-literal'))).toBe(true);
        });
    });

    describe('typeOverrides', () => {
        it('uses override for unrecognized type', () => {
            const project = createProject({
                'test.ts': `
interface Foo { x: string }
class Bar { @attribute() foo?: Foo; }
function attribute(p?: any) { return () => {}; }
`,
            });
            const migrator = new Migrator({ patterns: [], cwd: '', dryRun: true, typeOverrides: { 'Foo | undefined': 'String' } });
            const result = migrator.run(project);
            const text = project.getSourceFileOrThrow('/test.ts').getFullText();
            expect(text).toContain("type: 'String'");
            expect(result.warnings.some(w => w.includes('Unrecognized'))).toBe(false);
        });

        it('scan returns unresolved fields', () => {
            const project = createProject({
                'test.ts': `
interface Foo { x: string }
class Bar { @attribute() foo?: Foo; }
function attribute(p?: any) { return () => {}; }
`,
            });
            const migrator = new Migrator({ patterns: [], cwd: '', dryRun: true });
            const unresolved = migrator.scan(project);
            expect(unresolved.length).toBe(1);
            expect(unresolved[0].line).toBe(3);
        });
    });

    describe('@hashKey / @rangeKey', () => {
        it('adds type to @hashKey()', () => {
            const { texts } = migrate({
                'test.ts': `
class Foo { @hashKey() id?: string; }
function hashKey(p?: any) { return () => {}; }
`,
            });
            expect(texts['test.ts']).toContain("@hashKey({ type: 'String' })");
        });

        it('adds type to @rangeKey()', () => {
            const { texts } = migrate({
                'test.ts': `
class Foo { @rangeKey() createdAt?: Date; }
function rangeKey(p?: any) { return () => {}; }
`,
            });
            expect(texts['test.ts']).toContain("@rangeKey({ type: 'Date' })");
        });
    });

    describe('Document type', () => {
        it('maps class reference to Document type with valueConstructor', () => {
            const { texts } = migrate({
                'test.ts': `
function attribute(p?: any) { return () => {}; }
class Author { @attribute() name?: string; }
class Post { @attribute() author?: Author; }
`,
            });
            expect(texts['test.ts']).toContain("type: 'Document'");
            expect(texts['test.ts']).toContain('valueConstructor: Author');
        });

        it('injects @schema() on embedded class without @table or @schema', () => {
            const { texts } = migrate({
                'test.ts': `
function attribute(p?: any) { return () => {}; }
function schema() { return () => {}; }
class Author { @attribute() name?: string; }
class Post { @attribute() author?: Author; }
`,
            });
            expect(texts['test.ts']).toContain('@schema()');
        });

        it('recognizes nested class from out-of-glob file as Document', () => {
            const project = createProject({
                'nested.ts': `
function attribute(p?: any) { return () => {}; }
export class Address { @attribute() street?: string; }
`,
                'root.ts': `
import { Address } from './nested';
function attribute(p?: any) { return () => {}; }
export class Person { @attribute() address?: Address; }
`,
            });

            // Simulate: only root.ts matched the glob; nested.ts is in the compiler but not in registry
            const rootFile = project.getSourceFileOrThrow('/root.ts');
            const registry = new ClassRegistryImpl([rootFile]);
            const fileRewriter = new FileRewriter(new TypeMapper(registry));
            fileRewriter.rewrite(rootFile);

            expect(rootFile.getFullText()).toContain("type: 'Document'");
            expect(rootFile.getFullText()).toContain('valueConstructor: Address');
        });

        it('does not inject @schema() on class already decorated with @table', () => {
            const { texts } = migrate({
                'test.ts': `
function attribute(p?: any) { return () => {}; }
function table(name: string) { return () => {}; }
@table('Authors')
class Author { @attribute() name?: string; }
class Post { @attribute() author?: Author; }
`,
            });
            const tableCount = (texts['test.ts'].match(/@table\(/g) ?? []).length;
            expect(tableCount).toBe(1);
        });
    });
});
