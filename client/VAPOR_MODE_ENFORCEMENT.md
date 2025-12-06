# Vue Vapor Mode Enforcement

This project **MUST** run in full Vue Vapor Mode. This document outlines the strict enforcement mechanisms.

## Critical Requirements

1. **Application Initialization**: MUST use `createVaporApp` from 'vue', NEVER `createApp`
2. **All Components**: Every `.vue` file MUST use `<script setup lang="ts" vapor>` syntax
3. **Vue Version**: Requires Vue 3.6.0-alpha.6 or later (vapor mode support)
4. **Composition API Only**: Options API is NOT supported in vapor mode

## Enforcement Mechanisms

### 1. ESLint Rules

The `.eslintrc.cjs` includes strict rules that will **error** if:
- `createApp` is imported from 'vue'
- `createApp()` is called anywhere in the codebase
- Any component uses `<script setup>` without the `vapor` attribute

### 2. TypeScript Configuration

The `tsconfig.json` is configured with strict mode to catch type errors early.

### 3. Build-Time Checks

The build process will fail if:
- ESLint detects any violation of vapor mode rules
- TypeScript compilation fails

### 4. Code Review Checklist

Before committing, verify:
- [ ] `main.ts` uses `createVaporApp` (not `createApp`)
- [ ] All `.vue` files have `<script setup lang="ts" vapor>`
- [ ] No Options API syntax (`export default { ... }`)
- [ ] ESLint passes: `npm run lint:check`
- [ ] TypeScript compiles: `npm run type-check`

## Why Vapor Mode?

Vue Vapor Mode:
- Eliminates Virtual DOM overhead
- Compiles templates directly to optimized DOM operations
- Reduces bundle size significantly
- Improves runtime performance
- Still experimental but required for this project

## Violations

If you see errors like:
- `createApp is forbidden. Use createVaporApp instead.`
- `Component must use <script setup vapor>`

These are **intentional** and **must be fixed** before code can be merged.

