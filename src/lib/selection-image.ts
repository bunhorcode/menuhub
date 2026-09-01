import { OptionGroup, OptionValue, VariantCombination } from "./seller-types"

export interface ImageSelection {
  groupId?: string
  groupName: string
  valueId?: string
  value: string
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function isCompleteSelection(selections: ImageSelection[], optionGroups: OptionGroup[]): boolean {
  const groupsWithRequiredFlag = optionGroups.filter((group) => group.required)
  const requiredGroups = groupsWithRequiredFlag.length > 0 ? groupsWithRequiredFlag : optionGroups
  return requiredGroups.every((group) =>
    selections.some((selection) => normalize(selection.groupName) === normalize(group.name))
  )
}

function matchesSku(selections: ImageSelection[], sku: VariantCombination): boolean {
  const selectedByGroup = new Map(
    selections.map((selection) => [normalize(selection.groupName), normalize(selection.value)])
  )
  const skuEntries = Object.entries(sku.options)

  return (
    skuEntries.length === selectedByGroup.size &&
    skuEntries.every(([groupName, value]) => selectedByGroup.get(normalize(groupName)) === normalize(value))
  )
}

/** Returns the best new image, or undefined when the current image should remain. */
export function resolveDisplayImage(
  selections: ImageSelection[],
  optionGroups: OptionGroup[],
  skus: VariantCombination[] = []
): string | undefined {
  if (selections.length === 0) return undefined

  if (isCompleteSelection(selections, optionGroups)) {
    const skuImage = skus.find((sku) => matchesSku(selections, sku))?.image
    if (skuImage) return skuImage
  }

  const lastSelection = selections[selections.length - 1]
  const selectedGroup = optionGroups.find(
    (group) =>
      (lastSelection.groupId && group.id === lastSelection.groupId) ||
      normalize(group.name) === normalize(lastSelection.groupName)
  )
  const selectedValue = selectedGroup?.values.find(
    (value: OptionValue) =>
      (lastSelection.valueId && value.id === lastSelection.valueId) ||
      normalize(value.label) === normalize(lastSelection.value)
  )

  return selectedValue?.image || undefined
}