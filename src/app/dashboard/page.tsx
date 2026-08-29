import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { logoutAction } from "@/app/auth/actions"
import { SellerPortal } from "./seller-portal"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?next=/dashboard")
  }

  const provider = user.app_metadata?.provider ?? "email"
  const createdAt = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Recently"

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0d1c2d] flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-[#eef4ff] sticky top-0 z-40 shadow-xs">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/home" className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0d1c2d]">MenuHub</h1>
            <span className="text-[11px] font-semibold text-[#00714d] bg-[#eef4ff] px-2.5 py-0.5 rounded-full border border-[#ccdbf2]">
              User Portal
            </span>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/home"
              className="text-xs sm:text-sm font-semibold text-[#45464d] hover:text-[#006c49] transition-colors"
            >
              Browse Menus
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="bg-[#fee2e2] hover:bg-[#fecaca] text-[#b91c1c] text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl transition-all"
              >
                Log Out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-8">
        {/* Welcome Header */}
        <div className="bg-white border border-[#eef4ff] rounded-2xl p-6 sm:p-8 mb-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#eef4ff] text-[#00714d] rounded-full text-xs font-semibold mb-2">
                <span>●</span>
                <span>Active Session</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0d1c2d]">
                Welcome, {user.email?.split("@")[0]}!
              </h2>
              <p className="text-xs sm:text-sm text-[#76777d] mt-1">
                You are logged in via{" "}
                <span className="font-semibold text-[#0d1c2d] capitalize">{provider}</span>
              </p>
            </div>

            <Link
              href="/home"
              className="bg-[#006c49] hover:bg-[#005236] text-white text-xs sm:text-sm font-semibold px-5 py-3 rounded-xl transition-all shadow-xs inline-flex items-center justify-center gap-2 self-start sm:self-auto"
            >
              <span>Explore Stores & Catalogs</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* Become a Seller & Studio Management Component */}
        <SellerPortal user={user} />

        {/* Profile & Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1: Account Info */}
          <div className="bg-white border border-[#eef4ff] rounded-2xl p-6 shadow-xs">
            <div className="w-10 h-10 bg-[#eef4ff] text-[#006c49] rounded-xl flex items-center justify-center text-lg mb-4">
              👤
            </div>
            <h3 className="text-sm font-bold text-[#0d1c2d] mb-1">Account Details</h3>
            <p className="text-xs text-[#76777d] mb-4">Your verified profile information</p>

            <div className="space-y-2 text-xs border-t border-[#eef4ff] pt-3">
              <div className="flex justify-between">
                <span className="text-[#76777d]">Email:</span>
                <span className="font-medium text-[#0d1c2d] truncate max-w-[180px]">{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#76777d]">Auth Provider:</span>
                <span className="font-semibold text-[#00714d] capitalize">{provider}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#76777d]">Member Since:</span>
                <span className="text-[#0d1c2d]">{createdAt}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Saved Orders */}
          <div className="bg-white border border-[#eef4ff] rounded-2xl p-6 shadow-xs">
            <div className="w-10 h-10 bg-[#eef4ff] text-[#006c49] rounded-xl flex items-center justify-center text-lg mb-4">
              🛒
            </div>
            <h3 className="text-sm font-bold text-[#0d1c2d] mb-1">Recent Orders</h3>
            <p className="text-xs text-[#76777d] mb-4">Track your store orders & purchases</p>

            <div className="bg-[#f8f9ff] border border-[#eef4ff] rounded-xl p-4 text-center">
              <p className="text-xs text-[#76777d]">No active orders placed yet</p>
              <Link
                href="/home"
                className="text-xs font-semibold text-[#006c49] hover:underline mt-1.5 inline-block"
              >
                Browse stores & catalogs →
              </Link>
            </div>
          </div>

          {/* Card 3: Security */}
          <div className="bg-white border border-[#eef4ff] rounded-2xl p-6 shadow-xs">
            <div className="w-10 h-10 bg-[#eef4ff] text-[#006c49] rounded-xl flex items-center justify-center text-lg mb-4">
              ??
            </div>
            <h3 className="text-sm font-bold text-[#0d1c2d] mb-1">Security & Session</h3>
            <p className="text-xs text-[#76777d] mb-4">Supabase authenticated session</p>

            <div className="space-y-2 text-xs border-t border-[#eef4ff] pt-3">
              <div className="flex justify-between">
                <span className="text-[#76777d]">Session Status:</span>
                <span className="font-semibold text-[#00714d]">Active & Secured</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#76777d]">User ID:</span>
                <span className="font-mono text-[10px] text-[#76777d] truncate max-w-[140px]">
                  {user.id}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
