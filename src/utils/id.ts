/**
 * Standard ID generation for the Nebula4X codebase.
 * Uses a combination of timestamp and random characters for collision resistance.
 */
export function generateId(prefix: string): string {
    const randomPart = Math.random().toString(36).substring(2, 9);
    const timePart = Date.now().toString(36);
    return `${prefix}_${timePart}_${randomPart}`;
}
