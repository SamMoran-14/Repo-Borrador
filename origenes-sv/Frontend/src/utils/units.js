// Unidades de medida y conversiones. Se usa en pantallas que capturan cantidades de insumos.
// El inventario siempre guarda cada insumo en su unidad base (g, ml o unidad).
 
export const UNITS = ["g", "kg", "ml", "l", "unidad"];
 
// Familia de cada unidad: solo se puede convertir dentro de la misma familia
const UNIT_FAMILY = { g: "masa", kg: "masa", ml: "volumen", l: "volumen", unidad: "conteo" };
 
// Cuántas "unidades pequeñas" (g, ml, unidad) equivale cada una
const UNIT_FACTOR = { g: 1, kg: 1000, ml: 1, l: 1000, unidad: 1 };
 
// Unidades que se pueden elegir para un insumo según su unidad base
// (un insumo en gramos admite g o kg, pero no ml)
export function compatibleUnits(baseUnit) {
  if (!baseUnit) return UNITS;
  const family = UNIT_FAMILY[baseUnit];
  return family ? UNITS.filter((unit) => UNIT_FAMILY[unit] === family) : [baseUnit];
}
 
// Convierte una cantidad escrita en fromUnit a la unidad base del insumo.
// Ejemplo: toBaseUnit(2, "kg", "g") devuelve 2000.
export function toBaseUnit(quantity, fromUnit, baseUnit) {
  if (!UNIT_FACTOR[fromUnit] || !UNIT_FACTOR[baseUnit]) return quantity;
  return Math.round(((quantity * UNIT_FACTOR[fromUnit]) / UNIT_FACTOR[baseUnit]) * 1000) / 1000;
}
 