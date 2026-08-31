export type StoreCategoryType =
  | "Restaurants & Dining"
  | "Cafes & Bakery"
  | "Clothing & Fashion"
  | "Groceries & Supermarket"
  | "Electronics & Gadgets"
  | "Beauty & Cosmetics"
  | "Health & Wellness"
  | "Home & Living"
  | "Books & Stationery"
  | "Pet Supplies"
  | "Sports & Fitness"
  | "General Retail"
  | string

// ── Dynamic Product Variant / Option Types ───────────────────────────────────
export interface OptionValue {
  id: string
  label: string          // e.g. "Red", "Large", "50%"
  priceAdjustment: number // e.g. +2.00, 0, -1.00
  image?: string         // optional variant-specific image URL
  stock?: number         // stock inventory count: e.g. 5, 0 (0 = out of stock/disabled), undefined = unlimited
}

export interface OptionGroup {
  id: string
  name: string           // e.g. "Color", "Size", "Sugar Level"
  required: boolean      // must the customer pick one?
  values: OptionValue[]
}

// ── Multi-Attribute Variant Combination (SKU Matrix) ─────────────────────────
export interface VariantCombination {
  id: string
  options: Record<string, string> // e.g. { "Color": "Red", "Size": "S" }
  stock: number                   // stock quantity: e.g. 2, 0 (0 = No Stock)
  costPrice?: number              // cost / wholesale price (seller unit cost, e.g. 10.00)
  sellPrice?: number              // specific selling / retail price for this SKU (e.g. 25.00)
  priceAdjustment?: number        // delta adjustment (+/- e.g. +2.00)
  image?: string                  // variant combination image URL (optional)
  barcode?: string                // specific barcode/SKU code for this combination
}

export interface SellerProfile {
  id: string
  userId: string
  businessName: string
  ownerName: string
  phone: string
  address: string
  cuisineType: string // Store type / business specialty
  bio?: string
  telegramUsername?: string  // e.g. "@mystore" or "mystore" — used for order notifications
  createdAt: string
  status: "active" | "pending"
}

export interface Store {
  id: string
  sellerId: string
  name: string
  cuisine: string // Store subtitle / specialty description (e.g. "Streetwear & Apparel", "Organic Produce", "Artisan Coffee")
  priceRange: "$" | "$$" | "$$$"
  rating: number
  reviewsCount: number
  badgeIcon: string
  image: string
  category: StoreCategoryType
  description?: string
  createdAt: string
}

export interface StoreMenuItem {
  id: string
  storeId: string
  name: string
  category: string // Product category / catalog section
  price: number
  description: string
  image: string
  tags: string[]
  calories?: string // Product specifications / size / weight / calories
  prepTime?: string // Fulfillment time / delivery / prep time
  available: boolean
  stock?: number // Stock inventory count for simple items (e.g. 50 units, 0 = Sold Out)
  costPrice?: number // Wholesale / unit cost price (e.g. 15.00)
  barcode?: string // Barcode / SKU / UPC code for inventory tracking & POS scanning
  options?: OptionGroup[] // Dynamic variant groups (Color, Size, Sugar Level, etc.)
  variants?: VariantCombination[] // Multi-attribute combination matrix (e.g. Red/S = 2, Red/XL = 0)
  createdAt: string
}

