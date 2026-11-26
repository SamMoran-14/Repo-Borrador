import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Input, Spinner, Table } from "reactstrap";
import { api } from "../../api/api.js";
import { useWorkspace } from "../../context/WorkspaceContext.js";
import "./Inventory.css";
 
// Imágenes de Figma: carpeta public/img/ (se sirven desde la ruta /img/)
const IMG = "/img";
 
const STATUS_LABEL = { ok: "Disponible", low: "Stock bajo", out: "Sin stock" };
const STATUS_ORDER = { out: 0, low: 1, ok: 2 };
const SORT_OPTIONS = [
  { value: "default", label: "Más urgentes primero" },
  { value: "name", label: "Nombre" },
  { value: "quantity", label: "Existencia" },
  { value: "minimumStock", label: "Mínimo" },
  { value: "status", label: "Estado" }
];
const UNITS = ["g", "kg", "ml", "l", "unidad"];
// El backend fija el mínimo de los productos empacados (RESALE) en 5.
const RESALE_MIN_STOCK = 5;
 
// Convierte un registro del backend en uno de los 3 estados del diseño.
function getStatus(item) {
  if (Number(item.quantity) <= 0) return "out";
  if (item.lowStock) return "low";
  return "ok";
}
 
// Borrador de la fila "nuevo artículo". type: INGREDIENT (insumo) | RESALE (empacado)
function newDraft(type) {
  return {
    type,
    name: "",
    unit: type === "RESALE" ? "unidad" : "g",
    quantity: "",
    minimumStock: type === "RESALE" ? String(RESALE_MIN_STOCK) : "",
    price: ""
  };
}
 
export default function Inventory() {
  const { branchId, user } = useWorkspace();
  // Solo administradores y gerentes pueden crear o eliminar (el backend también lo valida).
  const canEdit = ["ADMIN", "MANAGER"].includes(user?.role);
 
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
 
  // Búsqueda, filtros y orden
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortKey, setSortKey] = useState("default");
  const [sortDir, setSortDir] = useState("asc");
 
  // Fila verde de "nuevo artículo"
  const [draft, setDraft] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
 
  const loadInventory = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError("");
    try {
      const data = await api(`/inventory?branchId=${branchId}`);
      setRows(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [branchId]);
 
  // Recarga cuando cambia la sucursal
  useEffect(() => {
    loadInventory();
  }, [loadInventory]);
 
  // Contadores de las tres tarjetas superiores
  const counters = useMemo(() => {
    const statuses = rows.map(getStatus);
    return {
      total: rows.length,
      low: statuses.filter((status) => status === "low").length,
      out: statuses.filter((status) => status === "out").length
    };
  }, [rows]);
 
  // 1) filtra (buscador + estado + tipo)  2) ordena
  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = rows.filter((item) => {
      const matchesSearch = !term || item.name.toLowerCase().includes(term);
      const matchesStatus = statusFilter === "all" || getStatus(item) === statusFilter;
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
    if (sortKey === "default") return filtered; // orden que envía el backend
    const factor = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name, "es") * factor;
      if (sortKey === "status") return (STATUS_ORDER[getStatus(a)] - STATUS_ORDER[getStatus(b)]) * factor;
      return (Number(a[sortKey]) - Number(b[sortKey])) * factor;
    });
  }, [rows, search, statusFilter, typeFilter, sortKey, sortDir]);
 
  const updateDraft = (field) => (event) =>
    setDraft((current) => ({ ...current, [field]: event.target.value }));
 
  // Abre la fila de captura. Por defecto empieza como insumo; el tipo se cambia dentro del formulario.
  function startDraft(type = "INGREDIENT") {
    setFormError("");
    setDraft(newDraft(type));
  }
 
  // Cambia entre insumo y producto empacado conservando lo que ya se escribió
  function changeDraftType(event) {
    const type = event.target.value;
    setDraft((current) => ({ ...newDraft(type), name: current.name, quantity: current.quantity }));
  }
 
  // Valida en el cliente y envía POST /inventory
  async function saveDraft() {
    const name = draft.name.trim();
    const quantity = Number(draft.quantity);
    const minimumStock = Number(draft.minimumStock);
    const price = Number(draft.price);
    const isResale = draft.type === "RESALE";
 
    if (name.length < 2) return setFormError("Escribe el nombre del artículo (mínimo 2 letras).");
    if (draft.quantity === "" || !Number.isFinite(quantity) || quantity < 0) {
      return setFormError("La existencia debe ser un número igual o mayor que 0.");
    }
    if (!isResale && (draft.minimumStock === "" || !Number.isFinite(minimumStock) || minimumStock < 0)) {
      return setFormError("El mínimo debe ser un número igual o mayor que 0.");
    }
    if (isResale && !(price > 0)) return setFormError("Indica el precio de venta del producto empacado.");
 
    setSaving(true);
    setFormError("");
    try {
      await api("/inventory", {
        method: "POST",
        body: {
          branchId,
          type: draft.type,
          name,
          unit: draft.unit,
          quantity,
          minimumStock: isResale ? RESALE_MIN_STOCK : minimumStock,
          ...(isResale ? { price } : {})
        }
      });
      setDraft(null);
      await loadInventory(false);
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setSaving(false);
    }
  }
 
  // Botón X: elimina (desactiva) el artículo
  async function removeItem(item) {
    const confirmed = window.confirm(
      `¿Eliminar "${item.name}"? Dejará de aparecer en el inventario de todas las sucursales.`
    );
    if (!confirmed) return;
    setError("");
    try {
      await api(`/inventory/${item.type}/${item.id}`, { method: "DELETE" });
      setRows((current) => current.filter((row) => !(row.id === item.id && row.type === item.type)));
    } catch (requestError) {
      setError(requestError.message);
    }
  }
 
  const summary = [
    { key: "total", label: "Total de productos", value: counters.total, img: "TotalProducto.png" },
    { key: "low", label: "Stock bajo", value: counters.low, img: "StockBajo.png" },
    { key: "out", label: "Sin stock", value: counters.out, img: "SinStock.png" }
  ];
  const columnCount = canEdit ? 6 : 5;
 
  return (
    <div className="inv-page">
      <h1 className="inv-title">Inventario</h1>
 
      {/* Buscador + botón de filtros */}
      <div className="inv-toolbar">
        <div className="inv-search">
          <img src={`${IMG}/BotonBuscador.png`} alt="" className="inv-search-icon" />
          <Input
            aria-label="Buscar artículo"
            placeholder="Buscar artículo"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="inv-filter-btn"
          aria-expanded={showFilters}
          aria-label="Mostrar filtros"
          onClick={() => setShowFilters((open) => !open)}
        >
          <img src={`${IMG}/Filtro.png`} alt="" />
        </button>
      </div>
 
      {showFilters && (
        <div className="inv-filters">
          <label>
            Estado
            <Input type="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Todos</option>
              <option value="ok">Disponible</option>
              <option value="low">Stock bajo</option>
              <option value="out">Sin stock</option>
            </Input>
          </label>
          <label>
            Tipo
            <Input type="select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">Todos</option>
              <option value="INGREDIENT">Insumo / receta</option>
              <option value="RESALE">Producto empacado</option>
            </Input>
          </label>
          <label>
            Ordenar por
            <Input type="select" value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Input>
          </label>
          <label>
            Orden
            <Input type="select" value={sortDir} disabled={sortKey === "default"}
              onChange={(event) => setSortDir(event.target.value)}>
              <option value="asc">Ascendente</option>
              <option value="desc">Descendente</option>
            </Input>
          </label>
        </div>
      )}
 
      {/* Tarjetas resumen */}
      <div className="inv-summary">
        {summary.map((card) => (
          <div className="inv-stat" key={card.key}>
            <img src={`${IMG}/${card.img}`} alt="" />
            <span>{card.label}: <strong>{card.value}</strong></span>
          </div>
        ))}
      </div>
 
      {error && <Alert color="danger">{error}</Alert>}
      {formError && <Alert color="warning">{formError}</Alert>}
 
      {loading ? (
        <Spinner color="success" />
      ) : (
        <div className="table-responsive">
          <Table className="inv-table align-middle">
            <thead>
              <tr>
                <th>Artículo</th>
                <th>Unidad</th>
                <th>Existencia</th>
                <th>Mínimo</th>
                <th>Estado</th>
                {canEdit && <th className="inv-action" aria-label="Acciones" />}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((item) => {
                const status = getStatus(item);
                return (
                  <tr key={`${item.type}-${item.id}`} className={`inv-row inv-row-${status}`}>
                    <td className="inv-name">{item.name}</td>
                    <td>{item.unit}</td>
                    <td>{Number(item.quantity).toLocaleString("es-SV")}</td>
                    <td>{Number(item.minimumStock).toLocaleString("es-SV")}</td>
                    <td><span className={`inv-badge inv-badge-${status}`}>{STATUS_LABEL[status]}</span></td>
                    {canEdit && (
                      <td className="inv-action">
                        <button type="button" className="inv-delete" aria-label={`Eliminar ${item.name}`}
                          onClick={() => removeItem(item)}>
                          <img src={`${IMG}/EliminarReceta.png`} alt="" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
 
              {!visibleRows.length && (
                <tr className="inv-empty">
                  <td colSpan={columnCount}>
                    {rows.length ? "Ningún artículo coincide con la búsqueda o los filtros." : "Sin existencias registradas."}
                  </td>
                </tr>
              )}
 
              {/* Fila verde: crear un artículo nuevo */}
              {canEdit && !draft && (
                <tr className="inv-add-trigger-row">
                  <td colSpan={5}>
                    {/* Toda la fila verde es un botón: reacciona al hover y al clic */}
                    <button
                      type="button"
                      className="inv-add-trigger"
                      aria-label="Añadir artículo nuevo"
                      onClick={() => startDraft()}
                    />
                  </td>
                  <td className="inv-action" />
                </tr>
              )}
 
              {canEdit && draft && (
                <tr className="inv-add-row inv-add-form">
                  <td>
                    <Input aria-label="Tipo de artículo" type="select" value={draft.type} onChange={changeDraftType}>
                      <option value="INGREDIENT">Insumo / ingrediente</option>
                      <option value="RESALE">Producto empacado</option>
                    </Input>
                    <Input aria-label="Nombre" maxLength={140} value={draft.name} onChange={updateDraft("name")}
                      placeholder={draft.type === "RESALE" ? "Nombre del producto empacado" : "Nombre del ingrediente"} />
                    {draft.type === "RESALE" && (
                      <Input aria-label="Precio de venta" type="number" min="0.01" step="0.01"
                        placeholder="Precio de venta (USD)" value={draft.price} onChange={updateDraft("price")} />
                    )}
                  </td>
                  <td>
                    {draft.type === "RESALE" ? "unidad" : (
                      <Input aria-label="Unidad" type="select" value={draft.unit} onChange={updateDraft("unit")}>
                        {UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                      </Input>
                    )}
                  </td>
                  <td>
                    <Input aria-label="Existencia inicial" type="number" min="0" step="any" placeholder="0"
                      value={draft.quantity} onChange={updateDraft("quantity")} />
                  </td>
                  <td>
                    {draft.type === "RESALE" ? RESALE_MIN_STOCK : (
                      <Input aria-label="Mínimo" type="number" min="0" step="any" placeholder="0"
                        value={draft.minimumStock} onChange={updateDraft("minimumStock")} />
                    )}
                  </td>
                  <td>
                    <div className="inv-form-actions">
                      <button type="button" className="inv-save" disabled={saving} onClick={saveDraft}>
                        {saving ? "Guardando…" : "Guardar"}
                      </button>
                      <button type="button" className="inv-cancel" disabled={saving}
                        onClick={() => { setDraft(null); setFormError(""); }}>
                        Cancelar
                      </button>
                    </div>
                  </td>
                  <td className="inv-action" />
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
 