/**
 * Dashboard layout — wraps authenticated app pages.
 * Sidebar, top nav, and other authenticated chrome will live here.
 */
export default function DashboardLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="relative flex min-h-screen">
      {/* Sidebar and authenticated nav will be added here */}
      <div className="flex flex-1 flex-col">
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
