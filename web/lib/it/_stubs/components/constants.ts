// Stub for `@components/constants` — the only symbol the parser/utility pipeline
// pulls from here is `drawerPages`, used by `shouldDisplayDrawer()` in
// utility/helpers.js. That function is UI-only and never invoked from
// our drop-rate code path, so an empty array satisfies the import.
export const drawerPages: string[] = [];
