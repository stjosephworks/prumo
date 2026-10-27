// Going to another page is a page load: each page is built on its own and mounts its own islands. One object, so a
// test can watch where the app would go, which jsdom cannot do for window.location.
export const navigate = {
  to: (url: string) => window.location.assign(url),
  replace: (url: string) => window.location.replace(url),
}
