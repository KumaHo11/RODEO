import { redirect } from 'next/navigation'

// The middleware handles auth routing, but this is a fallback for the root.
// Most users will be redirected before this renders.
export default function RootPage() {
  redirect('/login')
}
