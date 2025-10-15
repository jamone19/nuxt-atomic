
# Architecture Overview

```
Client
  | POST /api/atomic/<Transaction>
  v
Atomic Handler (Nitro/H3)
  - Load tx definition (#build/atomic/transactions.mjs)
  - For step in order:
      - Hydrate input (userland module)
      - Execute HTTP call
      - Accumulate success list
    on Error:
      - Reverse iterate success list and call rollback
      - Return failedStep + rollback report
  - Log every action to JSONL file
  - Return final JSON
```

- Module registers:
  - Dynamic route `baseRoute/:name`
  - Named routes for each declared transaction
- Virtual module contains only serializable definitions (functions are referenced by path strings), so it is safe for build-time.
