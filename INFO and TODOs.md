# Info and Todos

Place to hold notes and future todos for the project.

# Status 07-04-2025

So it successfully writes to the workspaces.json and if immediately after the change I close and reopen the vault the workspace that wasn't loaded will be changed.

The workspace that was open is automatically saved.

I workaround would be to make a "Dummy" workspace active and move between spaces.



# Debounce info

TODO: need to add debounce to save calls likely.

seen in Workspaces Plus plugin here: 
https://github.com/jsmorabito/obsidian-workspaces-plus/blob/470fdda31aea2425af5f9d9af395df6e1dc80d38/src/main.ts#L277

I should clarify that `debounce` is **not** actually exported from the "obsidian" package. Obsidian doesn't provide a debounce utility in its API.

## What You'll Actually Need

**Option 1: Use Lodash (recommended)**
```typescript
import { debounce } from 'lodash';

// Usage in your plugin
const debouncedSearch = debounce((query: string) => {
    // Your search logic
}, 300);
```

**Option 2: Implement your own**
```typescript
function debounce<T extends (...args: any[]) => void>(
    func: T, 
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}
```

**Option 3: Use a dedicated utility library**
```bash
npm install debounce
```

## Common Obsidian Plugin Use Cases

**Debounced file watching:**
```typescript
const debouncedSave = debounce(async () => {
    await this.saveWorkspaces();
}, 500);

// Use when files change frequently
this.app.vault.on('modify', debouncedSave);
```

**Debounced search in your workspace UI:**
```typescript
const debouncedFilter = debounce((searchTerm: string) => {
    this.filterWorkspaces(searchTerm);
}, 200);

searchInput.addEventListener('input', (e) => {
    debouncedFilter(e.target.value);
});
```

## Package.json Setup

If using Lodash:
```json
{
  "dependencies": {
    "obsidian": "latest",
    "lodash": "^4.17.21"
  },
  "devDependencies": {
    "@types/lodash": "^4.14.195"
  }
}
```

The confusion might come from seeing `debounce` used in Obsidian plugin examples, but it's typically imported from a separate utility library, not from Obsidian itself.

**Debounce** is a programming technique that delays function execution until after a specified period of inactivity. It prevents a function from being called too frequently.

## How It Works

**Without debounce:**
- User types "hello" → 5 function calls (h, e, l, l, o)
- Function runs immediately on every keystroke

**With debounce (300ms delay):**
- User types "hello" → Only 1 function call
- Function waits 300ms after the last keystroke, then runs once

## Common Use Cases

**Search boxes:**
```javascript
// Without debounce - searches on every keystroke
input.addEventListener('input', searchFunction); // Bad!

// With debounce - searches only after user stops typing
input.addEventListener('input', debounce(searchFunction, 300));
```

**Window resize:**
```javascript
// Prevents layout recalculation on every pixel of resize
window.addEventListener('resize', debounce(handleResize, 250));
```

**API calls:**
- Prevents spam requests while user is still typing
- Reduces server load dramatically

## Simple Implementation

```javascript
function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}
```

## Real-World Example

**Search suggestions:**
- User types "java" quickly
- Without debounce: 4 API calls (j, ja, jav, java)
- With debounce: 1 API call (java) after they finish typing

**The key insight:** Debounce assumes the user's **final state** is what matters, not every intermediate step. It's perfect for scenarios where you only care about the end result after user activity settles down.