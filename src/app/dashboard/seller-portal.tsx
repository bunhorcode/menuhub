"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { type User } from "@supabase/supabase-js"
import { SellerProfile, Store, StoreMenuItem, OptionGroup, OptionValue, VariantCombination, ProductType, ProductGalleryImage } from "@/lib/seller-types"
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
  checkBarcodeAvailability,
  generateUniqueBarcode,
  updateMenuItemStock,
} from "@/lib/store-data"
import { ImageCropperModal } from "./image-cropper-modal"
import {
  BarcodeScannerModal,
  BarcodeVisualPreview,
} from "./barcode-scanner-modal"

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
  "Food & Dining",
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
  const [cropperTarget, setCropperTarget] = useState<"store" | "product" | "variant" | "sku" | null>(null)
  const [skuUploadTargetComboId, setSkuUploadTargetComboId] = useState<string | null>(null)

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
        stock: 0,
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


  const handleSetAllVariantsStock = (stock: number) => {
    setItemVariants((prev) => prev.map((v) => ({ ...v, stock })))
  }

  const handleSetAllSellPriceToBase = (price?: number) => {
    const base = price !== undefined ? price : (parseFloat(itemPrice) || 0)
    setItemVariants((prev) => prev.map((v) => ({ ...v, sellPrice: base })))
  }

  const handleSetAllVariantsCost = (cost: number) => {
    setItemVariants((prev) => prev.map((v) => ({ ...v, costPrice: cost })))
  }

  const [isGeneratingAllSkuBarcodes, setIsGeneratingAllSkuBarcodes] = useState(false)

  const handleUpdateVariantBarcode = (comboId: string, barcode: string) => {
    setItemVariants((prev) =>
      prev.map((v) => (v.id === comboId ? { ...v, barcode } : v))
    )
  }

  const handleGenerateVariantBarcode = async (comboId: string) => {
    const code = await generateUniqueBarcode("200")
    setItemVariants((prev) =>
      prev.map((v) => (v.id === comboId ? { ...v, barcode: code } : v))
    )
  }

  const handleGenerateAllVariantBarcodes = async () => {
    setIsGeneratingAllSkuBarcodes(true)
    try {
      const updated = await Promise.all(
        itemVariants.map(async (v) => {
          if (!v.barcode) {
            const code = await generateUniqueBarcode("200")
            return { ...v, barcode: code }
          }
          return v
        })
      )
      setItemVariants(updated)
    } finally {
      setIsGeneratingAllSkuBarcodes(false)
    }
  }

  // SKU variant combination image upload via cropper
  const handleUploadSkuVariantImage = (comboId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSkuUploadTargetComboId(comboId)
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCropperSrc(reader.result)
        setCropperTarget("sku")
        setIsCropperOpen(true)
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ""
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
  const [regTelegramUsername, setRegTelegramUsername] = useState("")

  // Telegram settings for existing sellers
  const [telegramEdit, setTelegramEdit] = useState("")
  const [isTelegramEditing, setIsTelegramEditing] = useState(false)
  const [isSavingTelegram, setIsSavingTelegram] = useState(false)

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
  const [itemPrice, setItemPrice] = useState("")
  const [itemDescription, setItemDescription] = useState("")
  const [itemImage, setItemImage] = useState("/images/bistro_delight.jpg")
  const [itemTags, setItemTags] = useState("BESTSELLER, NEW ARRIVAL")
  const [itemCalories, setItemCalories] = useState("")
  const [itemPrepTime, setItemPrepTime] = useState("")
  const [itemAvailable, setItemAvailable] = useState(true)
  const [itemStock, setItemStock] = useState<string>("")

  // SKU bulk action input states
  const [showBasePriceInput, setShowBasePriceInput] = useState(false)
  const [basePriceInputValue, setBasePriceInputValue] = useState("")
  const [showBulkStockInput, setShowBulkStockInput] = useState(false)
  const [bulkStockInputValue, setBulkStockInputValue] = useState("")
  const [showBulkCostInput, setShowBulkCostInput] = useState(false)
  const [bulkCostInputValue, setBulkCostInputValue] = useState("")
  const [itemCostPrice, setItemCostPrice] = useState<string>("")
  const [itemBarcode, setItemBarcode] = useState("")
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false)
  // Per-SKU barcode scanner: stores the comboId of the variant being scanned, or null
  const [skuBarcodeScannerComboId, setSkuBarcodeScannerComboId] = useState<string | null>(null)
  const [barcodeCopied, setBarcodeCopied] = useState(false)
  const [barcodeStatus, setBarcodeStatus] = useState<{
    isChecking: boolean
    isUnique: boolean
    conflictName?: string
  } | null>(null)
  const [isGeneratingBarcode, setIsGeneratingBarcode] = useState(false)

  // ── Simple Gallery Product states ─────────────────────────────────────────
  const [itemProductType, setItemProductType] = useState<ProductType>("variant")
  const [itemShowPrice, setItemShowPrice] = useState<boolean>(true)
  const [itemGallery, setItemGallery] = useState<ProductGalleryImage[]>([])
  const [isUploadingGallery, setIsUploadingGallery] = useState(false)
  const [galleryUploadError, setGalleryUploadError] = useState<string | null>(null)
  // Type-switch confirmation dialog
  const [pendingTypeSwitch, setPendingTypeSwitch] = useState<ProductType | null>(null)

  // ── Stock & Inventory Hub States ──────────────────────────────────────────
  const [activeStoreTab, setActiveStoreTab] = useState<"catalog" | "inventory">("catalog")
  const [inventorySearch, setInventorySearch] = useState("")
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all")
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState("all")
  const [expandedItemIds, setExpandedItemIds] = useState<Record<string, boolean>>({})
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null)
  const [isInventoryScannerOpen, setIsInventoryScannerOpen] = useState(false)

  // Real-time debounced database barcode uniqueness check
  useEffect(() => {
    const clean = itemBarcode.trim()
    const timer = setTimeout(async () => {
      if (!clean) {
        setBarcodeStatus(null)
        return
      }
      setBarcodeStatus({ isChecking: true, isUnique: true })
      const result = await checkBarcodeAvailability(clean, editingItemId || undefined)
      setBarcodeStatus({
        isChecking: false,
        isUnique: result.isUnique,
        conflictName: result.existingItemName,
      })
    }, 300)

    return () => clearTimeout(timer)
  }, [itemBarcode, editingItemId])

  // ── Simple Gallery Product Helpers ────────────────────────────────────────
  const MAX_GALLERY_IMAGES = 15

  const handleGalleryUploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    setGalleryUploadError(null)
    const availableSlots = MAX_GALLERY_IMAGES - itemGallery.length
    if (availableSlots <= 0) {
      setGalleryUploadError(`Maximum limit of ${MAX_GALLERY_IMAGES} gallery images reached.`)
      return
    }

    const filesToUpload = fileArray.slice(0, availableSlots)
    if (fileArray.length > availableSlots) {
      setGalleryUploadError(`Only ${availableSlots} more image(s) could be added (max ${MAX_GALLERY_IMAGES}).`)
    }

    setIsUploadingGallery(true)
    try {
      const uploadedImages: ProductGalleryImage[] = []
      let hadCover = itemGallery.some((img) => img.isCover)

      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i]
        const { url, error } = await uploadStoreImage(file, "products")
        if (url) {
          const isCover = !hadCover && uploadedImages.length === 0
          if (isCover) hadCover = true
          uploadedImages.push({
            url,
            sortOrder: itemGallery.length + uploadedImages.length,
            isCover,
          })
        } else if (error) {
          setGalleryUploadError(`Failed to upload ${file.name}: ${error}`)
        }
      }

      if (uploadedImages.length > 0) {
        setItemGallery((prev) => [...prev, ...uploadedImages])
        // If no main image is set or current image is default, update with first uploaded image
        if (!itemImage || itemImage.includes("truffle_pasta") || itemImage.includes("bistro_delight")) {
          setItemImage(uploadedImages[0].url)
        }
      }
    } catch {
      setGalleryUploadError("An error occurred while uploading gallery images.")
    } finally {
      setIsUploadingGallery(false)
    }
  }

  const handleSetCoverImage = (index: number) => {
    setItemGallery((prev) =>
      prev.map((img, i) => ({
        ...img,
        isCover: i === index,
      }))
    )
    if (itemGallery[index]) {
      setItemImage(itemGallery[index].url)
    }
  }

  const handleDeleteGalleryImage = (index: number) => {
    setItemGallery((prev) => {
      const isDeletingCover = prev[index]?.isCover
      const next = prev.filter((_, i) => i !== index)
      if (next.length === 0) return []
      if (isDeletingCover) {
        next[0].isCover = true
        setItemImage(next[0].url)
      }
      return next.map((img, i) => ({ ...img, sortOrder: i }))
    })
  }

  const handleMoveGalleryImage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= itemGallery.length) return
    setItemGallery((prev) => {
      const copy = [...prev]
      const [moved] = copy.splice(fromIndex, 1)
      copy.splice(toIndex, 0, moved)
      return copy.map((img, i) => ({ ...img, sortOrder: i }))
    })
  }

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
    const ext = blob.type.includes("webp") ? "webp" : "jpg"
    const fileName = `${target}_cropped_${Date.now()}.${ext}`
    const file = new File([blob], fileName, { type: blob.type || "image/jpeg" })

    if (target === "store") {
      setIsUploadingStoreImg(true)
    } else if (target === "variant" || target === "sku") {
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
      } else if (target === "sku" && skuUploadTargetComboId) {
        setItemVariants((prev) =>
          prev.map((v) => (v.id === skuUploadTargetComboId ? { ...v, image: url } : v))
        )
        setSkuUploadTargetComboId(null)
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
      telegramUsername: regTelegramUsername || undefined,
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
      setItemStock(itemToEdit.stock !== undefined ? String(itemToEdit.stock) : "50")
      setItemCostPrice(itemToEdit.costPrice !== undefined ? String(itemToEdit.costPrice) : "")
      setItemBarcode(itemToEdit.barcode || "")
      setBarcodeStatus(null)
      setItemOptions(itemToEdit.options || [])
      setItemVariants(
        itemToEdit.variants && itemToEdit.variants.length > 0
          ? itemToEdit.variants
          : itemToEdit.options && itemToEdit.options.length > 0
            ? generateCombinations(itemToEdit.options)
            : []
      )
      // Simple Gallery fields
      setItemProductType(itemToEdit.productType || "variant")
      setItemShowPrice(itemToEdit.showPrice !== false) // default true
      setItemGallery(itemToEdit.gallery || [])
    } else {
      setEditingItemId(null)
      setItemName("")
      setItemCategory(PRODUCT_CATEGORIES[0])
      setItemPrice("")
      setItemDescription("")
      setItemImage("/images/truffle_pasta.jpg")
      setItemTags("")
      setItemCalories("")
      setItemPrepTime("")
      setItemAvailable(true)
      setItemStock("")
      setItemCostPrice("")
      setItemBarcode("")
      setBarcodeStatus(null)
      setItemOptions([])
      setItemVariants([])
      // Simple Gallery defaults
      setItemProductType("variant")
      setItemShowPrice(true)
      setItemGallery([])
    }
    setPendingTypeSwitch(null)
    setGalleryUploadError(null)
    setIsItemModalOpen(true)
  }

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStoreId) return
    setIsSaving(true)

    // Pre-save database barcode uniqueness validation
    if (itemBarcode.trim()) {
      const check = await checkBarcodeAvailability(itemBarcode.trim(), editingItemId || undefined)
      if (!check.isUnique) {
        alert(
          `Cannot save: Barcode "${itemBarcode.trim()}" is already assigned to "${check.existingItemName || "another item"}". Please use a unique barcode.`
        )
        setIsSaving(false)
        return
      }
    }

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

    const parsedStockNum = parseInt(itemStock)
    const validStock = !isNaN(parsedStockNum) && parsedStockNum >= 0 ? parsedStockNum : undefined
    const parsedCostNum = parseFloat(itemCostPrice)
    const validCost = !isNaN(parsedCostNum) && parsedCostNum >= 0 ? parsedCostNum : undefined

    const saved = await saveMenuItem({
      id: editingItemId || undefined,
      storeId: selectedStoreId,
      name: itemName,
      category: itemCategory,
      price: parseFloat(itemPrice) || 0,
      description: itemDescription,
      image: itemProductType === "simple" && itemGallery.length > 0
        ? (itemGallery.find((g) => g.isCover)?.url || itemGallery[0].url)
        : itemImage,
      tags: tagsArray,
      calories: itemCalories,
      prepTime: itemPrepTime,
      available: itemAvailable,
      stock: itemProductType === "simple" ? undefined : (validVariants && validVariants.length > 0 ? undefined : validStock),
      costPrice: validCost,
      barcode: itemBarcode.trim() || undefined,
      options: itemProductType === "simple" ? undefined : (cleanedOptions.length > 0 ? cleanedOptions : undefined),
      variants: itemProductType === "simple" ? undefined : (validVariants && validVariants.length > 0 ? validVariants : undefined),
      // Simple Gallery fields
      productType: itemProductType,
      showPrice: itemShowPrice,
      gallery: itemProductType === "simple" && itemGallery.length > 0 ? itemGallery : undefined,
    })

    if (saved) {
      const items = await getMenuItems(selectedStoreId)
      setMenuItems(items)
      setIsItemModalOpen(false)
    }
    setIsSaving(false)
  }

  // ── Fast Inline Stock Updates (Optimistic UI + Background DB Sync) ─────────
  const handleInlineStockChange = async (item: StoreMenuItem, newStock: number, variantId?: string) => {
    const cleanStock = Math.max(0, newStock)
    setMenuItems((prev) =>
      prev.map((it) => {
        if (it.id !== item.id) return it
        if (variantId && it.variants && it.variants.length > 0) {
          const updatedVariants = it.variants.map((v) =>
            v.id === variantId ? { ...v, stock: cleanStock } : v
          )
          const anyAvail = updatedVariants.some((v) => v.stock > 0)
          return { ...it, variants: updatedVariants, available: anyAvail }
        } else {
          return { ...it, stock: cleanStock, available: cleanStock > 0 }
        }
      })
    )
    await updateMenuItemStock(item, cleanStock, variantId)
  }

  // Bulk restock (+X units to all items)
  const handleBulkRestock = async (addUnits: number) => {
    if (menuItems.length === 0 || !selectedStoreId) return
    if (!confirm(`Add +${addUnits} stock units to all items in ${selectedStore?.name}?`)) return
    for (const it of menuItems) {
      if (it.variants && it.variants.length > 0) {
        const updatedVariants = it.variants.map((v) => ({
          ...v,
          stock: (v.stock || 0) + addUnits,
        }))
        await saveMenuItem({ ...it, variants: updatedVariants, available: true })
      } else {
        const curr = it.stock !== undefined ? it.stock : 50
        await saveMenuItem({ ...it, stock: curr + addUnits, available: true })
      }
    }
    const fresh = await getMenuItems(selectedStoreId)
    setMenuItems(fresh)
  }

  // Helper: compute total stock units for an item
  const getItemStockCount = (item: StoreMenuItem): number => {
    if (item.variants && item.variants.length > 0) {
      return item.variants.reduce((sum, v) => sum + (v.stock || 0), 0)
    }
    return item.stock !== undefined ? item.stock : item.available ? 50 : 0
  }

  // Helper: compute status of item stock
  const getItemStockStatus = (item: StoreMenuItem): "in_stock" | "low_stock" | "out_of_stock" => {
    if (!item.available) return "out_of_stock"
    const count = getItemStockCount(item)
    if (count <= 0) return "out_of_stock"
    if (count <= 5) return "low_stock"
    return "in_stock"
  }

  // Barcode POS scanner for fast restock
  const handleBarcodeRestockScan = (barcode: string) => {
    const clean = barcode.trim().toLowerCase()
    const found = menuItems.find(
      (it) => it.barcode && it.barcode.trim().toLowerCase() === clean
    )
    if (found) {
      setHighlightedItemId(found.id)
      setInventoryStatusFilter("all")
      if (found.variants && found.variants.length > 0) {
        setExpandedItemIds((prev) => ({ ...prev, [found.id]: true }))
      }
      setTimeout(() => {
        const el = document.getElementById(`inventory-row-${found.id}`)
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
      }, 200)
    } else {
      alert(`No product matching barcode "${barcode}" was found in this store.`)
    }
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

                {/* Telegram Username */}
                <div className="flex items-center gap-2.5 bg-[#f0f9ff] border border-[#bae6fd] rounded-xl px-4 py-3">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 text-[#2196F3] fill-current">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.869 4.326-2.96-.924c-.643-.203-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.829.941z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-bold text-[#0d1c2d] mb-0.5">Telegram Username <span className="font-normal text-[#76777d]">(optional)</span></label>
                    <input
                      type="text"
                      value={regTelegramUsername}
                      onChange={(e) => setRegTelegramUsername(e.target.value)}
                      placeholder="e.g. @mystore or mystore"
                      className="w-full bg-transparent border-none outline-none text-xs text-[#0d1c2d] placeholder-[#94a3b8]"
                    />
                  </div>
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
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-[#00714d] border border-emerald-200 rounded-full text-xs font-semibold mb-2">
              <span>✓</span>
              <span>Verified Seller</span>
            </div>
            <h2 className="text-2xl font-bold text-[#0d1c2d]">
              {profile.businessName} Studio
            </h2>
            <p className="text-xs text-[#76777d] mt-1">
              Owner: <span className="font-semibold text-[#0d1c2d]">{profile.ownerName}</span> • Phone: {profile.phone} • Cuisine: {profile.cuisineType}
            </p>

            {/* Telegram Section */}
            <div className="mt-3">
              {!isTelegramEditing ? (
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-[#2196F3] fill-current">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.869 4.326-2.96-.924c-.643-.203-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.829.941z" />
                  </svg>
                  {profile.telegramUsername ? (
                    <span className="text-xs text-[#0d1c2d] font-semibold">@{profile.telegramUsername}</span>
                  ) : (
                    <span className="text-xs text-[#76777d] italic">No Telegram linked</span>
                  )}
                  <button
                    onClick={() => {
                      setTelegramEdit(profile.telegramUsername || "")
                      setIsTelegramEditing(true)
                    }}
                    className="text-[10px] font-semibold text-[#006c49] hover:underline ml-1"
                  >
                    {profile.telegramUsername ? "Edit" : "+ Link Telegram"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-[#f0f9ff] border border-[#bae6fd] rounded-xl px-3 py-2 max-w-xs">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-[#2196F3] fill-current">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.869 4.326-2.96-.924c-.643-.203-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.829.941z" />
                  </svg>
                  <input
                    type="text"
                    value={telegramEdit}
                    onChange={(e) => setTelegramEdit(e.target.value)}
                    placeholder="@yourusername"
                    className="flex-1 bg-transparent border-none outline-none text-xs text-[#0d1c2d]"
                    autoFocus
                  />
                  <button
                    disabled={isSavingTelegram}
                    onClick={async () => {
                      setIsSavingTelegram(true)
                      const updated = await saveSellerProfile({
                        ...profile,
                        telegramUsername: telegramEdit || undefined,
                      })
                      if (updated) setProfile(updated)
                      setIsTelegramEditing(false)
                      setIsSavingTelegram(false)
                    }}
                    className="text-[10px] font-bold text-white bg-[#2196F3] hover:bg-[#1976d2] disabled:opacity-50 px-2 py-1 rounded-lg"
                  >
                    {isSavingTelegram ? "..." : "Save"}
                  </button>
                  <button
                    onClick={() => setIsTelegramEditing(false)}
                    className="text-[10px] text-[#76777d] hover:text-[#0d1c2d] font-semibold"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {stores.map((store, index) => {
              const isSelected = store.id === selectedStoreId
              return (
                <div
                  key={store.id}
                  onClick={() => setSelectedStoreId(store.id)}
                  className={`cursor-pointer rounded-xl border transition-all overflow-hidden flex flex-col justify-between bg-white shadow-xs hover:shadow-md group ${isSelected
                      ? "border-[#006c49] ring-2 ring-[#6cf8bb]/40"
                      : "border-[#eef4ff] hover:border-[#cbd5e1]"
                    }`}
                >
                  <div>
                    {/* Compact Square Image Frame - Matching Home Page Style */}
                    <div className="relative aspect-square w-full bg-[#f4f7fc] overflow-hidden flex items-center justify-center">
                      <Image
                        src={store.image}
                        alt={store.name}
                        fill
                        loading="eager"
                        priority={index < 4}
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-contain p-1.5 group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded-md text-[10px] font-bold shadow-xs">
                        {store.badgeIcon} <span className="hidden sm:inline">{store.category}</span>
                      </div>
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-[#006c49] text-white px-2 py-0.5 rounded-full text-[9px] font-bold shadow-xs">
                          Active
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 sm:p-3">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs sm:text-sm font-bold text-[#0d1c2d] truncate">{store.name}</h4>
                        <span className="text-xs font-bold text-[#006c49] shrink-0">{store.priceRange}</span>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-[#76777d] mt-0.5 line-clamp-1">{store.cuisine}</p>
                    </div>
                  </div>

                  <div className="p-2.5 sm:p-3 pt-0 flex items-center justify-between border-t border-[#f1f5f9] text-[10px] sm:text-xs text-[#76777d]">
                    <span>★ {store.rating} ({store.reviewsCount})</span>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenStoreModal(store)
                        }}
                        className="font-semibold text-[#006c49] hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteStore(store.id)
                        }}
                        className="font-semibold text-red-600 hover:underline"
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

      {/* Menu Items & Stock Hub Section */}
      {selectedStore && (
        <div className="bg-white border border-[#eef4ff] rounded-2xl p-4 sm:p-6 shadow-xs space-y-6">
          {/* Store Section Header & Segmented Tab Switcher */}
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#eef4ff] gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">{selectedStore.badgeIcon}</span>
                <h3 className="text-lg font-bold text-[#0d1c2d]">
                  {selectedStore.name}
                </h3>
              </div>
              <p className="text-xs text-[#76777d]">
                Manage catalog items, prices, variant matrices, and real-time inventory
              </p>
            </div>

            {/* Tab Switcher: Catalog vs Stock Management Hub */}
            <div className="flex items-center gap-2 bg-[#f8f9ff] p-1 rounded-xl border border-[#ccdbf2]">
              <button
                type="button"
                onClick={() => setActiveStoreTab("catalog")}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeStoreTab === "catalog"
                    ? "bg-[#006c49] text-white shadow-xs"
                    : "text-[#45464d] hover:text-[#0d1c2d] hover:bg-white/50"
                  }`}
              >
                <span>📋 Catalog Cards</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                  {menuItems.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveStoreTab("inventory")}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeStoreTab === "inventory"
                    ? "bg-[#006c49] text-white shadow-xs"
                    : "text-[#45464d] hover:text-[#0d1c2d] hover:bg-white/50"
                  }`}
              >
                <span>📦 Stock & Inventory Hub</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                  {menuItems.reduce((sum, it) => sum + getItemStockCount(it), 0)} units
                </span>
              </button>
            </div>
          </div>

          {/* TAB 1: Catalog & Product Cards Grid */}
          {activeStoreTab === "catalog" && (
            <div>
              <div className="flex items-center justify-between pb-3 mb-4">
                <p className="text-xs font-semibold text-[#0d1c2d]">
                  Catalog Display View ({menuItems.length} Products)
                </p>
                <button
                  onClick={() => handleOpenItemModal()}
                  className="bg-[#006c49] hover:bg-[#005236] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                >
                  <span>+ Add Product</span>
                </button>
              </div>

              {menuItems.length === 0 ? (
                <div className="text-center py-12 bg-[#f8f9ff] rounded-xl border border-dashed border-[#ccdbf2]">
                  <p className="text-xs text-[#76777d] mb-3">No products added to this store yet.</p>
                  <button
                    onClick={() => handleOpenItemModal()}
                    className="bg-[#006c49] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs"
                  >
                    + Add First Product
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
                  {menuItems.map((item, idx) => {
                    const stockCount = getItemStockCount(item)
                    const status = getItemStockStatus(item)

                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-[#eef4ff] overflow-hidden flex flex-col justify-between bg-white shadow-xs hover:shadow-md transition-all duration-200 group"
                      >
                        <div>
                          {/* Compact Square Image Frame */}
                          <div className="relative aspect-square w-full bg-[#f4f7fc] overflow-hidden flex items-center justify-center">
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              loading={idx < 4 ? "eager" : "lazy"}
                              priority={idx < 4}
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                              className="object-contain p-1.5 group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded-full text-[10px] font-bold text-[#0d1c2d] shadow-xs">
                              {item.category}
                            </div>
                            <button
                              onClick={() => handleToggleAvailable(item)}
                              className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-bold transition-all shadow-xs ${status === "in_stock"
                                  ? "bg-emerald-600 text-white"
                                  : status === "low_stock"
                                    ? "bg-amber-500 text-white"
                                    : "bg-red-600 text-white"
                                }`}
                            >
                              {status === "in_stock"
                                ? `${stockCount} In Stock`
                                : status === "low_stock"
                                  ? `Low: ${stockCount}`
                                  : "Sold Out"}
                            </button>
                          </div>

                          <div className="p-2.5 sm:p-3">
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <h4 className="font-bold text-xs sm:text-sm text-[#0d1c2d] line-clamp-1">
                                {item.name}
                              </h4>
                              <div className="text-right shrink-0">
                                {item.showPrice === false ? (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                    💬 Contact
                                  </span>
                                ) : (
                                  <span className="font-bold text-xs sm:text-sm text-[#006c49]">
                                    ${item.price.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {item.description && (
                              <p className="text-[10px] sm:text-[11px] text-[#76777d] line-clamp-1">
                                {item.description}
                              </p>
                            )}

                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {item.barcode && (
                                <span className="text-[9px] font-mono bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
                                  🏷️ {item.barcode}
                                </span>
                              )}
                              {item.productType === "simple" ? (
                                <span className="text-[9px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
                                  🖼️ {item.gallery?.length || 1} Photos
                                </span>
                              ) : item.variants && item.variants.length > 0 ? (
                                <span className="text-[9px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                                  {item.variants.length} SKUs
                                </span>
                              ) : (
                                <span className="text-[9px] bg-[#eef4ff] text-[#00714d] px-1.5 py-0.5 rounded font-semibold">
                                  📦 {stockCount} units
                                </span>
                              )}
                              {item.showPrice === false && (
                                <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                                  Hidden Price
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="p-2.5 sm:p-3 pt-0 border-t border-[#f1f5f9] flex items-center justify-between text-[10px] sm:text-xs text-[#76777d]">
                          <span className="truncate max-w-[70px] sm:max-w-[100px]">
                            {item.calories || item.prepTime || "Available"}
                          </span>
                          <div className="flex gap-2 shrink-0">
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
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Stock & Inventory Hub */}
          {activeStoreTab === "inventory" && (() => {
            const totalStockUnits = menuItems.reduce((sum, it) => sum + getItemStockCount(it), 0)
            const totalRetailValue = menuItems.reduce((sum, it) => {
              if (it.variants && it.variants.length > 0) {
                return (
                  sum +
                  it.variants.reduce(
                    (vsum, v) => vsum + (v.sellPrice || it.price) * (v.stock || 0),
                    0
                  )
                )
              }
              return sum + it.price * (it.stock !== undefined ? it.stock : 50)
            }, 0)
            const inStockItems = menuItems.filter((it) => getItemStockStatus(it) === "in_stock")
            const lowStockItems = menuItems.filter((it) => getItemStockStatus(it) === "low_stock")
            const outOfStockItems = menuItems.filter((it) => getItemStockStatus(it) === "out_of_stock")

            // Filter items for inventory table
            const filteredInventoryItems = menuItems.filter((it) => {
              const matchesSearch =
                !inventorySearch ||
                it.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
                (it.barcode && it.barcode.toLowerCase().includes(inventorySearch.toLowerCase())) ||
                it.category.toLowerCase().includes(inventorySearch.toLowerCase())

              const matchesCategory =
                inventoryCategoryFilter === "all" || it.category === inventoryCategoryFilter

              const status = getItemStockStatus(it)
              const matchesStatus =
                inventoryStatusFilter === "all" || inventoryStatusFilter === status

              return matchesSearch && matchesCategory && matchesStatus
            })

            const uniqueCategories = Array.from(new Set(menuItems.map((it) => it.category)))

            return (
              <div className="space-y-6">
                {/* 1. Executive Inventory KPI Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="p-3.5 bg-[#f8f9ff] border border-[#ccdbf2] rounded-2xl">
                    <p className="text-[11px] text-[#76777d] font-semibold flex items-center gap-1">
                      <span>📦</span>
                      <span>Total Stock Units</span>
                    </p>
                    <p className="text-xl font-black text-[#0d1c2d] mt-1">
                      {totalStockUnits.toLocaleString()}
                    </p>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Across {menuItems.length} products
                    </span>
                  </div>

                  <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl">
                    <p className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1">
                      <span>💰</span>
                      <span>Inventory Value</span>
                    </p>
                    <p className="text-xl font-black text-[#006c49] mt-1">
                      ${totalRetailValue.toFixed(2)}
                    </p>
                    <span className="text-[10px] text-emerald-700 font-medium">Estimated Retail</span>
                  </div>

                  <div
                    onClick={() => setInventoryStatusFilter("in_stock")}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${inventoryStatusFilter === "in_stock"
                        ? "bg-emerald-100/60 border-emerald-400 ring-2 ring-emerald-300"
                        : "bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50"
                      }`}
                  >
                    <p className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1">
                      <span>✓</span>
                      <span>In Stock (&gt; 5)</span>
                    </p>
                    <p className="text-xl font-black text-emerald-700 mt-1">
                      {inStockItems.length}
                    </p>
                    <span className="text-[10px] text-emerald-600 font-medium">Healthy Inventory</span>
                  </div>

                  <div
                    onClick={() => setInventoryStatusFilter("low_stock")}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${inventoryStatusFilter === "low_stock"
                        ? "bg-amber-100 border-amber-400 ring-2 ring-amber-300"
                        : "bg-amber-50/60 border-amber-200 hover:bg-amber-50"
                      }`}
                  >
                    <p className="text-[11px] text-amber-800 font-semibold flex items-center gap-1">
                      <span>⚠️</span>
                      <span>Low Stock (1-5)</span>
                    </p>
                    <p className="text-xl font-black text-amber-600 mt-1">
                      {lowStockItems.length}
                    </p>
                    <span className="text-[10px] text-amber-700 font-medium">Needs Reorder</span>
                  </div>

                  <div
                    onClick={() => setInventoryStatusFilter("out_of_stock")}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${inventoryStatusFilter === "out_of_stock"
                        ? "bg-red-100 border-red-400 ring-2 ring-red-300"
                        : "bg-red-50/50 border-red-200 hover:bg-red-50"
                      }`}
                  >
                    <p className="text-[11px] text-red-800 font-semibold flex items-center gap-1">
                      <span>✕</span>
                      <span>Out of Stock (0)</span>
                    </p>
                    <p className="text-xl font-black text-red-600 mt-1">
                      {outOfStockItems.length}
                    </p>
                    <span className="text-[10px] text-red-600 font-medium">Sold Out</span>
                  </div>
                </div>

                {/* 2. Search, Status Filter & Barcode Scanner Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#f8f9ff] p-3.5 rounded-2xl border border-[#eef4ff]">
                  <div className="flex flex-wrap items-center gap-2 flex-1">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[180px] max-w-xs">
                      <input
                        type="text"
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                        placeholder="Search product, barcode, category..."
                        className="w-full h-9 pl-8 pr-3 text-xs bg-white border border-[#ccdbf2] rounded-xl outline-none focus:border-[#006c49]"
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                        🔍
                      </span>
                    </div>

                    {/* Category Filter */}
                    <select
                      value={inventoryCategoryFilter}
                      onChange={(e) => setInventoryCategoryFilter(e.target.value)}
                      className="h-9 px-3 text-xs bg-white border border-[#ccdbf2] rounded-xl outline-none"
                    >
                      <option value="all">All Categories</option>
                      {uniqueCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>

                    {/* Status Filter Chips */}
                    <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-[#ccdbf2]">
                      {(["all", "in_stock", "low_stock", "out_of_stock"] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setInventoryStatusFilter(st)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${inventoryStatusFilter === st
                              ? "bg-[#006c49] text-white shadow-2xs"
                              : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                          {st === "all"
                            ? "All"
                            : st === "in_stock"
                              ? "In Stock"
                              : st === "low_stock"
                                ? "Low Stock"
                                : "Sold Out"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Barcode Scanner Restock Button */}
                    <button
                      type="button"
                      onClick={() => setIsInventoryScannerOpen(true)}
                      className="h-9 px-3 bg-[#006c49] hover:bg-[#005236] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0"
                      title="Scan barcode with camera to find & restock product instantly"
                    >
                      <span>📷 Scan Barcode to Restock</span>
                    </button>

                    {/* Bulk Restock +10 */}
                    <button
                      type="button"
                      onClick={() => handleBulkRestock(10)}
                      className="h-9 px-3 bg-white hover:bg-slate-50 text-[#00714d] text-xs font-bold border border-[#ccdbf2] rounded-xl transition-all flex items-center gap-1 shrink-0"
                      title="Add +10 units to all products in this store"
                    >
                      <span>⚡ Bulk +10</span>
                    </button>
                  </div>
                </div>

                {/* 3. Interactive Inventory Management Table & Mobile Cards */}
                {filteredInventoryItems.length === 0 ? (
                  <div className="text-center py-12 bg-[#f8f9ff] rounded-2xl border border-dashed border-[#ccdbf2]">
                    <span className="text-3xl inline-block mb-2">📦</span>
                    <p className="text-xs font-bold text-[#0d1c2d]">No inventory items match your filter.</p>
                    <p className="text-[11px] text-[#76777d] mt-0.5">Try resetting search or status filters.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setInventorySearch("")
                        setInventoryCategoryFilter("all")
                        setInventoryStatusFilter("all")
                      }}
                      className="mt-3 text-xs text-[#00714d] font-bold hover:underline"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* ── DESKTOP & TABLET: Clean Real HTML Table (hidden on mobile) ── */}
                    <div className="hidden md:block border border-[#eef4ff] rounded-2xl overflow-hidden bg-white shadow-2xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-[#f8f9ff] text-[#76777d] border-b border-[#eef4ff] font-bold text-[11px] uppercase tracking-wider">
                            <tr>
                              <th className="py-3 px-4 w-[28%]">Product</th>
                              <th className="py-3 px-4 w-[20%]">Category / Barcode</th>
                              <th className="py-3 px-4 w-[12%]">Price</th>
                              <th className="py-3 px-4 w-[14%]">Stock Status</th>
                              <th className="py-3 px-4 w-[14%] text-center">Current Stock</th>
                              <th className="py-3 px-4 w-[12%] text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f1f5f9]">
                            {filteredInventoryItems.map((item) => {
                              const stockCount = getItemStockCount(item)
                              const status = getItemStockStatus(item)
                              const hasVariants = item.variants && item.variants.length > 0
                              const isExpanded = !!expandedItemIds[item.id]
                              const isHighlighted = highlightedItemId === item.id

                              return (
                                <tr
                                  key={item.id}
                                  id={`inventory-row-${item.id}`}
                                  className={`transition-colors group ${isHighlighted
                                      ? "bg-emerald-50 ring-2 ring-emerald-400"
                                      : "hover:bg-[#fbfdff]"
                                    }`}
                                >
                                  {/* Col 1: Product Thumbnail & Name */}
                                  <td className="py-3.5 px-4 align-middle">
                                    <div className="flex items-center gap-3">
                                      <div className="relative w-12 h-12 rounded-xl bg-[#f4f7fc] border border-[#eef4ff] overflow-hidden shrink-0 flex items-center justify-center">
                                        <Image
                                          src={item.image}
                                          alt={item.name}
                                          fill
                                          sizes="48px"
                                          className="object-contain p-1"
                                        />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-bold text-xs sm:text-sm text-[#0d1c2d] truncate">
                                          {item.name}
                                        </p>
                                        {hasVariants ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setExpandedItemIds((prev) => ({
                                                ...prev,
                                                [item.id]: !prev[item.id],
                                              }))
                                            }
                                            className="text-[10px] font-bold text-[#00714d] bg-[#eef4ff] hover:bg-[#dbe9ff] px-2 py-0.5 rounded-md transition-all flex items-center gap-1 mt-1"
                                          >
                                            <span>{isExpanded ? "▼ Hide SKUs" : "▶ View SKUs"}</span>
                                            <span>({item.variants?.length} variants)</span>
                                          </button>
                                        ) : (
                                          <span className="text-[10px] text-slate-400 font-medium">
                                            Single Item
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Col 2: Category & Barcode */}
                                  <td className="py-3.5 px-4 align-middle">
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-semibold text-[#00714d] bg-[#eef4ff] px-2 py-0.5 rounded-full border border-[#ccdbf2] inline-block">
                                        {item.category}
                                      </span>
                                      {item.barcode ? (
                                        <p className="text-[10px] font-mono text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-bold">
                                          🏷️ {item.barcode}
                                        </p>
                                      ) : (
                                        <p className="text-[10px] text-slate-400 italic">No Barcode</p>
                                      )}
                                    </div>
                                  </td>

                                  {/* Col 3: Price & Cost */}
                                  <td className="py-3.5 px-4 align-middle">
                                    <p className="font-black text-xs sm:text-sm text-[#006c49]">
                                      ${item.price.toFixed(2)}
                                    </p>
                                    {item.costPrice ? (
                                      <p className="text-[10px] text-[#76777d]">
                                        Cost: ${item.costPrice.toFixed(2)}
                                      </p>
                                    ) : null}
                                  </td>

                                  {/* Col 4: Stock Status Badge */}
                                  <td className="py-3.5 px-4 align-middle">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${status === "in_stock"
                                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                          : status === "low_stock"
                                            ? "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                                            : "bg-red-50 text-red-700 border border-red-200"
                                        }`}
                                    >
                                      <span>
                                        {status === "in_stock" ? "✓" : status === "low_stock" ? "⚠️" : "✕"}
                                      </span>
                                      <span>
                                        {status === "in_stock"
                                          ? "In Stock"
                                          : status === "low_stock"
                                            ? "Low Stock"
                                            : "Sold Out"}
                                      </span>
                                    </span>
                                  </td>

                                  {/* Col 5: Current Stock Count & Stepper */}
                                  <td className="py-3.5 px-4 align-middle text-center">
                                    {hasVariants ? (
                                      <div>
                                        <p className="text-sm font-black text-[#0d1c2d]">
                                          {stockCount} units
                                        </p>
                                        <span className="text-[10px] text-[#76777d]">
                                          Total across variants
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="inline-flex items-center gap-1 bg-[#f8f9ff] border border-[#ccdbf2] rounded-xl p-1 shadow-2xs">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleInlineStockChange(item, Math.max(0, stockCount - 1))
                                          }
                                          className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 text-xs font-black text-[#0d1c2d] flex items-center justify-center transition-all shadow-2xs"
                                          title="Decrease stock by 1"
                                        >
                                          −
                                        </button>
                                        <input
                                          type="number"
                                          min="0"
                                          value={stockCount}
                                          onChange={(e) => {
                                            const v = parseInt(e.target.value)
                                            handleInlineStockChange(item, isNaN(v) ? 0 : v)
                                          }}
                                          className="w-12 text-center text-xs font-black bg-transparent border-none outline-none text-[#0d1c2d]"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleInlineStockChange(item, stockCount + 1)}
                                          className="w-7 h-7 rounded-lg bg-[#006c49] hover:bg-[#005236] text-xs font-black text-white flex items-center justify-center transition-all shadow-2xs"
                                          title="Increase stock by 1"
                                        >
                                          +
                                        </button>
                                      </div>
                                    )}
                                  </td>

                                  {/* Col 6: Quick Restock Actions */}
                                  <td className="py-3.5 px-4 align-middle text-right">
                                    {!hasVariants ? (
                                      <div className="inline-flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleInlineStockChange(item, stockCount + 10)}
                                          className="px-2 py-1 rounded-lg bg-[#eef4ff] hover:bg-[#dbe9ff] text-[#00714d] text-[11px] font-bold border border-[#ccdbf2] transition-all"
                                          title="Add +10 units"
                                        >
                                          +10
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleInlineStockChange(item, stockCount > 0 ? 0 : 25)
                                          }
                                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${stockCount > 0
                                              ? "text-red-600 bg-red-50 hover:bg-red-100 border-red-200"
                                              : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                                            }`}
                                        >
                                          {stockCount > 0 ? "Set 0" : "Stock 25"}
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedItemIds((prev) => ({
                                            ...prev,
                                            [item.id]: !prev[item.id],
                                          }))
                                        }
                                        className="px-3 py-1.5 rounded-lg bg-[#006c49] hover:bg-[#005236] text-white text-xs font-bold shadow-2xs transition-all whitespace-nowrap"
                                      >
                                        {isExpanded ? "Hide SKUs" : "Manage SKUs"}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* ── MOBILE VIEW: Dedicated Clean Inventory Cards (visible on mobile only) ── */}
                    <div className="block md:hidden space-y-3">
                      {filteredInventoryItems.map((item) => {
                        const stockCount = getItemStockCount(item)
                        const status = getItemStockStatus(item)
                        const hasVariants = item.variants && item.variants.length > 0
                        const isExpanded = !!expandedItemIds[item.id]
                        const isHighlighted = highlightedItemId === item.id

                        return (
                          <div
                            key={item.id}
                            id={`inventory-card-${item.id}`}
                            className={`p-3.5 rounded-2xl border bg-white shadow-2xs transition-all ${isHighlighted
                                ? "border-emerald-400 bg-emerald-50/40 ring-2 ring-emerald-300"
                                : "border-[#eef4ff] hover:border-[#cbd5e1]"
                              }`}
                          >
                            {/* Card Header: Image + Title + Price + Status */}
                            <div className="flex items-start gap-3">
                              <div className="relative w-14 h-14 rounded-xl bg-[#f4f7fc] border border-[#eef4ff] overflow-hidden shrink-0 flex items-center justify-center">
                                <Image
                                  src={item.image}
                                  alt={item.name}
                                  fill
                                  sizes="56px"
                                  className="object-contain p-1"
                                />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-1">
                                  <h4 className="font-bold text-xs text-[#0d1c2d] line-clamp-1">
                                    {item.name}
                                  </h4>
                                  <span className="font-black text-xs text-[#006c49] shrink-0">
                                    ${item.price.toFixed(2)}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                  <span className="text-[9px] font-semibold text-[#00714d] bg-[#eef4ff] px-2 py-0.2 rounded-full border border-[#ccdbf2]">
                                    {item.category}
                                  </span>
                                  {item.barcode && (
                                    <span className="text-[9px] font-mono text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-bold">
                                      🏷️ {item.barcode}
                                    </span>
                                  )}
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9px] font-bold ${status === "in_stock"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : status === "low_stock"
                                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                                          : "bg-red-50 text-red-700 border border-red-200"
                                      }`}
                                  >
                                    {status === "in_stock"
                                      ? "✓ In Stock"
                                      : status === "low_stock"
                                        ? `⚠️ Low (${stockCount})`
                                        : "✕ Sold Out"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Card Footer: Stock Stepper & Quick Actions */}
                            <div className="mt-3 pt-3 border-t border-[#f1f5f9] flex items-center justify-between gap-2">
                              {!hasVariants ? (
                                <>
                                  <div className="flex items-center gap-1 bg-[#f8f9ff] border border-[#ccdbf2] rounded-xl p-1 shadow-2xs">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleInlineStockChange(item, Math.max(0, stockCount - 1))
                                      }
                                      className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 text-xs font-black text-[#0d1c2d] flex items-center justify-center shadow-2xs"
                                    >
                                      −
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      value={stockCount}
                                      onChange={(e) => {
                                        const v = parseInt(e.target.value)
                                        handleInlineStockChange(item, isNaN(v) ? 0 : v)
                                      }}
                                      className="w-10 text-center text-xs font-black bg-transparent border-none outline-none text-[#0d1c2d]"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleInlineStockChange(item, stockCount + 1)}
                                      className="w-7 h-7 rounded-lg bg-[#006c49] hover:bg-[#005236] text-xs font-black text-white flex items-center justify-center shadow-2xs"
                                    >
                                      +
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleInlineStockChange(item, stockCount + 10)}
                                      className="px-2 py-1.5 rounded-lg bg-[#eef4ff] text-[#00714d] text-[10px] font-bold border border-[#ccdbf2]"
                                    >
                                      +10
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleInlineStockChange(item, stockCount > 0 ? 0 : 25)
                                      }
                                      className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border ${stockCount > 0
                                          ? "text-red-600 bg-red-50 border-red-200"
                                          : "text-emerald-700 bg-emerald-50 border-emerald-200"
                                        }`}
                                    >
                                      {stockCount > 0 ? "Set 0" : "Stock 25"}
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div className="w-full flex items-center justify-between gap-2">
                                  <div>
                                    <p className="text-xs font-black text-[#0d1c2d]">
                                      {stockCount} units
                                    </p>
                                    <p className="text-[10px] text-[#76777d]">
                                      Across {item.variants?.length} SKU variants
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedItemIds((prev) => ({
                                        ...prev,
                                        [item.id]: !prev[item.id],
                                      }))
                                    }
                                    className="px-3 py-1.5 rounded-xl bg-[#006c49] hover:bg-[#005236] text-white text-xs font-bold shadow-2xs transition-all"
                                  >
                                    {isExpanded ? "▼ Hide SKUs" : "▶ Manage SKUs"}
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Mobile Expandable SKU Matrix */}
                            {hasVariants && isExpanded && (
                              <div className="mt-3 pt-3 border-t border-[#eef4ff] space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-bold text-[#0d1c2d]">
                                    🧩 Variant SKU Matrix ({item.variants?.length})
                                  </p>
                                  <span className="text-[9px] text-[#76777d]">
                                    Set stock per combo
                                  </span>
                                </div>
                                <div className="space-y-1.5">
                                  {item.variants?.map((v) => {
                                    const comboLabel = Object.entries(v.options)
                                      .map(([grp, val]) => `${grp}: ${val}`)
                                      .join(" · ")
                                    const skuStatus =
                                      v.stock <= 0
                                        ? "out_of_stock"
                                        : v.stock <= 5
                                          ? "low_stock"
                                          : "in_stock"

                                    return (
                                      <div
                                        key={v.id}
                                        className="p-2 bg-[#f8f9ff] rounded-xl border border-[#ccdbf2] flex items-center justify-between gap-2"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[11px] font-bold text-[#0d1c2d] truncate">
                                            {comboLabel}
                                          </p>
                                          <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-[11px] font-bold text-[#006c49]">
                                              ${(v.sellPrice || item.price).toFixed(2)}
                                            </span>
                                            <span
                                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${skuStatus === "in_stock"
                                                  ? "bg-emerald-100 text-emerald-800"
                                                  : skuStatus === "low_stock"
                                                    ? "bg-amber-100 text-amber-800"
                                                    : "bg-red-100 text-red-800"
                                                }`}
                                            >
                                              {v.stock} in stock
                                            </span>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1 bg-white border border-[#ccdbf2] rounded-lg p-0.5">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleInlineStockChange(
                                                item,
                                                Math.max(0, (v.stock || 0) - 1),
                                                v.id
                                              )
                                            }
                                            className="w-6 h-6 rounded bg-slate-50 hover:bg-slate-100 text-xs font-black text-[#0d1c2d] flex items-center justify-center shadow-2xs"
                                          >
                                            −
                                          </button>
                                          <input
                                            type="number"
                                            min="0"
                                            value={v.stock || 0}
                                            onChange={(e) => {
                                              const val = parseInt(e.target.value)
                                              handleInlineStockChange(
                                                item,
                                                isNaN(val) ? 0 : val,
                                                v.id
                                              )
                                            }}
                                            className="w-8 text-center text-xs font-bold bg-transparent border-none outline-none text-[#0d1c2d]"
                                          />
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleInlineStockChange(
                                                item,
                                                (v.stock || 0) + 1,
                                                v.id
                                              )
                                            }
                                            className="w-6 h-6 rounded bg-[#006c49] hover:bg-[#005236] text-xs font-black text-white flex items-center justify-center shadow-2xs"
                                          >
                                            +
                                          </button>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* ── DESKTOP EXPANDED SKU SUB-PANELS (rendered below the table) ── */}
                    <div className="hidden md:block space-y-3">
                      {filteredInventoryItems
                        .filter((item) => item.variants && item.variants.length > 0 && expandedItemIds[item.id])
                        .map((item) => (
                          <div
                            key={`sku-panel-${item.id}`}
                            className="bg-[#f8f9ff] border border-[#ccdbf2] rounded-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-150"
                          >
                            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#eef4ff]">
                              <div className="flex items-center gap-2">
                                <span className="text-base">🧩</span>
                                <h4 className="text-xs sm:text-sm font-bold text-[#0d1c2d]">
                                  Variant SKU Matrix for &quot;{item.name}&quot; ({item.variants?.length} combinations)
                                </h4>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedItemIds((prev) => ({
                                    ...prev,
                                    [item.id]: false,
                                  }))
                                }
                                className="text-xs font-bold text-slate-500 hover:text-slate-800"
                              >
                                Close ✕
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                              {item.variants?.map((v) => {
                                const comboLabel = Object.entries(v.options)
                                  .map(([grp, val]) => `${grp}: ${val}`)
                                  .join(" · ")
                                const skuStatus =
                                  v.stock <= 0
                                    ? "out_of_stock"
                                    : v.stock <= 5
                                      ? "low_stock"
                                      : "in_stock"

                                return (
                                  <div
                                    key={v.id}
                                    className="p-3 bg-white rounded-xl border border-[#ccdbf2] shadow-2xs flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-bold text-[#0d1c2d] truncate">
                                        {comboLabel}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-bold text-[#006c49]">
                                          ${(v.sellPrice || item.price).toFixed(2)}
                                        </span>
                                        <span
                                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${skuStatus === "in_stock"
                                              ? "bg-emerald-50 text-emerald-700"
                                              : skuStatus === "low_stock"
                                                ? "bg-amber-50 text-amber-700"
                                                : "bg-red-50 text-red-700"
                                            }`}
                                        >
                                          {v.stock} in stock
                                        </span>
                                      </div>
                                    </div>

                                    {/* SKU Stepper */}
                                    <div className="flex items-center gap-1 bg-[#f8f9ff] border border-[#ccdbf2] rounded-lg p-0.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleInlineStockChange(
                                            item,
                                            Math.max(0, (v.stock || 0) - 1),
                                            v.id
                                          )
                                        }
                                        className="w-6 h-6 rounded bg-white hover:bg-slate-100 text-xs font-bold text-[#0d1c2d] flex items-center justify-center shadow-2xs"
                                      >
                                        −
                                      </button>
                                      <input
                                        type="number"
                                        min="0"
                                        value={v.stock || 0}
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value)
                                          handleInlineStockChange(
                                            item,
                                            isNaN(val) ? 0 : val,
                                            v.id
                                          )
                                        }}
                                        className="w-8 text-center text-xs font-bold bg-transparent border-none outline-none text-[#0d1c2d]"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleInlineStockChange(
                                            item,
                                            (v.stock || 0) + 1,
                                            v.id
                                          )
                                        }
                                        className="w-6 h-6 rounded bg-[#006c49] hover:bg-[#005236] text-xs font-bold text-white flex items-center justify-center shadow-2xs"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
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
                      className={`w-9 h-9 rounded-xl text-base flex items-center justify-center border transition-all ${storeBadge === emoji
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
                      loading="eager"
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
                      className={`relative h-12 rounded-lg overflow-hidden border-2 transition-all ${storeImage === img.url ? "border-[#006c49]" : "border-transparent"
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
          <div className="bg-white text-[#0d1c2d] rounded-2xl p-5 sm:p-8 max-w-xl md:max-w-2xl lg:max-w-3xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
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
              {/* ── Product Architecture Type Selector ── */}
              <div className="bg-[#f8f9ff] p-3 rounded-2xl border border-[#ccdbf2] space-y-2">
                <label className="block text-xs font-bold text-[#0d1c2d]">
                  Product Type Architecture *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Simple Product Option */}
                  <div
                    onClick={() => {
                      if (itemProductType !== "simple") {
                        if (itemOptions.length > 0 || itemVariants.length > 0) {
                          setPendingTypeSwitch("simple")
                        } else {
                          setItemProductType("simple")
                        }
                      }
                    }}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      itemProductType === "simple"
                        ? "border-[#006c49] bg-emerald-50/60 shadow-xs"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🖼️</span>
                      <span className="font-bold text-xs text-[#0d1c2d]">Simple Gallery Product</span>
                    </div>
                    <p className="text-[10px] text-[#76777d] leading-relaxed">
                      Single unique item (e.g. car, watch, art, real estate) with multi-photo gallery. No SKUs or size groups.
                    </p>
                  </div>

                  {/* Variant Product Option */}
                  <div
                    onClick={() => {
                      if (itemProductType !== "variant") {
                        if (itemGallery.length > 0) {
                          setPendingTypeSwitch("variant")
                        } else {
                          setItemProductType("variant")
                        }
                      }
                    }}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      itemProductType === "variant"
                        ? "border-[#006c49] bg-emerald-50/60 shadow-xs"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🧩</span>
                      <span className="font-bold text-xs text-[#0d1c2d]">Variant Product</span>
                    </div>
                    <p className="text-[10px] text-[#76777d] leading-relaxed">
                      Multi-option product (e.g. clothing with Color/Size matrix, menu items) with variant SKU pricing.
                    </p>
                  </div>
                </div>
              </div>

              {/* Type Switch Confirmation Modal */}
              {pendingTypeSwitch && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                  <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-amber-200 animate-in fade-in zoom-in-95">
                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-lg mb-2.5">
                      ⚠️
                    </div>
                    <h4 className="font-bold text-sm text-[#0d1c2d]">
                      Switch to {pendingTypeSwitch === "simple" ? "Simple Gallery Product" : "Variant Product"}?
                    </h4>
                    <p className="text-xs text-[#76777d] mt-1.5 leading-relaxed">
                      {pendingTypeSwitch === "simple"
                        ? "Switching to Simple Product will hide your Option Groups and SKU combinations upon saving. Multi-photo gallery will be enabled."
                        : "Switching to Variant Product will hide your multi-photo gallery upon saving. Option Groups & SKUs will be enabled."}
                    </p>
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingTypeSwitch(null)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setItemProductType(pendingTypeSwitch)
                          setPendingTypeSwitch(null)
                        }}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#006c49] text-white hover:bg-[#005236]"
                      >
                        Confirm Switch
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#0d1c2d] mb-1">Product / Item Name *</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. 2010 Toyota Prius, Vintage Watch, or Heavyweight Cotton Hoodie"
                  className="w-full h-10 px-3.5 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d] outline-none focus:border-[#006c49]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  <label className="block font-semibold text-[#0d1c2d] mb-1">
                    Selling Price ($) {itemProductType === "simple" || !itemShowPrice ? "(Optional)" : "*"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required={itemProductType !== "simple" && itemShowPrice}
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    placeholder={itemProductType === "simple" && !itemShowPrice ? "Negotiable / Contact" : "0.00"}
                    className="w-full h-10 px-3.5 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d] outline-none focus:border-[#006c49]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#0d1c2d] mb-1">
                    Unit Cost Price ($) <span className="text-[10px] text-slate-400">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={itemCostPrice}
                    onChange={(e) => setItemCostPrice(e.target.value)}
                    placeholder="12.00"
                    className="w-full h-10 px-3.5 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d] outline-none"
                  />
                </div>
              </div>

              {/* ── Price Visibility Toggle ── */}
              <div className="p-3 bg-slate-50 border border-[#eef4ff] rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{itemShowPrice ? "🏷️" : "💬"}</span>
                  <div>
                    <p className="text-xs font-bold text-[#0d1c2d]">
                      {itemShowPrice ? "Display Price on Store Menu" : "Hide Price ('Contact for Price')"}
                    </p>
                    <p className="text-[10px] text-[#76777d]">
                      {itemShowPrice
                        ? "Price is shown directly to customers on the catalog cards."
                        : "Price is hidden. Customers will see a 'Contact for Price' button with Telegram/WhatsApp inquiry."}
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={itemShowPrice}
                    onChange={(e) => setItemShowPrice(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006c49]"></div>
                </label>
              </div>

              <div>
                <label className="block font-semibold text-[#0d1c2d] mb-1">Description *</label>
                <textarea
                  rows={2}
                  required
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="Product specs, year/mileage, materials, condition, ingredients, or styling details..."
                  className="w-full p-3 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  <label className="block font-semibold text-[#0d1c2d] mb-1">Size / Weight / Specs</label>
                  <input
                    type="text"
                    value={itemCalories}
                    onChange={(e) => setItemCalories(e.target.value)}
                    placeholder="e.g. Sizes: S, M, L or 500g"
                    className="w-full h-10 px-3.5 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#0d1c2d] mb-1">
                    Stock Quantity (Units)
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={itemVariants.length > 0}
                    value={itemVariants.length > 0 ? itemVariants.reduce((s, v) => s + (v.stock || 0), 0) : itemStock}
                    onChange={(e) => setItemStock(e.target.value)}
                    placeholder="0"
                    className={`w-full h-10 px-3.5 bg-white border border-[#c6c6cd] rounded-xl text-[#0d1c2d] outline-none ${itemVariants.length > 0 ? "opacity-60 bg-slate-100 cursor-not-allowed" : ""
                      }`}
                  />
                  {itemVariants.length > 0 && (
                    <p className="text-[9px] text-[#00714d] mt-0.5">
                      Managed by {itemVariants.length} SKU variants below
                    </p>
                  )}
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

              {/* Barcode / SKU Code Section with Database Uniqueness Validation */}
              <div className="bg-[#f8f9ff] border border-[#eef4ff] rounded-2xl p-3.5 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-[#0d1c2d] flex items-center gap-1.5">
                      <span>🏷️ Barcode / SKU Code</span>
                      <span className="text-[10px] font-normal text-[#76777d]">(Must be unique)</span>
                    </label>
                    <p className="text-[10px] text-[#76777d]">Input manual, auto-generate, or scan with camera</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isGeneratingBarcode}
                      onClick={async () => {
                        setIsGeneratingBarcode(true)
                        const uniqueCode = await generateUniqueBarcode("200")
                        setItemBarcode(uniqueCode)
                        setIsGeneratingBarcode(false)
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-[#eef4ff] hover:bg-[#dbe9ff] disabled:opacity-50 text-[#00714d] text-[11px] font-bold border border-[#ccdbf2] transition-all flex items-center gap-1 shadow-2xs"
                      title="Auto-generate guaranteed unique barcode verified with database"
                    >
                      <span>{isGeneratingBarcode ? "⏳ Generating..." : "⚡ Auto Generate"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsBarcodeScannerOpen(true)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#006c49] hover:bg-[#005236] text-white text-[11px] font-bold shadow-xs transition-all flex items-center gap-1"
                      title="Scan barcode with device camera or image"
                    >
                      <span>📷 Scan Barcode</span>
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={itemBarcode}
                    onChange={(e) => setItemBarcode(e.target.value)}
                    placeholder="e.g. 200849201934 or TSHIRT-RED-S"
                    className={`w-full h-10 px-3.5 pr-20 rounded-xl text-xs font-mono outline-none transition-all border ${barcodeStatus && !barcodeStatus.isChecking && !barcodeStatus.isUnique
                        ? "border-red-500 bg-red-50/40 text-red-900 focus:border-red-600 ring-2 ring-red-200"
                        : barcodeStatus && !barcodeStatus.isChecking && barcodeStatus.isUnique
                          ? "border-emerald-500 bg-emerald-50/20 text-[#0d1c2d] focus:border-[#006c49]"
                          : "border-[#c6c6cd] bg-white text-[#0d1c2d] focus:border-[#006c49]"
                      }`}
                  />
                  {itemBarcode && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(itemBarcode)
                          setBarcodeCopied(true)
                          setTimeout(() => setBarcodeCopied(false), 1500)
                        }}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                        title="Copy barcode"
                      >
                        {barcodeCopied ? "✓ Copied" : "Copy"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemBarcode("")}
                        className="text-xs text-slate-400 hover:text-slate-700 px-1"
                        title="Clear barcode"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {/* Real-time Database Uniqueness Status Message */}
                {barcodeStatus && itemBarcode.trim() && (
                  <div>
                    {barcodeStatus.isChecking ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="inline-block animate-spin">⏳</span>
                        <span>Checking database for uniqueness...</span>
                      </div>
                    ) : barcodeStatus.isUnique ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-[#00714d] font-bold">
                        <span>✓</span>
                        <span>Unique Barcode: Available in Database</span>
                      </div>
                    ) : (
                      <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span>⚠️</span>
                          <span>
                            Duplicate Barcode: Already assigned to{" "}
                            <strong>&quot;{barcodeStatus.conflictName || "another item"}&quot;</strong>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            setIsGeneratingBarcode(true)
                            const uniqueCode = await generateUniqueBarcode("200")
                            setItemBarcode(uniqueCode)
                            setIsGeneratingBarcode(false)
                          }}
                          className="text-[10px] bg-red-600 hover:bg-red-700 text-white font-bold px-2 py-0.5 rounded-lg whitespace-nowrap"
                        >
                          Fix with Auto-Generate
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Visual SVG Barcode Preview */}
                {itemBarcode.trim() && barcodeStatus?.isUnique !== false && (
                  <div className="pt-1 flex items-center justify-center">
                    <BarcodeVisualPreview barcode={itemBarcode.trim()} />
                  </div>
                )}
              </div>

              {/* ── Conditional Section: Simple Product Gallery vs Variant Product Option Matrix ── */}
              {itemProductType === "simple" ? (
                /* ── Simple Product Multi-Photo Gallery ── */
                <div className="border border-[#ccdbf2] rounded-2xl p-4 bg-[#f8f9ff] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">📸</span>
                        <h4 className="text-xs font-bold text-[#0d1c2d]">
                          Multi-Photo Gallery ({itemGallery.length} / {MAX_GALLERY_IMAGES})
                        </h4>
                        {itemGallery.length >= 10 && itemGallery.length < MAX_GALLERY_IMAGES && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            Approaching limit ({itemGallery.length}/15)
                          </span>
                        )}
                        {itemGallery.length >= MAX_GALLERY_IMAGES && (
                          <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                            Max limit reached (15/15)
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#76777d] mt-0.5">
                        Upload 1 to 15 high-res photos. Set the cover image for catalog cards. Auto-optimized to WebP.
                      </p>
                    </div>

                    {/* Multi-file upload button */}
                    <div className="flex items-center gap-2">
                      <label
                        className={`cursor-pointer px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                          itemGallery.length >= MAX_GALLERY_IMAGES || isUploadingGallery
                            ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                            : "bg-[#006c49] hover:bg-[#005236] text-white"
                        }`}
                      >
                        <span>{isUploadingGallery ? "⏳ Uploading..." : "➕ Add Photos"}</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          disabled={itemGallery.length >= MAX_GALLERY_IMAGES || isUploadingGallery}
                          onChange={(e) => {
                            if (e.target.files) {
                              handleGalleryUploadFiles(e.target.files)
                            }
                            e.target.value = ""
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {galleryUploadError && (
                    <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center justify-between">
                      <span>⚠️ {galleryUploadError}</span>
                      <button
                        type="button"
                        onClick={() => setGalleryUploadError(null)}
                        className="text-red-500 hover:text-red-700 font-bold ml-2 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {itemGallery.length === 0 ? (
                    <div className="text-center py-8 bg-white rounded-2xl border-2 border-dashed border-[#ccdbf2]">
                      <span className="text-3xl inline-block mb-1.5">🖼️</span>
                      <p className="text-xs font-bold text-[#0d1c2d]">No gallery photos uploaded yet</p>
                      <p className="text-[10px] text-[#76777d] mt-0.5">
                        Select multiple images from your device to showcase this product.
                      </p>
                      <label className="mt-3 inline-block cursor-pointer bg-[#006c49] hover:bg-[#005236] text-white text-xs font-semibold px-4 py-1.5 rounded-xl shadow-xs">
                        <span>Browse Photos</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          disabled={isUploadingGallery}
                          onChange={(e) => {
                            if (e.target.files) {
                              handleGalleryUploadFiles(e.target.files)
                            }
                            e.target.value = ""
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {itemGallery.map((img, idx) => (
                        <div
                          key={img.url + idx}
                          className={`relative group bg-white rounded-xl border-2 overflow-hidden shadow-2xs transition-all ${
                            img.isCover ? "border-[#006c49] ring-2 ring-emerald-300" : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {/* Image Thumbnail */}
                          <div className="relative aspect-square w-full bg-[#f4f7fc] overflow-hidden flex items-center justify-center">
                            <Image
                              src={img.url}
                              alt={`Gallery photo ${idx + 1}`}
                              fill
                              sizes="(max-width: 640px) 50vw, 25vw"
                              className="object-contain p-1"
                            />
                          </div>

                          {/* Cover Badge / Button */}
                          {img.isCover ? (
                            <div className="absolute top-1.5 left-1.5 bg-[#006c49] text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-xs flex items-center gap-0.5">
                              <span>★</span>
                              <span>Cover</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetCoverImage(idx)}
                              className="absolute top-1.5 left-1.5 bg-black/60 hover:bg-black/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Set as main cover photo"
                            >
                              ☆ Set Cover
                            </button>
                          )}

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteGalleryImage(idx)}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600/90 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center shadow-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete photo"
                          >
                            ✕
                          </button>

                          {/* Bottom Controls: Order & Arrows */}
                          <div className="p-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px]">
                            <span className="font-bold text-slate-500 pl-1">#{idx + 1}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveGalleryImage(idx, idx - 1)}
                                className="w-5 h-5 rounded bg-white hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 font-bold flex items-center justify-center shadow-2xs"
                                title="Move left"
                              >
                                ◀
                              </button>
                              <button
                                type="button"
                                disabled={idx === itemGallery.length - 1}
                                onClick={() => handleMoveGalleryImage(idx, idx + 1)}
                                className="w-5 h-5 rounded bg-white hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 font-bold flex items-center justify-center shadow-2xs"
                                title="Move right"
                              >
                                ▶
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* ── Variant Product Single Image & Option Groups Builder ── */
                <>
                  <div>
                    <label className="block font-semibold text-[#0d1c2d] mb-1">
                      Product / Item Image
                    </label>

                    {/* Upload to Supabase Storage Box with Browse & Camera */}
                    <div className="border-2 border-dashed border-[#ccdbf2] hover:border-[#006c49] bg-[#f8f9ff] rounded-2xl p-4 text-center transition-all mb-3">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <span className="text-2xl">📸</span>
                        <p className="text-xs font-bold text-[#0d1c2d]">
                          {isUploadingItemImg
                            ? "Uploading product photo to Supabase..."
                            : "Upload Product Image or Capture with Camera"}
                        </p>
                        <p className="text-[11px] text-[#76777d]">PNG, JPG, WEBP up to 5MB</p>
                        <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
                          <label className="cursor-pointer bg-[#006c49] hover:bg-[#005236] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all">
                            <span>📁 Browse Files</span>
                            <input
                              type="file"
                              accept="image/*"
                              disabled={isUploadingItemImg}
                              onChange={handleUploadProductImage}
                              className="hidden"
                            />
                          </label>
                          <label className="cursor-pointer bg-white hover:bg-emerald-50 text-[#006c49] border border-[#006c49] text-xs font-semibold px-4 py-2 rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all">
                            <span>📷 Use Camera</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              disabled={isUploadingItemImg}
                              onChange={handleUploadProductImage}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    {uploadError && (
                      <div className="p-2.5 mb-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                        {uploadError}
                      </div>
                    )}

                    {/* Live Preview */}
                    {itemImage && (
                      <div className="flex items-center gap-3 mb-2 p-2.5 bg-slate-50 rounded-xl border border-[#eef4ff]">
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-200 shrink-0 border border-[#ccdbf2]">
                          <Image
                            src={itemImage}
                            alt="Product Preview"
                            fill
                            loading="eager"
                            sizes="56px"
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[#0d1c2d]">Active Product Photo</p>
                          <p className="text-[11px] text-[#00714d] font-semibold flex items-center gap-1 mt-0.5">
                            <span>✓</span> Photo ready
                          </p>
                        </div>
                      </div>
                    )}
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
                            <div className="space-y-2.5">
                              {group.values.map((val, valueIdx) => (
                                <div
                                  key={val.id}
                                  className="p-2.5 bg-[#f8f9ff] rounded-xl border border-[#eef4ff] flex flex-col sm:flex-row sm:items-center gap-2"
                                >
                                  {/* Main Row: Image + Value Name + Mobile Delete */}
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {/* Variant image thumbnail */}
                                    <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-slate-200 shrink-0 border border-[#ccdbf2] group/img cursor-pointer">
                                      {val.image ? (
                                        <Image
                                          src={val.image}
                                          alt={val.label || "Variant"}
                                          fill
                                          sizes="36px"
                                          className="object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xs text-[#76777d]">
                                          📷
                                        </div>
                                      )}
                                      <label className="absolute inset-0 cursor-pointer opacity-0 group-hover/img:opacity-100 bg-black/50 flex items-center justify-center text-white text-[9px] font-bold transition-opacity">
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

                                    {/* Label input - full width on mobile */}
                                    <input
                                      type="text"
                                      value={val.label}
                                      onChange={(e) =>
                                        handleUpdateOptionValue(groupIdx, valueIdx, "label", e.target.value)
                                      }
                                      placeholder="Value (e.g. Red, White, Size S, Large)"
                                      className="flex-1 h-9 px-3 bg-white border border-[#c6c6cd] rounded-lg text-[#0d1c2d] text-xs font-semibold outline-none focus:border-[#006c49] min-w-[100px]"
                                    />

                                    {/* Mobile Delete Button */}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveOptionValue(groupIdx, valueIdx)}
                                      className="sm:hidden text-red-500 hover:text-red-700 text-xs font-bold p-1.5 rounded hover:bg-red-50 transition-all shrink-0"
                                      title="Remove value"
                                    >
                                      ✕
                                    </button>
                                  </div>

                                  {/* Secondary Controls: Price Adj & Stock */}
                                  <div className="flex items-center gap-2 justify-end shrink-0 pl-11 sm:pl-0">
                                    {/* Price adjustment */}
                                    <div
                                      className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-[#c6c6cd]"
                                      title="Price adjustment"
                                    >
                                      <span className="text-[11px] text-[#76777d] font-semibold">+$</span>
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
                                        className="w-14 h-6 text-xs outline-none text-right font-medium text-[#0d1c2d]"
                                      />
                                    </div>

                                    {/* Stock Qty */}
                                    <div
                                      className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${val.stock !== undefined && val.stock <= 0
                                          ? "border-red-300 text-red-600 bg-red-50"
                                          : "border-[#c6c6cd] bg-white text-[#0d1c2d]"
                                        }`}
                                      title="Stock quantity (0 = Sold Out, blank = Unlimited)"
                                    >
                                      <span className="text-[11px] text-[#76777d] font-semibold">Qty:</span>
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
                                        className="w-10 h-6 text-xs font-bold outline-none text-center bg-transparent"
                                      />
                                    </div>

                                    {/* Desktop Delete Button */}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveOptionValue(groupIdx, valueIdx)}
                                      className="hidden sm:inline-flex text-red-400 hover:text-red-600 text-xs font-bold px-1.5 py-1 rounded hover:bg-red-50 transition-all shrink-0"
                                      title="Remove value"
                                    >
                                      ✕
                                    </button>
                                  </div>
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
                      <div className="mt-5 pt-5 border-t border-[#eef4ff]">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                          <div>
                            <p className="text-sm font-bold text-[#0d1c2d] flex items-center gap-1.5">
                              <span>📊 SKU Combination Matrix & Stock</span>
                            </p>
                            <p className="text-xs text-[#76777d]">
                              Configure selling price, cost, inventory, and unique barcodes per variant combination
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleSyncCombinations}
                            className="text-xs font-bold text-[#006c49] bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                            title="Generate or sync all combinations"
                          >
                            <span>⚡ Sync SKUs</span>
                          </button>
                        </div>

                        {/* Bulk Action Controls Bar */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 mb-3 flex flex-wrap items-center gap-2.5">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                            ⚡ Quick Apply All:
                          </span>

                          {/* Bulk Price */}
                          <div className="flex items-center bg-white border border-[#ccdbf2] rounded-xl overflow-hidden shadow-2xs">
                            <span className="text-xs font-bold text-[#006c49] pl-2.5 pr-1">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={basePriceInputValue}
                              onChange={(e) => setBasePriceInputValue(e.target.value)}
                              placeholder={itemPrice || "0.00"}
                              className="w-16 h-8 text-xs outline-none text-right font-medium text-[#0d1c2d]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const val = parseFloat(basePriceInputValue)
                                handleSetAllSellPriceToBase(!isNaN(val) ? val : undefined)
                              }}
                              className="text-xs font-bold text-[#006c49] bg-emerald-50 hover:bg-emerald-100 px-2.5 h-8 border-l border-[#ccdbf2] transition-all"
                              title="Apply selling price to all SKUs"
                            >
                              Set Price
                            </button>
                          </div>

                          {/* Bulk Cost */}
                          <div className="flex items-center bg-white border border-[#ccdbf2] rounded-xl overflow-hidden shadow-2xs">
                            <span className="text-xs font-bold text-slate-500 pl-2.5 pr-1">Cost $</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={bulkCostInputValue}
                              onChange={(e) => setBulkCostInputValue(e.target.value)}
                              placeholder={itemCostPrice || "0.00"}
                              className="w-16 h-8 text-xs outline-none text-right font-medium text-[#0d1c2d]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const cost = parseFloat(bulkCostInputValue)
                                handleSetAllVariantsCost(!isNaN(cost) ? Math.max(0, cost) : (parseFloat(itemCostPrice) || 0))
                              }}
                              className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 h-8 border-l border-[#ccdbf2] transition-all"
                              title="Apply unit cost to all SKUs"
                            >
                              Set Cost
                            </button>
                          </div>

                          {/* Bulk Stock */}
                          <div className="flex items-center bg-white border border-[#ccdbf2] rounded-xl overflow-hidden shadow-2xs">
                            <span className="text-xs font-semibold text-slate-500 pl-2.5 pr-1">Qty</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={bulkStockInputValue}
                              onChange={(e) => setBulkStockInputValue(e.target.value)}
                              placeholder="0"
                              className="w-12 h-8 text-xs outline-none text-center font-bold text-[#0d1c2d]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const qty = parseInt(bulkStockInputValue, 10)
                                handleSetAllVariantsStock(!isNaN(qty) ? Math.max(0, qty) : 10)
                              }}
                              className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 h-8 border-l border-[#ccdbf2] transition-all"
                              title="Apply stock quantity to all SKUs"
                            >
                              Set Stock
                            </button>
                          </div>

                          {/* Stock: 0 */}
                          <button
                            type="button"
                            onClick={() => handleSetAllVariantsStock(0)}
                            className="text-xs font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 px-3 h-8 rounded-xl transition-all shadow-2xs"
                            title="Set stock of all SKUs to 0"
                          >
                            Stock: 0
                          </button>

                          {/* Bulk Barcode */}
                          <button
                            type="button"
                            onClick={handleGenerateAllVariantBarcodes}
                            disabled={isGeneratingAllSkuBarcodes || itemVariants.length === 0}
                            className="text-xs font-bold text-[#006c49] bg-white border border-emerald-300 hover:bg-emerald-50 disabled:opacity-50 px-3 h-8 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 ml-auto"
                            title="Generate unique barcode for all SKU items"
                          >
                            <span>🏷️</span>
                            <span>{isGeneratingAllSkuBarcodes ? "Generating..." : "Gen All Barcodes"}</span>
                          </button>
                        </div>

                        {itemVariants.length === 0 ? (
                          <div className="text-center py-6 bg-white rounded-2xl border border-dashed border-[#ccdbf2]">
                            <button
                              type="button"
                              onClick={handleSyncCombinations}
                              className="text-xs font-bold text-[#006c49] hover:underline"
                            >
                              Click to Generate Combination Matrix ({itemOptions.length} option groups)
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
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
                                  className={`p-3.5 rounded-2xl border transition-all ${isOutOfStock
                                      ? "bg-red-50/20 border-red-200 hover:border-red-300"
                                      : "bg-white border-slate-200/80 hover:border-[#006c49]/40 shadow-xs"
                                    }`}
                                >
                                  {/* Tier 1: Badges & Status Header */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100 p-2 mb-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {Object.entries(variant.options).map(([k, v]) => (
                                        <span
                                          key={k}
                                          className="whitespace-nowrap inline-flex items-center text-xs font-bold bg-[#f0fdf4] text-[#00714d] px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs"
                                        >
                                          {k}: {v}
                                        </span>
                                      ))}
                                    </div>

                                    <div className="flex items-center gap-1.5 ml-auto">
                                      {isOutOfStock ? (
                                        <span className="whitespace-nowrap inline-flex items-center text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                          No Stock
                                        </span>
                                      ) : (
                                        <span className="whitespace-nowrap inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                          In Stock
                                        </span>
                                      )}

                                      {margin !== null && (
                                        <span
                                          className={`whitespace-nowrap inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${margin >= 0
                                              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                              : "text-red-700 bg-red-50 border-red-200"
                                            }`}
                                        >
                                          Margin: ${margin.toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Tier 2: Photo + 4-Column Controls Grid */}
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                    {/* SKU Photo Box with Gallery + Camera options */}
                                    <div className="flex flex-col items-center gap-1 shrink-0">
                                      {/* Preview thumbnail */}
                                      <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-2xs">
                                        {variant.image ? (
                                          <Image
                                            src={variant.image}
                                            alt="SKU Photo"
                                            fill
                                            sizes="56px"
                                            className="object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                            <span className="text-xl leading-none">📷</span>
                                            <span className="text-[9px] font-bold mt-0.5 text-slate-400">Photo</span>
                                          </div>
                                        )}
                                        {isUploadingVariantImg && skuUploadTargetComboId === variant.id && (
                                          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-[#006c49]">...</span>
                                          </div>
                                        )}
                                      </div>
                                      {/* Gallery + Camera Buttons */}
                                      <div className="flex gap-1">
                                        <label
                                          className="cursor-pointer flex items-center gap-0.5 text-[9px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 px-1.5 py-1 rounded-lg transition-all"
                                          title="Upload from gallery / files"
                                        >
                                          <span>🖼️</span>
                                          <span>Gallery</span>
                                          <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => handleUploadSkuVariantImage(variant.id, e)}
                                          />
                                        </label>
                                        <label
                                          className="cursor-pointer flex items-center gap-0.5 text-[9px] font-bold text-[#006c49] bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-1.5 py-1 rounded-lg transition-all"
                                          title="Take a photo with camera"
                                        >
                                          <span>📸</span>
                                          <span>Camera</span>
                                          <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="hidden"
                                            onChange={(e) => handleUploadSkuVariantImage(variant.id, e)}
                                          />
                                        </label>
                                      </div>
                                    </div>

                                    {/* Form Grid: Cost, Sell, Stock, Barcode */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 flex-1">
                                      {/* 1. Cost Price */}
                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">
                                          Cost Price ($)
                                        </label>
                                        <div className="flex items-center h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 focus-within:border-slate-400 focus-within:bg-white transition-all">
                                          <span className="text-xs text-slate-400 font-semibold">$</span>
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
                                            className="w-full h-full bg-transparent text-right text-xs font-medium outline-none text-[#0d1c2d]"
                                          />
                                        </div>
                                      </div>

                                      {/* 2. Sell Price */}
                                      <div>
                                        <label className="block text-[10px] font-bold text-[#006c49] mb-1">
                                          Selling Price ($) *
                                        </label>
                                        <div className="flex items-center h-8 bg-emerald-50/50 border border-emerald-200 rounded-lg px-2 focus-within:border-[#006c49] focus-within:bg-white transition-all">
                                          <span className="text-xs text-[#006c49] font-bold">$</span>
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
                                            placeholder={itemPrice || "0.00"}
                                            className="w-full h-full bg-transparent text-right text-xs font-bold text-[#006c49] outline-none"
                                          />
                                        </div>
                                      </div>

                                      {/* 3. Stock Quantity */}
                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">
                                          Stock (Units)
                                        </label>
                                        <div
                                          className={`flex items-center h-8 border rounded-lg px-2 transition-all ${isOutOfStock
                                              ? "bg-red-50/80 border-red-200 focus-within:border-red-400"
                                              : "bg-slate-50 border-slate-200 focus-within:border-slate-400 focus-within:bg-white"
                                            }`}
                                        >
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
                                            className={`w-full h-full bg-transparent text-center text-xs font-bold outline-none ${isOutOfStock ? "text-red-600" : "text-[#0d1c2d]"
                                              }`}
                                          />
                                        </div>
                                      </div>

                                      {/* 4. SKU Barcode */}
                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1">
                                          SKU Barcode
                                        </label>
                                        {/* Input row */}
                                        <div className="flex items-center h-8 bg-white border border-slate-200 rounded-lg overflow-hidden focus-within:border-[#006c49] transition-all">
                                          <input
                                            type="text"
                                            value={variant.barcode || ""}
                                            onChange={(e) => handleUpdateVariantBarcode(variant.id, e.target.value)}
                                            placeholder="EAN-13 / SKU code"
                                            className="w-full h-full px-2 text-xs font-mono text-[#0d1c2d] outline-none"
                                          />
                                          {/* ⚡ Auto-gen */}
                                          <button
                                            type="button"
                                            onClick={() => handleGenerateVariantBarcode(variant.id)}
                                            className="h-full px-2 text-[10px] font-bold text-[#006c49] bg-emerald-50 hover:bg-emerald-100 border-l border-slate-200 transition-all whitespace-nowrap"
                                            title="Auto-generate unique EAN-13 barcode"
                                          >
                                            ⚡
                                          </button>
                                          {/* 📷 Camera scan */}
                                          <button
                                            type="button"
                                            onClick={() => setSkuBarcodeScannerComboId(variant.id)}
                                            className="h-full px-2 text-[10px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border-l border-slate-200 transition-all whitespace-nowrap"
                                            title="Scan barcode with device camera"
                                          >
                                            📷
                                          </button>
                                        </div>
                                        {/* Show barcode preview when scanned/generated */}
                                        {variant.barcode && (
                                          <p className="text-[9px] font-mono text-slate-400 mt-0.5 truncate" title={variant.barcode}>
                                            {variant.barcode}
                                          </p>
                                        )}
                                      </div>
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
                </>
              )}

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
                  disabled={isSaving || barcodeStatus?.isChecking || barcodeStatus?.isUnique === false}
                  className="bg-[#006c49] hover:bg-[#005236] disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl font-bold transition-all shadow-xs"
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
              ? "Crop Option Image (1:1 Square)"
              : cropperTarget === "sku"
                ? "Crop SKU Combination Photo (1:1 Square)"
                : "Crop Product Photo (1:1 Square)"
        }
        onClose={() => {
          setIsCropperOpen(false)
          setCropperSrc(null)
        }}
        onCropComplete={handleCropComplete}
      />

      {/* Barcode / SKU Camera Scanner Modal for Item Form */}
      <BarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        onScan={(scannedCode) => {
          setItemBarcode(scannedCode)
        }}
      />

      {/* Quick Inventory Restock Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isInventoryScannerOpen}
        onClose={() => setIsInventoryScannerOpen(false)}
        onScan={(scannedCode) => {
          setIsInventoryScannerOpen(false)
          handleBarcodeRestockScan(scannedCode)
        }}
      />

      {/* Per-SKU Variant Barcode Scanner Modal */}
      {skuBarcodeScannerComboId !== null && (
        <BarcodeScannerModal
          isOpen={true}
          onClose={() => setSkuBarcodeScannerComboId(null)}
          onScan={(scannedCode) => {
            if (skuBarcodeScannerComboId) {
              handleUpdateVariantBarcode(skuBarcodeScannerComboId, scannedCode)
            }
            setSkuBarcodeScannerComboId(null)
          }}
        />
      )}
    </div>
  )
}



