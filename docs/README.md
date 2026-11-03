# Data map maintenance

`data-map.html` is the self-contained browser copy. Double-click it or open it
from the project README and bookmark the local page. It has no network resources
or data requests. Branch selection can be remembered in browser-local storage
where the browser permits it; the map works without that storage too.

`data-map.fragment.html` is the editable source for the inventory and interactive
diagram. The two files describe the same reviewed snapshot. They are not wired
to the running application's data or code, so updating one alone is insufficient.

When maintaining the map:

1. Inspect provider, normalization, storage, calculation and UI changes.
2. Update individual fields, source keys, display states, limitations and the
   review date in the fragment. Keep proposals distinct from implemented fields.
3. Regenerate the standalone export, keeping the styles and local state support
   embedded. Avoid references to machine-specific paths or chat-only actions.
4. Check branch selection, field search, field details, pan and zoom. Review both
   files in Git before committing. No personal handoff notes belong in the map.

The initial standalone export uses the same sandbox and state bridge as the
visualization export format, with only the styles and runtime needed by this
diagram. External icon/tooltip libraries are omitted because the map does not
use them. No live retrieval cycle is triggered by opening it.
