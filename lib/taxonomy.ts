// Dish taxonomy: the vocabulary search reasons with.
//
// The database stores only the category LEAF ('baked'). Parents and synonyms live
// here, so broadening "cake" to also mean cheesecake never needs a migration.

export const DIETS = ['veg', 'non_veg', 'jain', 'egg'] as const
export type Diet = (typeof DIETS)[number]

export const TASTES = ['sweet', 'spicy', 'tangy', 'savoury', 'rich', 'light', 'creamy', 'crispy'] as const
export type Taste = (typeof TASTES)[number]

export const MEALS = ['breakfast', 'brunch', 'lunch', 'dinner', 'anytime'] as const
export type Meal = (typeof MEALS)[number]

export const CUISINES = [
  'south_indian', 'north_indian', 'punjabi', 'mughlai', 'gujarati',
  'chinese', 'italian', 'continental', 'street_food',
] as const
export type Cuisine = (typeof CUISINES)[number]

/** Category leaves grouped under their parent. Leaves are what the database stores. */
export const CATEGORY_TREE = {
  dessert: ['baked', 'frozen', 'dessert_drink'],
  beverage: ['coffee', 'tea', 'shake', 'juice'],
  main: ['thali', 'curry', 'rice', 'bread', 'noodles'],
  snack: ['roll', 'chaat', 'fried', 'sandwich'],
} as const satisfies Record<string, readonly string[]>

export type CategoryParent = keyof typeof CATEGORY_TREE
export type CategoryLeaf = (typeof CATEGORY_TREE)[CategoryParent][number]

export const CATEGORY_LEAVES = Object.values(CATEGORY_TREE).flat() as CategoryLeaf[]

export function categoryParent(leaf: string): CategoryParent | null {
  for (const [parent, leaves] of Object.entries(CATEGORY_TREE)) {
    if ((leaves as readonly string[]).includes(leaf)) return parent as CategoryParent
  }
  return null
}

/**
 * Search synonyms. A query term maps to the set of category leaves it should match.
 *
 * This is what makes "best cake" return brownies: "cake" resolves to `baked`, which
 * covers brownie, cheesecake and cookie sandwich — while deliberately NOT covering
 * ice cream (`frozen`) or a frappe (`dessert_drink`).
 */
const CATEGORY_SYNONYMS: Record<string, CategoryLeaf[]> = {
  // dessert · baked
  cake: ['baked'],
  cakes: ['baked'],
  brownie: ['baked'],
  brownies: ['baked'],
  cheesecake: ['baked'],
  cookie: ['baked'],
  cookies: ['baked'],
  pastry: ['baked'],
  bakery: ['baked'],
  baked: ['baked'],
  // dessert · frozen
  'ice cream': ['frozen'],
  icecream: ['frozen'],
  sundae: ['frozen'],
  gelato: ['frozen'],
  frozen: ['frozen'],
  kulfi: ['frozen'],
  // dessert · drink
  frappe: ['dessert_drink'],
  milkshake: ['dessert_drink', 'shake'],
  // whole-parent terms
  dessert: ['baked', 'frozen', 'dessert_drink'],
  desserts: ['baked', 'frozen', 'dessert_drink'],
  sweets: ['baked', 'frozen', 'dessert_drink'],
  pudding: ['baked', 'frozen'],
  // beverage
  coffee: ['coffee'],
  cafe: ['coffee'],
  tea: ['tea'],
  chai: ['tea'],
  shake: ['shake'],
  juice: ['juice'],
  drink: ['coffee', 'tea', 'shake', 'juice', 'dessert_drink'],
  drinks: ['coffee', 'tea', 'shake', 'juice', 'dessert_drink'],
  // main
  thali: ['thali'],
  curry: ['curry'],
  sabji: ['curry'],
  sabzi: ['curry'],
  gravy: ['curry'],
  rice: ['rice'],
  biryani: ['rice'],
  bread: ['bread'],
  roti: ['bread'],
  naan: ['bread'],
  noodles: ['noodles'],
  // snack
  roll: ['roll'],
  wrap: ['roll'],
  shawarma: ['roll'],
  chaat: ['chaat'],
  fried: ['fried'],
  sandwich: ['sandwich'],
  snack: ['roll', 'chaat', 'fried', 'sandwich'],
  snacks: ['roll', 'chaat', 'fried', 'sandwich'],
}

/** Other dimensions people type directly into a search box. */
const DIET_SYNONYMS: Record<string, Diet> = {
  veg: 'veg', vegetarian: 'veg', pure_veg: 'veg', 'pure veg': 'veg',
  'non veg': 'non_veg', nonveg: 'non_veg', 'non-veg': 'non_veg', 'non_veg': 'non_veg',
  chicken: 'non_veg', mutton: 'non_veg', meat: 'non_veg',
  jain: 'jain',
  egg: 'egg', eggless: 'veg',
}

const TASTE_SYNONYMS: Record<string, Taste> = {
  sweet: 'sweet', sugary: 'sweet',
  spicy: 'spicy', hot: 'spicy', teekha: 'spicy', masala: 'spicy',
  tangy: 'tangy', sour: 'tangy', chatpata: 'tangy',
  savoury: 'savoury', savory: 'savoury', salty: 'savoury',
  rich: 'rich', indulgent: 'rich', heavy: 'rich',
  light: 'light', healthy: 'light',
  creamy: 'creamy',
  crispy: 'crispy', crunchy: 'crispy',
}

const MEAL_SYNONYMS: Record<string, Meal> = {
  breakfast: 'breakfast', morning: 'breakfast',
  brunch: 'brunch',
  lunch: 'lunch',
  dinner: 'dinner', supper: 'dinner',
  anytime: 'anytime',
}

const CUISINE_SYNONYMS: Record<string, Cuisine> = {
  'south indian': 'south_indian', south_indian: 'south_indian', southindian: 'south_indian',
  'north indian': 'north_indian', north_indian: 'north_indian',
  punjabi: 'punjabi',
  mughlai: 'mughlai', mughal: 'mughlai', moghlai: 'mughlai',
  gujarati: 'gujarati',
  chinese: 'chinese',
  italian: 'italian',
  continental: 'continental',
  'street food': 'street_food', street_food: 'street_food', streetfood: 'street_food',
}

/** Words that describe intent rather than food, and should not be matched as terms. */
const STOP_WORDS = new Set(['best', 'top', 'good', 'nice', 'the', 'a', 'an', 'in', 'near', 'me', 'for', 'of', 'food', 'dish', 'place'])

export type ParsedQuery = {
  /** Terms left over after taxonomy words were consumed — matched against dish names. */
  text: string
  categories: CategoryLeaf[]
  diets: Diet[]
  tastes: Taste[]
  meals: Meal[]
  cuisines: Cuisine[]
}

function normalize(input: string): string {
  return input.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Pulls taxonomy meaning out of a free-text query.
 *
 *   "best cake"        -> categories: [baked],           text: ""
 *   "spicy veg curry"  -> tastes: [spicy], diets: [veg], categories: [curry], text: ""
 *   "nutella brownie"  -> categories: [baked],           text: "nutella"
 */
export function parseQuery(raw: string): ParsedQuery {
  const q = normalize(raw)
  if (!q) return { text: '', categories: [], diets: [], tastes: [], meals: [], cuisines: [] }

  const categories = new Set<CategoryLeaf>()
  const diets = new Set<Diet>()
  const tastes = new Set<Taste>()
  const meals = new Set<Meal>()
  const cuisines = new Set<Cuisine>()

  // Multi-word phrases first, so "ice cream" is not split into "ice" + "cream".
  let remaining = ` ${q} `
  const phrases = [
    ...Object.keys(CATEGORY_SYNONYMS),
    ...Object.keys(DIET_SYNONYMS),
    ...Object.keys(CUISINE_SYNONYMS),
    ...Object.keys(TASTE_SYNONYMS),
    ...Object.keys(MEAL_SYNONYMS),
  ]
    .filter((p) => p.includes(' '))
    .sort((a, b) => b.length - a.length)

  for (const phrase of phrases) {
    if (!remaining.includes(` ${phrase} `)) continue
    CATEGORY_SYNONYMS[phrase]?.forEach((c) => categories.add(c))
    if (DIET_SYNONYMS[phrase]) diets.add(DIET_SYNONYMS[phrase])
    if (CUISINE_SYNONYMS[phrase]) cuisines.add(CUISINE_SYNONYMS[phrase])
    if (TASTE_SYNONYMS[phrase]) tastes.add(TASTE_SYNONYMS[phrase])
    if (MEAL_SYNONYMS[phrase]) meals.add(MEAL_SYNONYMS[phrase])
    remaining = remaining.replace(` ${phrase} `, ' ')
  }

  const leftover: string[] = []
  for (const word of remaining.trim().split(' ').filter(Boolean)) {
    const hitCategory = CATEGORY_SYNONYMS[word]
    if (hitCategory) { hitCategory.forEach((c) => categories.add(c)); continue }
    if (DIET_SYNONYMS[word]) { diets.add(DIET_SYNONYMS[word]); continue }
    if (TASTE_SYNONYMS[word]) { tastes.add(TASTE_SYNONYMS[word]); continue }
    if (MEAL_SYNONYMS[word]) { meals.add(MEAL_SYNONYMS[word]); continue }
    if (CUISINE_SYNONYMS[word]) { cuisines.add(CUISINE_SYNONYMS[word]); continue }
    if (STOP_WORDS.has(word)) continue
    leftover.push(word)
  }

  return {
    text: leftover.join(' '),
    categories: Array.from(categories),
    diets: Array.from(diets),
    tastes: Array.from(tastes),
    meals: Array.from(meals),
    cuisines: Array.from(cuisines),
  }
}

/** True when the query carried no taxonomy meaning at all. */
export function isPlainTextQuery(parsed: ParsedQuery): boolean {
  return (
    parsed.categories.length === 0 &&
    parsed.diets.length === 0 &&
    parsed.tastes.length === 0 &&
    parsed.meals.length === 0 &&
    parsed.cuisines.length === 0
  )
}

export function labelFor(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** A dish needs at least these two to be filterable; anything less is "untagged". */
export function isUntagged(dish: { diet: string | null; category: string | null }): boolean {
  return !dish.diet || !dish.category
}
