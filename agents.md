# Agents

This document defines how AI agents are built, behave, and integrate with BookApp. It covers Claude Code subagents used during development, custom agents being built into the app, and the patterns they follow.

---

## Claude Code Subagents (Development)

These agents are used during development via Claude Code. Each has a specific role — invoke the right one to get focused results.

| Agent | When to use |
|---|---|
| `Explore` | Locating files, finding symbols, answering "where is X defined?" — read-only searches |
| `Plan` | Designing implementation strategy before writing code — returns step-by-step plans |
| `general-purpose` | Multi-step research tasks, cross-file consistency checks, broad codebase analysis |
| `claude-code-guide` | Questions about Claude Code CLI, Claude API, or Anthropic SDK usage |

**Ground rules for subagents in this project:**
- Spawn `Explore` for any open-ended search that would take more than 3 Grep/Glob calls
- Use `Plan` before implementing features that touch multiple lib files or migrations
- Never delegate Supabase schema changes to subagents without reviewing the migration SQL yourself

---

## Custom Agents (In-App)

All in-app agents use the **Anthropic SDK** with **`claude-sonnet-4-6`** as the default model.

### Shared conventions

- Each agent is a single async function in `lib/agents/` that accepts typed input and returns typed output
- Agents call Supabase directly for reads; they never write to the database — mutations are handled by the caller
- Tool use follows the pattern: define tools as constants, pass to `client.messages.create`, handle `tool_use` blocks in a loop
- System prompts live in `lib/agents/prompts/` as template strings, not inline

### Book Recommendation Agent

**File:** `lib/agents/recommend.ts`

**Goal:** Suggest books tailored to the user's taste based on their library, ratings, and reading history.

**Inputs:**
- `userId` — used to fetch the user's rated and read books from Supabase (`user_books`, `books`)
- Optional: `mood` string or `genreFilter`

**Tools available to this agent:**
- `search_books` — queries the Hardcover API via `lib/discover.ts`
- `get_user_library` — reads `user_books` + `books` for the given user

**Behavior:**
1. Fetch the user's top-rated books (≥ 4 stars)
2. Identify patterns (genre, author, era)
3. Call `search_books` to find candidates
4. Return a ranked list with a short rationale per book

---

### Review / Summary Agent

**File:** `lib/agents/review.ts`

**Goal:** Generate or summarize book reviews — either drafting a review for the user or condensing community reviews.

**Inputs:**
- `bookId` — used to fetch the book's metadata and existing reviews
- `mode`: `"draft"` (write a review for the user) | `"summarize"` (condense existing reviews)

**For `"draft"` mode:**
- Takes the user's star rating and optional notes as seeds
- Returns a polished 2–4 sentence review in first person

**For `"summarize"` mode:**
- Reads reviews from Supabase (`authors` / `books` review fields)
- Returns a neutral 3–5 sentence summary highlighting consensus and outliers

**Constraints:** Never fabricate plot details. If source material is thin, say so rather than hallucinating.

---

### Reading List Curator Agent

**File:** `lib/agents/curator.ts`

**Goal:** Organize, prioritize, and suggest structure for a user's `want_to_read` list.

**Inputs:**
- `userId`
- Optional: `goal` string (e.g., "finish a series", "read more nonfiction this month")

**Tools available to this agent:**
- `get_want_to_read` — fetches `user_books` where `status = 'want_to_read'`
- `get_series_info` — checks `series` table to identify incomplete series

**Behavior:**
1. Fetch the full want-to-read list
2. Group by series, author, or genre
3. If a `goal` is provided, reorder to surface the most relevant books
4. Return an ordered list with grouping labels

---

### Social / Discussion Agent

**File:** `lib/agents/discussion.ts`

**Goal:** Facilitate book club discussions — generate prompts, moderate threads, or seed a post.

**Inputs:**
- `clubId` or `bookId`
- `mode`: `"prompts"` | `"seed_post"` | `"summary"`

**For `"prompts"` mode:**
- Returns 5–7 discussion questions appropriate for the book's genre and themes
- Avoids spoilers unless `spoilersOk: true` is passed

**For `"seed_post"` mode:**
- Drafts an opening club post to kick off discussion

**For `"summary"` mode:**
- Reads recent club posts from Supabase (`club_posts`, `club_comments`)
- Returns a 3–5 sentence recap of what members are saying

---

## Supabase Integration

Agents access Supabase via the existing client in `lib/supabase.ts`. Use the service role key only in Edge Functions — never in client-side agent code.

**Tables agents read:**
- `user_books` — reading status, ratings, dates
- `books` — metadata, Hardcover ID, series ID
- `authors` — author info linked to books
- `series` — series name and book order
- `club_posts`, `club_comments` — club discussion content
- `messages` — direct messages (discussion agent only, with user consent)

**Edge Functions** (`supabase/functions/`):
- `books/index.ts` — Hardcover API proxy; recommendation agent calls this
- `send-notification/index.ts` — push notifications; agents do not call this directly

---

## Adding a New Agent

1. Create `lib/agents/<name>.ts`
2. Add its system prompt to `lib/agents/prompts/<name>.ts`
3. Define input/output types in `lib/agents/types.ts`
4. If it needs new Supabase reads, add a helper in `lib/<domain>.ts` — keep DB logic out of agent files
5. Add an entry to this file under **Custom Agents**
