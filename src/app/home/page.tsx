"use client"

import { useState, useMemo, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { type User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { getStores, getMenuItems } from "@/lib/store-data"
import { Store, StoreMenuItem } from "@/lib/seller-types"

interface CartItem {
  item: StoreMenuItem
  quantity: number
}

const CATEGORY_PILLS = [
  { name: "All", icon: "🎯" },
  { name: "Clothing & Fashion", icon: "👗" },
  { name: "Groceries & Supermarket", icon: "🛒" },
  { name: "Cafes & Bakery", icon: "☕" },
  { name: "Restaurants & Dining", icon: "🍽️" },
  { name: "Electronics & Gadgets", icon: "📱" },
  { name: "Beauty & Cosmetics", icon: "💄" },
  { name: "Health & Wellness", icon: "🌿" },
  { name: "Home & Living", icon: "🏠" },
  { name: "Books & Stationery", icon: "📚" },
  { name: "Pet Supplies", icon: "🐾" },
  { name: "Sports & Fitness", icon: "⚽" },
]

export default function MenuHubScreen() {
  const [stores, setStores] = useState<Store[]>([])
  const [selectedCategoryPill, setSelectedCategoryPill] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeRestaurant, setActiveRestaurant] = useState<Store | null>(null)
  const [storeDishes, setStoreDishes] = useState<StoreMenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [supabaseStatus, setSupabaseStatus] = useState<string>("Checking...")

  // Load stores from Supabase
  useEffect(() => {
    const loadStores = async () => {
      const loadedStores = await getStores()
      setStores(loadedStores)
    }
    loadStores()
  }, [])

  // When active restaurant changes, load its dishes from Supabase
  useEffect(() => {
    const loadDishes = async () => {
      if (activeRestaurant) {
        const items = await getMenuItems(activeRestaurant.id)
        setStoreDishes(items)
      } else {
        setStoreDishes([])
      }
    }
    loadDishes()
  }, [activeRestaurant])

  // Verify Supabase integration & load authenticated user
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const supabase = createClient()
        if (supabase) {
          setSupabaseStatus("Supabase Connected")
          const { data: { user: currentUser } } = await supabase.auth.getUser()
          setUser(currentUser)

          const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
          })

          return () => {
            subscription.unsubscribe()
          }
        }
      } catch {
        setSupabaseStatus("Local Mode")
      }
    }
    checkConnection()
  }, [])

  // Filter stores by search and category pill
  const filteredRestaurants = useMemo(() => {
    return stores.filter((rest) => {
      const matchesCategory =
        selectedCategoryPill === "All" ||
        rest.category.toLowerCase().includes(selectedCategoryPill.toLowerCase()) ||
        selectedCategoryPill.toLowerCase().includes(rest.category.toLowerCase())
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        rest.name.toLowerCase().includes(q) ||
        rest.cuisine.toLowerCase().includes(q) ||
        rest.category.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }, [stores, selectedCategoryPill, searchQuery])

  // Cart helper actions
  const handleAddToCart = (item: StoreMenuItem) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id)
      if (existing) {
        return prev.map((ci) =>
          ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        )
      }
      return [...prev, { item, quantity: 1 }]
    })
  }

  const handleRemoveFromCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.item.id === itemId)
      if (existing && existing.quantity > 1) {
        return prev.map((ci) =>
          ci.item.id === itemId ? { ...ci, quantity: ci.quantity - 1 } : ci
        )
      }
      return prev.filter((ci) => ci.item.id !== itemId)
    })
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
  }

  const totalItemCount = cart.reduce((sum, ci) => sum + ci.quantity, 0)
  const cartSubtotal = cart.reduce(
    (sum, ci) => sum + ci.item.price * ci.quantity,
    0
  )

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0d1c2d] flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-[#eef4ff] sticky top-0 z-40 shadow-xs">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => setActiveRestaurant(null)}
          >
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0d1c2d]">MenuHub</h1>
            <span className="text-[11px] font-semibold text-[#00714d] bg-[#eef4ff] px-2.5 py-0.5 rounded-full border border-[#ccdbf2]">
              Stores & Catalogs
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Supabase status indicator */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#76777d]">
              <span className="w-2 h-2 rounded-full bg-[#006c49]"></span>
              <span>{supabaseStatus}</span>
            </div>

            {/* Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-[#0d1c2d] hover:bg-[#f8f9ff] rounded-xl transition-colors"
              title="Shopping Cart"
            >
              <span className="text-lg">🛒</span>
              {totalItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#006c49] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {totalItemCount}
                </span>
              )}
            </button>

            {/* Auth Buttons */}
            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard"
                  className="bg-[#006c49] text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#005236] transition-all shadow-xs"
                >
                  Seller Studio
                </Link>
                <button
                  onClick={handleSignOut}
                  className="bg-[#f8f9ff] hover:bg-[#eef4ff] text-[#0d1c2d] text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl transition-all border border-[#ccdbf2]"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="bg-[#006c49] text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#005236] transition-all shadow-xs"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  className="hidden sm:inline-block bg-[#f8f9ff] hover:bg-[#eef4ff] text-[#0d1c2d] text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl transition-all border border-[#ccdbf2]"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {!activeRestaurant ? (
        <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-8">
          {/* Hero Banner with Search and Categories */}
          <div className="bg-white border border-[#eef4ff] rounded-2xl p-6 sm:p-8 mb-8 shadow-xs">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0d1c2d]">
              Explore Stores, Boutiques & Digital Menus
            </h2>
            <p className="text-xs sm:text-sm text-[#76777d] mt-1">
              Discover fashion boutiques, organic grocery markets, specialty cafes, tech hubs, and gourmet dining.
            </p>

            {/* Search Input */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#76777d]">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Search stores, fashion, groceries, cafes, gadgets, beauty..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-10 pr-10 bg-[#f8f9ff] border border-[#eef4ff] rounded-xl text-sm text-[#0d1c2d] placeholder-[#76777d] focus:outline-none focus:border-[#006c49] focus:bg-white transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-[#76777d]"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2.5 mt-5 overflow-x-auto pb-1 scrollbar-none">
              {CATEGORY_PILLS.map((pill) => {
                const isActive = selectedCategoryPill === pill.name
                return (
                  <button
                    key={pill.name}
                    onClick={() => setSelectedCategoryPill(pill.name)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${isActive
                        ? "bg-[#006c49] text-white shadow-xs"
                        : "bg-[#eef4ff] hover:bg-[#dbe9ff] text-[#0d1c2d]"
                      }`}
                  >
                    <span>{pill.icon}</span>
                    <span>{pill.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Store Cards Grid — Compact Taobao-style */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-12">
            {filteredRestaurants.map((rest) => (
              <div
                key={rest.id}
                onClick={() => setActiveRestaurant(rest)}
                className="bg-white rounded-xl border border-[#eef4ff] overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer group"
              >
                {/* Card Image - Square Frame with Full Image */}
                <div className="relative aspect-square w-full bg-[#f4f7fc] overflow-hidden flex items-center justify-center">
                  <Image
                    src={rest.image}
                    alt={rest.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-contain p-1.5 group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Category Badge */}
                  <div className="absolute top-1.5 left-1.5 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md flex items-center gap-1 text-[10px] font-bold shadow-xs">
                    <span>{rest.badgeIcon}</span>
                    <span className="text-[#0d1c2d] hidden sm:inline">{rest.category}</span>
                  </div>

                  {/* Rating */}
                  <div className="absolute bottom-1.5 right-1.5 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md text-[10px] font-bold text-[#0d1c2d] shadow-xs flex items-center gap-0.5">
                    <span className="text-[#006c49]">★</span>
                    <span>{rest.rating}</span>
                  </div>
                </div>

                {/* Card Info */}
                <div className="p-2.5 sm:p-3">
                  <h3 className="text-xs sm:text-sm font-bold text-[#0d1c2d] leading-tight line-clamp-1">
                    {rest.name}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-[#76777d] mt-0.5 line-clamp-1">
                    {rest.cuisine} · {rest.priceRange}
                  </p>
                  <div className="mt-2 bg-[#eef4ff] hover:bg-[#dbe9ff] text-[#00714d] font-semibold text-[10px] sm:text-[11px] py-1.5 rounded-lg flex items-center justify-center gap-1 transition-all">
                    <span>View Store</span>
                    <span>→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      ) : (
        /* Store View when Clicking Explore Store */
        <main className="flex-1 max-w-[1200px] w-full mx-auto px-3 sm:px-6 py-5 sm:py-8">
          {/* Store Header Banner */}
          <div className="bg-white border border-[#eef4ff] rounded-2xl p-4 sm:p-6 mb-6 shadow-xs">
            {/* Back Button */}
            <button
              onClick={() => setActiveRestaurant(null)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#006c49] hover:text-[#005236] bg-[#eef4ff] hover:bg-[#dbe9ff] px-3 py-1.5 rounded-lg mb-3 transition-all"
            >
              <span>←</span>
              <span>Back to All Stores</span>
            </button>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="bg-[#006c49] text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full">
                    ★ {activeRestaurant.rating} ({activeRestaurant.reviewsCount}+)
                  </span>
                  <span className="text-[10px] sm:text-xs font-semibold text-[#00714d] bg-[#eef4ff] px-2 py-0.5 rounded-full">
                    {activeRestaurant.badgeIcon} {activeRestaurant.category}
                  </span>
                  <span className="text-[10px] sm:text-xs font-medium text-[#76777d]">
                    {activeRestaurant.cuisine} · {activeRestaurant.priceRange}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0d1c2d] mt-1.5">
                  {activeRestaurant.name}
                </h2>
                <p className="text-xs text-[#76777d] mt-0.5">
                  {activeRestaurant.description || "Digital Catalog & Live Ordering"}
                </p>
              </div>

              <button
                onClick={() => setIsCartOpen(true)}
                className="bg-[#006c49] hover:bg-[#005236] text-white px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm flex items-center gap-2 self-start sm:self-auto shadow-xs shrink-0"
              >
                <span>🛒 View Bag ({totalItemCount})</span>
              </button>
            </div>
          </div>

          {/* Products / Items Grid — Compact Taobao-style 2-column mobile */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-12">
            {storeDishes.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-[#eef4ff] shadow-xs">
                <p className="text-xs sm:text-sm text-[#76777d]">No items listed in this store catalog yet.</p>
                <Link
                  href="/dashboard"
                  className="inline-block mt-2 text-xs font-semibold text-[#006c49] hover:underline"
                >
                  Manage store items in Seller Studio →
                </Link>
              </div>
            ) : (
              storeDishes.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-[#eef4ff] overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
                >
                  <div>
                    {/* Compact Square Image Frame - Full Image */}
                    <div className="relative aspect-square w-full bg-[#f4f7fc] overflow-hidden flex items-center justify-center">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-contain p-1.5 group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Out of Stock Overlay */}
                      {!item.available && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                          <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Sold Out
                          </span>
                        </div>
                      )}

                      {/* Tag / Category Badge */}
                      {item.category && (
                        <div className="absolute top-1.5 left-1.5 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md text-[9px] font-bold text-[#0d1c2d] shadow-xs truncate max-w-[80%]">
                          {item.category}
                        </div>
                      )}
                    </div>

                    {/* Content Details */}
                    <div className="p-2.5 sm:p-3">
                      <h3 className="font-bold text-xs sm:text-sm text-[#0d1c2d] leading-tight line-clamp-1">
                        {item.name}
                      </h3>

                      {item.description && (
                        <p className="text-[10px] text-[#76777d] mt-1 line-clamp-1 leading-tight">
                          {item.description}
                        </p>
                      )}

                      {/* Price & Variant Specs */}
                      <div className="mt-1.5 flex items-baseline justify-between gap-1 flex-wrap">
                        <span className="font-bold text-sm sm:text-base text-[#006c49]">
                          ${item.price.toFixed(2)}
                        </span>
                        {item.calories && (
                          <span className="text-[9px] sm:text-[10px] text-[#76777d] bg-[#f8f9ff] px-1.5 py-0.5 rounded border border-[#eef4ff] truncate max-w-[90px]">
                            {item.calories}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Add to Bag Button */}
                  <div className="p-2.5 sm:p-3 pt-0">
                    <button
                      disabled={!item.available}
                      onClick={() => handleAddToCart(item)}
                      className="w-full bg-[#0d1c2d] hover:bg-[#131b2e] disabled:opacity-40 text-white text-[11px] font-semibold py-1.5 sm:py-2 rounded-lg flex items-center justify-center gap-1 transition-all"
                    >
                      <span>{item.available ? "+ Add to Bag" : "Sold Out"}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      )}

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md h-full flex flex-col justify-between p-6 shadow-2xl">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#eef4ff]">
                <h3 className="text-lg font-bold text-[#0d1c2d]">Your Order</h3>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="text-sm font-bold text-[#76777d]"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {cart.length === 0 ? (
                  <p className="text-sm text-[#76777d] text-center py-8">
                    Your order is empty
                  </p>
                ) : (
                  cart.map((ci) => (
                    <div
                      key={ci.item.id}
                      className="flex items-center justify-between p-3 bg-[#f8f9ff] rounded-xl border border-[#eef4ff]"
                    >
                      <div>
                        <p className="text-sm font-bold text-[#0d1c2d]">
                          {ci.item.name}
                        </p>
                        <p className="text-xs text-[#76777d]">
                          ${ci.item.price.toFixed(2)} x {ci.quantity}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRemoveFromCart(ci.item.id)}
                          className="w-6 h-6 rounded bg-white text-xs font-bold border border-[#c6c6cd]"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold">{ci.quantity}</span>
                        <button
                          onClick={() => handleAddToCart(ci.item)}
                          className="w-6 h-6 rounded bg-[#006c49] text-white text-xs font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {cart.length > 0 && (
              <div className="pt-4 border-t border-[#eef4ff]">
                <div className="flex justify-between text-base font-bold text-[#0d1c2d] mb-4">
                  <span>Subtotal</span>
                  <span className="text-[#006c49]">${cartSubtotal.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => {
                    alert("Order / Bag submitted successfully!")
                    setCart([])
                    setIsCartOpen(false)
                  }}
                  className="w-full bg-[#006c49] text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-[#005236] transition-all"
                >
                  Checkout & Place Order
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Section */}
      <footer className="bg-[#eef4ff] border-t border-[#dbe9ff] mt-auto">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {/* Left Col: MenuHub Description */}
            <div>
              <h3 className="text-xl font-bold text-[#0d1c2d] mb-3">MenuHub</h3>
              <p className="text-xs text-[#45464d] leading-relaxed max-w-sm">
                The modern universal storefront platform. Discover fashion boutiques, organic grocery markets, specialty cafes, tech hubs, and gourmet dining.
              </p>
            </div>

            {/* Middle Col: Platform links */}
            <div>
              <h4 className="text-xs font-bold text-[#0d1c2d] mb-3 uppercase tracking-wider">
                Platform
              </h4>
              <ul className="space-y-2 text-xs font-medium text-[#45464d]">
                <li className="hover:text-[#006c49] cursor-pointer">About Us</li>
                <li className="hover:text-[#006c49] cursor-pointer">Contact</li>
                <li className="hover:text-[#006c49] cursor-pointer">Careers</li>
              </ul>
            </div>

            {/* Right Col: Partners links */}
            <div>
              <h4 className="text-xs font-bold text-[#0d1c2d] mb-3 uppercase tracking-wider">
                Partners
              </h4>
              <ul className="space-y-2 text-xs font-semibold">
                <li>
                  <Link href="/dashboard" className="text-[#00714d] hover:underline">
                    Join as a Seller
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-[#45464d] font-medium hover:text-[#006c49]">
                    Restaurant Login
                  </Link>
                </li>
                <li className="text-[#45464d] font-medium hover:text-[#006c49] cursor-pointer">
                  API Documentation
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright Bar */}
          <div className="pt-6 border-t border-[#dbe9ff] flex items-center justify-between text-xs text-[#76777d]">
            <p>© 2024 MenuHub. All rights reserved.</p>
            <span className="text-base cursor-pointer">🌐</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
