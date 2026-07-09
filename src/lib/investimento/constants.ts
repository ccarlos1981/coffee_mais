export const PRODUCT_FAMILIES = [
  "Grão",
  "Moído",
  "Drip",
  "Capsula",
  "1KG",
  "Café Verde"
] as const;

export type ProductFamily = typeof PRODUCT_FAMILIES[number];
