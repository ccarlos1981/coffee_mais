---
project_name: 'Coffee Mais'
user_name: 'Cristiano'
date: '2026-04-11'
sections_completed:
  ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 15
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Framework**: Next.js v16.2.2 (App Router)
- **UI & Components**: React & React DOM v19.2.4
- **Styling**: Tailwind CSS v4 (using @tailwindcss/postcss)
- **Database & Auth**: Supabase via `@supabase/supabase-js v2.102.1`
- **Data Visualization**: Recharts v3.8.1
- **Utilities**: date-fns v4.1.0, xlsx v0.18.5, lucide-react v1.7.0
- **Language**: TypeScript v5 (Strict Mode), ESLint v9

## Critical Implementation Rules

### Language-Specific Rules

- **Strict Type Checking**: TypeScript strict mode is enforced. The use of `any` is strictly prohibited to keep zero linting/build warnings.
- **Catch Block Error Handling**: All `catch` blocks must type the error as `unknown` rather than `any`, using type guards to extract messages: `catch (error: unknown) { const msg = error instanceof Error ? error.message : String(error); }`
- **Data Casting**: When casting data from external libraries (like Supabase `GenericStringError`) into stricter arrays, explicitly cast through `unknown` first: `(data as unknown as SpecificInterface[])`.

### Framework-Specific Rules

- **Next.js 15+ Async Params**: API routes and page components handling dynamic properties must treat `params` and `searchParams` as Promises. Always `await` them before access (e.g., `const { id } = await params;`).
- **Dashboard API Caching**: To prevent excessive hits to Supabase for historical metrics, always leverage the robust in-memory `API_CACHE` (`const API_CACHE = new Map<string, { timestamp: number; data: unknown }>();`) pattern established at the top of `/api/dashboard/*` routes for large aggregate queries.
- **Recharts Tooltips & Labels**: Do not hardcode type constraints directly into inline formatter callbacks inside `Tooltip` or `LabelList` components (e.g. avoid `formatter={(val: number) => ...}`). Let the parameters implicitly adopt the `RenderableText` / `undefined` types passed natively by Recharts to prevent TS compiler crashes.

### Testing Rules

- **Testing Framework**: No formal testing framework (Jest/Vitest/Playwright) is currently implemented.

### Code Quality & Style Rules

- **Linting & Formatting**: Follow warnings provided by ESLint strictly. Avoid global CSS tricks and inline-styles unless dynamically calculated; rely entirely on CSS Utility Classes via Tailwind CSS v4 to style components.
- **Project Structure**:
  - `src/app/` is reserved strictly for Next.js App Router conventions (API, `page.tsx`, `layout.tsx`).
  - `src/components/` is for shared, reusable React UI elements and generic structures.
  - `src/lib/` is for pure functions, standard business logic, formatters, calculators, and database initializations (e.g., Supabase clients).

### Development Workflow Rules

- **AI-Assisted Development**: Follow strict separation between the main Next.js App (`src/`) and standalone migration/maintenance scripts. Standalone backend scripts (like `.py` or `.js` database fixers) must be run from the project root and ideally documented or ignored in Git if they contain sensitive data.
- **Git Hygiene**: When introducing new AI Agent artifacts folders or local backup directories, ensure `.gitignore` always includes them to prevent corrupting the `main` branch remote.

### Critical Don't-Miss Rules

- **Strict Casting over `any`**: Although `any` is prohibited, blindly using double casting (`data as unknown as SpecificInterface`) without runtime data validation is equally dangerous. Always ensure properties actually exist at runtime to avoid fatal crashes when database shapes evolve invisibly.
- **Vercel Serverless Memory/Caching Limits**: Using `API_CACHE` (like maps/objects in memory) prevents hitting Supabase thousands of times, but remember that Vercel Serverless Functions have tight memory bounds. Heavy API caching logic MUST implement a TTL (Time To Live) or explicit clearing mechanism so it doesn't cause Out of Memory errors during prolonged admin usage sessions.
- **Data Poisoning & Recharts Crashes**: Recharts crashes completely if fed strings where numbers are expected or invalid JS `Date` objects. All Excel/CSV bulk import scripts must aggressively sanitize data (removing monetary symbols, resolving NaN gracefully, validating date lengths) *before* attempting database insertions.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-04-11
