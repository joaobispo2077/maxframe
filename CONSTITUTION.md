# Maxframe Constitution

## Purpose

This constitution defines non-negotiable engineering principles for Maxframe.
All implementation and review decisions must align with this document.

## Core Principles

1. Clean Architecture First

- Keep business rules inside `src/domain` and `src/application`.
- Treat frameworks and tools (Electron, React, axios, ffmpeg) as replaceable outer details.
- Enforce inward dependency direction:
  - `interface -> application -> domain`
  - `infrastructure -> application -> domain`

2. Functional Programming by Default

- Prefer pure functions for domain and application logic.
- Prefer immutable data and return new values instead of mutating inputs.
- Keep side effects at system boundaries (IPC handlers, filesystem, process execution, HTTP).
- Compose behavior from small functions with clear contracts.
- Avoid hidden state and temporal coupling in business logic.

3. Clean Code and Readability

- Use intention-revealing names.
- Keep functions small and focused on one reason to change.
- Make invalid states explicit with clear domain types and guards.
- Replace magic values with named constants and types.

4. Honest Product Behavior

- Never misrepresent quality availability or download outcome.
- Always expose real, source-derived quality information.
- If data is uncertain, surface uncertainty explicitly instead of guessing.

5. Test-Driven Quality Gates

- Follow Red -> Green -> Refactor for core logic.
- Unit tests protect domain policies and use-case behavior.
- Mutation testing is required to validate test strength for critical logic.
- E2E tests validate user-facing truthfulness and integration flow.

## Required Coding Rules

- Domain code must be framework-agnostic.
- Application use cases must depend on ports, never concrete adapters.
- Adapters may transform data, but cannot own business policy.
- Error messages returned to UI must be explicit and user-safe.
- New behavior must include tests at the appropriate layer.

## Decision Priority

When principles conflict, prioritize in this order:

1. Product honesty
2. Architectural boundaries
3. Functional purity in core logic
4. Readability and simplicity
5. Performance optimization
