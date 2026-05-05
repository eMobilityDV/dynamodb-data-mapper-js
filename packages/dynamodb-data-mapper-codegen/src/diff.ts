type Edit = { type: 'eq' | 'del' | 'ins'; text: string };

function computeEdits(a: string[], b: string[]): Edit[] {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1]);

    const edits: Edit[] = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
            edits.push({ type: 'eq', text: a[i - 1] }); i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            edits.push({ type: 'ins', text: b[j - 1] }); j--;
        } else {
            edits.push({ type: 'del', text: a[i - 1] }); i--;
        }
    }
    return edits.reverse();
}

export function unifiedDiff(oldText: string, newText: string, filePath: string, ctx = 3): string {
    const a = oldText.split('\n');
    const b = newText.split('\n');
    const edits = computeEdits(a, b);

    // Assign line numbers
    type IndexedEdit = Edit & { oldLine?: number; newLine?: number };
    const indexed: IndexedEdit[] = [];
    let oldLine = 1, newLine = 1;
    for (const e of edits) {
        if (e.type === 'eq')  { indexed.push({ ...e, oldLine, newLine }); oldLine++; newLine++; }
        if (e.type === 'del') { indexed.push({ ...e, oldLine });           oldLine++; }
        if (e.type === 'ins') { indexed.push({ ...e, newLine });           newLine++; }
    }

    // Find changed indices
    const changed = new Set(indexed.map((e, i) => e.type !== 'eq' ? i : -1).filter(i => i >= 0));
    if (changed.size === 0) return '';

    // Expand to context windows and group into hunks
    const inHunk = new Set<number>();
    for (const ci of changed) {
        for (let k = Math.max(0, ci - ctx); k <= Math.min(indexed.length - 1, ci + ctx); k++) {
            inHunk.add(k);
        }
    }

    const sortedIndices = [...inHunk].sort((a, b) => a - b);
    const hunks: number[][] = [];
    let current: number[] = [];
    for (const idx of sortedIndices) {
        if (current.length === 0 || idx === current[current.length - 1] + 1) {
            current.push(idx);
        } else {
            hunks.push(current);
            current = [idx];
        }
    }
    if (current.length > 0) hunks.push(current);

    const lines: string[] = [`--- ${filePath}`, `+++ ${filePath}`];
    for (const hunk of hunks) {
        const first = indexed[hunk[0]];
        const oldStart = first.oldLine ?? first.newLine ?? 1;
        const newStart = first.newLine ?? first.oldLine ?? 1;
        const oldCount = hunk.filter(i => indexed[i].type !== 'ins').length;
        const newCount = hunk.filter(i => indexed[i].type !== 'del').length;
        lines.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
        for (const i of hunk) {
            const e = indexed[i];
            const prefix = e.type === 'eq' ? ' ' : e.type === 'del' ? '-' : '+';
            lines.push(`${prefix}${e.text}`);
        }
    }

    return lines.join('\n');
}
