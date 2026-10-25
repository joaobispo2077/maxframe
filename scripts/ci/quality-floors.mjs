/**
 * Single source for quality floors.
 * vitest.config.ts imports the coverage minimums.
 * stryker.config.base.mjs imports the mutation break.
 * Raise a minimum only here. Lower a ceiling only here.
 *
 * Mutation break is 68. Stryker full run 39808689775 on develop at
 * 2318f38b tested all 1391 mutants with no cache and scored 69.59%.
 * The floor is that score rounded down, minus 1 point for timeout noise.
 */

export const COVERAGE_FLOORS = Object.freeze({
  statements: 74,
  branches: 63,
  functions: 81,
  lines: 75,
});

export const MUTATION_BREAK = 68;

/**
 * Max duplicated lines percent.
 * Measured 1.95 on develop and rounded up to one decimal.
 * This ceiling only moves down.
 */
export const DUPLICATION_CEILING = 2;

/** Max CRAP for a function that is not on the allowlist. Only moves down. */
export const CRAP_MAX = 30;

/** ESLint modified cyclomatic complexity max. Do not raise. */
export const COMPLEXITY_MAX = 12;

/**
 * High findings ceiling. The review measured 40 high on this tree.
 * The ceiling is 40 and only moves down. Any critical finding fails
 * on its own. There is no waiver for criticals.
 */
export const AUDIT_HIGH_MAX = 40;

/**
 * Package names resolved at more than one version.
 * Measured 134 on develop at eb4b007f from package-lock.json.
 * This ceiling only moves down.
 */
export const FIND_DUPES_MAX = 134;

/**
 * axe-core violation nodes on the built renderer.
 * Summed across analyze, analyze-results, queue, and settings.
 * Measured 4 critical and 1 serious on develop at e481844.
 * The scan waits out the 300ms reveal and forces reduced motion
 * so contrast is the settled color. These ceilings only move down.
 * Moderate and minor are reported and do not block.
 */
export const A11Y_CRITICAL_MAX = 4;
export const A11Y_SERIOUS_MAX = 1;

export const MUTATION_SURVIVOR_LIMIT = 10;

export const ELECTRON_SECURITY_FLOOR =
  'contextIsolation true, nodeIntegration false, sandbox true';

export function coverageFloorLabel(floors = COVERAGE_FLOORS) {
  return `statements ${floors.statements}, branches ${floors.branches}, functions ${floors.functions}, lines ${floors.lines}`;
}

export function mutationFloorLabel(floor = MUTATION_BREAK) {
  return `break ${floor}`;
}

export function complexityFloorLabel() {
  return `complexity <= ${COMPLEXITY_MAX}, CRAP <= ${CRAP_MAX}, 0 new over the line`;
}
