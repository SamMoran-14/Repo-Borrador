# Diseño técnico — Orígenes SV

## Arquitectura

- **Cliente:** React, Vite, React Router y componentes Reactstrap sobre Bootstrap.
- **API:** Node.js y Express, JSON sobre HTTP/REST.
- **Persistencia:** PostgreSQL mediante `pg` y consultas parametrizadas.
- **Validación:** Zod en límites HTTP; restricciones y claves foráneas en PostgreSQL.
- **Autenticación:** JWT con expiración de ocho horas, hash de contraseña bcrypt y límite de intentos de inicio de sesión.

## Organización del código

El repositorio es un monorepo con dos paquetes (`Frontend/` y `Backend/`) y recursos compartidos en la raíz (`db/`, `docs/`, `docker-compose.yml`). El servidor sigue una estructura por capas: `routes` → `controllers` → `services`, con `schemas` (Zod) para validar la entrada, `middlewares` para autenticación, permisos, límites de intentos y manejo de errores, y `domain` para los cálculos puros que tienen pruebas unitarias. El cliente organiza cada pantalla en `Frontend/src/pages/<Pantalla>/`. Aunque el código está separado en dos paquetes, la aplicación se despliega como una unidad: en producción el servidor entrega el cliente compilado (`Frontend/dist/`). Consulta el README para el árbol completo.

## Módulos y datos

`branches`, `users`, `employees`, `products`, `ingredients` y `recipe_items` describen la operación. `inventory_balances` mantiene existencias por sucursal, con claves únicas parciales para insumos y artículos empacados. `sales`, `sale_items`, `invoices` e `invoice_counters` guardan ventas y correlativos. Compras, líneas y `accounts_payable` reflejan adquisiciones y obligaciones. `cash_shifts` agrupa ventas por turno y medio de pago. `payroll_runs` y `payroll_lines` guardan cada cálculo como una instantánea histórica.

## Reglas principales

- Las ventas y compras ejecutan en una transacción SQL. Un error revierte las líneas, la actualización de existencias y el correlativo.
- El POS combina pedidos repetidos por producto, calcula subtotal y aplica IVA del 13% sobre los precios registrados (precios antes de IVA).
- Los productos con receta descuentan cantidades acumuladas por insumo. Los productos de reventa descuentan existencias por unidad. No se permite inventario negativo.
- El correlativo es independiente por sucursal, documento y año, con bloqueo atómico en PostgreSQL para evitar duplicados concurrentes.
- La caja compara fondo de apertura más ventas en efectivo con el conteo; tarjeta, Bitcoin y Chivo Wallet se comparan por separado.
- La planilla quincenal usa salario mensual dividido entre dos, ISSS al 3% (sobre un máximo de $500 por quincena), AFP al 7.25% e ISR según el tramo configurado en `Backend/src/domain/domain.js`.

## API

Las rutas de negocio requieren `Authorization: Bearer <JWT>`.

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/health` | Estado de la API y conexión a DB |
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/branches` | Sucursales activas |
| GET | `/api/dashboard?branchId=` | Indicadores de sucursal |
| GET / POST | `/api/products` | Menú y creación de productos elaborados |
| GET / PUT | `/api/products/:id/recipe` | Consultar y reemplazar receta |
| POST / DELETE | `/api/inventory`, `/api/inventory/:type/:id` | Crear y desactivar artículos |
| POST / DELETE | `/api/suppliers`, `/api/suppliers/:id` | Crear y desactivar proveedores |
| DELETE | `/api/purchases/:id` | Eliminar una factura de compra |
| GET | `/api/auth/me` | Usuario de la sesión |
| POST | `/api/auth/password` | Cambiar contraseña |
| GET | `/api/inventory?branchId=` | Existencias y alertas |
| GET / POST | `/api/purchases` | Listar y registrar compras |
| GET | `/api/suppliers` | Proveedores activos |
| GET | `/api/cash/status?branchId=` | Turno activo y totales |
| POST | `/api/cash/open`, `/api/cash/close` | Apertura y cierre de turno |
| POST | `/api/sales` | Registrar venta y comprobante interno |
| GET / POST | `/api/employees` | Consultar y registrar empleados |
| GET / POST | `/api/payroll` | Consultar y generar planillas |

## Seguridad, configuración y operación

- No se almacenan contraseñas en texto claro; `ADMIN_PASSWORD` solo se utiliza para crear el primer usuario.
- Las consultas usan parámetros, los esquemas validan la entrada y el JSON entrante tiene un límite de tamaño.
- `helmet` agrega encabezados de seguridad; CORS queda limitado al origen configurado en `APP_ORIGIN`.
- Los secretos locales se guardan en `.env`, que está excluido de Git.
- Configure respaldo y restauración probada de PostgreSQL, TLS, rotación de secretos y alertas antes de producción.

## Límites pendientes para producción

1. Integrar y certificar DTE de Hacienda (firma, ambiente de pruebas/producción, contingencia, anulación y almacenamiento legal). Los correlativos del prototipo no reemplazan esos requisitos.
2. Validar con documentación oficial vigente y asesoría contable las tablas ISR, bases, topes de ISSS/AFP, excepciones y redondeos. La tasa de IVA de venta está fijada al 13% por el enunciado.
3. Agregar gestión de roles y usuarios, pagos parciales de proveedores, auditoría de movimientos de inventario, devoluciones, cierres históricos consultables y pruebas de integración con PostgreSQL.
4. Desplegar sobre infraestructura con HTTPS, secretos administrados, respaldos cifrados, monitoreo y un procedimiento de recuperación.

## Asistencia de IA

Se utilizaron asistentes de IA para la implementación y la documentación inicial, y Claude (Anthropic) para reorganizar, revisar y corregir el código (entre otros: tabla de renta, tope del ISSS, fechas y permisos). El equipo verificó todo el código, validó los cálculos con fuentes oficiales, ejecutó las pruebas y declaró esta asistencia en la bibliografía IEEE requerida por el curso.

## Referencias

[1] Cátedra de Programación Web, "Desarrollo de aplicaciones web, para la resolución de problemas prácticos," enunciado del proyecto, ciclo 02, 2026.

[2] Anthropic, "Claude," asistente de inteligencia artificial. [En línea]. Disponible: https://claude.ai. Accedido: 26 nov. 2026.

[3] Órgano Ejecutivo de El Salvador, "Decreto Ejecutivo No. 10: Tablas de retención del impuesto sobre la renta," 2025. [En línea]. Disponible: https://www.jurisprudencia.gob.sv/DocumentosBoveda/D/2/2020-2029/2025/04/10A052.PDF. Accedido: 26 nov. 2026.