## Why

El dashboard actualmente no muestra información de checklists. Los usuarios (admin, técnico, calidad) necesitan ver qué checklists están programados para el día que están consultando, y poder navegar a otros días. Además, cuando un checklist tiene campos con valor «NO OK» o comentarios, debe destacarse como prioridad porque probablemente requiere acción correctiva.

## What Changes

- Agregar una nueva sección al dashboard que muestre los checklists completados/pendientes del día seleccionado
- Permitir navegación por fecha (día anterior/siguiente) dentro de esa sección
- Marcar como prioridad los checklists que contengan al menos un campo con valor «NO OK» o que tengan comentarios/notas asociados
- Hacer la sección visible para admin, técnico y calidad (cada rol que pueda ver el dashboard o tenga acceso a checklists)
- Exponer un endpoint API para consultar checklists por fecha con indicadores de prioridad

## Capabilities

### New Capabilities
- `dashboard-checklists`: Vista de checklists del día en el dashboard con navegación por fecha y marcado de prioridad (NO OK / comentarios)

### Modified Capabilities
- `checklists`: Agregar lógica de detección de prioridad (campos NO OK, notas asociadas)

## Impact

- **API**: Nuevo endpoint `GET /api/dashboard/checklists?date=YYYY-MM-DD`
- **UI**: Nueva sección en `app/(app)/dashboard/page.tsx`
- **Lib**: Nuevo helper `lib/dashboard-checklists.ts` para lógica de prioridad
- **Middleware**: Puede requerir que técnico y calidad accedan al dashboard o a este endpoint específico
- **DB**: No requiere migración — usa tablas existentes (`work_order_checklist`, `work_orders`, `notes`)
