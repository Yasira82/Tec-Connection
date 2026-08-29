// `server-only` has no runtime behaviour — importing it is a BUILD-time assertion
// that a module never reaches a client bundle. Next.js resolves it during a build;
// under Vitest there is no bundler to enforce it and no package to resolve, so the
// import is aliased to this empty module.
//
// The alias is deliberately narrow. Deleting the `import 'server-only'` lines
// instead would have made the tests pass too — and would have removed the one
// thing standing between INTERNAL_SECRET and a client component.
export {};
