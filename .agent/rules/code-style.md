# Always-On Rule: Code Style and Quality Standards

1. **Backend Standards:**
   - Python 3.12 managed with `uv`.
   - Strict type hints on every function signature.
   - Fully asynchronous I/O (`async`/`await`) for database sessions and HTTP requests.
   - Structured logging with `structlog` (never bare `print()` statements in production code).
   - Clean linting with `ruff check` and formatting with `ruff format`.

2. **Frontend Standards:**
   - Next.js App Router with TypeScript in strict mode.
   - No implicit or explicit `any` types.
   - Tailwind CSS for all utility styling; avoid arbitrary inline styles.
   - State management partitioned clearly: TanStack Query for server state, Zustand for client UI state.

3. **Testing Standards:**
   - Pytest suite covering all services with golden mathematical tests.
   - Never remove or break existing unit tests when refactoring.
