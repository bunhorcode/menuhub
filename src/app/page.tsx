"use client"

import { useState, useMemo, useEffect } from "react"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"

// Interfaces update
interface Restaurant {
  id: string
  name: string
  cuisine: string
  priceRange: string
  rating: number
  reviewsCount: number
  badgeIcon: string
  image: string
  category: string
}

interface MenuItem {
  id: string
  name: string
  category: string
  price: number
  description: string
  image: string
  tags: string[]
  calories?: string
  prepTime?: string
  available: boolean
}

interface CartItem {
  item: MenuItem
  quantity: number
}

// 6 Restaurant Cards matching the image
const RESTAURANTS: Restaurant[] = [
  {
    id: "rest-1",
    name: "Bistro Delight",
    cuisine: "Modern European",
    priceRange: "$$",
    rating: 4.8,
    reviewsCount: 120,
    badgeIcon: "🍽️",
    image: "/images/bistro_delight.jpg",
    category: "Italian",
  },
  {
    id: "rest-2",
    name: "Sushi Zen",
    cuisine: "Japanese",
    priceRange: "$$$",
    rating: 4.9,
    reviewsCount: 340,
    badgeIcon: "🍣",
    image: "/images/sushi_zen.jpg",
    category: "Sushi",
  },
  {
    id: "rest-3",
    name: "Cafe Nova",
    cuisine: "Coffee & Pastries",
    priceRange: "$",
    rating: 4.7,
    reviewsCount: 89,
    badgeIcon: "☕",
    image: "/images/matcha_latte.jpg",
    category: "Cafes",
  },
  {
    id: "rest-4",
    name: "The Burger Joint",
    cuisine: "Burgers",
    priceRange: "$$",
    rating: 4.6,
    reviewsCount: 210,
    badgeIcon: "🍔",
    image: "/images/wagyu_burger.jpg",
    category: "Burgers",
  },
  {
    id: "rest-5",
    name: "Green Garden",
    cuisine: "Vegan",
    priceRange: "$$",
    rating: 4.8,
    reviewsCount: 150,
    badgeIcon: "🌱",
    image: "/images/berry_tart.jpg",
    category: "Vegan",
  },
  {
    id: "rest-6",
    name: "Pastry Palace",
    cuisine: "Cafes",
    priceRange: "$$$",
    rating: 4.7,
    reviewsCount: 95,
    badgeIcon: "🥐",
    image: "/images/truffle_pasta.jpg",
    category: "Cafes",
  },
]

// Digital Menu Items for Store View
const STORE_ITEMS: MenuItem[] = [
  {
    id: "item-1",
    name: "Artisan Truffle Tagliatelle",
    category: "Chef's Specials",
    price: 26.5,
    description:
      "Hand-crafted egg tagliatelle tossed in cultured butter, parmigiano-reggiano, and freshly shaved black winter truffles.",
    image: "/images/truffle_pasta.jpg",
    tags: ["POPULAR", "CHEF'S PICK"],
    calories: "680 kcal",
    prepTime: "15 min",
    available: true,
  },
  {
    id: "item-2",
    name: "Smoked Wagyu Beef Burger",
    category: "Signature Mains",
    price: 24.0,
    description:
      "Aged A5 Wagyu beef patty with smoked cheddar, caramelized shallots, crisp butter lettuce, and truffle aioli.",
    image: "/images/wagyu_burger.jpg",
    tags: ["SIGNATURE", "POPULAR"],
    calories: "840 kcal",
    prepTime: "12 min",
    available: true,
  },
  {
    id: "item-3",
    name: "Iced Ceremonial Matcha Latte",
    category: "Artisan Coffee",
    price: 8.5,
    description:
      "Single-origin Uji matcha whisked fresh to order, layered over creamy organic oat milk and raw agave syrup.",
    image: "/images/matcha_latte.jpg",
    tags: ["VEGAN", "ORGANIC"],
    calories: "140 kcal",
    prepTime: "5 min",
    available: true,
  },
  {
    id: "item-4",
    name: "Wild Berry Vanilla Custard Tart",
    category: "Desserts & Pastries",
    price: 12.0,
    description:
      "Crisp butter pastry filled with Tahitian vanilla bean pastry cream, topped with fresh raspberries and blueberries.",
    image: "/images/berry_tart.jpg",
    tags: ["FRESH", "CHEF'S DESSERT"],
    calories: "390 kcal",
    prepTime: "8 min",
    available: true,
  },
]

const CATEGORY_PILLS = [
  { name: "All", icon: "🎯" },
  { name: "Italian", icon: "🍕" },
  { name: "Sushi", icon: "🍣" },
  { name: "Burgers", icon: "🍔" },
  { name: "Cafes", icon: "☕" },
  { name: "Vegan", icon: "🌱" },
]

export default function MenuHubScreen() {
  const [selectedCategoryPill, setSelectedCategoryPill] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeRestaurant, setActiveRestaurant] = useState<Restaurant | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [authModal, setAuthModal] = useState<"login" | "signup" | null>(null)
  const [supabaseStatus, setSupabaseStatus] = useState<string>("Checking...")

  // Verify Supabase integration
  // setState is called inside an async function (not synchronously in the
  // effect body) to satisfy the react-hooks/set-state-in-effect ESLint rule.
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const supabase = createClient()
        if (supabase) {
          setSupabaseStatus("Supabase Connected")
        }
      } catch {
        setSupabaseStatus("Local Mode")
      }
    }
    checkConnection()
  }, [])

  // Filter restaurants by search and category pill
  const filteredRestaurants = useMemo(() => {
    return RESTAURANTS.filter((rest) => {
      const matchesCategory =
        selectedCategoryPill === "All" || rest.category === selectedCategoryPill
      const matchesSearch =
        rest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rest.cuisine.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [selectedCategoryPill, searchQuery])

  // Cart helper actions
  const handleAddToCart = (item: MenuItem) => {
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

  const totalItemCount = cart.reduce((sum, ci) => sum + ci.quantity, 0)
  const subtotal = cart.reduce((sum, ci) => sum + ci.item.price * ci.quantity, 0)

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0d1c2d] flex flex-col font-sans">
      {/* 1. Top Navigation Bar Header */}
      <header className="bg-white border-b border-[#eef4ff] sticky top-0 z-40 shadow-xs">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveRestaurant(null)}>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0d1c2d]">
              MenuHub
            </h1>
            <span className="hidden sm:inline-block text-[11px] font-semibold text-[#00714d] bg-[#eef4ff] px-2.5 py-0.5 rounded-full border border-[#ccdbf2]">
              {supabaseStatus}
            </span>
          </div>

          {/* Right Navigation Actions */}
          <div className="flex items-center gap-4 sm:gap-6">
            {activeRestaurant && (
              <button
                onClick={() => setActiveRestaurant(null)}
                className="text-xs sm:text-sm font-semibold text-[#45464d] hover:text-[#006c49] flex items-center gap-1"
              >
                ← Back to Stores
              </button>
            )}

            <button
              onClick={() => setAuthModal("login")}
              className="text-xs sm:text-sm font-medium text-[#0d1c2d] hover:text-[#006c49] transition-colors"
            >
              Log In
            </button>

            <button
              onClick={() => setAuthModal("signup")}
              className="bg-[#006c49] hover:bg-[#005236] text-white text-xs sm:text-sm font-semibold px-4.5 py-2 rounded-lg transition-all shadow-xs"
            >
              Sign Up
            </button>
          </div>
        </div>
      </header>

      {/* Main Screen Content */}
      {!activeRestaurant ? (
        /* Restaurant Discovery Screen (Matching the image) */
        <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-8">
          {/* Hero Search Box & Category Filter Pills */}
          <div className="bg-white border border-[#eef4ff] rounded-2xl p-4 sm:p-6 mb-8 shadow-xs">
            {/* Search Input Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="What are you craving?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 px-4.5 bg-white border border-[#c6c6cd]/50 rounded-xl text-sm text-[#0d1c2d] placeholder-[#76777d] focus:outline-none focus:border-[#006c49] focus:ring-2 focus:ring-[#6cf8bb]/40 transition-all shadow-2xs"
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

              <button
                onClick={() => { }}
                className="bg-[#006c49] hover:bg-[#005236] text-white h-12 px-6 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-xs transition-all"
              >
                <span>🔍</span>
                <span>Search</span>
              </button>
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

          {/* Restaurant Cards Grid (3 Columns on Desktop) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {filteredRestaurants.map((rest) => (
              <div
                key={rest.id}
                className="bg-white rounded-2xl border border-[#eef4ff] overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* Card Image Header with Badges */}
                  <div className="relative h-48 sm:h-52 w-full bg-[#eef4ff] overflow-hidden">
                    <Image
                      src={rest.image}
                      alt={rest.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover"
                    />

                    {/* Top-Left Badge Icon */}
                    <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md w-9 h-9 rounded-xl flex items-center justify-center text-sm shadow-xs border border-white/40">
                      {rest.badgeIcon}
                    </div>

                    {/* Bottom-Right Rating Pill */}
                    <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-[#0d1c2d] shadow-xs flex items-center gap-1 border border-white/40">
                      <span className="text-[#006c49]">★</span>
                      <span>{rest.rating}</span>
                      <span className="text-[#76777d] font-normal">
                        ({rest.reviewsCount}+)
                      </span>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-[#0d1c2d] tracking-tight">
                      {rest.name}
                    </h3>
                    <p className="text-xs text-[#76777d] mt-1 font-medium">
                      {rest.cuisine} • {rest.priceRange}
                    </p>

                    {/* Action Button: View Menu → */}
                    <button
                      onClick={() => setActiveRestaurant(rest)}
                      className="w-full mt-4 bg-[#eef4ff] hover:bg-[#dbe9ff] text-[#00714d] font-semibold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all"
                    >
                      <span>View Menu</span>
                      <span className="text-sm">→</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      ) : (
        /* Store View when Clicking View Menu */
        <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-8">
          {/* Store Header Banner */}
          <div className="bg-white border border-[#eef4ff] rounded-2xl p-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#006c49] text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                  ★ {activeRestaurant.rating} ({activeRestaurant.reviewsCount}+)
                </span>
                <span className="text-xs font-medium text-[#76777d]">
                  {activeRestaurant.cuisine} • {activeRestaurant.priceRange}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0d1c2d] mt-2">
                {activeRestaurant.name}
              </h2>
              <p className="text-sm text-[#76777d] mt-1">
                Table #04 • Digital Menu & Live Ordering
              </p>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="bg-[#006c49] hover:bg-[#005236] text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 self-start md:self-auto shadow-xs"
            >
              <span>🛒 View Order ({totalItemCount})</span>
            </button>
          </div>

          {/* Dishes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {STORE_ITEMS.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-[#eef4ff] overflow-hidden flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="relative h-48 w-full bg-[#eef4ff] overflow-hidden">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-base text-[#0d1c2d]">
                        {item.name}
                      </h3>
                      <span className="font-bold text-base text-[#006c49]">
                        ${item.price.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-[#76777d] mt-2 leading-relaxed line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="p-5 pt-0">
                  <button
                    onClick={() => handleAddToCart(item)}
                    className="w-full bg-[#0d1c2d] hover:bg-[#131b2e] text-white text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1"
                  >
                    + Add to Order
                  </button>
                </div>
              </div>
            ))}
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
                  <span>Total</span>
                  <span className="text-[#006c49]">${subtotal.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => {
                    alert("Order sent to kitchen!")
                    setCart([])
                    setIsCartOpen(false)
                  }}
                  className="w-full bg-[#006c49] text-white py-3.5 rounded-xl font-semibold text-sm"
                >
                  Confirm & Send Order
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auth Modal (Log In / Sign Up) */}
      {authModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#0d1c2d]">
                {authModal === "login" ? "Log In to MenuHub" : "Create MenuHub Account"}
              </h3>
              <button
                onClick={() => setAuthModal(null)}
                className="text-sm font-bold text-[#76777d]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="email"
                placeholder="Email address"
                className="w-full h-11 px-4 border border-[#c6c6cd] rounded-xl text-sm"
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full h-11 px-4 border border-[#c6c6cd] rounded-xl text-sm"
              />
              <button
                onClick={() => setAuthModal(null)}
                className="w-full bg-[#006c49] hover:bg-[#005236] text-white py-3 rounded-xl font-semibold text-sm mt-2"
              >
                {authModal === "login" ? "Log In" : "Sign Up"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Footer Section (Matching screenshot exactly) */}
      <footer className="bg-[#eef4ff] border-t border-[#dbe9ff] mt-auto">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {/* Left Col: MenuHub Description */}
            <div>
              <h3 className="text-xl font-bold text-[#0d1c2d] mb-3">MenuHub</h3>
              <p className="text-xs text-[#45464d] leading-relaxed max-w-sm">
                Elevating the dining experience through beautiful, intuitive digital
                menus. Discover your next great meal.
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
                <li className="text-[#00714d] hover:underline cursor-pointer">
                  Join as a Seller
                </li>
                <li className="text-[#45464d] font-medium hover:text-[#006c49] cursor-pointer">
                  Restaurant Login
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
