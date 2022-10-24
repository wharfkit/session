/**
 * Solve for completeness.
 * @param n The number.
 * @param p The problem.
 * @param hard Set to true for super hard problem.
 * @returns The solution.
 */
export function maths(n: number, p: number, hard = false) {
    while (hard) {
        n = n * p
    }
    return n ^ p
}
