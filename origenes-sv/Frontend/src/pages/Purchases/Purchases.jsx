import { useEffect, useMemo, useState } from "react";
import { Alert, Input, Spinner } from "reactstrap";
import { api, formatDate, formatMoney } from "../../api/api.js";
import { useWorkspace } from "../../context/WorkspaceContext.js";
import { compatibleUnits, toBaseUnit } from "../../utils/units.js";
import "./Purchases.css";
 
// Imágenes en public/img/
const IMG = "/img";
 
const today = new Date().toISOString().slice(0, 10);
 
// Una fila de la factura: insumo, cantidad con su unidad, y costo por esa unidad
const newLine = () => ({ itemId: "", quantity: "1", unit: "", unitCost: "" });
const initialLines = () => [newLine(), newLine(), newLine()];
 
const emptySupplier = { name: "", taxId: "", phone: "", email: "" };
 
// Estado de la cuenta por pagar de cada factura
const STATUS_LABEL = { PENDING: "Pendiente", PARTIAL: "Pago parcial", PAID: "Pagada" };
 
export default function Purchases() {
  const { branchId, user } = useWorkspace();
  const canEdit = ["ADMIN", "MANAGER"].includes(user?.role);
 
  const [suppliers, setSuppliers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [purchases, setPurchases] = useState([]);
 
  // Campos de factura (panel izquierdo)
  const [supplierId, setSupplierId] = useState("");
  const [supplierInvoice, setSupplierInvoice] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(today);
  const [dueAt, setDueAt] = useState(today);
  const [lines, setLines] = useState(initialLines);
 
  // Buscador, filtro y orden de proveedores (panel derecho)
  const [searchSupplier, setSearchSupplier] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [onlyPendingBalance, setOnlyPendingBalance] = useState(false);
  const [sortOrder, setSortOrder] = useState("asc");
 
  // Fila verde de "nuevo proveedor"
  const [supplierDraft, setSupplierDraft] = useState(null);
  const [supplierSaving, setSupplierSaving] = useState(false);
  const [supplierFormError, setSupplierFormError] = useState("");
 
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
 
  // Vista activa: "register" (factura + proveedores) o "invoices" (tarjetas de facturas)
  const [view, setView] = useState("register");
 
  // Buscador, filtro y orden de la vista de facturas
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [showInvoiceFilters, setShowInvoiceFilters] = useState(false);
  const [invoiceFilter, setInvoiceFilter] = useState("all"); // all | pending | paid
  const [invoiceSort, setInvoiceSort] = useState("recent"); // recent | oldest | total
 
  async function loadData() {
    const [supplierList, stock, purchaseList] = await Promise.all([
      api("/suppliers"),
      api(`/inventory?branchId=${branchId}`),
      api(`/purchases?branchId=${branchId}`)
    ]);
    setSuppliers(supplierList);
    setInventory(stock);
    setPurchases(purchaseList);
    if (!supplierId && supplierList[0]) {
      setSupplierId(String(supplierList[0].id));
    }
  }
 
  useEffect(() => {
    setLoading(true);
    setError("");
    loadData()
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [branchId]);
 
  // Artículos que se pueden comprar (insumos y productos empacados), con su unidad base
  const selectedItems = useMemo(
    () =>
      inventory.map((item) => ({
        value: `${item.type}:${item.id}`,
        label: `${item.name} (${item.unit})`,
        unit: item.unit
      })),
    [inventory]
  );
 
  const itemsByValue = useMemo(
    () => new Map(selectedItems.map((item) => [item.value, item])),
    [selectedItems]
  );
 
  // Totales: cantidad × costo no cambia aunque se elija otra unidad (kg o g), por eso
  // el subtotal se calcula directamente con lo que escribe el usuario.
  const subtotal = useMemo(
    () =>
      lines.reduce(
        (sum, line) => sum + Number(line.quantity || 0) * Number(line.unitCost || 0),
        0
      ),
    [lines]
  );
  const totalWithIva = Math.round(subtotal * 1.13 * 100) / 100;
 
  // Proveedores visibles: buscador + filtro de saldo + orden por nombre
  const filteredSuppliers = useMemo(() => {
    const term = searchSupplier.trim().toLowerCase();
    const list = suppliers.filter((sup) => {
      const infoText = `${sup.phone || ""} ${sup.email || ""} ${sup.taxId || ""}`.toLowerCase();
      const matchesSearch =
        !term || (sup.name || "").toLowerCase().includes(term) || infoText.includes(term);
      if (!matchesSearch) return false;
      if (!onlyPendingBalance) return true;
 
      return purchases.some(
        (p) =>
          (p.supplierId === sup.id || p.supplier === sup.name) && Number(p.outstanding || 0) > 0
      );
    });
    const factor = sortOrder === "desc" ? -1 : 1;
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "es") * factor);
  }, [suppliers, purchases, searchSupplier, onlyPendingBalance, sortOrder]);
 
  // Facturas visibles: buscador (proveedor o No. factura) + filtro de saldo + orden
  const filteredInvoices = useMemo(() => {
    const term = invoiceSearch.trim().toLowerCase();
    const list = purchases.filter((invoice) => {
      const matchesSearch =
        !term ||
        (invoice.supplier || "").toLowerCase().includes(term) ||
        (invoice.supplierInvoice || "").toLowerCase().includes(term);
      if (!matchesSearch) return false;
      if (invoiceFilter === "pending") return Number(invoice.outstanding || 0) > 0;
      if (invoiceFilter === "paid") return Number(invoice.outstanding || 0) === 0;
      return true;
    });
    return [...list].sort((a, b) => {
      if (invoiceSort === "total") return Number(b.total) - Number(a.total);
      // El id crece con cada compra, así que sirve para ordenar por antigüedad
      return invoiceSort === "oldest" ? Number(a.id) - Number(b.id) : Number(b.id) - Number(a.id);
    });
  }, [purchases, invoiceSearch, invoiceFilter, invoiceSort]);
 
  function updateLine(index, key, value) {
    setLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const updated = { ...line, [key]: value };
        // Al cambiar el insumo, la unidad vuelve a la unidad base de ese insumo
        if (key === "itemId") updated.unit = itemsByValue.get(value)?.unit || "";
        return updated;
      })
    );
  }
 
  function addLine() {
    setLines((current) => [...current, newLine()]);
  }
 
  function removeLine(index) {
    setLines((current) => {
      if (current.length <= 1) return [newLine()];
      return current.filter((_, i) => i !== index);
    });
  }
 
  function cancelPurchaseForm() {
    setSupplierInvoice("");
    setPurchasedAt(today);
    setDueAt(today);
    setLines(initialLines());
    setError("");
    setMessage("");
  }
 
  async function submit(event) {
    if (event) event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
 
    try {
      const items = [];
      lines.forEach((line, index) => {
        if (!line.itemId) return; // filas sin insumo se ignoran
        const position = index + 1;
        const item = itemsByValue.get(line.itemId);
        const quantity = Number(line.quantity);
        const cost = Number(line.unitCost);
 
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error(`Indica una cantidad mayor que 0 en la fila ${position}.`);
        }
        if (line.unitCost === "" || !Number.isFinite(cost) || cost <= 0) {
          throw new Error(`Indica el costo unitario de la fila ${position}.`);
        }
 
        // El inventario trabaja en la unidad base del insumo: se convierte cantidad y costo.
        // Ejemplo: 2 kg a $10 por kg se envía como 2000 g a $0.01 por g (mismo total: $20).
        const baseQuantity = toBaseUnit(quantity, line.unit, item.unit);
        if (baseQuantity <= 0) {
          throw new Error(`La cantidad de la fila ${position} es demasiado pequeña.`);
        }
        const baseCost = (cost * quantity) / baseQuantity;
 
        const [type, id] = line.itemId.split(":");
        items.push({
          ...(type === "INGREDIENT" ? { ingredientId: Number(id) } : { productId: Number(id) }),
          quantity: baseQuantity,
          unitCost: baseCost
        });
      });
 
      if (!items.length) {
        throw new Error("Selecciona al menos un insumo o artículo para registrar la compra.");
      }
 
      const result = await api("/purchases", {
        method: "POST",
        body: {
          branchId,
          supplierId: Number(supplierId),
          supplierInvoice: supplierInvoice.trim() || `FAC-${Date.now().toString().slice(-5)}`,
          purchasedAt,
          dueAt,
          items
        }
      });
 
      setMessage(
        `Compra #${result.id} registrada. Cuenta por pagar: ${formatMoney(result.total)}.`
      );
      setSupplierInvoice("");
      setLines(initialLines());
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }
 
  // ---------- Proveedores: crear y eliminar ----------
 
  function startSupplierDraft() {
    setSupplierFormError("");
    setSupplierDraft({ ...emptySupplier });
  }
 
  function updateSupplierDraft(field) {
    return (event) => setSupplierDraft((current) => ({ ...current, [field]: event.target.value }));
  }
 
  async function saveSupplier() {
    const name = supplierDraft.name.trim();
    const email = supplierDraft.email.trim();
 
    if (name.length < 2) {
      return setSupplierFormError("Escribe el nombre del proveedor (mínimo 2 letras).");
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return setSupplierFormError("El correo no tiene un formato válido.");
    }
 
    setSupplierSaving(true);
    setSupplierFormError("");
    try {
      const created = await api("/suppliers", {
        method: "POST",
        body: {
          name,
          taxId: supplierDraft.taxId.trim(),
          phone: supplierDraft.phone.trim(),
          email
        }
      });
      setSuppliers((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name, "es"))
      );
      setSupplierId(String(created.id)); // queda elegido en la factura
      setSupplierDraft(null);
      setMessage(`Proveedor "${created.name}" agregado.`);
    } catch (requestError) {
      setSupplierFormError(requestError.message);
    } finally {
      setSupplierSaving(false);
    }
  }
 
  async function handleRemoveSupplier(supplier) {
    const confirmed = window.confirm(`¿Quitar al proveedor "${supplier.name}" de la lista?`);
    if (!confirmed) return;
    setError("");
    try {
      await api(`/suppliers/${supplier.id}`, { method: "DELETE" });
      setSuppliers((current) => current.filter((s) => s.id !== supplier.id));
      if (String(supplier.id) === supplierId) setSupplierId("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }
 
  // X azul de cada tarjeta: elimina la factura (el servidor revierte el inventario)
  async function handleRemoveInvoice(invoice) {
    const confirmed = window.confirm(
      `¿Eliminar la factura ${invoice.supplierInvoice} de ${invoice.supplier}? ` +
        "Se restará del inventario lo que esta compra había sumado y se quitará su cuenta por pagar."
    );
    if (!confirmed) return;
    setError("");
    setMessage("");
    try {
      await api(`/purchases/${invoice.id}`, { method: "DELETE" });
      setPurchases((current) => current.filter((p) => p.id !== invoice.id));
      setMessage(`Factura ${invoice.supplierInvoice} eliminada.`);
    } catch (requestError) {
      setError(requestError.message);
    }
  }
 
  // Info del proveedor: solo sus datos de contacto (las facturas están en "Vista facturas")
  function formatSupplierInfo(supplier) {
    const parts = [supplier.phone, supplier.email, supplier.taxId].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Proveedor registrado";
  }
 
  return (
    <div className="prov-page">
      {error && (
        <Alert color="danger" className="mb-3" toggle={() => setError("")}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert color="success" className="mb-3" toggle={() => setMessage("")}>
          {message}
        </Alert>
      )}
 
      {/* Pestañas: dos vistas dentro de la misma pantalla */}
      <div className="prov-tabs" role="tablist" aria-label="Vistas de compras">
        <button
          type="button"
          role="tab"
          aria-selected={view === "register"}
          className={`prov-tab${view === "register" ? " active" : ""}`}
          onClick={() => setView("register")}
        >
          Registro y proveedores
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "invoices"}
          className={`prov-tab${view === "invoices" ? " active" : ""}`}
          onClick={() => setView("invoices")}
        >
          Vista facturas <span className="prov-tab-count">{purchases.length}</span>
        </button>
      </div>
 
      {loading ? (
        <div className="prov-loading">
          <Spinner color="success" />
        </div>
      ) : view === "invoices" ? (
        /* VISTA FACTURAS: una tarjeta por factura registrada */
        <section className="suppliers-panel invoices-panel">
          <header className="suppliers-header">
            <h2 className="suppliers-title">Vista facturas</h2>
            <div className="suppliers-divider" />
          </header>
 
          <div className="suppliers-toolbar">
            <div className="suppliers-search-wrap">
              <img src={`${IMG}/BotonBuscador.png`} alt="Buscar" className="suppliers-search-icon" />
              <Input
                aria-label="Buscar factura"
                className="suppliers-search-input"
                placeholder="Proveedor o No. factura"
                value={invoiceSearch}
                onChange={(event) => setInvoiceSearch(event.target.value)}
              />
            </div>
 
            <div className="suppliers-filter-wrap">
              <button
                type="button"
                className="suppliers-filter-btn"
                aria-label="Filtrar facturas"
                aria-expanded={showInvoiceFilters}
                onClick={() => setShowInvoiceFilters((prev) => !prev)}
              >
                <img src={`${IMG}/Filtro.png`} alt="Filtrar" />
              </button>
 
              {showInvoiceFilters && (
                <div className="suppliers-filter-menu">
                  <span className="filter-menu-title">Mostrar</span>
                  {[
                    ["all", "Todas las facturas"],
                    ["pending", "Con saldo pendiente"],
                    ["paid", "Pagadas"]
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={invoiceFilter === value ? "active" : ""}
                      onClick={() => {
                        setInvoiceFilter(value);
                        setShowInvoiceFilters(false);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                  <span className="filter-menu-title">Ordenar</span>
                  {[
                    ["recent", "Más recientes primero"],
                    ["oldest", "Más antiguas primero"],
                    ["total", "Mayor total primero"]
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={invoiceSort === value ? "active" : ""}
                      onClick={() => {
                        setInvoiceSort(value);
                        setShowInvoiceFilters(false);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
 
            <span className="invoice-count">
              {filteredInvoices.length} de {purchases.length} facturas
            </span>
          </div>
 
          {filteredInvoices.length ? (
            <div className="invoice-grid">
              {filteredInvoices.map((invoice) => (
                <article className="invoice-card" key={invoice.id}>
                  <img className="invoice-card-bg" src={`${IMG}/CajaInformacion.png`} alt="" />
 
                  {canEdit && (
                    <button
                      type="button"
                      className="invoice-card-delete"
                      aria-label={`Eliminar factura ${invoice.supplierInvoice}`}
                      onClick={() => handleRemoveInvoice(invoice)}
                    >
                      <img src={`${IMG}/EliminarReceta.png`} alt="" />
                    </button>
                  )}
 
                  {/* Arriba: el proveedor, sobre la raya de la caja */}
                  <h3 className="invoice-card-supplier" title={invoice.supplier}>
                    <span>{invoice.supplier}</span>
                  </h3>
 
                  {/* Abajo: el resto de la información */}
                  <div className="invoice-card-body">
                    <dl className="invoice-card-info">
                      {[
                        ["Factura", invoice.supplierInvoice],
                        ["Fecha", formatDate(invoice.purchasedAt)],
                        ["Vence", formatDate(invoice.dueAt)],
                        ["Subtotal", formatMoney(invoice.subtotal)],
                        ["IVA 13%", formatMoney(invoice.tax)],
                        ["Total", formatMoney(invoice.total)],
                        ["Saldo", formatMoney(invoice.outstanding)]
                      ].map(([label, value]) => (
                        <div
                          className={`invoice-row${label === "Total" ? " invoice-row-total" : ""}`}
                          key={label}
                        >
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
 
                    <span className={`invoice-status invoice-status-${String(invoice.status).toLowerCase()}`}>
                      {STATUS_LABEL[invoice.status] || invoice.status}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="invoice-empty">
              {purchases.length
                ? "Ninguna factura coincide con la búsqueda o el filtro."
                : "Aún no hay facturas registradas en esta sucursal."}
            </p>
          )}
        </section>
      ) : (
        <div className="prov-layout">
          {/* PANEL IZQUIERDO: REGISTRO DE FACTURAS DE COMPRA */}
          <aside className="invoice-panel">
            <header className="invoice-header">
              <h1 className="invoice-title">Registro de facturas de compra</h1>
              <div className="invoice-divider" />
            </header>
 
            <form className="invoice-form" onSubmit={submit}>
              {/* Fila superior: PROVEEDOR | FECHA | NO. FACTURA */}
              <div className="invoice-top-box">
                <div className="invoice-top-labels">
                  <span>PROVEEDOR</span>
                  <span>FECHA</span>
                  <span>NO. FACTURA</span>
                </div>
 
                <div className="invoice-top-inputs">
                  <div className="pill-wrap pill-supplier">
                    <Input
                      aria-label="Proveedor"
                      type="select"
                      value={supplierId}
                      disabled={!canEdit}
                      onChange={(event) => setSupplierId(event.target.value)}
                      required
                    >
                      <option value="">Proveedor</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </Input>
                    <span className="pill-arrow arrow-blue" aria-hidden="true">
                      ▼
                    </span>
                  </div>
 
                  <div className="pill-wrap pill-date">
                    <Input
                      aria-label="Fecha de compra"
                      type="date"
                      value={purchasedAt}
                      disabled={!canEdit}
                      onChange={(event) => {
                        setPurchasedAt(event.target.value);
                        setDueAt(event.target.value);
                      }}
                      required
                    />
                  </div>
 
                  <div className="pill-wrap pill-invoice">
                    <Input
                      aria-label="Número de factura del proveedor"
                      placeholder="No. factura"
                      maxLength={80}
                      value={supplierInvoice}
                      disabled={!canEdit}
                      onChange={(event) => setSupplierInvoice(event.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
 
              {/* Bloque medio: INSUMO | CANTIDAD | COSTO | TOTAL */}
              <div className="invoice-items-box">
                <div className="invoice-items-header">
                  <span className="col-insumo-lbl">INSUMO</span>
                  <span className="col-cant-lbl">CANTIDAD</span>
                  <span className="col-cost-lbl" title="Costo por la unidad elegida">COSTO UNIT.</span>
                  <span className="col-total-lbl">TOTAL</span>
                </div>
 
                <div className="invoice-lines">
                  {lines.map((line, index) => {
                    const item = itemsByValue.get(line.itemId);
                    const lineTotal = Number(line.quantity || 0) * Number(line.unitCost || 0);
 
                    return (
                      <div className="invoice-line-row" key={index}>
                        {/* Insumo */}
                        <div className="pill-wrap pill-insumo">
                          {canEdit && (
                            <button
                              type="button"
                              className="line-remove-btn"
                              aria-label="Quitar insumo"
                              onClick={() => removeLine(index)}
                            >
                              <img src={`${IMG}/EliminarReceta.png`} alt="" />
                            </button>
                          )}
                          <Input
                            aria-label="Insumo"
                            type="select"
                            value={line.itemId}
                            disabled={!canEdit}
                            onChange={(event) => updateLine(index, "itemId", event.target.value)}
                          >
                            <option value="">Insumo</option>
                            {selectedItems.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Input>
                          <span className="pill-arrow arrow-purple" aria-hidden="true">
                            ▼
                          </span>
                        </div>
 
                        {/* Cantidad + unidad (solo unidades compatibles con el insumo) */}
                        <div className="pill-wrap pill-cant">
                          <Input
                            aria-label="Cantidad"
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0"
                            className="pill-number"
                            value={line.quantity}
                            disabled={!canEdit}
                            onChange={(event) => updateLine(index, "quantity", event.target.value)}
                          />
                          <div className="pill-unit-wrap">
                            <Input
                              aria-label="Unidad de medida"
                              type="select"
                              value={line.unit}
                              disabled={!canEdit || !item}
                              onChange={(event) => updateLine(index, "unit", event.target.value)}
                            >
                              {item ? (
                                compatibleUnits(item.unit).map((unit) => (
                                  <option key={unit} value={unit}>
                                    {unit}
                                  </option>
                                ))
                              ) : (
                                <option value="">—</option>
                              )}
                            </Input>
                            <span className="pill-arrow arrow-blue" aria-hidden="true">
                              ▼
                            </span>
                          </div>
                        </div>
 
                        {/* Costo por la unidad elegida */}
                        <div className="pill-wrap pill-cost">
                          <span className="pill-prefix" aria-hidden="true">$</span>
                          <Input
                            aria-label="Costo unitario"
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0.00"
                            className="pill-number"
                            value={line.unitCost}
                            disabled={!canEdit}
                            onChange={(event) => updateLine(index, "unitCost", event.target.value)}
                          />
                        </div>
 
                        {/* Total de la fila (solo lectura) */}
                        <div className="line-total-box" title="Total de línea">
                          {lineTotal > 0 ? formatMoney(lineTotal) : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
 
                {canEdit && (
                  <button type="button" className="add-line-link" onClick={addLine}>
                    + Añadir fila de insumo
                  </button>
                )}
              </div>
 
              {/* Bloque inferior: botones Cancelar / Confirmar + Subtotal / Total con IVA */}
              <div className="invoice-bottom-box">
                <div className="invoice-actions-col">
                  <button
                    type="button"
                    className="img-action-btn"
                    disabled={busy || !canEdit}
                    onClick={cancelPurchaseForm}
                  >
                    <img src={`${IMG}/EliminarProducto.png`} alt="" />
                    <span className="img-action-label">Cancelar compra</span>
                  </button>
 
                  <button
                    type="submit"
                    className="img-action-btn"
                    disabled={busy || !canEdit || !suppliers.length || !selectedItems.length}
                  >
                    <img src={`${IMG}/AñadirProducto.png`} alt="" />
                    <span className="img-action-label">
                      {busy ? "Guardando…" : "Confirmar compra"}
                    </span>
                  </button>
                </div>
 
                <div className="invoice-summary-col">
                  <div className="summary-row">
                    <span className="summary-label">SUBTOTAL</span>
                    <strong className="summary-value">{formatMoney(subtotal)}</strong>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">
                      TOTAL CON
                      <br />
                      IVA
                    </span>
                    <strong className="summary-value">{formatMoney(totalWithIva)}</strong>
                  </div>
                </div>
              </div>
            </form>
          </aside>
 
          {/* PANEL DERECHO: PROVEEDORES */}
          <section className="suppliers-panel">
            <header className="suppliers-header">
              <h2 className="suppliers-title">Proveedores</h2>
              <div className="suppliers-divider" />
            </header>
 
            <div className="suppliers-toolbar">
              <div className="suppliers-search-wrap">
                <img src={`${IMG}/BotonBuscador.png`} alt="Buscar" className="suppliers-search-icon" />
                <Input
                  aria-label="Buscar proveedor"
                  className="suppliers-search-input"
                  value={searchSupplier}
                  onChange={(event) => setSearchSupplier(event.target.value)}
                />
              </div>
 
              <div className="suppliers-filter-wrap">
                <button
                  type="button"
                  className="suppliers-filter-btn"
                  aria-label="Filtrar proveedores"
                  aria-expanded={showFilters}
                  onClick={() => setShowFilters((prev) => !prev)}
                >
                  <img src={`${IMG}/Filtro.png`} alt="Filtrar" />
                </button>
 
                {showFilters && (
                  <div className="suppliers-filter-menu">
                    <span className="filter-menu-title">Mostrar</span>
                    <button
                      type="button"
                      className={!onlyPendingBalance ? "active" : ""}
                      onClick={() => {
                        setOnlyPendingBalance(false);
                        setShowFilters(false);
                      }}
                    >
                      Todos los proveedores
                    </button>
                    <button
                      type="button"
                      className={onlyPendingBalance ? "active" : ""}
                      onClick={() => {
                        setOnlyPendingBalance(true);
                        setShowFilters(false);
                      }}
                    >
                      Con saldo pendiente
                    </button>
                    <span className="filter-menu-title">Ordenar</span>
                    <button
                      type="button"
                      className={sortOrder === "asc" ? "active" : ""}
                      onClick={() => {
                        setSortOrder("asc");
                        setShowFilters(false);
                      }}
                    >
                      Nombre A–Z
                    </button>
                    <button
                      type="button"
                      className={sortOrder === "desc" ? "active" : ""}
                      onClick={() => {
                        setSortOrder("desc");
                        setShowFilters(false);
                      }}
                    >
                      Nombre Z–A
                    </button>
                  </div>
                )}
              </div>
            </div>
 
            <div className="suppliers-table-wrap">
              <table className="suppliers-table">
                <thead>
                  <tr>
                    <th className="col-prov-nombre">PROVEEDORES</th>
                    <th className="col-prov-info">INFO PROVEEDORES</th>
                    {canEdit && <th className="col-prov-accion" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td
                        className="prov-cell"
                        onClick={() => setSupplierId(String(supplier.id))}
                        title="Seleccionar proveedor en la factura"
                      >
                        {supplier.name}
                      </td>
                      <td className="prov-cell">{formatSupplierInfo(supplier)}</td>
                      {canEdit && (
                        <td className="prov-action-cell">
                          <button
                            type="button"
                            className="prov-delete-btn"
                            aria-label={`Eliminar ${supplier.name}`}
                            onClick={() => handleRemoveSupplier(supplier)}
                          >
                            <img src={`${IMG}/EliminarReceta.png`} alt="" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
 
                  {!filteredSuppliers.length && (
                    <tr>
                      <td className="prov-cell prov-empty" colSpan={canEdit ? 3 : 2}>
                        {suppliers.length
                          ? "Ningún proveedor coincide con la búsqueda o el filtro."
                          : "Aún no hay proveedores registrados."}
                      </td>
                    </tr>
                  )}
 
                  {/* Fila verde clara: toda la fila es un botón para crear un proveedor nuevo */}
                  {canEdit && !supplierDraft && (
                    <tr className="prov-add-trigger-row">
                      <td colSpan={2}>
                        <button
                          type="button"
                          className="prov-add-trigger"
                          aria-label="Añadir proveedor nuevo"
                          onClick={startSupplierDraft}
                        />
                      </td>
                      <td className="prov-action-cell" />
                    </tr>
                  )}
 
                  {canEdit && supplierDraft && (
                    <tr className="prov-form-row">
                      <td colSpan={2}>
                        <div className="prov-form-grid">
                          <div>
                            <label htmlFor="sup-name">Nombre</label>
                            <Input
                              id="sup-name"
                              maxLength={160}
                              placeholder="Nombre del proveedor"
                              value={supplierDraft.name}
                              onChange={updateSupplierDraft("name")}
                            />
                          </div>
                          <div>
                            <label htmlFor="sup-phone">Teléfono</label>
                            <Input
                              id="sup-phone"
                              maxLength={40}
                              placeholder="+503 0000-0000"
                              value={supplierDraft.phone}
                              onChange={updateSupplierDraft("phone")}
                            />
                          </div>
                          <div>
                            <label htmlFor="sup-email">Correo</label>
                            <Input
                              id="sup-email"
                              type="email"
                              maxLength={255}
                              placeholder="ventas@proveedor.com"
                              value={supplierDraft.email}
                              onChange={updateSupplierDraft("email")}
                            />
                          </div>
                          <div>
                            <label htmlFor="sup-tax">NIT (opcional)</label>
                            <Input
                              id="sup-tax"
                              maxLength={30}
                              placeholder="0000-000000-000-0"
                              value={supplierDraft.taxId}
                              onChange={updateSupplierDraft("taxId")}
                            />
                          </div>
 
                          {supplierFormError && <p className="prov-form-error">{supplierFormError}</p>}
 
                          <div className="prov-form-actions">
                            <button
                              type="button"
                              className="prov-save-btn"
                              disabled={supplierSaving}
                              onClick={saveSupplier}
                            >
                              {supplierSaving ? "Guardando…" : "Guardar proveedor"}
                            </button>
                            <button
                              type="button"
                              className="prov-cancel-btn"
                              disabled={supplierSaving}
                              onClick={() => {
                                setSupplierDraft(null);
                                setSupplierFormError("");
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="prov-action-cell" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
 