
export interface DiffLine {
    type: 'added' | 'removed' | 'unchanged';
    content: string;
}

/**
 * Computes a simple line-based diff between two text strings.
 * Returns an array of DiffLine objects.
 */
export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const diff: DiffLine[] = [];

    let i = 0;
    let j = 0;

    while (i < oldLines.length || j < newLines.length) {
        const oldLine = oldLines[i];
        const newLine = newLines[j];

        if (oldLine === newLine) {
            diff.push({ type: 'unchanged', content: oldLine });
            i++;
            j++;
        } else {
            // Check for potential insertions/deletions lookahead
            // Simple heuristic matches: look ahead up to 3 lines
            let foundMatch = false;

            // Look for oldLine in future newLines (Insertion)
            for (let k = 1; k <= 5; k++) {
                if (j + k < newLines.length && oldLines[i] === newLines[j + k]) {
                    // Lines between j and j+k are insertions
                    for (let m = 0; m < k; m++) {
                        diff.push({ type: 'added', content: newLines[j + m] });
                    }
                    j += k;
                    foundMatch = true;
                    break;
                }
            }

            if (!foundMatch) {
                // Look for newLine in future oldLines (Deletion)
                for (let k = 1; k <= 5; k++) {
                    if (i + k < oldLines.length && newLines[j] === oldLines[i + k]) {
                        // Lines between i and i+k are deletions
                        for (let m = 0; m < k; m++) {
                            diff.push({ type: 'removed', content: oldLines[i + m] });
                        }
                        i += k;
                        foundMatch = true;
                        break;
                    }
                }
            }

            if (!foundMatch) {
                // Modified line (treat as remove + add)
                if (i < oldLines.length) {
                    diff.push({ type: 'removed', content: oldLines[i] });
                    i++;
                }
                if (j < newLines.length) {
                    diff.push({ type: 'added', content: newLines[j] });
                    j++;
                }
            }
        }
    }

    return diff;
}
