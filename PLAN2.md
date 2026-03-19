# PLAN 2 - Requisitos funcionales

## 1) Solicitudes anonimas desde `/solicitud`
- Debe existir una pantalla publica en `/solicitud` para crear solicitudes sin iniciar sesion.
- Al enviar una solicitud, el sistema debe crear una orden de trabajo en estado `abierta`.
- Campos minimos: titulo, descripcion, datos de contacto del solicitante (nombre y/o email).

### Criterios de aceptacion
- Un usuario no autenticado puede abrir `/solicitud` y enviar el formulario.
- La orden aparece en el listado de ordenes abiertas.
- El flujo no expone informacion interna del sistema a usuarios anonimos.

---

## 2) Calendario anual de mantenimiento preventivo
- Debe existir una vista anual para planificar mantenimientos preventivos.
- Permitir crear eventos preventivos por activo, fecha y frecuencia.
- Los eventos deben poder convertirse o generar ordenes de trabajo segun la fecha programada.

### Criterios de aceptacion
- El usuario puede navegar por meses dentro del anio.
- Se pueden crear, editar y eliminar eventos preventivos.
- Los eventos muestran estado (programado, ejecutado, vencido).

---

## 3) Roles y permisos
- Roles iniciales:
  - `administrador`: acceso total.
  - `operador`: acceso solo a `ordenes de trabajo`, `dashboard`, `asistente` y `base de conocimientos`.
- Cualquier ruta o accion fuera de permisos debe bloquearse por backend y frontend.

### Criterios de aceptacion
- Un operador no puede acceder a modulos restringidos.
- Un administrador puede acceder y operar en todos los modulos.
- Los permisos se validan en API (no solo en la UI).

---

## 4) Dashboard con ordenes abiertas
- El dashboard principal debe mostrar ordenes de trabajo en estado `abierta`.
- Debe incluir al menos: conteo total, listado resumido y accesos rapidos para abrir detalle.

### Criterios de aceptacion
- Al ingresar al dashboard se ven las ordenes abiertas sin pasos adicionales.
- Si no hay ordenes abiertas, se muestra estado vacio claro.
- La informacion del dashboard respeta el rol del usuario.

---

## 5) Kanban para flujo de ordenes de trabajo
- La vista de ordenes debe incluir tablero Kanban con columnas:
  - `abierta`
  - `en_progreso`
  - `terminada`
- Debe permitir drag-and-drop para mover tarjetas entre columnas y actualizar estado.

### Criterios de aceptacion
- Al arrastrar una tarjeta entre columnas, el estado se persiste en backend.
- Si falla la actualizacion, la tarjeta vuelve a su estado previo y se muestra error.
- El tablero refleja cambios en tiempo real o mediante refresco consistente.