import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
} from "reactstrap";
import { api } from "../../api/api.js";
import { useWorkspace } from "../../context/WorkspaceContext.js";
import "./ProductRecipe.css";
 
// Imagenes de Figma: carpeta public/img/ (se sirven desde la ruta /img/)
const IMG = "/img";
 
const UNITS = ["g", "kg", "ml", "l", "unidad"];
 
// Valor especial del selector de producto para crear uno nuevo
const NEW_PRODUCT = "NEW";
 
// Familia y factor de cada unidad respecto a su unidad "pequeña" (g, ml, unidad)
const UNIT_FAMILY = { g: "masa", kg: "masa", ml: "volumen", l: "volumen", unidad: "conteo" };
const UNIT_FACTOR = { g: 1, kg: 1000, ml: 1, l: 1000, unidad: 1 };
 
// Unidades que se pueden elegir para un insumo: solo las de su misma familia
// (un insumo en gramos admite g o kg, pero no ml)
function compatibleUnits(baseUnit) {
  if (!baseUnit) return UNITS;
  const family = UNIT_FAMILY[baseUnit];
  return family ? UNITS.filter((unit) => UNIT_FAMILY[unit] === family) : [baseUnit];
}
 
// Convierte la cantidad escrita a la unidad base del insumo, que es la que usa el
// inventario. Ejemplo: 0.5 kg de un insumo en gramos se guarda como 500.
function toBaseUnit(quantity, fromUnit, baseUnit) {
  if (!UNIT_FACTOR[fromUnit] || !UNIT_FACTOR[baseUnit]) return quantity;
  return Math.round(((quantity * UNIT_FACTOR[fromUnit]) / UNIT_FACTOR[baseUnit]) * 1000) / 1000;
}
 
function newRecipeRow() {
  return {
    key: `${Date.now()}-${Math.random()}`,
    ingredientId: "",
    quantity: "",
    unit: "g",
  };
}
 
// Mínimo 3 filas visibles como en la maqueta
const emptyRows = () => [newRecipeRow(), newRecipeRow(), newRecipeRow()];
 
export default function ProductRecipe({ productId: propProductId = null }) {
  const { branchId, user } = useWorkspace();
  const canEdit = ["ADMIN", "MANAGER"].includes(user?.role);
 
  // Catalogos cargados desde el backend
  const [products, setProducts] = useState([]);
  const [ingredientsCatalog, setIngredientsCatalog] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(propProductId || "");
 
  // Datos del producto nuevo (solo se usan cuando está elegida la opción "Nuevo producto")
  const [newProduct, setNewProduct] = useState({ name: "", category: "", price: "" });
 
  const [rows, setRows] = useState(emptyRows);
 
  // Advertencia antes de reemplazar la receta de un producto existente
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingItems, setPendingItems] = useState(null);
 
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
 
  const isNewProduct = selectedProductId === NEW_PRODUCT;
  const selectedProduct = products.find((product) => String(product.id) === selectedProductId);
 
  // 1) Carga los insumos disponibles en inventario y los productos elaborados.
  //    selectId: producto que debe quedar seleccionado (por ejemplo, el recién creado).
  const loadData = useCallback(async ({ selectId = null, silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [inventoryData, productsData] = await Promise.all([
        api(`/inventory?branchId=${branchId}`),
        api(`/products?branchId=${branchId}`),
      ]);
 
      // Solo los insumos (INGREDIENT) pueden formar parte de una receta
      setIngredientsCatalog(inventoryData.filter((item) => item.type === "INGREDIENT"));
 
      // Solo los productos elaborados (RECIPE) tienen receta; los empacados (RESALE) no
      const recipeProducts = productsData.filter((product) => product.productType === "RECIPE");
      setProducts(recipeProducts);
 
      if (selectId) {
        setSelectedProductId(String(selectId));
      } else if (!propProductId) {
        // Conserva la selección actual si todavía existe; si no, elige el primero
        setSelectedProductId((current) => {
          if (current === NEW_PRODUCT) return current;
          if (recipeProducts.some((product) => String(product.id) === current)) return current;
          if (recipeProducts[0]) return String(recipeProducts[0].id);
          return canEdit ? NEW_PRODUCT : "";
        });
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [branchId, propProductId, canEdit]);
 
  useEffect(() => {
    loadData();
  }, [loadData]);
 
  // 2) Carga la receta existente cuando cambia el producto seleccionado
  useEffect(() => {
    if (!selectedProductId) return;
 
    // Producto nuevo: empieza con filas vacías, no hay nada que pedir al servidor
    if (selectedProductId === NEW_PRODUCT) {
      setRows(emptyRows());
      return;
    }
 
    let cancelled = false;
    async function loadRecipe() {
      try {
        const recipeItems = await api(`/products/${selectedProductId}/recipe`);
        if (cancelled) return;
 
        if (Array.isArray(recipeItems) && recipeItems.length > 0) {
          setRows(
            recipeItems.map((item) => ({
              key: `${item.ingredientId}-${Math.random()}`,
              ingredientId: String(item.ingredientId),
              // Number() quita ceros sobrantes: "18.000" se muestra como 18
              quantity: String(Number(item.quantity)),
              unit: item.unit || "g",
            }))
          );
        } else {
          // Si el producto aún no tiene receta, muestra 3 filas vacías como en el diseño
          setRows(emptyRows());
        }
      } catch (requestError) {
        if (!cancelled) setError(requestError.message);
      }
    }
 
    loadRecipe();
    return () => {
      cancelled = true;
    };
  }, [selectedProductId]);
 
  // Mapa rápido para conocer la unidad base de cada insumo seleccionado
  const ingredientsById = useMemo(() => {
    const map = new Map();
    ingredientsCatalog.forEach((ing) => map.set(String(ing.id), ing));
    return map;
  }, [ingredientsCatalog]);
 
  // Categorías ya usadas, para sugerirlas al crear un producto nuevo
  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category))].sort(),
    [products]
  );
 
  function handleProductSelect(event) {
    setError("");
    setFormError("");
    setSuccessMsg("");
    setSelectedProductId(event.target.value);
  }
 
  function handleNewProductChange(field, value) {
    setNewProduct((current) => ({ ...current, [field]: value }));
  }
 
  function addRow() {
    setFormError("");
    setSuccessMsg("");
    setRows((current) => [...current, newRecipeRow()]);
  }
 
  function removeRow(key) {
    setFormError("");
    setSuccessMsg("");
    setRows((current) => {
      const updated = current.filter((row) => row.key !== key);
      return updated.length > 0 ? updated : [newRecipeRow()];
    });
  }
 
  function handleIngredientChange(key, ingredientId) {
    const found = ingredientsById.get(String(ingredientId));
    setRows((current) =>
      current.map((row) =>
        row.key === key
          ? {
              ...row,
              ingredientId,
              unit: found?.unit || row.unit,
            }
          : row
      )
    );
  }
 
  function handleFieldChange(key, field, value) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row))
    );
  }
 
  // Valida las filas y devuelve los ingredientes listos para enviar (o null si hay error)
  function buildItems() {
    // Filtramos filas completamente vacías
    const nonEmptyRows = rows.filter(
      (row) => row.ingredientId !== "" || String(row.quantity).trim() !== ""
    );
 
    if (nonEmptyRows.length === 0) {
      setFormError("Agrega al menos un ingrediente con su cantidad.");
      return null;
    }
 
    const usedIds = new Set();
    const items = [];
 
    for (const row of nonEmptyRows) {
      if (!row.ingredientId) {
        setFormError("Selecciona el ingrediente en todas las filas utilizadas.");
        return null;
      }
      if (usedIds.has(row.ingredientId)) {
        setFormError("No puedes repetir el mismo ingrediente en la receta.");
        return null;
      }
      const qty = Number(row.quantity);
      if (row.quantity === "" || !Number.isFinite(qty) || qty <= 0) {
        setFormError("Todas las cantidades deben ser mayores que 0.");
        return null;
      }
 
      // El inventario descuenta en la unidad base del insumo: se convierte antes de enviar
      const baseUnit = ingredientsById.get(row.ingredientId)?.unit;
      const baseQuantity = toBaseUnit(qty, row.unit, baseUnit);
      if (baseQuantity <= 0) {
        setFormError("Una cantidad es demasiado pequeña para la unidad del insumo.");
        return null;
      }
 
      usedIds.add(row.ingredientId);
      items.push({ ingredientId: Number(row.ingredientId), quantity: baseQuantity });
    }
    return items;
  }
 
  // Clic en "Guardar receta": valida y decide si crea el producto o pide confirmación
  function handleSaveClick() {
    setFormError("");
    setSuccessMsg("");
 
    if (!selectedProductId) {
      return setFormError("Selecciona un producto para asignarle su receta.");
    }
 
    if (isNewProduct) {
      if (newProduct.name.trim().length < 2) {
        return setFormError("Escribe el nombre del producto nuevo (mínimo 2 letras).");
      }
      if (newProduct.category.trim().length < 2) {
        return setFormError("Escribe o elige la categoría del producto nuevo.");
      }
      if (!(Number(newProduct.price) > 0)) {
        return setFormError("El precio de venta debe ser mayor que 0.");
      }
    }
 
    const items = buildItems();
    if (!items) return;
 
    if (isNewProduct) {
      submitRecipe(items);
    } else {
      // Producto existente: se reemplaza su receta, así que primero se pide confirmación
      setPendingItems(items);
      setConfirmOpen(true);
    }
  }
 
  function cancelReplace() {
    setConfirmOpen(false);
    setPendingItems(null);
  }
 
  function confirmReplace() {
    setConfirmOpen(false);
    if (pendingItems) submitRecipe(pendingItems);
    setPendingItems(null);
  }
 
  // Envía al backend: POST /products (producto nuevo) o PUT /products/:id/recipe (reemplazo)
  async function submitRecipe(items) {
    setSaving(true);
    try {
      if (isNewProduct) {
        const productName = newProduct.name.trim();
        const created = await api("/products", {
          method: "POST",
          body: {
            name: productName,
            category: newProduct.category.trim(),
            price: Number(newProduct.price),
            items,
          },
        });
        setNewProduct({ name: "", category: "", price: "" });
        // Recarga la lista y deja seleccionado el producto recién creado
        await loadData({ selectId: created.id, silent: true });
        setSuccessMsg(`Producto "${productName}" creado con su receta.`);
      } else {
        await api(`/products/${selectedProductId}/recipe`, {
          method: "PUT",
          body: { items },
        });
        setSuccessMsg("Receta guardada correctamente.");
      }
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setSaving(false);
    }
  }
 
  return (
    <div className="rec-page">
      <div className="rec-header">
        <h1 className="rec-title">Receta de producto</h1>
 
        {/* Selector de producto (si no viene fijo por prop) */}
        {!propProductId && (products.length > 0 || canEdit) && (
          <div className="rec-product-selector">
            <label htmlFor="rec-product-select">Producto:</label>
            <Input
              id="rec-product-select"
              type="select"
              value={selectedProductId}
              onChange={handleProductSelect}
            >
              {canEdit && <option value={NEW_PRODUCT}>+ Nuevo producto</option>}
              {products.map((prod) => (
                <option key={prod.id} value={prod.id}>
                  {prod.name}
                </option>
              ))}
            </Input>
          </div>
        )}
      </div>
 
      {error && <Alert color="danger">{error}</Alert>}
      {formError && <Alert color="warning">{formError}</Alert>}
      {successMsg && <Alert color="success">{successMsg}</Alert>}
 
      {loading ? (
        <Spinner color="info" />
      ) : (
        <>
          {/* Datos del producto nuevo */}
          {isNewProduct && (
            <div className="rec-new-product">
              <div className="rec-new-field">
                <label htmlFor="rec-new-name">Nombre del producto</label>
                <Input
                  id="rec-new-name"
                  maxLength={140}
                  placeholder="Ej. Latte de caramelo"
                  value={newProduct.name}
                  onChange={(event) => handleNewProductChange("name", event.target.value)}
                />
              </div>
              <div className="rec-new-field">
                <label htmlFor="rec-new-category">Categoría</label>
                <Input
                  id="rec-new-category"
                  list="rec-categories"
                  maxLength={60}
                  placeholder="Ej. Café"
                  value={newProduct.category}
                  onChange={(event) => handleNewProductChange("category", event.target.value)}
                />
                <datalist id="rec-categories">
                  {categories.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </div>
              <div className="rec-new-field">
                <label htmlFor="rec-new-price">Precio de venta (USD)</label>
                <Input
                  id="rec-new-price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={newProduct.price}
                  onChange={(event) => handleNewProductChange("price", event.target.value)}
                />
              </div>
            </div>
          )}
 
          <div className="rec-panels">
            {/* PANEL IZQUIERDO: INGREDIENTES */}
            <section className="rec-panel" aria-label="Ingredientes">
              <div className="rec-panel-banner">
                <img src={`${IMG}/Ingredientes.png`} alt="Ingredientes" />
              </div>
 
              <div className="rec-list">
                {rows.map((row) => (
                  <div className="rec-pill rec-pill-ingredient" key={row.key}>
                    {canEdit && (
                      <button
                        type="button"
                        className="rec-remove-btn"
                        aria-label="Quitar ingrediente"
                        onClick={() => removeRow(row.key)}
                      >
                        <img src={`${IMG}/EliminarReceta.png`} alt="" />
                      </button>
                    )}
 
                    <Input
                      type="select"
                      aria-label="Seleccionar ingrediente"
                      className="rec-select"
                      disabled={!canEdit}
                      value={row.ingredientId}
                      onChange={(event) =>
                        handleIngredientChange(row.key, event.target.value)
                      }
                    >
                      <option value="">Seleccionar ingrediente</option>
                      {ingredientsCatalog.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} ({ing.unit})
                        </option>
                      ))}
                    </Input>
 
                    <span className="rec-caret rec-caret-purple" aria-hidden="true">
                      ▼
                    </span>
                  </div>
                ))}
              </div>
            </section>
 
            {/* PANEL DERECHO: CANTIDAD */}
            <section className="rec-panel" aria-label="Cantidad">
              <div className="rec-panel-banner">
                <img src={`${IMG}/Cantidad.png`} alt="Cantidad" />
              </div>
 
              <div className="rec-list">
                {rows.map((row) => (
                  <div className="rec-pill rec-pill-quantity" key={row.key}>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      aria-label="Cantidad del ingrediente"
                      className="rec-qty-input"
                      placeholder="0"
                      disabled={!canEdit}
                      value={row.quantity}
                      onChange={(event) =>
                        handleFieldChange(row.key, "quantity", event.target.value)
                      }
                    />
 
                    <div className="rec-unit-wrap">
                      <Input
                        type="select"
                        aria-label="Unidad de medida"
                        className="rec-unit-select"
                        disabled={!canEdit}
                        value={row.unit}
                        onChange={(event) =>
                          handleFieldChange(row.key, "unit", event.target.value)
                        }
                      >
                        {compatibleUnits(ingredientsById.get(row.ingredientId)?.unit).map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </Input>
                      <span className="rec-caret rec-caret-blue" aria-hidden="true">
                        ▼
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
 
          {/* PIE DE PÁGINA: AñadirIngrediente.png (bajo el panel izquierdo) y GuardarRecetas.png (bajo el derecho) */}
          {canEdit && (
            <div className="rec-footer">
              <div className="rec-add-slot">
                <button
                  type="button"
                  className="rec-add-btn"
                  aria-label="Añadir ingrediente"
                  onClick={addRow}
                >
                  <img src={`${IMG}/AñadirIngrediente.png`} alt="Añadir ingrediente" />
                </button>
              </div>
 
              <div className="rec-save-slot">
                <button
                  type="button"
                  className="rec-save-btn"
                  aria-label="Guardar receta"
                  aria-busy={saving}
                  disabled={saving}
                  onClick={handleSaveClick}
                >
                  <img src={`${IMG}/GuardarRecetas.png`} alt="Guardar receta" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
 
      {/* Advertencia al reemplazar la receta de un producto existente */}
      <Modal isOpen={confirmOpen} toggle={cancelReplace} centered>
        <ModalHeader toggle={cancelReplace}>Reemplazar receta</ModalHeader>
        <ModalBody>
          ¿Seguro que quieres reemplazar la receta del producto{" "}
          <strong>{selectedProduct?.name}</strong>? La receta anterior se perderá y las
          próximas ventas descontarán los insumos que acabas de definir.
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={cancelReplace}>
            Cancelar
          </Button>
          <Button color="warning" onClick={confirmReplace}>
            Sí, reemplazar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
 