"use client"

import { useState, useMemo, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { type User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { getStores, getMenuItems, getSellerProfileByStoreId } from "@/lib/store-data"
import { Store, StoreMenuItem, OptionValue } from "@/lib/seller-types"

interface SelectedOption {
  groupId: string
  groupName: string
  value: OptionValue
}

interface ModalOptionQuantityEntry {
  selections: SelectedOption[]
  quantity: number
}

// Helper to generate unique key for a set of selected options
function getComboKey(options: SelectedOption[]): string {
  return options
    .map((o) => `${o.groupId}:${o.value.id}`)
    .sort()
    .join("|")
}

interface CartItem {
  id: string
  item: StoreMenuItem
  quantity: number
  selectedOptions?: SelectedOption[]
  selectedImage?: string
  storeId?: string
  storeName?: string
  selectedForOrder: boolean
  createdAt: number
}

// Generate a unique cart key based on item ID + selected option values
function cartKey(itemId: string, selectedOptions?: SelectedOption[]): string {
  if (!selectedOptions || selectedOptions.length === 0) return itemId
  return `${itemId}__${getComboKey(selectedOptions)}`
}

const CART_STORAGE_KEY = "menuhub_cart_storage_v2"

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
  const [isCartHydrated, setIsCartHydrated] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [supabaseStatus, setSupabaseStatus] = useState<string>("Checking...")

  // Item detail modal state (for products with options/variants)
  const [detailItem, setDetailItem] = useState<StoreMenuItem | null>(null)
  const [detailSelectedOptions, setDetailSelectedOptions] = useState<SelectedOption[]>([])
  const [detailDisplayImage, setDetailDisplayImage] = useState<string>("")
  // Per-combination quantities across all variants (e.g. White+S: 1, White+M: 1, Black+S: 1, Black+M: 1)
  const [detailComboQuantities, setDetailComboQuantities] = useState<Record<string, ModalOptionQuantityEntry>>({})

  // Seller Telegram username for the active store (used for order notification button)
  const [sellerTelegramUsername, setSellerTelegramUsername] = useState<string | null>(null)

  // 1. Cart Hydration & Persistence:
  // - Registered MenuHub Users: Permanent storage in localStorage keyed by user ID
  // - Guest Users (No Account): Temporary session storage only (cleared when session/browser ends)
  useEffect(() => {
    try {
      if (user) {
        // Authenticated user: load from permanent account storage
        const userStorageKey = `menuhub_cart_user_${user.id}`
        const saved = localStorage.getItem(userStorageKey)
        if (saved) {
          const parsed: CartItem[] = JSON.parse(saved)
          if (Array.isArray(parsed)) {
            setCart(
              parsed.map((ci) => ({
                ...ci,
                selectedForOrder: ci.selectedForOrder ?? true,
              }))
            )
          }
        } else {
          // If user had guest items before logging in, transfer them to permanent account storage
          const guestSaved = sessionStorage.getItem("menuhub_guest_cart")
          if (guestSaved) {
            const guestParsed: CartItem[] = JSON.parse(guestSaved)
            if (Array.isArray(guestParsed) && guestParsed.length > 0) {
              setCart(
                guestParsed.map((ci) => ({
                  ...ci,
                  selectedForOrder: ci.selectedForOrder ?? true,
                }))
              )
              sessionStorage.removeItem("menuhub_guest_cart")
            }
          }
        }
      } else {
        // Guest user (no account): load temporary session bag only
        const guestSaved = sessionStorage.getItem("menuhub_guest_cart")
        if (guestSaved) {
          const parsed: CartItem[] = JSON.parse(guestSaved)
          if (Array.isArray(parsed)) {
            setCart(
              parsed.map((ci) => ({
                ...ci,
                selectedForOrder: ci.selectedForOrder ?? true,
              }))
            )
          }
        }
      }
    } catch (e) {
      console.warn("Could not load cart", e)
    } finally {
      setIsCartHydrated(true)
    }
  }, [user])

  // 2. Auto-save: Permanent in localStorage for registered accounts, session-only for guests
  useEffect(() => {
    if (!isCartHydrated) return

    try {
      if (user) {
        // Permanent storage for registered MenuHub account
        const userStorageKey = `menuhub_cart_user_${user.id}`
        localStorage.setItem(userStorageKey, JSON.stringify(cart))
      } else {
        // Temporary session-only storage for guest users without account
        sessionStorage.setItem("menuhub_guest_cart", JSON.stringify(cart))
      }
    } catch (e) {
      console.warn("Could not save cart", e)
    }
  }, [cart, user, isCartHydrated])

  // Load stores from Supabase
  useEffect(() => {
    const loadStores = async () => {
      const loadedStores = await getStores()
      setStores(loadedStores)
    }
    loadStores()
  }, [])

  // When active restaurant changes, load its dishes from Supabase + seller Telegram info
  useEffect(() => {
    const loadDishes = async () => {
      if (activeRestaurant) {
        const items = await getMenuItems(activeRestaurant.id)
        setStoreDishes(items)
        // Fetch seller Telegram username for the order notification button
        const sellerProfile = await getSellerProfileByStoreId(activeRestaurant.id)
        setSellerTelegramUsername(sellerProfile?.telegramUsername || null)
      } else {
        setStoreDishes([])
        setSellerTelegramUsername(null)
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

  // ── Cart CRUD Operations ──────────────────────────────────────────────────
  const handleAddToCart = (
    item: StoreMenuItem,
    selectedOptions?: SelectedOption[],
    quantity = 1,
    customImage?: string
  ) => {
    const key = cartKey(item.id, selectedOptions)
    const storeInfo = stores.find((s) => s.id === item.storeId) || activeRestaurant

    // Select thumbnail image: custom variant image > option image > item base image
    const itemImg =
      customImage ||
      selectedOptions?.find((o) => o.value.image)?.value.image ||
      item.image

    setCart((prev) => {
      const existingIdx = prev.findIndex((ci) => ci.id === key)
      if (existingIdx !== -1) {
        return prev.map((ci, idx) =>
          idx === existingIdx
            ? { ...ci, quantity: ci.quantity + quantity, selectedForOrder: true }
            : ci
        )
      }
      return [
        {
          id: key,
          item,
          quantity,
          selectedOptions: selectedOptions && selectedOptions.length > 0 ? selectedOptions : undefined,
          selectedImage: itemImg,
          storeId: item.storeId,
          storeName: storeInfo?.name,
          selectedForOrder: true,
          createdAt: Date.now(),
        },
        ...prev,
      ]
    })
  }

  // Update item quantity
  const handleUpdateCartItemQty = (cartId: string, newQty: number) => {
    if (newQty <= 0) {
      handleDeleteCartItem(cartId)
      return
    }
    setCart((prev) =>
      prev.map((ci) => (ci.id === cartId ? { ...ci, quantity: newQty } : ci))
    )
  }

  // Delete single item from cart
  const handleDeleteCartItem = (cartId: string) => {
    setCart((prev) => prev.filter((ci) => ci.id !== cartId))
  }

  // Toggle selection for a single cart item
  const handleToggleCartItemSelect = (cartId: string) => {
    setCart((prev) =>
      prev.map((ci) =>
        ci.id === cartId ? { ...ci, selectedForOrder: !ci.selectedForOrder } : ci
      )
    )
  }

  // Toggle select all / deselect all
  const handleToggleSelectAll = () => {
    const shouldSelectAll = cart.some((ci) => !ci.selectedForOrder)
    setCart((prev) => prev.map((ci) => ({ ...ci, selectedForOrder: shouldSelectAll })))
  }

  // Delete selected items
  const handleDeleteSelectedItems = () => {
    const selectedCount = cart.filter((ci) => ci.selectedForOrder).length
    if (selectedCount === 0) return
    if (confirm(`Remove ${selectedCount} selected item(s) from your bag?`)) {
      setCart((prev) => prev.filter((ci) => !ci.selectedForOrder))
    }
  }

  // Clear entire cart
  const handleClearEntireCart = () => {
    if (cart.length === 0) return
    if (confirm("Are you sure you want to clear your entire bag?")) {
      setCart([])
    }
  }

  // Helper to check if an option value is out of stock (multi-attribute combination aware)
  const checkOptionOutOfStock = (
    item: StoreMenuItem,
    groupId: string,
    groupName: string,
    val: OptionValue,
    currentSelections: SelectedOption[]
  ): boolean => {
    // If combinations matrix exists in item.variants
    if (item.variants && item.variants.length > 0) {
      const candidateCombo: Record<string, string> = {}
      currentSelections.forEach((s) => {
        if (s.groupId !== groupId) {
          candidateCombo[s.groupName] = s.value.label
        }
      })
      candidateCombo[groupName] = val.label

      const matchingVariants = item.variants.filter((v) => {
        return Object.entries(candidateCombo).every(([k, l]) => v.options[k] === l)
      })

      if (matchingVariants.length > 0) {
        return matchingVariants.every((v) => v.stock <= 0)
      }

      const anyComboWithVal = item.variants.some(
        (v) => v.options[groupName] === val.label && v.stock > 0
      )
      return !anyComboWithVal
    }

    // Fallback to option value stock if no matrix defined
    return val.stock !== undefined && val.stock <= 0
  }

  // Compute price including option adjustments or SKU combo Sell Price
  const computeItemPrice = (item: StoreMenuItem, selectedOptions?: SelectedOption[]): number => {
    const base = item.price
    if (!selectedOptions || selectedOptions.length === 0) return base

    if (item.variants && item.variants.length > 0) {
      const candidateCombo: Record<string, string> = {}
      selectedOptions.forEach((s) => {
        candidateCombo[s.groupName.trim()] = s.value.label.trim()
      })

      // 1. Try to find exact match for all selected options
      const exactMatch = item.variants.find((v) => {
        const vEntries = Object.entries(v.options)
        const cEntries = Object.entries(candidateCombo)
        const allCandidatesMatch = cEntries.every(
          ([k, l]) => v.options[k]?.trim().toLowerCase() === l?.trim().toLowerCase()
        )
        return allCandidatesMatch && vEntries.length === cEntries.length
      })

      if (exactMatch) {
        if (exactMatch.sellPrice !== undefined && exactMatch.sellPrice > 0) {
          return exactMatch.sellPrice
        }
        if (exactMatch.priceAdjustment !== undefined && exactMatch.priceAdjustment !== 0) {
          return base + exactMatch.priceAdjustment
        }
      }

      // 2. Try partial match if not all option groups selected yet
      const partialMatch = item.variants.find((v) => {
        return Object.entries(candidateCombo).every(
          ([k, l]) => v.options[k]?.trim().toLowerCase() === l?.trim().toLowerCase()
        )
      })

      if (partialMatch) {
        if (partialMatch.sellPrice !== undefined && partialMatch.sellPrice > 0) {
          return partialMatch.sellPrice
        }
        if (partialMatch.priceAdjustment !== undefined && partialMatch.priceAdjustment !== 0) {
          return base + partialMatch.priceAdjustment
        }
      }
    }

    const adjustments = selectedOptions.reduce((sum, o) => sum + (o.value.priceAdjustment || 0), 0)
    return base + adjustments
  }

  // Helper to find the stock amount of the selected SKU combination
  const getSelectedSkuStock = (item: StoreMenuItem, selectedOptions?: SelectedOption[]): number | undefined => {
    if (!item.variants || item.variants.length === 0) return undefined
    if (!selectedOptions || selectedOptions.length === 0) return undefined
    const candidateCombo: Record<string, string> = {}
    selectedOptions.forEach((s) => {
      candidateCombo[s.groupName.trim()] = s.value.label.trim()
    })
    const matching =
      item.variants.find((v) => {
        const vEntries = Object.entries(v.options)
        const cEntries = Object.entries(candidateCombo)
        const allMatch = cEntries.every(
          ([k, l]) => v.options[k]?.trim().toLowerCase() === l?.trim().toLowerCase()
        )
        return allMatch && vEntries.length === cEntries.length
      }) ||
      item.variants.find((v) => {
        return Object.entries(candidateCombo).every(
          ([k, l]) => v.options[k]?.trim().toLowerCase() === l?.trim().toLowerCase()
        )
      })
    return matching?.stock
  }

  // Open item detail modal (for items with options)
  const handleOpenItemDetail = (item: StoreMenuItem) => {
    setDetailItem(item)
    setDetailDisplayImage(item.image)
    setDetailComboQuantities({})
    // Pre-select first in-stock value of each non-last required group (last group uses qty rows)
    const initialSelections: SelectedOption[] = []
    if (item.options && item.options.length > 0) {
      const groupsExceptLast = item.options.slice(0, -1)
      groupsExceptLast.forEach((group) => {
        if (group.required && group.values.length > 0) {
          const inStockValue =
            group.values.find(
              (v) => !checkOptionOutOfStock(item, group.id, group.name, v, initialSelections)
            ) || group.values[0]
          initialSelections.push({
            groupId: group.id,
            groupName: group.name,
            value: inStockValue,
          })
        }
      })
    }
    setDetailSelectedOptions(initialSelections)
    // If first required option has an image, show it
    if (initialSelections.length > 0 && initialSelections[0].value.image) {
      setDetailDisplayImage(initialSelections[0].value.image)
    }
  }

  const handleSelectOption = (groupId: string, groupName: string, value: OptionValue) => {
    if (!detailItem) return
    const isOut = checkOptionOutOfStock(detailItem, groupId, groupName, value, detailSelectedOptions)
    if (isOut) return

    const newSelections: SelectedOption[] = detailSelectedOptions
      .filter((o) => o.groupId !== groupId)
      .concat({ groupId, groupName, value })

    // Auto-adjust other selected options if they became out-of-stock under this new selection
    if (detailItem.options && detailItem.variants && detailItem.variants.length > 0) {
      detailItem.options.forEach((otherGroup) => {
        if (otherGroup.id !== groupId) {
          const currentOther = newSelections.find((s) => s.groupId === otherGroup.id)
          if (currentOther) {
            const otherWithoutSelf = newSelections.filter((s) => s.groupId !== otherGroup.id)
            const currentOtherOut = checkOptionOutOfStock(
              detailItem,
              otherGroup.id,
              otherGroup.name,
              currentOther.value,
              otherWithoutSelf
            )
            if (currentOtherOut) {
              const altVal = otherGroup.values.find(
                (v) => !checkOptionOutOfStock(detailItem, otherGroup.id, otherGroup.name, v, otherWithoutSelf)
              )
              if (altVal) {
                const idx = newSelections.findIndex((s) => s.groupId === otherGroup.id)
                if (idx !== -1) {
                  newSelections[idx] = { groupId: otherGroup.id, groupName: otherGroup.name, value: altVal }
                }
              }
            }
          }
        }
      })
    }

    setDetailSelectedOptions(newSelections)
    // If this value has an image, swap the display image
    if (value.image) {
      setDetailDisplayImage(value.image)
    }
  }

  const handleAddFromDetail = () => {
    if (!detailItem) return
    const selectedEntries = Object.values(detailComboQuantities).filter((e) => e.quantity > 0)
    if (selectedEntries.length === 0) return

    selectedEntries.forEach((entry) => {
      const variantImg =
        entry.selections.find((o) => o.value.image)?.value.image ||
        detailDisplayImage ||
        detailItem.image
      handleAddToCart(detailItem, entry.selections, entry.quantity, variantImg)
    })

    setDetailItem(null)
  }

  // When clicking a product card, decide: open detail modal or add directly
  const handleProductClick = (item: StoreMenuItem) => {
    if (item.options && item.options.length > 0) {
      handleOpenItemDetail(item)
    } else {
      handleAddToCart(item)
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setCart([]) // Reset in-memory cart on logout
    sessionStorage.removeItem("menuhub_guest_cart")
  }

  // ── Cart Calculations ───────────────────────────────────────────────────────
  const totalCartItemCount = cart.reduce((sum, ci) => sum + ci.quantity, 0)
  const totalCartSubtotal = cart.reduce(
    (sum, ci) => sum + computeItemPrice(ci.item, ci.selectedOptions) * ci.quantity,
    0
  )

  const selectedCartItems = useMemo(
    () => cart.filter((ci) => ci.selectedForOrder !== false),
    [cart]
  )

  const selectedItemCount = selectedCartItems.reduce((sum, ci) => sum + ci.quantity, 0)
  const selectedSubtotal = selectedCartItems.reduce(
    (sum, ci) => sum + computeItemPrice(ci.item, ci.selectedOptions) * ci.quantity,
    0
  )

  const isAllSelected = cart.length > 0 && selectedCartItems.length === cart.length
  const isSomeSelected = selectedCartItems.length > 0 && !isAllSelected

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
              {totalCartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#006c49] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
                  {totalCartItemCount}
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
            {filteredRestaurants.length === 0 ? (
              <div className="col-span-full text-center py-16 px-4 bg-white rounded-2xl border border-[#eef4ff] shadow-xs">
                <span className="text-4xl inline-block mb-2">🏬</span>
                <h3 className="text-base font-bold text-[#0d1c2d]">No Stores Available Yet</h3>
                <p className="text-xs text-[#76777d] mt-1 max-w-sm mx-auto">
                  {searchQuery || selectedCategoryPill !== "All"
                    ? "No stores match your current filters. Try changing your search keywords."
                    : "Become a seller and open your digital store & catalog today!"}
                </p>
                <Link
                  href="/dashboard"
                  className="inline-block mt-4 bg-[#006c49] hover:bg-[#005236] text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-xs"
                >
                  + Open Store in Seller Studio
                </Link>
              </div>
            ) : (
              filteredRestaurants.map((rest, idx) => (
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
                      priority={idx < 4}
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-contain p-1.5 group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Category Badge */}
                    <div className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md flex items-center gap-1 text-[10px] font-bold shadow-xs">
                      <span>{rest.badgeIcon}</span>
                      <span className="text-[#0d1c2d] hidden sm:inline">{rest.category}</span>
                    </div>

                    {/* Rating */}
                    <div className="absolute bottom-2.5 right-2.5 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md text-[10px] font-bold text-[#0d1c2d] shadow-xs flex items-center gap-0.5">
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
              ))
            )}
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
                <span>🛒 View Bag ({totalCartItemCount})</span>
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
              storeDishes.map((item, idx) => (
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
                        priority={idx < 4}
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
                          {item.variants && item.variants.length > 0 ? (
                            (() => {
                              const prices = item.variants
                                .map((v) =>
                                  v.sellPrice !== undefined && v.sellPrice > 0
                                    ? v.sellPrice
                                    : item.price + (v.priceAdjustment || 0)
                                )
                                .filter((p) => p > 0)
                              if (prices.length === 0) return `$${item.price.toFixed(2)}`
                              const min = Math.min(...prices)
                              const max = Math.max(...prices)
                              return min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)} - $${max.toFixed(2)}`
                            })()
                          ) : (
                            `$${item.price.toFixed(2)}`
                          )}
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
                      onClick={(e) => {
                        e.stopPropagation()
                        handleProductClick(item)
                      }}
                      className="w-full bg-[#0d1c2d] hover:bg-[#131b2e] disabled:opacity-40 text-white text-[11px] font-semibold py-1.5 sm:py-2 rounded-lg flex items-center justify-center gap-1 transition-all"
                    >
                      <span>
                        {!item.available
                          ? "Sold Out"
                          : item.options && item.options.length > 0
                          ? "✨ Select Options"
                          : "+ Add to Bag"}
                      </span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      )}

      {/* Item Detail / Variant Selection Modal */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white text-[#0d1c2d] rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#eef4ff] flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="min-w-0 flex-1 pr-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#00714d] bg-[#eef4ff] px-2 py-0.5 rounded-full">
                  {detailItem.category}
                </span>
                <div className="flex items-baseline justify-between gap-2 mt-1">
                  <h3 className="text-base sm:text-lg font-bold text-[#0d1c2d] truncate">
                    {detailItem.name}
                  </h3>
                  <span className="text-base sm:text-lg font-black text-[#006c49] shrink-0">
                    {(() => {
                      if (!detailItem) return "$0.00"
                      const selectedEntries = Object.values(detailComboQuantities).filter((e) => e.quantity > 0)
                      const total = selectedEntries.reduce(
                        (sum, e) => sum + computeItemPrice(detailItem, e.selections) * e.quantity,
                        0
                      )
                      return selectedEntries.length > 0 ? `$${total.toFixed(2)}` : `$${detailItem.price.toFixed(2)}`
                    })()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setDetailItem(null)}
                className="w-8 h-8 rounded-full bg-[#f8f9ff] hover:bg-[#eef4ff] text-[#76777d] hover:text-[#0d1c2d] flex items-center justify-center text-sm font-bold transition-all shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-5 flex-1">
              {/* Active Image (Dynamic Swapping when Variant Selected) */}
              <div className="relative aspect-square w-full max-h-64 rounded-xl bg-[#f4f7fc] overflow-hidden flex items-center justify-center border border-[#eef4ff]">
                <Image
                  src={detailDisplayImage || detailItem.image}
                  alt={detailItem.name}
                  fill
                  priority
                  sizes="(max-width: 640px) 100vw, 400px"
                  className="object-contain p-2 transition-all duration-300"
                />
              </div>

              {/* Description & Base Specs */}
              <div>
                <p className="text-xs text-[#76777d] leading-relaxed">
                  {detailItem.description}
                </p>
                {detailItem.calories && (
                  <p className="text-[11px] text-[#00714d] font-semibold mt-1">
                    Specs: {detailItem.calories}
                  </p>
                )}
              </div>

              {/* Dynamic Option Groups */}
              {detailItem.options && detailItem.options.length > 0 && (() => {
                const lastGroup = detailItem.options[detailItem.options.length - 1]
                const pillGroups = detailItem.options.slice(0, -1)

                return (
                  <div className="space-y-4 pt-2 border-t border-[#eef4ff]">
                    {/* ── Pill-based groups (all groups except the last) ── */}
                    {pillGroups.map((group) => {
                      const currentSelection = detailSelectedOptions.find(
                        (o) => o.groupId === group.id
                      )
                      return (
                        <div key={group.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-[#0d1c2d] flex items-center gap-1.5">
                              <span>{group.name}</span>
                              {group.required && (
                                <span className="text-[10px] font-normal text-red-500">* Required</span>
                              )}
                            </label>
                            {currentSelection && (
                              <span className="text-[11px] font-semibold text-[#00714d]">
                                {currentSelection.value.label}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {group.values.map((val) => {
                              const isOutOfStock = checkOptionOutOfStock(
                                detailItem, group.id, group.name, val, detailSelectedOptions
                              )
                              const isSelected = currentSelection?.value.id === val.id
                              // Count of items selected under this pill across all last-group values
                              const pillItemCount = Object.values(detailComboQuantities)
                                .filter((e) => e.selections.some((s) => s.groupId === group.id && s.value.id === val.id))
                                .reduce((sum, e) => sum + e.quantity, 0)

                              return (
                                <button
                                  key={val.id}
                                  type="button"
                                  disabled={isOutOfStock}
                                  onClick={() =>
                                    !isOutOfStock && handleSelectOption(group.id, group.name, val)
                                  }
                                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                                    isOutOfStock
                                      ? "border-slate-200 bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed line-through"
                                      : isSelected
                                      ? "border-[#006c49] bg-[#eef4ff] text-[#00714d] ring-2 ring-[#006c49]/20 font-bold shadow-xs scale-[1.02]"
                                      : "border-[#e2e8f0] bg-white hover:border-[#cbd5e1] text-[#0d1c2d]"
                                  }`}
                                >
                                  {val.image && (
                                    <div className={`relative w-5 h-5 rounded-md overflow-hidden bg-slate-200 shrink-0 ${isOutOfStock ? "grayscale opacity-50" : ""}`}>
                                      <Image src={val.image} alt={val.label} fill sizes="20px" className="object-cover" />
                                    </div>
                                  )}
                                  <span>{val.label}</span>
                                  {pillItemCount > 0 && (
                                    <span className="bg-[#006c49] text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                                      {pillItemCount}
                                    </span>
                                  )}
                                  {isOutOfStock && (
                                    <span className="text-[10px] text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded no-underline">No Stock</span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}

                    {/* ── Last group: Quantity rows with [- qty +] per value ── */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#0d1c2d] flex items-center gap-1.5">
                        <span>{lastGroup.name}</span>
                        <span className="text-[10px] font-normal text-[#76777d]">— set quantity per option</span>
                      </label>

                      <div className="divide-y divide-[#eef4ff] border border-[#eef4ff] rounded-xl overflow-hidden">
                        {lastGroup.values.map((val) => {
                          // Build a full candidate with this value to check stock
                          const baseSelections = detailSelectedOptions.filter((o) => o.groupId !== lastGroup.id)
                          const candidateSelections: SelectedOption[] = [
                            ...baseSelections,
                            { groupId: lastGroup.id, groupName: lastGroup.name, value: val },
                          ]
                          const comboKey = getComboKey(candidateSelections)
                          const skuStock = getSelectedSkuStock(detailItem, candidateSelections)
                          const isOutOfStock = skuStock !== undefined && skuStock <= 0
                          const qty = detailComboQuantities[comboKey]?.quantity || 0
                          const maxQty = skuStock !== undefined ? skuStock : 999

                          // Compute SKU sell price for this combination
                          const skuPrice = computeItemPrice(detailItem, candidateSelections)

                          return (
                            <div
                              key={val.id}
                              className={`flex items-center justify-between px-3.5 py-3 gap-3 transition-all ${
                                isOutOfStock
                                  ? "bg-slate-50/50 opacity-60"
                                  : qty > 0
                                  ? "bg-[#eef4ff]/40"
                                  : "bg-white hover:bg-[#f8f9ff]"
                              }`}
                            >
                              {/* Left: Value info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {val.image && (
                                    <div className={`relative w-7 h-7 rounded-lg overflow-hidden bg-slate-200 shrink-0 ${isOutOfStock ? "grayscale" : ""}`}>
                                      <Image src={val.image} alt={val.label} fill sizes="28px" className="object-cover" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className={`text-xs font-bold leading-tight truncate ${
                                      isOutOfStock ? "text-slate-400 line-through" : "text-[#0d1c2d]"
                                    }`}>
                                      {val.label}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      {isOutOfStock ? (
                                        <span className="text-[10px] text-red-500 font-bold">No Stock</span>
                                      ) : (
                                        <>
                                          <span className="text-[10px] text-[#006c49] font-bold">${skuPrice.toFixed(2)}</span>
                                          {skuStock !== undefined && (
                                            <span className="text-[10px] text-[#76777d]">
                                              · {skuStock > 0 ? `${skuStock} in stock` : ""}
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Right: Quantity stepper [- qty +] */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={isOutOfStock || qty <= 0}
                                  onClick={() => {
                                    setDetailComboQuantities((prev) => {
                                      const current = prev[comboKey]?.quantity || 0
                                      const nextQty = Math.max(0, current - 1)
                                      if (nextQty <= 0) {
                                        const updated = { ...prev }
                                        delete updated[comboKey]
                                        return updated
                                      }
                                      return {
                                        ...prev,
                                        [comboKey]: {
                                          selections: candidateSelections,
                                          quantity: nextQty,
                                        },
                                      }
                                    })
                                  }}
                                  className="w-8 h-8 rounded-lg bg-white border border-[#ccdbf2] text-xs font-bold text-[#0d1c2d] hover:bg-slate-50 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                                >
                                  −
                                </button>
                                <span className={`w-7 text-center text-xs font-bold tabular-nums ${
                                  qty > 0 ? "text-[#006c49]" : "text-[#76777d]"
                                }`}>
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  disabled={isOutOfStock || qty >= maxQty}
                                  onClick={() => {
                                    setDetailComboQuantities((prev) => {
                                      const current = prev[comboKey]?.quantity || 0
                                      const nextQty = Math.min(maxQty, current + 1)
                                      return {
                                        ...prev,
                                        [comboKey]: {
                                          selections: candidateSelections,
                                          quantity: nextQty,
                                        },
                                      }
                                    })
                                  }}
                                  className="w-8 h-8 rounded-lg bg-[#006c49] text-white text-xs font-bold hover:bg-[#005236] disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* ── Selected Combinations Summary Chips ── */}
                    {Object.keys(detailComboQuantities).length > 0 && (
                      <div className="pt-3 border-t border-[#eef4ff] space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-[#0d1c2d]">
                            Selected Items ({Object.values(detailComboQuantities).reduce((s, e) => s + e.quantity, 0)})
                          </label>
                          <button
                            type="button"
                            onClick={() => setDetailComboQuantities({})}
                            className="text-[10px] text-red-500 font-semibold hover:underline"
                          >
                            Clear All
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(detailComboQuantities).map(([k, entry]) => {
                            const desc = entry.selections.map((s) => `${s.groupName}: ${s.value.label}`).join(", ")
                            const price = computeItemPrice(detailItem, entry.selections) * entry.quantity
                            return (
                              <span
                                key={k}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#eef4ff] text-[#00714d] text-[11px] font-semibold border border-[#ccdbf2]"
                              >
                                <span>{desc}</span>
                                <span className="bg-[#006c49] text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                                  ×{entry.quantity}
                                </span>
                                <span className="text-[#0d1c2d] font-bold text-[10px]">
                                  ${price.toFixed(2)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDetailComboQuantities((prev) => {
                                      const copy = { ...prev }
                                      delete copy[k]
                                      return copy
                                    })
                                  }}
                                  className="text-[#76777d] hover:text-red-500 font-bold ml-0.5 text-xs leading-none"
                                >
                                  ×
                                </button>
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Modal Footer / Add to Bag */}
            {(() => {
              if (!detailItem) return null
              const selectedEntries = Object.values(detailComboQuantities).filter((e) => e.quantity > 0)
              const totalQty = selectedEntries.reduce((sum, e) => sum + e.quantity, 0)
              const totalPrice = selectedEntries.reduce(
                (sum, e) => sum + computeItemPrice(detailItem, e.selections) * e.quantity,
                0
              )

              return (
                <div className="p-4 sm:p-5 border-t border-[#eef4ff] bg-[#f8f9ff] sticky bottom-0 space-y-3">
                  {/* Price summary */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] text-[#76777d]">
                        {totalQty > 0
                          ? `Total (${totalQty} ${totalQty > 1 ? "items" : "item"})`
                          : "Select quantities above"}
                      </p>
                      <p className="text-base sm:text-xl font-black text-[#006c49]">
                        {totalQty > 0 ? `$${totalPrice.toFixed(2)}` : "$0.00"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Telegram Send Order button — only shown when seller has Telegram linked */}
                      {sellerTelegramUsername && (
                        <button
                          type="button"
                          title="Send order to seller via Telegram"
                          disabled={totalQty <= 0}
                          onClick={() => {
                            // Build order summary lines across all selected combinations including barcode
                            const lines = selectedEntries.map((entry) => {
                              const linePrice = computeItemPrice(detailItem, entry.selections) * entry.quantity
                              const optionDesc = entry.selections
                                .map((o) => `${o.groupName}: ${o.value.label}`)
                                .join(", ")
                              const barcodeText = detailItem.barcode ? ` [Barcode: ${detailItem.barcode}]` : ""
                              return `• ${detailItem.name}${barcodeText} | ${optionDesc} × ${entry.quantity} — $${linePrice.toFixed(2)}`
                            })
                            const storeName = activeRestaurant?.name || "the store"
                            const divider = "─────────────────"
                            const message = [
                              `🛍️ Order from ${storeName}`,
                              divider,
                              ...lines,
                              divider,
                              `Total: ${totalQty} ${totalQty > 1 ? "items" : "item"} — $${totalPrice.toFixed(2)}`,
                            ].join("\n")
                            const tgUsername = sellerTelegramUsername.replace(/^@/, "")
                            window.open(
                              `https://t.me/${tgUsername}?text=${encodeURIComponent(message)}`,
                              "_blank"
                            )
                          }}
                          className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#2196F3] hover:bg-[#1976d2] disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all shadow-xs shrink-0"
                        >
                          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.869 4.326-2.96-.924c-.643-.203-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.829.941z"/>
                          </svg>
                        </button>
                      )}

                      {/* Add to Bag button */}
                      <button
                        type="button"
                        disabled={totalQty <= 0 || !detailItem.available}
                        onClick={handleAddFromDetail}
                        className="bg-[#006c49] hover:bg-[#005236] disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center gap-1.5"
                      >
                        <span>
                          {totalQty <= 0
                            ? "Select Items"
                            : `+ Add ${totalQty} to Bag · $${totalPrice.toFixed(2)}`}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()}

          </div>
        </div>
      )}

      {/* Cart Drawer with Permanent Storage, Full CRUD, Item Images & Selective Telegram Checkout */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md h-full flex flex-col justify-between shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-[#eef4ff] bg-white sticky top-0 z-10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🛍️</span>
                  <div>
                    <h3 className="text-base font-bold text-[#0d1c2d]">Shopping Bag</h3>
                    <p className="text-[11px] text-[#76777d]">
                      {totalCartItemCount} {totalCartItemCount === 1 ? "item" : "items"} in cart
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearEntireCart}
                      className="text-[11px] text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                      title="Clear all items"
                    >
                      Clear All
                    </button>
                  )}
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="w-8 h-8 rounded-full bg-[#f8f9ff] hover:bg-[#eef4ff] text-[#76777d] hover:text-[#0d1c2d] flex items-center justify-center text-sm font-bold transition-all"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Account Permanent Storage Status Banner */}
              {user ? (
                <div className="flex items-center gap-1.5 text-[11px] text-[#00714d] font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                  <span>☁️</span>
                  <span>Permanently saved to your MenuHub account</span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                  <div className="flex items-center gap-1 text-amber-900 font-medium text-[11px]">
                    <span>💡</span>
                    <span>Guest Bag (Temporary)</span>
                  </div>
                  <Link
                    href="/login"
                    onClick={() => setIsCartOpen(false)}
                    className="text-[11px] text-[#00714d] font-bold hover:underline"
                  >
                    Sign in to save permanently →
                  </Link>
                </div>
              )}

              {/* Sub-header: Select All & Batch Actions */}
              {cart.length > 0 && (
                <div className="pt-2 border-t border-[#eef4ff] flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-[#0d1c2d]">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected
                      }}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded text-[#006c49] accent-[#006c49] cursor-pointer"
                    />
                    <span>
                      Select All ({selectedCartItems.length}/{cart.length})
                    </span>
                  </label>

                  {selectedCartItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteSelectedItems}
                      className="text-[11px] text-slate-500 hover:text-red-600 font-medium transition-colors"
                    >
                      Remove Selected ({selectedCartItems.length})
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#f8f9ff]">
              {cart.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <span className="text-5xl inline-block mb-3">🛒</span>
                  <h4 className="text-base font-bold text-[#0d1c2d]">Your Bag is Empty</h4>
                  <p className="text-xs text-[#76777d] mt-1 max-w-xs mx-auto">
                    Explore our stores and add delicious items, fashion, or groceries to your order.
                  </p>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="mt-5 bg-[#006c49] hover:bg-[#005236] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                cart.map((ci) => {
                  const itemUnitPrice = computeItemPrice(ci.item, ci.selectedOptions)
                  const itemTotalPrice = itemUnitPrice * ci.quantity

                  return (
                    <div
                      key={ci.id}
                      className={`flex items-start p-3 rounded-2xl border transition-all gap-3 ${
                        ci.selectedForOrder
                          ? "bg-white border-[#ccdbf2] shadow-2xs"
                          : "bg-slate-50/70 border-slate-200 opacity-70"
                      }`}
                    >
                      {/* Checkbox for Selective Ordering */}
                      <div className="pt-1">
                        <input
                          type="checkbox"
                          checked={ci.selectedForOrder}
                          onChange={() => handleToggleCartItemSelect(ci.id)}
                          className="w-4 h-4 rounded text-[#006c49] accent-[#006c49] cursor-pointer"
                        />
                      </div>

                      {/* Small Product / Variant Image Thumbnail */}
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-[#f4f7fc] border border-[#eef4ff] shrink-0 flex items-center justify-center">
                        <Image
                          src={ci.selectedImage || ci.item.image}
                          alt={ci.item.name}
                          fill
                          sizes="56px"
                          className="object-contain p-1"
                        />
                      </div>

                      {/* Item Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-xs sm:text-sm font-bold text-[#0d1c2d] truncate">
                            {ci.item.name}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleDeleteCartItem(ci.id)}
                            className="text-slate-400 hover:text-red-600 transition-colors text-xs p-0.5 ml-1"
                            title="Remove item"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Store & Barcode pills */}
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          {ci.storeName && (
                            <span className="text-[9px] text-[#76777d] font-semibold bg-slate-100 px-1.5 py-0.2 rounded">
                              {ci.storeName}
                            </span>
                          )}
                          {ci.item.barcode && (
                            <span className="text-[9px] font-mono text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-bold">
                              🏷️ {ci.item.barcode}
                            </span>
                          )}
                        </div>

                        {/* Selected Variants / Options Badges */}
                        {ci.selectedOptions && ci.selectedOptions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {ci.selectedOptions.map((opt) => (
                              <span
                                key={opt.groupId}
                                className="text-[10px] bg-[#eef4ff] border border-[#ccdbf2] text-[#00714d] px-1.5 py-0.5 rounded-md font-semibold"
                              >
                                {opt.groupName}: {opt.value.label}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Price & Quantity Stepper */}
                        <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-[#f1f5f9]">
                          <div>
                            <span className="text-[10px] text-[#76777d]">
                              ${itemUnitPrice.toFixed(2)} ea
                            </span>
                            <p className="text-xs sm:text-sm font-black text-[#006c49]">
                              ${itemTotalPrice.toFixed(2)}
                            </p>
                          </div>

                          {/* Stepper [- qty +] */}
                          <div className="flex items-center gap-1 bg-[#f8f9ff] border border-[#ccdbf2] rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateCartItemQty(ci.id, ci.quantity - 1)}
                              className="w-6 h-6 rounded bg-white hover:bg-slate-100 text-xs font-bold text-[#0d1c2d] flex items-center justify-center transition-all shadow-2xs"
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-xs font-bold tabular-nums text-[#0d1c2d]">
                              {ci.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateCartItemQty(ci.id, ci.quantity + 1)}
                              className="w-6 h-6 rounded bg-[#006c49] hover:bg-[#005236] text-xs font-bold text-white flex items-center justify-center transition-all shadow-2xs"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Sticky Drawer Footer */}
            {cart.length > 0 && (
              <div className="p-4 sm:p-5 border-t border-[#eef4ff] bg-white space-y-3 shadow-lg">
                {/* Price Breakdown */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-[#76777d]">
                    <span>Total Bag ({totalCartItemCount} items)</span>
                    <span>${totalCartSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-baseline text-base font-black text-[#0d1c2d]">
                    <span className="flex items-center gap-1.5">
                      <span>Selected for Order</span>
                      <span className="text-xs font-bold text-[#006c49] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {selectedItemCount} items
                      </span>
                    </span>
                    <span className="text-lg text-[#006c49]">${selectedSubtotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Action Buttons: Telegram Order (Selected) & Direct Checkout */}
                <div className="flex items-center gap-2 pt-1">
                  {/* Telegram Send Order Button */}
                  <button
                    type="button"
                    disabled={selectedItemCount <= 0}
                    onClick={() => {
                      if (selectedCartItems.length === 0) return
                      const lines = selectedCartItems.map((ci) => {
                        const itemTotalPrice = computeItemPrice(ci.item, ci.selectedOptions) * ci.quantity
                        const optionDesc =
                          ci.selectedOptions && ci.selectedOptions.length > 0
                            ? " | " + ci.selectedOptions.map((o) => `${o.groupName}: ${o.value.label}`).join(", ")
                            : ""
                        const barcodeText = ci.item.barcode ? ` [Barcode: ${ci.item.barcode}]` : ""
                        const storeTag = ci.storeName ? ` (${ci.storeName})` : ""
                        return `• ${ci.item.name}${barcodeText}${storeTag}${optionDesc} × ${ci.quantity} — $${itemTotalPrice.toFixed(2)}`
                      })
                      const storeName =
                        activeRestaurant?.name || selectedCartItems[0]?.storeName || "MenuHub Store"
                      const divider = "─────────────────"
                      const message = [
                        `🛍️ Order from ${storeName}`,
                        divider,
                        ...lines,
                        divider,
                        `Total: ${selectedItemCount} ${selectedItemCount > 1 ? "items" : "item"} — $${selectedSubtotal.toFixed(2)}`,
                      ].join("\n")
                      const tgUsername = (sellerTelegramUsername || "").replace(/^@/, "")
                      if (tgUsername) {
                        window.open(
                          `https://t.me/${tgUsername}?text=${encodeURIComponent(message)}`,
                          "_blank"
                        )
                      } else {
                        // Fallback: Copy to clipboard
                        navigator.clipboard.writeText(message)
                        alert("Order summary copied to clipboard! (The seller does not have a linked Telegram account yet)")
                      }
                    }}
                    className="h-12 px-4 rounded-xl flex items-center justify-center gap-2 bg-[#2196F3] hover:bg-[#1976d2] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-xs shrink-0"
                    title="Send selected order items via Telegram"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.869 4.326-2.96-.924c-.643-.203-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.829.941z"/>
                    </svg>
                    <span className="hidden sm:inline">Send to Telegram</span>
                  </button>

                  {/* Checkout Button */}
                  <button
                    disabled={selectedItemCount <= 0}
                    onClick={() => {
                      if (selectedCartItems.length === 0) return
                      alert(`Successfully placed order for ${selectedItemCount} items ($${selectedSubtotal.toFixed(2)})!`)
                      // Remove only the checked items, keep unchecked items saved
                      setCart((prev) => prev.filter((ci) => !ci.selectedForOrder))
                      setIsCartOpen(false)
                    }}
                    className="flex-1 h-12 bg-[#006c49] hover:bg-[#005236] disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <span>
                      {selectedItemCount <= 0
                        ? "Select Items to Order"
                        : `Checkout ${selectedItemCount} ${selectedItemCount === 1 ? "Item" : "Items"} · $${selectedSubtotal.toFixed(2)}`}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Cart Quick Access Pill */}
      {totalCartItemCount > 0 && !isCartOpen && (
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-[#006c49] hover:bg-[#005236] text-white px-4 py-3 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3 border-2 border-emerald-300 animate-in fade-in slide-in-from-bottom-4 group cursor-pointer"
        >
          <div className="relative">
            <span className="text-xl">🛍️</span>
            <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-900 text-[10px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-xs">
              {totalCartItemCount}
            </span>
          </div>
          <div className="text-left">
            <p className="text-[10px] font-medium text-emerald-100 uppercase tracking-wider leading-none">Your Bag</p>
            <p className="text-xs font-black mt-0.5">${totalCartSubtotal.toFixed(2)}</p>
          </div>
        </button>
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
