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

export interface SellerProfile {
  id: string
  userId: string
  businessName: string
  ownerName: string
  phone: string
  address: string
  cuisineType: string // Store type / business specialty
  bio?: string
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
  createdAt: string
}
