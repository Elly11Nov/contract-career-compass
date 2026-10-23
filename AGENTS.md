<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep Job Search query scheduling in the browser-safe `jobDiscovery` module, alternating role families by country and rotating by Zurich calendar day, so offline tests exercise the exact production schedule.
- Keep Job Search duplicate comparisons in the shared `jobIdentity` module for engine and persistence; use verified company aliases, retain vacancy URL identifiers, and leave stored names and application statuses untouched.
