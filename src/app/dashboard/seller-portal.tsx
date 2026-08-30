"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { type User } from "@supabase/supabase-js"
import { SellerProfile, Store, StoreMenuItem, OptionGroup, OptionValue, VariantCombination } from "@/lib/seller-types"
import {
  getSellerProfile,
  saveSellerProfile,
  getStores,
  saveStore,
  deleteStore,
  getMenuItems,
  saveMenuItem,
  deleteMenuItem,
  uploadStoreImage,
} from "@/lib/store-data"
import { ImageCropperModal } from "./image-cropper-modal"

const SAMPLE_IMAGES = [
  { name: "Fashion & Apparel", url: "/images/bistro_delight.jpg" },
  { name: "Groceries & Fresh", url: "/images/berry_tart.jpg" },
  { name: "Coffee & Cafe", url: "/images/matcha_latte.jpg" },
  { name: "Electronics & Tech", url: "/images/sushi_zen.jpg" },
  { name: "Dining & Cuisine", url: "/images/truffle_pasta.jpg" },
  { name: "Retail & Goods", url: "/images/wagyu_burger.jpg" },
]

const EMOJI_ICONS = [
  "👗",
  "🛒",
  "☕",
  "📱",
  "🍽️",
  "💄",
  "🌿",
  "🏠",
  "📚",
  "🐾",
  "⚽",
  "🎁",
  "👟",
  "🍕",
  "🍔",
  "🍣",
  "🥐",
  "🍰",
]

const STORE_CATEGORIES = [
  "Clothing & Fashion",
  "Groceries & Supermarket",
  "Cafes & Bakery",
  "Restaurants & Dining",
  "Electronics & Gadgets",
  "Beauty & Cosmetics",
  "Health & Wellness",
  "Home & Living",
  "Books & Stationery",
  "Pet Supplies",
  "Sports & Fitness",
  "General Retail",
]

const PRODUCT_CATEGORIES = [
  "Apparel & Clothing",
  "Fresh Produce & Groceries",
  "Bakery & Snacks",
  "Coffee & Drinks",
  "Electronics & Tech",
  "Beauty & Personal Care",
  "Chef's Dishes & Mains",
  "Home & Living",
  "Accessories & Gifts",
  "General Merchandise",
]

export function SellerPortal({ user }: { user: User }) {
  const [profile, setProfile] = useState<SellerProfile | null>(null)
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingStoreImg, setIsUploadingStoreImg] = useState(false)
  const [isUploadingItemImg, setIsUploadingItemImg] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Cropper states
  const [isCropperOpen, setIsCropperOpen] = useState(false)
  const [cropperSrc, setCropperSrc] = useState<string | null>(null)
  const [cropperTarget, setCropperTarget] = useState<"store" | "product" | "variant" | null>(null)

  // Variant option builder state
  const [itemOptions, setItemOptions] = useState<OptionGroup[]>([])
  const [itemVariants, setItemVariants] = useState<VariantCombination[]>([])
  const [variantUploadTarget, setVariantUploadTarget] = useState<{ groupIdx: number; valueIdx: number } | null>(null)
  const [isUploadingVariantImg, setIsUploadingVariantImg] = useState(false)

  // ── Multi-Attribute Variant Combination Generator ──────────────────────────
  const generateCombinations = (
    groups: OptionGroup[],
    existingVariants: VariantCombination[] = []
  ): VariantCombination[] => {
    const validGroups = groups.filter(
      (g) => g.name.trim() && g.values.filter((v) => v.label.trim()).length > 0
    )
    if (validGroups.length === 0) return []

    let combos: Record<string, string>[] = [{}]
    for (const group of validGroups) {
      const newCombos: Record<string, string>[] = []
      const validValues = group.values.filter((v) => v.label.trim())
      for (const existing of combos) {
        for (const val of validValues) {
          newCombos.push({ ...existing, [group.name.trim()]: val.label.trim() })
        }
      }
      combos = newCombos
    }

    return combos.map((combo) => {
      const existing = existingVariants.find((ev) => {
        const keys = Object.keys(combo)
        return (
          keys.every((k) => ev.options[k] === combo[k]) &&
          Object.keys(ev.options).length === keys.length
        )
      })

      if (existing) {
        return existing
      }

      return {
        id: Math.random().toString(36).substring(2, 10),
        options: combo,
        stock: 5,
        costPrice: undefined,
        sellPrice: parseFloat(itemPrice) || 0,
        priceAdjustment: 0,
      }
    })
  }

  const handleSyncCombinations = () => {
    const generated = generateCombinations(itemOptions, itemVariants)
    setItemVariants(generated)
  }

  const handleUpdateVariantStock = (comboId: string, stock: number) => {
    setItemVariants((prev) =>
      prev.map((v) => (v.id === comboId ? { ...v, stock } : v))
    )
  }

  const handleUpdateVariantCostPrice = (comboId: string, costPrice: number | undefined) => {
    setItemVariants((prev) =>
      prev.map((v) => (v.id === comboId ? { ...v, costPrice } : v))
    )
  }

  const handleUpdateVariantSellPrice = (comboId: string, sellPrice: number | undefined) => {
    setItemVariants((prev) =>
      prev.map((v) => (v.id === comboId ? { ...v, sellPrice } : v))
    )
  }

  const handleUpdateVariantPrice = (comboId: string, priceAdjustment: number) => {
    setItemVariants((prev) =>
      prev.map((v) => (v.id === comboId ? { ...v, priceAdjustment } : v))
    )
  }

  const handleSetAllVariantsStock = (stock: number) => {
    setItemVariants((prev) => prev.map((v) => ({ ...v, stock })))
  }

  const handleSetAllSellPriceToBase = () => {
    const base = parseFloat(itemPrice) || 0
    setItemVariants((prev) => prev.map((v) => ({ ...v, sellPrice: base })))
  }

  // ── Option Group Builder Helpers ──────────────────────────────────────────
  const generateId = () => Math.random().toString(36).substring(2, 10)

  const handleAddOptionGroup = () => {
    setItemOptions((prev) => [
      ...prev,
      {
        id: generateId(),
        name: "",
        required: false,
        values: [{ id: generateId(), label: "", priceAdjustment: 0 }],
      },
    ])
  }

  const handleRemoveOptionGroup = (groupIdx: number) => {
    setItemOptions((prev) => prev.filter((_, i) => i !== groupIdx))
  }

  const handleUpdateGroupName = (groupIdx: number, name: string) => {
    setItemOptions((prev) =>
      prev.map((g, i) => (i === groupIdx ? { ...g, name } : g))
    )
  }

  const handleToggleGroupRequired = (groupIdx: number) => {
    setItemOptions((prev) =>
      prev.map((g, i) => (i === groupIdx ? { ...g, required: !g.required } : g))
    )
  }

  const handleAddOptionValue = (groupIdx: number) => {
    setItemOptions((prev) =>
      prev.map((g, i) =>
        i === groupIdx
          ? { ...g, values: [...g.values, { id: generateId(), label: "", priceAdjustment: 0 }] }
          : g
      )
    )
  }

  const handleRemoveOptionValue = (groupIdx: number, valueIdx: number) => {
    setItemOptions((prev) =>
      prev.map((g, i) =>
        i === groupIdx ? { ...g, values: g.values.filter((_, vi) => vi !== valueIdx) } : g
      )
    )
  }

  const handleUpdateOptionValue = (
    groupIdx: number,
    valueIdx: number,
    field: keyof OptionValue,
    value: string | number | undefined
  ) => {
    setItemOptions((prev) =>
      prev.map((g, i) =>
        i === groupIdx
          ? {
              ...g,
              values: g.values.map((v, vi) =>
                vi === valueIdx ? { ...v, [field]: value } : v
              ),
            }
          : g
      )
    )
  }

  const handleUploadVariantImage = (groupIdx: number, valueIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setVariantUploadTarget({ groupIdx, valueIdx })
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCropperSrc(reader.result)
        setCropperTarget("variant")
        setIsCropperOpen(true)
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const [stores, setStores] = useState<Store[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState<string>("")
  const [menuItems, setMenuItems] = useState<StoreMenuItem[]>([])

  const [regBusinessName, setRegBusinessName] = useState("")
  const [regOwnerName, setRegOwnerName] = useState("")
  const [regPhone, setRegPhone] = useState("")
  const [regAddress, setRegAddress] = useState("")
  const [regCuisine, setRegCuisine] = useState("Clothing & Fashion")
  const [regBio, setRegBio] = useState("")

  const [editingStoreId, setEditingStoreId] = useState<string | null>(null)
  const [storeName, setStoreName] = useState("")
  const [storeCuisine, setStoreCuisine] = useState("")
  const [storePriceRange, setStorePriceRange] = useState<"$" | "$$" | "$$$">("$$")
  const [storeCategory, setStoreCategory] = useState("Clothing & Fashion")
  const [storeBadge, setStoreBadge] = useState("👗")
  const [storeImage, setStoreImage] = useState("/images/bistro_delight.jpg")
  const [storeDescription, setStoreDescription] = useState("")

  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [itemName, setItemName] = useState("")
  const [itemCategory, setItemCategory] = useState("Apparel & Clothing")
  const [itemPrice, setItemPrice] = useState("29.99")
  const [itemDescription, setItemDescription] = useState("")
  const [itemImage, setItemImage] = useState("/images/bistro_delight.jpg")
  const [itemTags, setItemTags] = useState("BESTSELLER, NEW ARRIVAL")
  const [itemCalories, setItemCalories] = useState("Sizes: S, M, L, XL")
  const [itemPrepTime, setItemPrepTime] = useState("Same-Day Dispatch")
  const [itemAvailable, setItemAvailable] = useState(true)

  const handleUploadProductImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCropperSrc(reader.result)
        setCropperTarget("product")
        setIsCropperOpen(true)
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleUploadStoreCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCropperSrc(reader.result)
        setCropperTarget("store")
        setIsCropperOpen(true)
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleCropComplete = async (blob: Blob) => {
    const target = cropperTarget || "product"
    const folder = target === "store" ? "stores" : "products"
    const fileName = `${target}_cropped_${Date.now()}.jpg`
    const file = new File([blob], fileName, { type: "image/jpeg" })

    if (target === "store") {
      setIsUploadingStoreImg(true)
    } else if (target === "variant") {
      setIsUploadingVariantImg(true)
    } else {
      setIsUploadingItemImg(true)
    }
    setUploadError(null)

    const { url, error } = await uploadStoreImage(file, folder)
    if (url) {
      if (target === "store") {
        setStoreImage(url)
      } else if (target === "variant" && variantUploadTarget) {
        handleUpdateOptionValue(
          variantUploadTarget.groupIdx,
          variantUploadTarget.valueIdx,
          "image",
          url
        )
        setVariantUploadTarget(null)
      } else {
        setItemImage(url)
      }
      setIsCropperOpen(false)
      setCropperSrc(null)
    } else {
      setUploadError(error || "Upload failed. Please check Supabase storage configuration.")
    }

    setIsUploadingStoreImg(false)
    setIsUploadingItemImg(false)
    setIsUploadingVariantImg(false)
  }

  // Load seller data from Supabase
  useEffect(() => {
    const loadSellerData = async () => {
      const existing = await getSellerProfile(user.id)
      if (existing) {
        setProfile(existing)
        const sellerStores = await getStores(user.id)
        setStores(sellerStores)
        if (sellerStores.length > 0) {
          setSelectedStoreId(sellerStores[0].id)
        }
      }
    }
    loadSellerData()
  }, [user.id])

  // Load menu items when selected store changes from Supabase
  useEffect(() => {
    const loadItems = async () => {
      if (selectedStoreId) {
        const items = await getMenuItems(selectedStoreId)
        setMenuItems(items)
      } else {
        setMenuItems([])
      }
    }
    loadItems()
  }, [selectedStoreId])

  const handleRegisterSeller = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    const saved = await saveSellerProfile({
      userId: user.id,
      businessName: regBusinessName,
      ownerName: regOwnerName,
      phone: regPhone,
      address: regAddress,
      cuisineType: regCuisine,
      bio: regBio,
      status: "active",
    })

    if (saved) {
      setProfile(saved)
      setIsRegisterModalOpen(false)

      const initialStore = await saveStore({
        sellerId: user.id,
        name: regBusinessName,
        cuisine: regCuisine,
        priceRange: "$$",
        rating: 5.0,
        reviewsCount: 1,
        badgeIcon: "🍽️",
        image: "/images/bistro_delight.jpg",
        category: regCuisine,
        description: regBio || "Welcome to our brand new digital store!",
      })

      if (initialStore) {
        const userStores = await getStores(user.id)
        setStores(userStores)
        setSelectedStoreId(initialStore.id)
      }
    }
    setIsSaving(false)
  }

  const handleOpenStoreModal = (storeToEdit?: Store) => {
    if (storeToEdit) {
      setEditingStoreId(storeToEdit.id)
      setStoreName(storeToEdit.name)
      setStoreCuisine(storeToEdit.cuisine)
      setStorePriceRange(storeToEdit.priceRange)
      setStoreCategory(storeToEdit.category)
      setStoreBadge(storeToEdit.badgeIcon)
      setStoreImage(storeToEdit.image)
      setStoreDescription(storeToEdit.description || "")
    } else {
      setEditingStoreId(null)
      setStoreName("")
      setStoreCuisine("Modern Dining")
      setStorePriceRange("$$")
      setStoreCategory("Italian")
      setStoreBadge("🍽️")
      setStoreImage("/images/bistro_delight.jpg")
      setStoreDescription("")
    }
    setIsStoreModalOpen(true)
  }

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    const storePayload = {
      id: editingStoreId || undefined,
      sellerId: user.id,
      name: storeName,
      cuisine: storeCuisine,
      priceRange: storePriceRange,
      rating: 5.0,
      reviewsCount: 1,
      badgeIcon: storeBadge,
      image: storeImage,
      category: storeCategory,
      description: storeDescription,
    }

    const saved = await saveStore(storePayload)
    if (saved) {
      const sellerStores = await getStores(user.id)
      setStores(sellerStores)
      if (!selectedStoreId || editingStoreId === selectedStoreId) {
        setSelectedStoreId(saved.id)
      }
      setIsStoreModalOpen(false)
    }
    setIsSaving(false)
  }

  const handleDeleteStore = async (id: string) => {
    if (confirm("Are you sure you want to delete this store and its menu items?")) {
      await deleteStore(id)
      const remaining = await getStores(user.id)
      setStores(remaining)
      if (selectedStoreId === id) {
        setSelectedStoreId(remaining[0]?.id || "")
      }
    }
  }

  const handleOpenItemModal = (itemToEdit?: StoreMenuItem) => {
    if (!selectedStoreId) {
      alert("Please select or create a store first.")
      return
    }
    if (itemToEdit) {
      setEditingItemId(itemToEdit.id)
      setItemName(itemToEdit.name)
      setItemCategory(itemToEdit.category)
      setItemPrice(itemToEdit.price.toString())
      setItemDescription(itemToEdit.description)
      setItemImage(itemToEdit.image)
      setItemTags(itemToEdit.tags.join(", "))
      setItemCalories(itemToEdit.calories || "")
      setItemPrepTime(itemToEdit.prepTime || "")
      setItemAvailable(itemToEdit.available)
      setItemOptions(itemToEdit.options || [])
      setItemVariants(
        itemToEdit.variants && itemToEdit.variants.length > 0
          ? itemToEdit.variants
          : itemToEdit.options && itemToEdit.options.length > 0
          ? generateCombinations(itemToEdit.options)
          : []
      )
    } else {
      setEditingItemId(null)
      setItemName("")
      setItemCategory("Chef's Specials")
      setItemPrice("18.50")
      setItemDescription("")
      setItemImage("/images/truffle_pasta.jpg")
      setItemTags("POPULAR, CHEF'S PICK")
      setItemCalories("550 kcal")
      setItemPrepTime("15 min")
      setItemAvailable(true)
      setItemOptions([])
      setItemVariants([])
    }
    setIsItemModalOpen(true)
  }

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStoreId) return
    setIsSaving(true)
    const tagsArray = itemTags
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean)

    // Clean options: remove empty groups or values without labels
    const cleanedOptions = itemOptions
      .filter((g) => g.name.trim())
      .map((g) => ({
        ...g,
        values: g.values.filter((v) => v.label.trim()),
      }))
      .filter((g) => g.values.length > 0)

    const validVariants =
      cleanedOptions.length > 0 && itemVariants.length > 0
        ? itemVariants.filter((v) => {
            return Object.entries(v.options).every(([grpName, valLabel]) => {
              const grp = cleanedOptions.find((g) => g.name.trim() === grpName)
              return grp && grp.values.some((val) => val.label.trim() === valLabel)
            })
          })
        : undefined

    const saved = await saveMenuItem({
      id: editingItemId || undefined,
      storeId: selectedStoreId,
      name: itemName,
      category: itemCategory,
      price: parseFloat(itemPrice) || 0,
      description: itemDescription,
      image: itemImage,
      tags: tagsArray,
      calories: itemCalories,
      prepTime: itemPrepTime,
      available: itemAvailable,
      options: cleanedOptions.length > 0 ? cleanedOptions : undefined,
      variants: validVariants && validVariants.length > 0 ? validVariants : undefined,
    })

    if (saved) {
      const items = await getMenuItems(selectedStoreId)
      setMenuItems(items)
      setIsItemModalOpen(false)
    }
    setIsSaving(false)
  }

  const handleDeleteItem = async (id: string) => {
    if (confirm("Delete this menu item?")) {
      await deleteMenuItem(id)
      if (selectedStoreId) {
        const items = await getMenuItems(selectedStoreId)
        setMenuItems(items)
      }
    }
  }

  const handleToggleAvailable = async (item: StoreMenuItem) => {
    await saveMenuItem({ ...item, available: !item.available })
    if (selectedStoreId) {
      const items = await getMenuItems(selectedStoreId)
      setMenuItems(items)
    }
  }

  const selectedStore = stores.find((s) => s.id === selectedStoreId)

  if (!profile) {
    return (
      <div className="bg-gradient-to-br from-[#0d1c2d] to-[#1a334e] text-white rounded-2xl p-6 sm:p-8 mb-8 shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#006c49] text-emerald-100 rounded-full text-xs font-semibold">
              <span>⭐ Seller Opportunity</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Become a MenuHub Seller
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Launch your digital restaurant on MenuHub. Create unlimited stores, customize live digital menus, upload dishes, and manage kitchen orders with zero limits.
            </p>
          </div>

          <button
            onClick={() => setIsRegisterModalOpen(true)}
            className="bg-[#00714d] hover:bg-[#005a3e] text-white px-6 py-3.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all whitespace-nowrap self-start md:self-center flex items-center gap-2"
          >
            <span>🚀 Apply to Become a Seller</span>
          </button>
        </div>

        {isRegisterModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white text-[#0d1c2d] rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-[#eef4ff] mb-4">
                <div>
                  <h3 className="text-lg font-bold text-[#0d1c2d]">Become a MenuHub Seller</h3>
                  <p className="text-xs text-[#76777d]">Fill in your store details to start selling</p>
                </div>
                <button
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="text-sm font-bold text-[#76777d] hover:text-[#0d1c2d]"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRegisterSeller} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#0d1c2d] mb-1">
                    Store / Restaurant Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={regBusinessName}
                    onChange={(e) => setRegBusinessName(e.target.value)}
                    placeholder="e.g. Bella Roma Ristorante"
                    className="w-full h-10 px-3.5 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d] focus:border-[#006c49] outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#0d1c2d] mb-1">
                      Owner Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={regOwnerName}
                      onChange={(e) => setRegOwnerName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full h-10 px-3.5 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d] focus:border-[#006c49] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#0d1c2d] mb-1">
                      Business Phone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full h-10 px-3.5 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d] focus:border-[#006c49] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#0d1c2d] mb-1">
                      Business / Store Category *
                    </label>
                    <select
                      value={regCuisine}
                      onChange={(e) => setRegCuisine(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d] focus:border-[#006c49] outline-none"
                    >
                      {STORE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#0d1c2d] mb-1">
                      Store Address *
                    </label>
                    <input
                      type="text"
                      required
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      placeholder="123 Gourmet Ave, Suite 4"
                      className="w-full h-10 px-3.5 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d] focus:border-[#006c49] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#0d1c2d] mb-1">
                    Store Bio & Description
                  </label>
                  <textarea
                    rows={2}
                    value={regBio}
                    onChange={(e) => setRegBio(e.target.value)}
                    placeholder="Tell guests about your dining concept..."
                    className="w-full p-3 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d] focus:border-[#006c49] outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRegisterModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl font-semibold text-[#76777d] hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-[#006c49] hover:bg-[#005236] disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm"
                  >
                    {isSaving ? "Creating Account..." : "Confirm & Start Selling"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8 mb-8">
      {/* Seller Header Banner */}
      <div className="bg-white border border-[#eef4ff] rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-[#00714d] border border-emerald-200 rounded-full text-xs font-semibold mb-2">
              <span>✓</span>
              <span>Verified Restaurant Seller</span>
            </div>
            <h2 className="text-2xl font-bold text-[#0d1c2d]">
              {profile.businessName} Studio
            </h2>
            <p className="text-xs text-[#76777d] mt-1">
              Owner: <span className="font-semibold text-[#0d1c2d]">{profile.ownerName}</span> • Phone: {profile.phone} • Cuisine: {profile.cuisineType}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => handleOpenStoreModal()}
              className="bg-[#006c49] hover:bg-[#005236] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <span>+ Add Store</span>
            </button>
            <Link
              href="/home"
              className="bg-[#eef4ff] hover:bg-[#dbe9ff] text-[#00714d] text-xs font-semibold px-4 py-2.5 rounded-xl border border-[#ccdbf2] transition-all flex items-center gap-1.5"
            >
              <span>Live MenuHub View →</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Stores Management Section */}
      <div className="bg-white border border-[#eef4ff] rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-[#eef4ff] mb-6">
          <div>
            <h3 className="text-base font-bold text-[#0d1c2d]">Your Stores ({stores.length})</h3>
            <p className="text-xs text-[#76777d]">Manage all stores under your seller account</p>
          </div>
          <button
            onClick={() => handleOpenStoreModal()}
            className="text-xs font-semibold text-[#00714d] hover:underline"
          >
            + Create New Store
          </button>
        </div>

        {stores.length === 0 ? (
          <div className="text-center py-10 bg-[#f8f9ff] rounded-xl border border-dashed border-[#ccdbf2]">
            <p className="text-xs text-[#76777d] mb-3">No stores created yet.</p>
            <button
              onClick={() => handleOpenStoreModal()}
              className="bg-[#006c49] text-white px-4 py-2 rounded-xl text-xs font-semibold"
            >
              + Create Your First Store
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {stores.map((store) => {
              const isSelected = store.id === selectedStoreId
              return (
                <div
                  key={store.id}
                  onClick={() => setSelectedStoreId(store.id)}
                  className={`cursor-pointer rounded-2xl border transition-all overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? "border-[#006c49] ring-2 ring-[#6cf8bb]/40 shadow-sm"
                      : "border-[#eef4ff] hover:border-[#cbd5e1]"
                  }`}
                >
                  <div>
                    <div className="relative h-36 w-full bg-slate-100 overflow-hidden">
                      <Image
                        src={store.image}
                        alt={store.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover"
                      />
                      <div className="absolute top-2 left-2 bg-white/95 px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs">
                        {store.badgeIcon} {store.category}
                      </div>
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-[#006c49] text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                          Active Store
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-[#0d1c2d] truncate">{store.name}</h4>
                        <span className="text-xs font-bold text-[#006c49]">{store.priceRange}</span>
                      </div>
                      <p className="text-[11px] text-[#76777d] mt-1 line-clamp-1">{store.cuisine}</p>
                    </div>
                  </div>

                  <div className="p-4 pt-0 flex items-center justify-between border-t border-[#f1f5f9] mt-2">
                    <span className="text-[11px] font-medium text-[#76777d]">
                      ★ {store.rating} ({store.reviewsCount} reviews)
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenStoreModal(store)
                        }}
                        className="text-xs font-semibold text-[#006c49] hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteStore(store.id)
                        }}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Menu Items Management Section */}
      {selectedStore && (
        <div className="bg-white border border-[#eef4ff] rounded-2xl p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#eef4ff] mb-6 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base">{selectedStore.badgeIcon}</span>
                <h3 className="text-base font-bold text-[#0d1c2d]">
                  {selectedStore.name} — Menu Items ({menuItems.length})
                </h3>
              </div>
              <p className="text-xs text-[#76777d]">Add dishes, set prices, tags, and manage live availability</p>
            </div>

            <button
              onClick={() => handleOpenItemModal()}
              className="bg-[#006c49] hover:bg-[#005236] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>+ Add Menu Item</span>
            </button>
          </div>

          {menuItems.length === 0 ? (
            <div className="text-center py-10 bg-[#f8f9ff] rounded-xl border border-dashed border-[#ccdbf2]">
              <p className="text-xs text-[#76777d] mb-3">No menu items added to this store yet.</p>
              <button
                onClick={() => handleOpenItemModal()}
                className="bg-[#006c49] text-white px-4 py-2 rounded-xl text-xs font-semibold"
              >
                + Add First Dish
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#eef4ff] overflow-hidden flex flex-col justify-between bg-white shadow-xs"
                >
                  <div>
                    <div className="relative h-40 w-full bg-slate-100 overflow-hidden">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover"
                      />
                      <div className="absolute top-2 left-2 bg-white/95 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-[#0d1c2d]">
                        {item.category}
                      </div>
                      <button
                        onClick={() => handleToggleAvailable(item)}
                        className={`absolute top-2 right-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all shadow-xs ${
                          item.available
                            ? "bg-emerald-600 text-white"
                            : "bg-red-600 text-white"
                        }`}
                      >
                        {item.available ? "In Stock" : "Sold Out"}
                      </button>
                    </div>

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-bold text-sm text-[#0d1c2d]">{item.name}</h4>
                        <span className="font-bold text-sm text-[#006c49]">
                          ${item.price.toFixed(2)}
                        </span>
                      </div>

                      <p className="text-xs text-[#76777d] line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>

                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="bg-[#eef4ff] text-[#00714d] px-2 py-0.5 rounded-md text-[10px] font-bold"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 pt-0 border-t border-[#f1f5f9] flex items-center justify-between text-xs text-[#76777d] mt-2">
                    <span>
                      {item.prepTime || "15 min"} • {item.calories || "500 kcal"}
                    </span>
                    <div className="flex gap-2.5">
                      <button
                        onClick={() => handleOpenItemModal(item)}
                        className="font-semibold text-[#006c49] hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="font-semibold text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Store Create/Edit Modal */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white text-[#0d1c2d] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#eef4ff] mb-4">
              <h3 className="text-lg font-bold text-[#0d1c2d]">
                {editingStoreId ? "Edit Store" : "Add New Store"}
              </h3>
              <button
                onClick={() => setIsStoreModalOpen(false)}
                className="text-sm font-bold text-[#76777d]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStore} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#0d1c2d] mb-1">Store Name *</label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. Golden Dragon Sushi"
                  className="w-full h-10 px-3.5 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d] outline-none focus:border-[#006c49]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#0d1c2d] mb-1">Category *</label>
                  <select
                    value={storeCategory}
                    onChange={(e) => setStoreCategory(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d] outline-none"
                  >
                    {STORE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#0d1c2d] mb-1">Price Tier *</label>
                  <select
                    value={storePriceRange}
                    onChange={(e) => setStorePriceRange(e.target.value as "$" | "$$" | "$$$")}
                    className="w-full h-10 px-3 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d] outline-none"
                  >
                    <option value="$">$ (Budget-Friendly)</option>
                    <option value="$$">$$ (Mid-Range / Casual)</option>
                    <option value="$$$">$$$ (Premium / Luxury)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#0d1c2d] mb-1">
                  Tagline / Specialty Description *
                </label>
                <input
                  type="text"
                  required
                  value={storeCuisine}
                  onChange={(e) => setStoreCuisine(e.target.value)}
                  placeholder="e.g. Streetwear & Outerwear or Organic Produce"
                  className="w-full h-10 px-3.5 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d] outline-none focus:border-[#006c49]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#0d1c2d] mb-1">Store Badge Icon</label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {EMOJI_ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setStoreBadge(emoji)}
                      className={`w-9 h-9 rounded-xl text-base flex items-center justify-center border transition-all ${
                        storeBadge === emoji
                          ? "border-[#006c49] bg-emerald-50 scale-110"
                          : "border-[#eef4ff] hover:bg-slate-50"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#0d1c2d] mb-1">
                  Store Cover Image
                </label>

                {/* Upload to Supabase Storage Button */}
                <div className="border-2 border-dashed border-[#ccdbf2] hover:border-[#006c49] bg-[#f8f9ff] rounded-2xl p-4 text-center transition-all mb-3">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <span className="text-2xl">📸</span>
                    <p className="text-xs font-bold text-[#0d1c2d]">
                      {isUploadingStoreImg
                        ? "Uploading image to Supabase..."
                        : "Upload Store Image from Device"}
                    </p>
                    <p className="text-[11px] text-[#76777d]">PNG, JPG, WEBP up to 5MB</p>
                    <label className="mt-1 cursor-pointer bg-[#006c49] hover:bg-[#005236] text-white text-xs font-semibold px-4 py-1.5 rounded-xl shadow-xs inline-block">
                      <span>Browse Files</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isUploadingStoreImg}
                        onChange={handleUploadStoreCover}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {uploadError && (
                  <div className="p-2.5 mb-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                    {uploadError}
                  </div>
                )}

                {/* Image Preview & URL input */}
                <div className="flex items-center gap-3 mb-2 p-2 bg-slate-50 rounded-xl border border-[#eef4ff]">
                  <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-slate-200 shrink-0">
                    <Image
                      src={storeImage}
                      alt="Store Cover Preview"
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-[#0d1c2d]">Selected Image</p>
                    <p className="text-[10px] text-[#76777d] truncate">{storeImage}</p>
                  </div>
                </div>

                {/* Preset Suggestions */}
                <p className="text-[11px] font-semibold text-[#76777d] mb-1.5">Or choose from sample covers:</p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {SAMPLE_IMAGES.map((img) => (
                    <button
                      key={img.url}
                      type="button"
                      onClick={() => setStoreImage(img.url)}
                      className={`relative h-12 rounded-lg overflow-hidden border-2 transition-all ${
                        storeImage === img.url ? "border-[#006c49]" : "border-transparent"
                      }`}
                    >
                      <Image src={img.url} alt={img.name} fill sizes="80px" className="object-cover" />
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={storeImage}
                  onChange={(e) => setStoreImage(e.target.value)}
                  placeholder="Or paste direct image URL"
                  className="w-full h-8 px-3 bg-white border border-[#c6c6cd] rounded-lg text-[#0d1c2d] text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsStoreModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-[#76777d]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[#006c49] hover:bg-[#005236] disabled:opacity-50 text-white px-5 py-2 rounded-xl font-bold"
                >
                  {isSaving ? "Saving..." : "Save Store"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Menu Item Create/Edit Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white text-[#0d1c2d] rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#eef4ff] mb-4">
              <h3 className="text-lg font-bold text-[#0d1c2d]">
                {editingItemId ? "Edit Product / Item" : "Add New Product / Item"}
              </h3>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="text-sm font-bold text-[#76777d]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#0d1c2d] mb-1">Product / Item Name *</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Heavyweight Cotton Hoodie or Artisan Coffee"
                  className="w-full h-10 px-3.5 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d] outline-none focus:border-[#006c49]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#0d1c2d] mb-1">Category / Section *</label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d] outline-none"
                  >
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#0d1c2d] mb-1">Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    placeholder="24.50"
                    className="w-full h-10 px-3.5 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d] outline-none focus:border-[#006c49]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#0d1c2d] mb-1">Description *</label>
                <textarea
                  rows={2}
                  required
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="Product specs, materials, ingredients, or styling details..."
                  className="w-full p-3 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#0d1c2d] mb-1">Dispatch / Fulfillment Time</label>
                  <input
                    type="text"
                    value={itemPrepTime}
                    onChange={(e) => setItemPrepTime(e.target.value)}
                    placeholder="e.g. Same-Day or 15 min"
                    className="w-full h-10 px-3.5 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#0d1c2d] mb-1">Size / Weight / Variant</label>
                  <input
                    type="text"
                    value={itemCalories}
                    onChange={(e) => setItemCalories(e.target.value)}
                    placeholder="e.g. Sizes: S, M, L or 500g"
                    className="w-full h-10 px-3.5 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#0d1c2d] mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={itemTags}
                  onChange={(e) => setItemTags(e.target.value)}
                  placeholder="BESTSELLER, NEW ARRIVAL, 100% ORGANIC"
                  className="w-full h-10 px-3.5 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#0d1c2d] mb-1">
                  Product / Item Image
                </label>

                {/* Upload to Supabase Storage Box */}
                <div className="border-2 border-dashed border-[#ccdbf2] hover:border-[#006c49] bg-[#f8f9ff] rounded-2xl p-4 text-center transition-all mb-3">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <span className="text-2xl">📤</span>
                    <p className="text-xs font-bold text-[#0d1c2d]">
                      {isUploadingItemImg
                        ? "Uploading product photo to Supabase..."
                        : "Upload Product Image from Device"}
                    </p>
                    <p className="text-[11px] text-[#76777d]">PNG, JPG, WEBP up to 5MB</p>
                    <label className="mt-1 cursor-pointer bg-[#006c49] hover:bg-[#005236] text-white text-xs font-semibold px-4 py-1.5 rounded-xl shadow-xs inline-block">
                      <span>Browse Files</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isUploadingItemImg}
                        onChange={handleUploadProductImage}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {uploadError && (
                  <div className="p-2.5 mb-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                    {uploadError}
                  </div>
                )}

                {/* Live Preview */}
                <div className="flex items-center gap-3 mb-2 p-2 bg-slate-50 rounded-xl border border-[#eef4ff]">
                  <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-slate-200 shrink-0">
                    <Image
                      src={itemImage}
                      alt="Product Preview"
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-[#0d1c2d]">Active Product Photo</p>
                    <p className="text-[10px] text-[#76777d] truncate">{itemImage}</p>
                  </div>
                </div>

                {/* Preset Suggestions */}
                <p className="text-[11px] font-semibold text-[#76777d] mb-1.5">Or choose from sample images:</p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {SAMPLE_IMAGES.map((img) => (
                    <button
                      key={img.url}
                      type="button"
                      onClick={() => setItemImage(img.url)}
                      className={`relative h-12 rounded-lg overflow-hidden border-2 transition-all ${
                        itemImage === img.url ? "border-[#006c49]" : "border-transparent"
                      }`}
                    >
                      <Image src={img.url} alt={img.name} fill sizes="80px" className="object-cover" />
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={itemImage}
                  onChange={(e) => setItemImage(e.target.value)}
                  placeholder="Or enter custom image URL"
                  className="w-full h-8 px-3 bg-white border border-[#c6c6cd] rounded-lg text-[#0d1c2d] text-xs"
                />
              </div>

              {/* ── Option Groups / Variants Builder ───────────────────────── */}
              <div className="border border-[#eef4ff] rounded-xl p-4 bg-[#f8f9ff]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-bold text-[#0d1c2d]">🎨 Item Options / Variants</p>
                    <p className="text-[10px] text-[#76777d]">
                      Add dynamic options like Color, Size, Sugar Level, etc.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddOptionGroup}
                    className="text-[11px] font-bold text-[#006c49] hover:text-[#005236] bg-white border border-[#ccdbf2] hover:border-[#006c49] px-3 py-1.5 rounded-lg transition-all"
                  >
                    + Add Option Group
                  </button>
                </div>

                {itemOptions.length === 0 ? (
                  <div className="text-center py-4 text-[10px] text-[#76777d] border border-dashed border-[#ccdbf2] rounded-lg bg-white">
                    No options added. Click &quot;+ Add Option Group&quot; to create variants like Color, Size, or Cup Size.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {itemOptions.map((group, groupIdx) => (
                      <div
                        key={group.id}
                        className="bg-white border border-[#eef4ff] rounded-xl p-3.5 shadow-xs"
                      >
                        {/* Group Header */}
                        <div className="flex items-center gap-2 mb-3">
                          <input
                            type="text"
                            value={group.name}
                            onChange={(e) => handleUpdateGroupName(groupIdx, e.target.value)}
                            placeholder="Option name (e.g. Color, Size, Sugar Level)"
                            className="flex-1 h-9 px-3 bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg text-[#0d1c2d] text-xs font-semibold outline-none focus:border-[#006c49]"
                          />
                          <label className="flex items-center gap-1 text-[10px] text-[#76777d] whitespace-nowrap cursor-pointer">
                            <input
                              type="checkbox"
                              checked={group.required}
                              onChange={() => handleToggleGroupRequired(groupIdx)}
                              className="w-3.5 h-3.5 accent-[#006c49]"
                            />
                            Required
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveOptionGroup(groupIdx)}
                            className="text-red-500 hover:text-red-700 text-xs font-bold px-1.5 py-0.5 rounded hover:bg-red-50 transition-all"
                            title="Remove option group"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Option Values */}
                        <div className="space-y-2">
                          {group.values.map((val, valueIdx) => (
                            <div
                              key={val.id}
                              className="flex items-center gap-2 p-2 bg-[#f8f9ff] rounded-lg border border-[#eef4ff]"
                            >
                              {/* Variant image thumbnail */}
                              <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-slate-200 shrink-0 border border-[#eef4ff] group/img cursor-pointer">
                                {val.image ? (
                                  <Image
                                    src={val.image}
                                    alt={val.label || "Variant"}
                                    fill
                                    sizes="36px"
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[10px] text-[#76777d]">
                                    📷
                                  </div>
                                )}
                                <label className="absolute inset-0 cursor-pointer opacity-0 group-hover/img:opacity-100 bg-black/40 flex items-center justify-center text-white text-[8px] font-bold transition-opacity">
                                  {isUploadingVariantImg && variantUploadTarget?.groupIdx === groupIdx && variantUploadTarget?.valueIdx === valueIdx
                                    ? "..."
                                    : "📸"}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleUploadVariantImage(groupIdx, valueIdx, e)}
                                  />
                                </label>
                              </div>

                              {/* Label input */}
                              <input
                                type="text"
                                value={val.label}
                                onChange={(e) =>
                                  handleUpdateOptionValue(groupIdx, valueIdx, "label", e.target.value)
                                }
                                placeholder="Value (e.g. Red, Large, 50%)"
                                className="flex-1 h-8 px-2.5 bg-white border border-[#c6c6cd] rounded-lg text-[#0d1c2d] text-xs outline-none focus:border-[#006c49] min-w-0"
                              />

                              {/* Price adjustment */}
                              <div className="flex items-center gap-0.5 shrink-0" title="Price adjustment">
                                <span className="text-[10px] text-[#76777d]">+$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={val.priceAdjustment || ""}
                                  onChange={(e) =>
                                    handleUpdateOptionValue(
                                      groupIdx,
                                      valueIdx,
                                      "priceAdjustment",
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  placeholder="0.00"
                                  className="w-14 h-8 px-1.5 bg-white border border-[#c6c6cd] rounded-lg text-[#0d1c2d] text-xs outline-none focus:border-[#006c49] text-right"
                                />
                              </div>

                              {/* Stock Qty */}
                              <div className="flex items-center gap-0.5 shrink-0" title="Stock quantity (0 = Sold Out, blank = Unlimited)">
                                <span className="text-[10px] text-[#76777d]">Qty:</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={val.stock !== undefined ? val.stock : ""}
                                  onChange={(e) =>
                                    handleUpdateOptionValue(
                                      groupIdx,
                                      valueIdx,
                                      "stock",
                                      e.target.value === "" ? undefined : parseInt(e.target.value, 10)
                                    )
                                  }
                                  placeholder="∞"
                                  className={`w-12 h-8 px-1 bg-white border rounded-lg text-xs outline-none focus:border-[#006c49] text-center font-medium ${
                                    val.stock !== undefined && val.stock <= 0
                                      ? "border-red-300 text-red-600 bg-red-50"
                                      : "border-[#c6c6cd] text-[#0d1c2d]"
                                  }`}
                                />
                              </div>

                              {/* Remove value button */}
                              <button
                                type="button"
                                onClick={() => handleRemoveOptionValue(groupIdx, valueIdx)}
                                className="text-red-400 hover:text-red-600 text-[10px] font-bold px-1 rounded hover:bg-red-50 transition-all shrink-0"
                                title="Remove value"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Add Value Button */}
                        <button
                          type="button"
                          onClick={() => handleAddOptionValue(groupIdx)}
                          className="mt-2 text-[11px] font-semibold text-[#006c49] hover:text-[#005236] flex items-center gap-1"
                        >
                          <span>+</span> Add Value
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Multi-Attribute Variant Matrix (SKU Combinations) ── */}
                {itemOptions.some((g) => g.name.trim() && g.values.some((v) => v.label.trim())) && (
                  <div className="mt-4 pt-4 border-t border-[#eef4ff]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <p className="text-xs font-bold text-[#0d1c2d]">
                          📊 SKU Combination Matrix & Stock
                        </p>
                        <p className="text-[10px] text-[#76777d]">
                          Set stock amount for each combination (e.g. Red/S: 2, Red/XL: 0)
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={handleSyncCombinations}
                          className="text-[10px] font-bold text-[#006c49] bg-white border border-[#ccdbf2] hover:border-[#006c49] px-2.5 py-1 rounded-lg transition-all"
                          title="Generate or sync all combinations"
                        >
                          ⚡ Sync SKUs
                        </button>
                        <button
                          type="button"
                          onClick={handleSetAllSellPriceToBase}
                          className="text-[10px] font-semibold text-[#0d1c2d] bg-white border border-[#ccdbf2] hover:bg-slate-50 px-2 py-1 rounded-lg transition-all"
                          title="Apply base item price to all SKU Sell Prices"
                        >
                          Set Base Sell Price
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetAllVariantsStock(10)}
                          className="text-[10px] font-semibold text-[#0d1c2d] bg-white border border-[#ccdbf2] hover:bg-slate-50 px-2 py-1 rounded-lg transition-all"
                        >
                          All Stock: 10
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetAllVariantsStock(0)}
                          className="text-[10px] font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 px-2 py-1 rounded-lg transition-all"
                        >
                          All: 0
                        </button>
                      </div>
                    </div>

                    {itemVariants.length === 0 ? (
                      <div className="text-center py-3 bg-white rounded-lg border border-dashed border-[#ccdbf2]">
                        <button
                          type="button"
                          onClick={handleSyncCombinations}
                          className="text-xs font-bold text-[#006c49] hover:underline"
                        >
                          Click to Generate Combination Matrix ({itemOptions.length} option groups)
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                        {itemVariants.map((variant) => {
                          const isOutOfStock = variant.stock <= 0
                          const margin =
                            variant.sellPrice !== undefined &&
                            variant.costPrice !== undefined &&
                            variant.costPrice > 0
                              ? variant.sellPrice - variant.costPrice
                              : null

                          return (
                            <div
                              key={variant.id}
                              className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border transition-all text-xs gap-2.5 ${
                                isOutOfStock
                                  ? "bg-red-50/40 border-red-200"
                                  : "bg-white border-[#eef4ff] hover:border-[#ccdbf2]"
                              }`}
                            >
                              {/* Combination tags & Margin indicator */}
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {Object.entries(variant.options).map(([k, v]) => (
                                    <span
                                      key={k}
                                      className="text-[10px] font-bold bg-[#eef4ff] text-[#00714d] px-2 py-0.5 rounded-md border border-[#ccdbf2]"
                                    >
                                      {k}: {v}
                                    </span>
                                  ))}
                                  {isOutOfStock ? (
                                    <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                                      No Stock
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                      In Stock
                                    </span>
                                  )}
                                  {margin !== null && (
                                    <span
                                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                        margin >= 0
                                          ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                                          : "text-red-700 bg-red-50 border border-red-200"
                                      }`}
                                    >
                                      Margin: ${margin.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Cost Price, Sell Price & Stock Qty */}
                              <div className="flex items-center gap-2 flex-wrap shrink-0">
                                {/* Cost Price */}
                                <div className="flex items-center gap-1" title="Cost / Wholesale price (Seller unit cost)">
                                  <span className="text-[10px] text-[#76777d] font-semibold">Cost: $</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={variant.costPrice !== undefined ? variant.costPrice : ""}
                                    onChange={(e) =>
                                      handleUpdateVariantCostPrice(
                                        variant.id,
                                        e.target.value === "" ? undefined : parseFloat(e.target.value) || 0
                                      )
                                    }
                                    placeholder="0.00"
                                    className="w-16 h-7 px-1.5 bg-white border border-[#c6c6cd] rounded-lg text-xs outline-none focus:border-[#006c49] text-right font-medium"
                                  />
                                </div>

                                {/* Sell Price */}
                                <div className="flex items-center gap-1" title="Selling / Retail price for this SKU">
                                  <span className="text-[10px] text-[#006c49] font-bold">Sell: $</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={variant.sellPrice !== undefined ? variant.sellPrice : ""}
                                    onChange={(e) =>
                                      handleUpdateVariantSellPrice(
                                        variant.id,
                                        e.target.value === "" ? undefined : parseFloat(e.target.value) || 0
                                      )
                                    }
                                    placeholder={itemPrice}
                                    className="w-16 h-7 px-1.5 bg-white border border-[#006c49] text-[#006c49] rounded-lg text-xs font-bold outline-none text-right"
                                  />
                                </div>

                                {/* Stock Quantity */}
                                <div className="flex items-center gap-1" title="Stock quantity for this SKU (0 = No Stock)">
                                  <span className="text-[10px] text-[#76777d] font-semibold">Stock:</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={variant.stock}
                                    onChange={(e) =>
                                      handleUpdateVariantStock(
                                        variant.id,
                                        Math.max(0, parseInt(e.target.value, 10) || 0)
                                      )
                                    }
                                    className={`w-14 h-7 px-1.5 bg-white border rounded-lg text-xs font-bold text-center outline-none focus:border-[#006c49] ${
                                      isOutOfStock
                                        ? "border-red-300 text-red-600 bg-red-50"
                                        : "border-[#c6c6cd] text-[#0d1c2d]"
                                    }`}
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="availableCheck"
                  checked={itemAvailable}
                  onChange={(e) => setItemAvailable(e.target.checked)}
                  className="w-4 h-4 text-[#006c49] accent-[#006c49]"
                />
                <label htmlFor="availableCheck" className="font-semibold text-[#0d1c2d]">
                  Item is currently in stock & available for orders
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-[#76777d]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[#006c49] hover:bg-[#005236] disabled:opacity-50 text-white px-5 py-2 rounded-xl font-bold"
                >
                  {isSaving ? "Saving..." : "Save Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive 1:1 Image Cropper Modal */}
      <ImageCropperModal
        isOpen={isCropperOpen}
        imageSrc={cropperSrc || ""}
        title={
          cropperTarget === "store"
            ? "Crop Store Cover (1:1 Square)"
            : cropperTarget === "variant"
            ? "Crop Variant Image (1:1 Square)"
            : "Crop Product Photo (1:1 Square)"
        }
        onClose={() => {
          setIsCropperOpen(false)
          setCropperSrc(null)
        }}
        onCropComplete={handleCropComplete}
      />
    </div>
  )
}


