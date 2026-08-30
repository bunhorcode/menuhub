import { createClient } from "./supabase/client"
import { Store, StoreMenuItem, SellerProfile, OptionGroup, VariantCombination } from "./seller-types"

export const DEFAULT_STORES: Store[] = []

export const DEFAULT_MENU_ITEMS: StoreMenuItem[] = []

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
  telegram_username: string | null
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
  barcode?: string | null
  options: OptionGroup[] | null
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
    telegramUsername: row.telegram_username || undefined,
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
  // Parse options & variants matrix — handle both array and { groups, variants } object
  let parsedOptions: OptionGroup[] | undefined = undefined
  let parsedVariants: VariantCombination[] | undefined = undefined

  if (row.options) {
    try {
      const raw = typeof row.options === "string" ? JSON.parse(row.options) : row.options
      if (Array.isArray(raw)) {
        parsedOptions = raw.length > 0 ? raw : undefined
      } else if (raw && typeof raw === "object") {
        parsedOptions = Array.isArray(raw.groups) && raw.groups.length > 0 ? raw.groups : undefined
        parsedVariants = Array.isArray(raw.variants) && raw.variants.length > 0 ? raw.variants : undefined
      }
    } catch {
      parsedOptions = undefined
      parsedVariants = undefined
    }
  }

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
    barcode: row.barcode || undefined,
    options: parsedOptions,
    variants: parsedVariants,
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
      telegram_username: profile.telegramUsername?.replace(/^@/, "") || null,
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

// ── 1b. Get seller profile by store ID (for storefront Telegram lookup) ──────
export async function getSellerProfileByStoreId(storeId: string): Promise<SellerProfile | null> {
  if (!storeId) return null
  try {
    const supabase = createClient()
    // Join stores → sellers via seller_id / user_id
    const { data: storeData, error: storeErr } = await supabase
      .from("stores")
      .select("seller_id")
      .eq("id", storeId)
      .maybeSingle()
    if (storeErr || !storeData) return null

    const { data, error } = await supabase
      .from("sellers")
      .select("*")
      .eq("user_id", storeData.seller_id)
      .maybeSingle()
    if (!error && data) return mapDbSeller(data)
  } catch (e) {
    console.error("getSellerProfileByStoreId error:", e)
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

    if (!error && data) {
      return data.map(mapDbStore)
    }
  } catch (e) {
    console.error("Supabase getStores exception:", e)
  }
  return []
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

    if (!error && data) {
      return data.map(mapDbMenuItem)
    }
  } catch (e) {
    console.error("Supabase getMenuItems exception:", e)
  }
  return []
}

export async function saveMenuItem(item: Omit<StoreMenuItem, "id" | "createdAt"> & { id?: string }): Promise<StoreMenuItem | null> {
  try {
    const supabase = createClient()
    // Store options and multi-attribute variant matrix cleanly in options column
    let optionsPayload: any = null
    if (item.options && item.options.length > 0) {
      if (item.variants && item.variants.length > 0) {
        optionsPayload = {
          groups: item.options,
          variants: item.variants,
        }
      } else {
        optionsPayload = item.options
      }
    }

    const payload: any = {
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
      barcode: item.barcode || null,
      options: optionsPayload,
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

// ── 3b. Barcode Uniqueness Validation ────────────────────────────────────────
export async function checkBarcodeAvailability(
  barcode: string,
  excludeItemId?: string
): Promise<{ isUnique: boolean; existingItemName?: string }> {
  const clean = barcode.trim()
  if (!clean) return { isUnique: true }

  try {
    const supabase = createClient()
    let query = supabase
      .from("menu_items")
      .select("id, name, barcode")
      .eq("barcode", clean)

    if (excludeItemId && !excludeItemId.startsWith("item-")) {
      query = query.neq("id", excludeItemId)
    }

    const { data, error } = await query

    if (!error && data && data.length > 0) {
      const collision = data.find((d) => d.id !== excludeItemId)
      if (collision) {
        return { isUnique: false, existingItemName: collision.name }
      }
    }
  } catch (e) {
    console.error("checkBarcodeAvailability exception:", e)
  }

  return { isUnique: true }
}

export async function generateUniqueBarcode(prefix = "200"): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    // Generate 12-digit EAN-13 formatted string with valid check digit
    let code = prefix
    while (code.length < 11) {
      code += Math.floor(Math.random() * 10).toString()
    }
    let sum = 0
    for (let i = 0; i < code.length; i++) {
      const digit = parseInt(code[i], 10)
      sum += i % 2 === 0 ? digit : digit * 3
    }
    const checkDigit = (10 - (sum % 10)) % 10
    const candidate = code + checkDigit.toString()

    const { isUnique } = await checkBarcodeAvailability(candidate)
    if (isUnique) {
      return candidate
    }
  }
  // Fallback with timestamp
  const ts = Date.now().toString().slice(-8)
  return `${prefix}${ts}`
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


