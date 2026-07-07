import { Link, createRouter } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultNotFoundComponent: NotFound,
    scrollRestoration: true,
  })
}

function NotFound() {
  return (
    <main className="main">
      <h1>Page not found</h1>
      <p>The admin dashboard only has one page.</p>
      <Link to="/">Back to dashboard</Link>
    </main>
  )
}
