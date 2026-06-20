# SobreBox — User Stories

## Roles

| Símbolo | Rol | Descripción |
|---------|-----|-------------|
| 👤 | `visitor` | Visitante anónimo |
| 🧑 | `user` | Usuario registrado y autenticado |
| 🛡️ | `admin` | Administrador / moderador |

---

## Epic 1 — Autenticación y perfil

### US-01 Registro
**Como** visitante **quiero** registrarme con email y contraseña o mediante OAuth (Google, Discord) **para** acceder a todas las funciones de la plataforma.

**Criterios de aceptación:**
- El formulario valida email único y contraseña mínimo 8 caracteres con al menos un número
- Se envía email de verificación tras el registro; la cuenta queda activa solo tras verificar
- El registro vía Google o Discord no requiere contraseña
- Al crear la cuenta se inicializan inventario y wishlist vacíos
- El username se auto-sugiere del email y puede personalizarse (único, 3-20 chars, sin espacios)

### US-02 Inicio de sesión
**Como** visitante **quiero** iniciar sesión con mis credenciales o mediante OAuth **para** acceder a mi cuenta.

**Criterios de aceptación:**
- JWT de acceso (15 min) + refresh token en cookie httpOnly (7 días)
- Bloqueo temporal de 15 min tras 5 intentos fallidos consecutivos
- "Recordarme" extiende el refresh token a 30 días
- Redirige al origen de la sesión tras el login

### US-03 Perfil público
**Como** usuario **quiero** tener una página de perfil pública con mis estadísticas y reputación **para** que la comunidad pueda conocerme como coleccionista y trader.

**Criterios de aceptación:**
- Muestra: avatar, username, bio (máx 280 chars), fecha de miembro
- Estadísticas visibles: total de aperturas, colecciones en progreso, ítems únicos obtenidos
- Reputación de trader: media de reviews (1-5 ★) + nº de transacciones completadas
- Historial de aperturas y wishlist opcionales (configurables en privacidad)
- Listado de ítems en venta/intercambio activos

### US-04 Configuración de cuenta y privacidad
**Como** usuario **quiero** gestionar mis datos de cuenta y qué información es pública **para** mantener el control de mi privacidad.

**Criterios de aceptación:**
- Puedo editar: username, avatar, bio, email (requiere verificación), contraseña
- Control de privacidad individual para: historial de aperturas, inventario, wishlist
- El username y la reputación son siempre públicos
- Puedo desactivar la cuenta (soft delete, reversible en 30 días)
- Exportar todos mis datos (GDPR) en formato JSON/CSV

---

## Epic 2 — Catálogo de colecciones

### US-05 Explorar catálogo
**Como** visitante **quiero** explorar el catálogo de colecciones disponibles **para** descubrir qué existe en la plataforma sin necesidad de registrarme.

**Criterios de aceptación:**
- Filtros: brand (Pokémon, Funko, Magic, One Piece, Dragon Ball…), tipo (TCG, figura, blind box…), año, estado (verificada/no verificada)
- Ordenar por: popularidad (nº de aperturas registradas), novedades, nombre A-Z
- Paginación infinite scroll (20 ítems por página)
- Vista grid (cards con imagen) y lista (compacta con datos)
- Cards muestran: imagen, nombre, nº de ítems, nº de aperturas registradas, % de completado medio

### US-06 Detalle de colección
**Como** visitante **quiero** ver el detalle completo de una colección con todos sus ítems y estadísticas **para** decidir si me interesa coleccionarla.

**Criterios de aceptación:**
- Lista todos los ítems agrupados y ordenados por rareza
- Para cada ítem: imagen, nombre, rareza, nº de coleccionistas que lo tienen, pull rate oficial (si existe) y pull rate empírico de la comunidad
- Resumen de tipos de sobre disponibles (Booster, Blister, Display…) con precio y tamaño
- Estadísticas generales: distribución de rarezas del catálogo, ítems más difíciles de conseguir
- Nº de usuarios con ítems de esta colección, nº de aperturas registradas
- Badge "Verificada" / "Enviada por la comunidad" con nombre del autor si aplica

### US-07 Seguir una colección
**Como** usuario **quiero** marcar una colección como "en progreso" **para** hacer seguimiento de mis ítems obtenidos y ver mi porcentaje de completado.

**Criterios de aceptación:**
- Botón "Añadir a mis colecciones" en la página de detalle
- La colección aparece en mi dashboard bajo "Colecciones activas"
- Muestra: ítems que tengo / total ítems, % completado, ítems duplicados, ítems que me faltan
- Puede eliminarse de "activas" (no borra el inventario)

### US-08 Enviar nueva colección
**Como** usuario **quiero** proponer una colección que no está en el catálogo **para** que la comunidad pueda usarla.

**Criterios de aceptación:**
- Formulario: nombre, brand (lista + "otro"), tipo, año de lanzamiento, imagen de portada, ítems (nombre, rareza, imagen, pull rate oficial opcional), tipos de sobre
- La colección queda en estado "Pendiente de revisión" con badge visible
- El usuario recibe notificación in-app y email cuando es aprobada o rechazada (con motivo)
- Hasta que se aprueba, solo el autor y los admins pueden verla
- El autor puede editar mientras esté pendiente

### US-09 Moderar colecciones (admin)
**Como** admin **quiero** revisar, editar y aprobar o rechazar las colecciones enviadas por usuarios **para** garantizar la calidad del catálogo.

**Criterios de aceptación:**
- Panel de moderación con cola de colecciones pendientes ordenadas por fecha
- Puedo editar cualquier campo antes de aprobar
- Puedo aprobar (colección pasa a visible + badge "Verificada"), rechazar (con motivo obligatorio) o pedir cambios al autor
- Al aprobar/rechazar, el autor recibe notificación
- Las colecciones verificadas pueden ser editadas solo por admins

---

## Epic 3 — Apertura de sobres

### US-10 Registrar apertura individual
**Como** usuario **quiero** registrar la apertura de un sobre y seleccionar los ítems que me han salido **para** mantener mi inventario actualizado y contribuir a las estadísticas de la comunidad.

**Criterios de aceptación:**
- Flujo: seleccionar colección → seleccionar tipo de sobre → seleccionar ítems obtenidos con cantidad
- Animación de apertura de sobre (flip 3D + reveal del ítem con intensidad según rareza)
- Los ítems seleccionados se añaden automáticamente al inventario del usuario
- Opcional: marcar la apertura como privada (no cuenta para estadísticas públicas)
- La apertura queda guardada en el historial con timestamp

### US-11 Apertura en bloque (bulk opening)
**Como** usuario **quiero** registrar múltiples aperturas del mismo tipo de sobre a la vez **para** cuando abro un display completo sin tener que registrar sobre a sobre.

**Criterios de aceptación:**
- Selecciono nº de sobres a registrar (máx 36 de una vez)
- Para cada sobre, selecciono los ítems obtenidos (o uso "skip" si no recuerdo)
- Al finalizar se muestra un resumen: rarezas obtenidas, ítems únicos vs duplicados, comparación con probabilidades medias
- Opción de registrar en modo rápido: solo selecciono ítems notables (raros+) sin detallar comunes

### US-12 Historial de aperturas propio
**Como** usuario **quiero** ver y filtrar mi historial completo de aperturas **para** analizar mis resultados a lo largo del tiempo.

**Criterios de aceptación:**
- Lista cronológica con filtros: por colección, por rango de fechas, por rareza obtenida
- Cada apertura muestra: tipo de sobre, ítems obtenidos (con imagen y rareza), fecha
- Puede expandirse para ver detalle completo o compartirse como link público (si la apertura es pública)
- Estadísticas acumuladas del historial: media de rarezas por sobre, colecciones más abiertas

### US-13 Feed de aperturas de la comunidad
**Como** usuario **quiero** ver las aperturas recientes de la comunidad y de quienes sigo **para** inspirarme y ver qué les sale a los demás.

**Criterios de aceptación:**
- Feed chronológico con filtro "Todos" / "Solo los que sigo"
- Cada entrada muestra: avatar + username, colección/sobre, ítems destacados (raros+), timestamp
- Puedo reaccionar con emojis (👀 🔥 💎 🤯) y ver el recuento de reacciones
- Paginación con scroll infinito
- Las aperturas privadas no aparecen en el feed

---

## Epic 4 — Inventario

### US-14 Ver inventario personal
**Como** usuario **quiero** ver todos los ítems que tengo organizados por colección **para** saber exactamente qué poseo.

**Criterios de aceptación:**
- Vista por colección: nº de ítems que tengo / total, % completado, ítems duplicados
- Vista global: todos los ítems paginados con filtros (rareza, condición, estado: en venta / en intercambio / disponible)
- Cada ítem muestra: imagen, nombre, rareza, cantidad, condición, si está listado en marketplace
- Exportar inventario a CSV
- Buscador por nombre de ítem dentro del inventario

### US-15 Gestionar ítem del inventario
**Como** usuario **quiero** editar la información de un ítem concreto de mi inventario **para** mantenerlo actualizado.

**Criterios de aceptación:**
- Puedo editar: cantidad, condición (Mint / Near Mint / Good / Played / Damaged), notas privadas
- Puedo marcar como "Para vender", "Para intercambiar" o ambos; esto lo hace visible en marketplace
- Puedo definir un precio estimado de venta (opcional)
- Si la cantidad llega a 0, el ítem se elimina del inventario (previa confirmación)
- Los cambios se reflejan en tiempo real en el marketplace si el ítem tiene listings activos

### US-16 Wishlist
**Como** usuario **quiero** gestionar una lista de ítems que deseo conseguir **para** facilitar que otros usuarios me los ofrezcan.

**Criterios de aceptación:**
- Añado ítems desde el catálogo de colección con un clic
- Configuro por ítem: prioridad (Alta / Media / Baja), precio máximo que pagaría (opcional y público)
- La wishlist puede ser pública o privada (config de privacidad)
- Si alguien lista en venta/intercambio un ítem de mi wishlist activa, recibo notificación
- Puedo ver qué ítems de mi wishlist tiene la gente para intercambiar (matching)

---

## Epic 5 — Estadísticas

### US-17 Pull rates de la comunidad
**Como** visitante **quiero** ver las probabilidades reales de obtener cada ítem basadas en las aperturas registradas **para** saber qué esperar antes de comprar un sobre.

**Criterios de aceptación:**
- Gráfico de distribución de rarezas por tipo de sobre (barras o donut)
- Por ítem: pull rate oficial (si el fabricante lo publica) y pull rate empírico (calculado de aperturas reales)
- El pull rate empírico requiere mínimo 50 aperturas registradas; por debajo se muestra "datos insuficientes"
- Muestra prominentemente el nº de aperturas que contribuyen al cálculo
- Si el pull rate empírico difiere significativamente del oficial (>20%), se resalta el dato

### US-18 Estadísticas personales
**Como** usuario **quiero** ver un dashboard con mis estadísticas personales de coleccionista **para** entender mis hábitos y comparar mi suerte con la comunidad.

**Criterios de aceptación:**
- KPIs: total de aperturas, total de ítems únicos obtenidos, total de colecciones activas, total de transacciones completadas
- Comparativa de mis pull rates vs media de la comunidad por rareza (en las colecciones que más abro)
- Racha de suerte: % de raros y ultra-raros en mis últimas 20 aperturas vs media
- Gráfico de actividad mensual (aperturas + transacciones)
- Ítem más raro/valioso obtenido
- Colecciones más cerca de completar

### US-19 Leaderboards
**Como** usuario **quiero** ver rankings de la plataforma **para** compararme con la comunidad y encontrar traders activos.

**Criterios de aceptación:**
- Rankings: "Mejores coleccionistas" (colecciones completadas), "Más aperturas" (nº de sobres), "Traders de confianza" (más transacciones + mejor media de reviews)
- Filtro por colección específica para ver quién tiene el set más completo
- Se puede hacer clic en un perfil del ranking para ir a su perfil
- Los rankings se actualizan diariamente (no en tiempo real, para evitar gaming)
- El usuario puede ver su propia posición aunque esté fuera del top visible

---

## Epic 6 — Marketplace

### US-20 Publicar anuncio de venta
**Como** usuario **quiero** publicar uno o varios ítems de mi inventario en el marketplace para venderlos **para** sacar valor a mis duplicados.

**Criterios de aceptación:**
- Selecciono ítem(s) del inventario, cantidad a vender, condición, precio, descripción opcional
- Puedo añadir hasta 5 fotos adicionales al listing (el ítem ya tiene imagen de catálogo)
- El listing es visible en marketplace en menos de 1 minuto tras publicarse
- El ítem queda marcado como "En venta" en mi inventario; si se vende toda la cantidad, se marca como "Agotado"
- Puedo pausar o eliminar el listing en cualquier momento

### US-21 Publicar propuesta de intercambio
**Como** usuario **quiero** ofrecer un ítem mío a cambio de ítems concretos de otra colección **para** intercambiar sin usar dinero o complementando con una cantidad pequeña.

**Criterios de aceptación:**
- Especifico qué ítem ofrezco (de mi inventario) y qué ítems acepto a cambio (del catálogo)
- Opcionalmente puedo añadir o pedir compensación económica (diferencia de valor)
- El sistema muestra "matches potenciales": usuarios que tienen lo que busco y buscan lo que tengo
- El ítem queda marcado como "Para intercambio" en mi inventario

### US-22 Explorar marketplace
**Como** visitante **quiero** explorar los anuncios del marketplace y buscar ítems concretos **para** encontrar lo que necesito para completar mi colección.

**Criterios de aceptación:**
- Filtros: colección, ítem concreto, precio (rango), condición, tipo (venta / intercambio / ambos), país del vendedor
- Búsqueda por nombre de ítem con autocomplete del catálogo
- Ordenar por: precio más bajo, más reciente, mejor valorado (vendedor)
- Vista grid y lista; en lista se muestran datos de precio y vendedor sin abrir el listing
- Accesible sin registro para browsing; los CTAs de compra/oferta requieren login

### US-23 Hacer oferta o contrapropuesta
**Como** usuario **quiero** hacer una oferta diferente al precio publicado o proponer un intercambio en un listing **para** negociar con el vendedor.

**Criterios de aceptación:**
- Para listings de venta: puedo ofrecer un precio diferente + mensaje opcional
- Para listings de intercambio: selecciono qué ítems ofrezco de mi inventario + mensaje
- El vendedor recibe notificación in-app
- El vendedor puede: aceptar, rechazar (con motivo opcional) o contraofertar
- El comprador recibe notificación del resultado; si es rechazo puede hacer otra oferta
- Máximo 3 contraofertos por listing por usuario (evitar negociaciones infinitas)

### US-24 Chat de transacción
**Como** usuario **quiero** tener un chat privado con el otro usuario durante una transacción activa **para** coordinar el envío y resolver dudas.

**Criterios de aceptación:**
- Chat disponible una vez aceptada una oferta o acordado un precio
- Mensajes en tiempo real (WebSocket); si no hay conexión, se entrega al reconectar
- El historial del chat persiste asociado a la transacción
- Se pueden adjuntar imágenes (foto del embalaje, justificante de envío)
- Botón "Marcar como enviado" / "Marcar como recibido" dentro del chat

### US-25 Completar transacción y dejar review
**Como** usuario **quiero** marcar una transacción como completada y dejar una valoración al otro usuario **para** mantener la reputación de la comunidad.

**Criterios de aceptación:**
- Ambas partes deben marcar "Recibido/Completado" para cerrar la transacción
- Si solo una parte marca completado, el sistema envía recordatorio a la otra a las 48h; a los 7 días se cierra automáticamente
- Tras cierre: se habilita formulario de review (1-5 ★ + comentario de hasta 280 chars, obligatorio)
- La review es pública en el perfil del usuario valorado
- No se puede editar ni eliminar una review tras publicarla (solo admin puede moderar)
- Las reviews afectan directamente al "Reputation Score" del usuario

---

## Epic 7 — Social

### US-26 Seguir usuarios
**Como** usuario **quiero** seguir a otros coleccionistas **para** ver su actividad en mi feed.

**Criterios de aceptación:**
- Botón "Seguir" en perfiles públicos; no requiere aceptación
- Feed de inicio muestra actividad priorizada de seguidos
- Recibo notificación cuando alguien me sigue
- Puedo gestionar mis seguidos/seguidores desde mi perfil

### US-27 Compartir apertura
**Como** usuario **quiero** compartir el resultado de una apertura pública con un link o en redes sociales **para** celebrar mis mejores pulls con la comunidad.

**Criterios de aceptación:**
- URL permanente para cada apertura pública (eg. sobrebox.com/openings/uuid)
- Open Graph tags generados automáticamente: imagen con los ítems obtenidos, texto "¡@username abrió [tipo de sobre] y consiguió [ítem más raro]!"
- Imagen OG generada server-side (compatible con Discord, Twitter/X, WhatsApp)
- Botones de compartir rápido para Twitter/X, Discord, WhatsApp

---

## Epic 8 — Notificaciones

### US-28 Notificaciones in-app
**Como** usuario **quiero** recibir notificaciones de actividad relevante dentro de la plataforma **para** no perder oportunidades sin tener que estar mirando continuamente.

**Criterios de aceptación:**
- Badge numérico de no leídas en el icono de campana del header
- Tipos de notificación: oferta recibida, oferta aceptada/rechazada, transacción completada, review recibida, ítem de wishlist disponible en marketplace, colección enviada aprobada, nuevo seguidor, reacción en apertura pública
- Click en notificación navega al contexto relevante
- "Marcar todas como leídas" en un clic

### US-29 Preferencias de notificación por email
**Como** usuario **quiero** configurar qué notificaciones recibo también por email **para** no saturar mi bandeja de entrada.

**Criterios de aceptación:**
- Panel de preferencias con toggle por categoría: actividad de marketplace, actividad social, sistema y alertas
- Se puede desactivar el email completamente (solo notificaciones in-app)
- Los emails de sistema (verificación, recuperación de contraseña, cierre de transacción automático) no son desactivables
- Los emails respetan las preferencias de idioma de la cuenta

---

## Resumen por épica

| Epic | Stories | Prioridad MVP |
|------|---------|---------------|
| 1 · Auth & Perfil | US-01 a US-04 | 🔴 Crítico |
| 2 · Catálogo | US-05 a US-09 | 🔴 Crítico |
| 3 · Apertura | US-10 a US-13 | 🔴 Crítico |
| 4 · Inventario | US-14 a US-16 | 🔴 Crítico |
| 5 · Estadísticas | US-17 a US-19 | 🟡 Alta |
| 6 · Marketplace | US-20 a US-25 | 🟡 Alta |
| 7 · Social | US-26 a US-27 | 🟢 Media |
| 8 · Notificaciones | US-28 a US-29 | 🟢 Media |
