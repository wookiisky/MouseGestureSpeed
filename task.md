# Task Plan

## Phase 1: Foundation Setup
- Task: Initialize MV3 extension scaffold including manifest.json, base tsconfig/build tooling, and directory skeleton under src/common|content|background|options plus config/gestures.json.
  - Verification: Load the unpacked extension in Chrome and ensure service worker registration succeeds with no console errors.
- Task: Implement shared type definitions for gestures, actions, and configuration schema under src/common/types.
  - Verification: Run the TypeScript compiler to confirm types compile without errors.

## Phase 2: Common Utilities
- Task: Create logging utility in src/common/log.ts with module-prefixed info/error methods and log level control.
  - Verification: Add unit test that stubs console and asserts prefix formatting using npm test:common.
- Task: Implement messaging constants and helper wrappers in src/common/messaging.ts defining channels and payload typings.
  - Verification: Compile TypeScript and run unit test covering message factory functions.

## Phase 3: Configuration Services
- Task: Build ConfigStateService in src/common/config-state-service.ts to read/write chrome.storage sync/local with subscription support and logging.
  - Verification: Create unit tests using chrome-mock to simulate storage read/write success and failure paths.
- Task: Implement GestureConfigLoader in src/content/gesture-config-loader.ts combining default JSON with ConfigStateService responses.
  - Verification: Unit test loader merge strategy with mocked storage responses and schema validation errors.

## Phase 4: Gesture Detection Pipeline
- Task: Develop GestureTracker in src/content/gesture-tracker.ts handling pointer events, minimal gesture duration check (defaultDelay), direction normalization, and logging hooks.
  - Verification: Unit test direction extraction logic with synthetic pointer sequences and timer handling via fake timers.
- Task: Implement GestureInterpreter in src/content/gesture-interpreter.ts to match sequences against configuration with extensible strategies.
  - Verification: Unit test matching success/failure cases, including multi-step gestures and fallbacks.
- Task: Create ActionRouter in src/content/action-router.ts separating DOM actions (scroll, history, reload) from extension actions routed via MessagingChannel.
  - Verification: Unit test ensures DOM actions call window APIs and extension actions dispatch expected messages.

## Phase 5: Background Action Execution
- Task: Implement BackgroundActionExecutor in src/background/action-executor.ts to handle close tab and other extension actions with error logging.
  - Verification: Unit test executor with chrome.tabs mock verifying API calls and error handling behavior.
- Task: Wire background service worker entry point to initialize messaging listeners and preload configuration.
  - Verification: Integration test via chrome-extension-automated harness or manual devtools check confirming messages trigger actions.

## Phase 6: Cross-Context Messaging
- Task: Finalize MessagingChannel usage across content, background, and options scripts ensuring consistent payload contracts.
  - Verification: Unit test messaging helpers using mock ports plus integration smoke test sending gesture triggered payload.

## Phase 7: Options Page UI
- Task: Scaffold options page build (bundler entry, HTML, styling) and mount root component.
  - Verification: npm run build:options completes; manual load via chrome-extension options shows shell renders without errors.
- Task: Implement OptionsPageUI modules for gesture list, editor form, import/export, validation logic (src/options/*) with logging.
  - Verification: Component-level unit tests for validators and React component interactions using testing library.
- Task: Integrate ConfigStateService in options page to load, validate, save, import/export configurations and broadcast updates.
  - Verification: Manual QA in Chrome options page ensuring save propagates to content script (observe message logs) plus unit tests for storage adapters.

## Phase 8: End-to-End Validation
- Task: Package and run lint/test pipeline covering all modules (ESLint, TypeScript, Jest/Vitest) with CI script.
  - Verification: npm run lint && npm run test succeed locally.
- Task: Perform manual gesture walkthrough in Chrome verifying each default gesture action and logging output in content/background consoles.
  - Verification: Document results in QA checklist within repository (e.g., docs/qa.md) noting pass/fail status.

## Phase 9: Release Preparation
- Task: Update README with installation steps, configuration guidance, and testing instructions referencing modular architecture.
  - Verification: Markdown lint and manual review ensure links and commands are valid.
- Task: Create release notes summarizing features, tests performed, and known limitations for initial version tag.
  - Verification: Stakeholder review sign-off recorded in repo issue or docs/release-notes.md.
