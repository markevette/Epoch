import type { Locale } from "./locale"

export type FoodGroup = "drink" | "bread" | "meat" | "rice" | "pulse" | "egg" | "dairy" | "plant" | "extra"

export type MealLine = {
  food: string
  count: number
  milky?: boolean
  honey?: boolean
  sugar?: boolean
}

type Food = {
  id: string
  group: FoodGroup
  en: string
  de: string
  portion: Portion
  /** Rough energy for one ordinary portion. */
  kcal: number
  /** A larger milk portion for the same drink. */
  milky?: number
  sweet?: boolean
}

type Portion = "cup" | "slice" | "piece" | "bowl" | "spoon" | "glass" | "egg"

const PORTION: Record<Portion, { en: [string, string]; de: [string, string] }> = {
  cup: { en: ["cup", "cups"], de: ["Tasse", "Tassen"] },
  slice: { en: ["slice", "slices"], de: ["Scheibe", "Scheiben"] },
  piece: { en: ["piece", "pieces"], de: ["Stück", "Stück"] },
  bowl: { en: ["bowl", "bowls"], de: ["Schale", "Schalen"] },
  spoon: { en: ["spoon", "spoons"], de: ["Löffel", "Löffel"] },
  glass: { en: ["glass", "glasses"], de: ["Glas", "Gläser"] },
  egg: { en: ["egg", "eggs"], de: ["Ei", "Eier"] },
}

/** Staples a person can name. Honey is about 20 kcal a teaspoon, sugar about 15. */
const FOODS: Food[] = [
  { id: "coffee-black", group: "drink", en: "Black coffee", de: "Schwarzer Kaffee", portion: "cup", kcal: 5, sweet: true },
  { id: "coffee-milk", group: "drink", en: "Milk coffee", de: "Milchkaffee", portion: "cup", kcal: 25, milky: 105, sweet: true },
  { id: "tea-milk", group: "drink", en: "Tea with milk", de: "Tee mit Milch", portion: "cup", kcal: 25, milky: 105, sweet: true },
  { id: "bread-wheat", group: "bread", en: "Wheat bread", de: "Weizenbrot", portion: "slice", kcal: 80 },
  { id: "bread-whole", group: "bread", en: "Whole-grain bread", de: "Vollkornbrot", portion: "slice", kcal: 75 },
  { id: "flatbread", group: "bread", en: "Flatbread", de: "Fladenbrot", portion: "piece", kcal: 120 },
  { id: "chicken-grilled", group: "meat", en: "Grilled chicken", de: "Gegrilltes Hähnchen", portion: "piece", kcal: 200 },
  { id: "chicken-fried", group: "meat", en: "Fried chicken", de: "Gebratenes Hähnchen", portion: "piece", kcal: 280 },
  { id: "fish", group: "meat", en: "Fish", de: "Fisch", portion: "piece", kcal: 150 },
  { id: "beef", group: "meat", en: "Beef", de: "Rind", portion: "piece", kcal: 250 },
  { id: "rice-white", group: "rice", en: "White rice", de: "Weißer Reis", portion: "cup", kcal: 200 },
  { id: "rice-wild", group: "rice", en: "Wild rice", de: "Wildreis", portion: "cup", kcal: 165 },
  { id: "beans", group: "pulse", en: "Kidney beans", de: "Kidneybohnen", portion: "bowl", kcal: 220 },
  { id: "chickpeas", group: "pulse", en: "Chickpeas", de: "Kichererbsen", portion: "bowl", kcal: 270 },
  { id: "lentils", group: "pulse", en: "Lentils", de: "Linsen", portion: "bowl", kcal: 230 },
  { id: "egg", group: "egg", en: "Egg", de: "Ei", portion: "egg", kcal: 75 },
  { id: "milk", group: "dairy", en: "Milk", de: "Milch", portion: "glass", kcal: 150 },
  { id: "yogurt", group: "dairy", en: "Yogurt", de: "Joghurt", portion: "bowl", kcal: 100 },
  { id: "vegetables", group: "plant", en: "Vegetables", de: "Gemüse", portion: "bowl", kcal: 40 },
  { id: "fruit", group: "plant", en: "Fruit", de: "Obst", portion: "piece", kcal: 80 },
  { id: "curry", group: "extra", en: "Curry", de: "Curry", portion: "bowl", kcal: 250 },
  { id: "oil", group: "extra", en: "Oil", de: "Öl", portion: "spoon", kcal: 120 },
]

const BY_ID = new Map(FOODS.map((food) => [food.id, food]))

export const FOOD_GROUPS: { id: FoodGroup; en: string; de: string }[] = [
  { id: "drink", en: "Drinks", de: "Getränke" },
  { id: "bread", en: "Bread", de: "Brot" },
  { id: "meat", en: "Meat and fish", de: "Fleisch und Fisch" },
  { id: "rice", en: "Rice", de: "Reis" },
  { id: "pulse", en: "Pulses", de: "Hülsenfrüchte" },
  { id: "egg", en: "Eggs", de: "Eier" },
  { id: "dairy", en: "Dairy", de: "Milchiges" },
  { id: "plant", en: "Vegetables and fruit", de: "Gemüse und Obst" },
  { id: "extra", en: "A bowl or a spoon", de: "Eine Schale oder ein Löffel" },
]

export const MEAL_LINE_MAX = 8
export const MEAL_COUNT_MAX = 12
const HONEY = 20
const SUGAR = 15

export function foodsIn(group: FoodGroup): Food[] {
  return FOODS.filter((food) => food.group === group)
}

export function foodById(id: string): Food | undefined {
  return BY_ID.get(id)
}

export function foodName(id: string, locale: Locale): string {
  const food = BY_ID.get(id)
  if (!food) return id
  return locale === "de" ? food.de : food.en
}

export function portionName(id: string, count: number, locale: Locale): string {
  const food = BY_ID.get(id)
  if (!food) return ""
  const words = PORTION[food.portion][locale]
  return `${count} ${words[count === 1 ? 0 : 1]}`
}

export function lineEnergy(line: MealLine): number {
  const food = BY_ID.get(line.food)
  if (!food) return 0
  const count = Math.min(MEAL_COUNT_MAX, Math.max(1, Math.round(line.count)))
  let each = line.milky && food.milky != null ? food.milky : food.kcal
  if (line.honey && food.sweet) each += HONEY
  if (line.sugar && food.sweet) each += SUGAR
  return each * count
}

export function mealEstimate(lines: MealLine[]): number {
  return lines.reduce((sum, line) => sum + lineEnergy(line), 0)
}

export function foodAllows(id: string, flag: "milky" | "sweet"): boolean {
  const food = BY_ID.get(id)
  if (!food) return false
  return flag === "milky" ? food.milky != null : Boolean(food.sweet)
}

export function cleanMealLines(value: unknown): MealLine[] {
  if (!Array.isArray(value)) return []
  const lines: MealLine[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const food = typeof row.food === "string" ? BY_ID.get(row.food) : undefined
    if (!food) continue
    if (typeof row.count !== "number" || !Number.isInteger(row.count) || row.count < 1 || row.count > MEAL_COUNT_MAX) continue
    const line: MealLine = { food: food.id, count: row.count }
    if (food.milky != null && row.milky === true) line.milky = true
    if (food.sweet && row.honey === true) line.honey = true
    if (food.sweet && row.sugar === true) line.sugar = true
    lines.push(line)
    if (lines.length >= MEAL_LINE_MAX) break
  }
  return lines
}
