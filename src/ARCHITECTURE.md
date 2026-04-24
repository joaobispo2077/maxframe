# Maxframe Architecture (Root `src`)

Maxframe uses a normal root `src/` folder for core application code.

Electron is an accepted platform dependency and acts as an outer adapter boundary.

## Layer Layout

- `src/domain`: pure business rules and policies
- `src/application`: use cases and ports
- `src/infrastructure`: implementations for external tools/services (ffmpeg, axios, filesystem)
- `src/interface`: adapters for delivery mechanisms (Electron IPC, UI mappers)
- `src/shared`: cross-layer primitives and shared contracts

## Dependency Rule

Allowed direction is inward:

`interface -> application -> domain`  
`infrastructure -> application -> domain`

Disallowed:

- `domain` importing from any outer layer
- `application` importing from `interface` or `infrastructure`

## Electron Boundary

- Electron `main` + `preload` remain platform adapters.
- They call into `src/interface`/`src/application` and do not own core business policy.
- Renderer UI stays framework-specific, but app rules remain in `src/domain` and `src/application`.
