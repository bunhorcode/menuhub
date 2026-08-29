import { createClient } from "./supabase/client"
import { Store, StoreMenuItem, SellerProfile } from "./seller-types"

export const DEFAULT_STORES: Store[] = [
  {
    id: "rest-1",
    sellerId: "system",
    name: "Urban Threads Fashion",
    cuisine: "Streetwear, Casual & Outerwear",
    priceRange: "$$",
    rating: 4.9,
    reviewsCount: 280,
    badgeIcon: "👗",
    image: "/images/bistro_delight.jpg",
    category: "Clothing & Fashion",
    description: "Premium contemporary fashion boutique offering curated everyday apparel and outerwear.",
    createdAt: "2024-01-01",
  },
  {
    id: "rest-2",
    sellerId: "system",
    name: "FreshMart Organic Groceries",
    cuisine: "Fresh Produce, Bakery & Essentials",
    priceRange: "$",
    rating: 4.8,
    reviewsCount: 420,
    badgeIcon: "🛒",
    image: "/images/berry_tart.jpg",
    category: "Groceries & Supermarket",
    description: "Farm-to-table organic vegetables, artisan pantry items, dairy, and daily essentials.",
    createdAt: "2024-01-02",
  },
  {
    id: "rest-3",
    sellerId: "system",
    name: "Cafe Nova Roasters",
    cuisine: "Artisan Coffee, Pastries & Beans",
    priceRange: "$",
    rating: 4.9,
    reviewsCount: 310,
    badgeIcon: "☕",
    image: "/images/matcha_latte.jpg",
    category: "Cafes & Bakery",
    description: "Specialty single-origin micro-lot coffees, pour-overs, and handcrafted French pastries.",
    createdAt: "2024-01-03",
  },
  {
    id: "rest-4",
    sellerId: "system",
    name: "PixelTech Gadgets",
    cuisine: "Audio Gear, Accessories & Smart Devices",
    priceRange: "$$$",
    rating: 4.7,
    reviewsCount: 195,
    badgeIcon: "📱",
    image: "/images/sushi_zen.jpg",
    category: "Electronics & Gadgets",
    description: "Cutting-edge consumer tech, premium wireless audio, charging docks, and smart accessories.",
    createdAt: "2024-01-04",
  },
  {
    id: "rest-5",
    sellerId: "system",
    name: "Bistro Delight",
    cuisine: "Modern European Dining",
    priceRange: "$$",
    rating: 4.8,
    reviewsCount: 150,
    badgeIcon: "🍽️",
    image: "/images/truffle_pasta.jpg",
    category: "Restaurants & Dining",
    description: "Classic modern European cuisine crafted with seasonal organic produce and fine pairings.",
    createdAt: "2024-01-05",
  },
  {
    id: "rest-6",
    sellerId: "system",
    name: "Glow & Flora Botanicals",
    cuisine: "Skincare, Aromatherapy & Wellness",
    priceRange: "$$",
    rating: 4.9,
    reviewsCount: 160,
    badgeIcon: "💄",
    image: "/images/wagyu_burger.jpg",
    category: "Beauty & Cosmetics",
    description: "Cruelty-free clean beauty essentials, organic botanical serums, and self-care collections.",
    createdAt: "2024-01-06",
  },
]

export const DEFAULT_MENU_ITEMS: StoreMenuItem[] = [
  // Urban Threads Fashion
  {
    id: "item-1",
    storeId: "rest-1",
    name: "Oversized Heavyweight Cotton Hoodie",
    category: "Apparel & Tops",
    price: 65.0,
    description: "450 GSM French terry cotton hoodie with drop-shoulder silhouette and ribbed trim.",
    image: "/images/bistro_delight.jpg",
    tags: ["BESTSELLER", "100% COTTON"],
    calories: "Sizes: S, M, L, XL",
    prepTime: "Same-Day Dispatch",
    available: true,
    createdAt: "2024-01-01",
  },
  {
    id: "item-2",
    storeId: "rest-1",
    name: "Vintage Wash Relaxed Denim",
    category: "Bottoms & Pants",
    price: 78.0,
    description: "13oz Japanese selvedge denim in an authentic washed vintage indigo finish.",
    image: "/images/wagyu_burger.jpg",
    tags: ["NEW ARRIVAL", "PREMIUM"],
    calories: "Sizes: 28 - 36",
    prepTime: "Same-Day Dispatch",
    available: true,
    createdAt: "2024-01-01",
  },
  // FreshMart Organic Groceries
  {
    id: "item-3",
    storeId: "rest-2",
    name: "Seasonal Organic Berry & Fruit Box",
    category: "Fresh Produce",
    price: 24.5,
    description: "Hand-picked fresh strawberries, blueberries, blackberries, and crisp organic Honeycrisp apples.",
    image: "/images/berry_tart.jpg",
    tags: ["100% ORGANIC", "FARM FRESH"],
    calories: "1.5 kg box",
    prepTime: "Fresh Delivery (1 hr)",
    available: true,
    createdAt: "2024-01-02",
  },
  {
    id: "item-4",
    storeId: "rest-2",
    name: "Artisan Sourdough Country Loaf",
    category: "Bakery & Bread",
    price: 7.5,
    description: "Naturally fermented 36-hour sourdough baked daily with organic stone-ground wheat flour.",
    image: "/images/truffle_pasta.jpg",
    tags: ["FRESHLY BAKED", "VEGAN"],
    calories: "750g loaf",
    prepTime: "Baked Morning",
    available: true,
    createdAt: "2024-01-02",
  },
  // Cafe Nova Roasters
  {
    id: "item-5",
    storeId: "rest-3",
    name: "Iced Ceremonial Matcha Latte",
    category: "Artisan Drinks",
    price: 8.5,
    description: "Single-origin Uji ceremonial matcha whisked to order with organic oat milk and raw agave syrup.",
    image: "/images/matcha_latte.jpg",
    tags: ["VEGAN", "ORGANIC"],
    calories: "16 oz",
    prepTime: "5 min",
    available: true,
    createdAt: "2024-01-03",
  },
  // PixelTech Gadgets
  {
    id: "item-6",
    storeId: "rest-4",
    name: "Wireless ANC Pro Studio Earbuds",
    category: "Audio Gear",
    price: 129.0,
    description: "Active noise cancellation, 32-hour battery life with Qi wireless charging case and Hi-Res audio codec.",
    image: "/images/sushi_zen.jpg",
    tags: ["BLUETOOTH 5.3", "IPX5 WATERPROOF"],
    calories: "Matte Black",
    prepTime: "Express Delivery",
    available: true,
    createdAt: "2024-01-04",
  },
  // Bistro Delight
  {
    id: "item-7",
    storeId: "rest-5",
    name: "Artisan Truffle Tagliatelle",
    category: "Chef's Specials",
    price: 26.5,
    description: "Hand-crafted egg pasta tossed in cultured butter, parmigiano-reggiano, and shaved black truffles.",
    image: "/images/truffle_pasta.jpg",
    tags: ["SIGNATURE", "CHEF'S PICK"],
    calories: "680 kcal",
    prepTime: "15 min",
    available: true,
    createdAt: "2024-01-05",
  },
]

// Database mapping helpers
interface DbSellerRow {
  id: string
  user_id: string
  business_name: string
  owner_name: string
  phone: string
  address: string
  cuisine_type: string
  bio: string | null
  status: "active" | "pending"
  created_at: string
}

interface DbStoreRow {
  id: string
  seller_id: string
  name: string
  cuisine: string
  price_range: string
  rating: number
  reviews_count: number
  badge_icon: string
  image: string
  category: string
  description: string | null
  created_at: string
}

interface DbMenuItemRow {
  id: string
  store_id: string
  name: string
  category: string
  price: number
  description: string
  image: string
  tags: string[] | null
  calories: string | null
  prep_time: string | null
  available: boolean
  created_at: string
}

function mapDbSeller(row: DbSellerRow): SellerProfile {
  return {
    id: row.id,
    userId: row.user_id,
    businessName: row.business_name,
    ownerName: row.owner_name,
    phone: row.phone,
    address: row.address,
    cuisineType: row.cuisine_type,
    bio: row.bio || undefined,
    status: row.status || "active",
    createdAt: row.created_at,
  }
}

function mapDbStore(row: DbStoreRow): Store {
  return {
    id: row.id,
    sellerId: row.seller_id,
    name: row.name,
    cuisine: row.cuisine,
    priceRange: (row.price_range as "$" | "$$" | "$$$") || "$$",
    rating: Number(row.rating) || 5.0,
    reviewsCount: Number(row.reviews_count) || 0,
    badgeIcon: row.badge_icon || "🍽️",
    image: row.image,
    category: row.category,
    description: row.description || undefined,
    createdAt: row.created_at,
  }
}

function mapDbMenuItem(row: DbMenuItemRow): StoreMenuItem {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    category: row.category,
    price: Number(row.price) || 0,
    description: row.description,
    image: row.image,
    tags: row.tags || [],
    calories: row.calories || undefined,
    prepTime: row.prep_time || undefined,
    available: row.available ?? true,
    createdAt: row.created_at,
  }
}

// ── 1. Seller Profiles in Supabase ───────────────────────────────────────────
export async function getSellerProfile(userId?: string): Promise<SellerProfile | null> {
  if (!userId) return null
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("sellers")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()

    if (!error && data) {
      return mapDbSeller(data)
    }
  } catch (e) {
    console.error("Supabase getSellerProfile error:", e)
  }
  return null
}

export async function saveSellerProfile(profile: Omit<SellerProfile, "id" | "createdAt"> & { id?: string }): Promise<SellerProfile | null> {
  try {
    const supabase = createClient()
    const payload: Partial<DbSellerRow> = {
      user_id: profile.userId,
      business_name: profile.businessName,
      owner_name: profile.ownerName,
      phone: profile.phone,
      address: profile.address,
      cuisine_type: profile.cuisineType,
      bio: profile.bio || null,
      status: profile.status || "active",
    }
    if (profile.id && !profile.id.startsWith("seller-")) {
      payload.id = profile.id
    }

    const { data, error } = await supabase
      .from("sellers")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single()

    if (!error && data) {
      return mapDbSeller(data)
    }
    console.error("Supabase saveSellerProfile error:", error)
  } catch (e) {
    console.error("Supabase saveSellerProfile exception:", e)
  }
  return null
}

// ── 2. Stores in Supabase ───────────────────────────────────────────────────
export async function getStores(sellerId?: string): Promise<Store[]> {
  try {
    const supabase = createClient()
    let query = supabase.from("stores").select("*").order("created_at", { ascending: false })
    if (sellerId) {
      query = query.eq("seller_id", sellerId)
    }
    const { data, error } = await query

    if (!error && data && data.length > 0) {
      const dbStores = data.map(mapDbStore)
      if (sellerId) return dbStores
      return [...dbStores, ...DEFAULT_STORES]
    }
  } catch (e) {
    console.error("Supabase getStores exception:", e)
  }
  return sellerId ? [] : DEFAULT_STORES
}

export async function saveStore(store: Omit<Store, "id" | "createdAt"> & { id?: string }): Promise<Store | null> {
  try {
    const supabase = createClient()
    const payload: Partial<DbStoreRow> = {
      seller_id: store.sellerId,
      name: store.name,
      cuisine: store.cuisine,
      price_range: store.priceRange,
      rating: store.rating || 5.0,
      reviews_count: store.reviewsCount || 1,
      badge_icon: store.badgeIcon || "🍽️",
      image: store.image,
      category: store.category,
      description: store.description || null,
    }
    if (store.id && !store.id.startsWith("store-") && !store.id.startsWith("rest-")) {
      payload.id = store.id
    }

    const { data, error } = await supabase
      .from("stores")
      .upsert(payload)
      .select()
      .single()

    if (!error && data) {
      return mapDbStore(data)
    }
    console.error("Supabase saveStore error:", error)
  } catch (e) {
    console.error("Supabase saveStore exception:", e)
  }
  return null
}

export async function deleteStore(storeId: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase.from("stores").delete().eq("id", storeId)
    return !error
  } catch (e) {
    console.error("Supabase deleteStore exception:", e)
    return false
  }
}

// ── 3. Menu Items in Supabase ───────────────────────────────────────────────
export async function getMenuItems(storeId?: string): Promise<StoreMenuItem[]> {
  try {
    const supabase = createClient()
    let query = supabase.from("menu_items").select("*").order("created_at", { ascending: false })
    if (storeId) {
      query = query.eq("store_id", storeId)
    }
    const { data, error } = await query

    if (!error && data && data.length > 0) {
      return data.map(mapDbMenuItem)
    }
  } catch (e) {
    console.error("Supabase getMenuItems exception:", e)
  }

  // Fallback to sample items for default store IDs
  if (storeId) {
    const defaultMatches = DEFAULT_MENU_ITEMS.filter((i) => i.storeId === storeId)
    return defaultMatches.length > 0 ? defaultMatches : DEFAULT_MENU_ITEMS
  }
  return DEFAULT_MENU_ITEMS
}

export async function saveMenuItem(item: Omit<StoreMenuItem, "id" | "createdAt"> & { id?: string }): Promise<StoreMenuItem | null> {
  try {
    const supabase = createClient()
    const payload: Partial<DbMenuItemRow> = {
      store_id: item.storeId,
      name: item.name,
      category: item.category,
      price: item.price,
      description: item.description,
      image: item.image,
      tags: item.tags || [],
      calories: item.calories || null,
      prep_time: item.prepTime || null,
      available: item.available ?? true,
    }
    if (item.id && !item.id.startsWith("item-")) {
      payload.id = item.id
    }

    const { data, error } = await supabase
      .from("menu_items")
      .upsert(payload)
      .select()
      .single()

    if (!error && data) {
      return mapDbMenuItem(data)
    }
    console.error("Supabase saveMenuItem error:", error)
  } catch (e) {
    console.error("Supabase saveMenuItem exception:", e)
  }
  return null
}

export async function deleteMenuItem(itemId: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase.from("menu_items").delete().eq("id", itemId)
    return !error
  } catch (e) {
    console.error("Supabase deleteMenuItem exception:", e)
    return false
  }
}

// ── 4. Supabase Storage Image Upload ─────────────────────────────────────────
export async function uploadStoreImage(
  file: File,
  folder: "products" | "stores" = "products"
): Promise<{ url: string | null; error: string | null }> {
  try {
    const supabase = createClient()
    const fileExt = file.name.split(".").pop() || "jpg"
    const cleanFileName = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
    const filePath = `${folder}/${Date.now()}_${cleanFileName}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from("store-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      })

    if (uploadError) {
      console.error("Supabase storage upload error:", uploadError)
      return { url: null, error: uploadError.message }
    }

    const { data } = supabase.storage.from("store-images").getPublicUrl(filePath)
    return { url: data.publicUrl, error: null }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to upload image"
    console.error("Supabase storage exception:", e)
    return { url: null, error: message }
  }
}


