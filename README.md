# Reservas directas: Next.js + Hospitable + Square

Web de reservas directas para una propiedad. La disponibilidad y las
reservas viven en Hospitable, así que todo queda sincronizado con Airbnb y
Vrbo. Los precios, tarifas y descuentos se manejan desde el panel `/admin`.
El cobro lo hace Square, con el formulario de tarjeta incrustado en la
página (Web Payments SDK). Los huéspedes crean una cuenta para reservar y
ven sus viajes en `/account`.

## Cómo funciona

Todo pasa en una sola petición a `/api/book`:

0. El huésped tiene que haber iniciado sesión.
1. El servidor recalcula el precio con la disponibilidad fresca de Hospitable y las reglas de `/admin`. Si el total cambió desde que el huésped lo vio, no cobra nada y le muestra el nuevo total.
2. Square **autoriza** la tarjeta sin cobrarla (`autocomplete: false`).
3. Se crea la reserva manual en Hospitable.
4. Si Hospitable la acepta, se **captura** el pago y las fechas se bloquean en Airbnb y Vrbo.

Si algo falla después del paso 2 (fechas tomadas por otro canal, error de Hospitable), la autorización se anula y el huésped no paga nada. Si el servidor se cae a la mitad, Square anula la autorización por su cuenta a los 30 minutos (`delayAction: CANCEL`).

Al confirmarse, la reserva también se guarda en la base de datos: aparece en la cuenta del huésped y en el panel de admin.

## Precios y panel de admin

Entra a `/admin` con la contraseña `ADMIN_PASSWORD`. Desde ahí cambias, sin tocar código:

- **Precio por noche:** el de entre semana, el porcentaje de aumento y qué noches cuentan como fin de semana (por defecto viernes y sábado: $300 y $411).
- **Tarifas:** limpieza ($175) y mascota ($20 por estadía, sin importar cuántas mascotas).
- **Descuentos:** semanal (10% desde 7 noches), mensual (18% desde 28 noches) y el de reserva directa (5%), que se activa y desactiva con un interruptor.
- **Límites:** máximo de huéspedes (10, sin contar bebés), de mascotas (2) y de noches.
- **Impuesto:** mientras esté vacío, **la reserva en línea está cerrada**. Escribe 0 solo si de verdad no cobras impuestos.

Cómo se calcula el total:

1. Se suman las noches, a precio normal o de fin de semana.
2. Se aplica el descuento semanal o el mensual. No se suman: aplica el más largo.
3. Sobre eso se aplica el descuento por reserva directa.
4. Se agregan la limpieza y la tarifa de mascota. Los descuentos no tocan las tarifas.
5. El impuesto se calcula sobre noches más tarifas.

Los precios por noche que tengas en Hospitable ya **no** se usan en la web; de Hospitable solo se toman la disponibilidad, el mínimo de noches y los días cerrados para entrar o salir. Los cambios del panel tardan como máximo 15 segundos en verse en la web.

## Cuentas de huéspedes

Los huéspedes crean su cuenta con nombre, teléfono, email y contraseña, desde el mismo panel de reserva o en `/account`. Las contraseñas se guardan cifradas (scrypt) y la sesión dura 30 días. La sesión de admin es independiente y dura 12 horas.

Todavía no hay recuperación de contraseña, porque necesita un servicio de envío de emails (por ejemplo Resend). Mientras tanto, si alguien olvida la suya, puedes borrar su cuenta en la base de datos para que la cree de nuevo, siempre que no tenga reservas.

## Requisitos

- Plan pago de Hospitable (Host, Professional o Mogul). El plan Essentials no tiene acceso a la API.
- Cuenta de vendedor de Square **aprobada** para pagos en línea y una app en developer.squareup.com.
- Una base de datos Postgres. En Vercel, la de Neon (plan gratis) es la más sencilla.
- Node 20 o superior.

## Configuración

```bash
npm install
cp .env.example .env.local   # y completa los valores
```

**Hospitable:** en my.hospitable.com ve a Apps → API access → Access tokens y crea un token con lectura y escritura. Dura un año, así que anota cuándo vence. Para obtener el ID de la propiedad:

```bash
curl -s -H "Authorization: Bearer TU_TOKEN" \
  https://public.api.hospitable.com/v2/properties | python3 -m json.tool | grep -E '"(id|name)"'
```

**Square:** en developer.squareup.com crea una aplicación. En *Credentials* copia el Application ID y el Access token; en *Locations*, el Location ID. Empieza con las credenciales de **Sandbox** y `NEXT_PUBLIC_SQUARE_ENVIRONMENT=sandbox`. El Location ID tiene que ser el mismo en el formulario y en el cobro; si no coinciden, Square rechaza los pagos con verificación.

**Base de datos:** en Vercel ve a *Storage → Create Database → Neon* y conéctala al proyecto; `DATABASE_URL` se agrega sola. Las tablas se crean automáticamente la primera vez que se usan. En local sirve cualquier Postgres 13 o superior.

**Seguridad:** genera `SESSION_SECRET` con `openssl rand -base64 48` y elige una `ADMIN_PASSWORD` larga. Si cambias `SESSION_SECRET`, se cierran todas las sesiones.

**Impuestos:** en `/admin`, pon el porcentaje total que corresponde a tu propiedad (sales tax de Florida, surtax del condado y Tourist Development Tax). Confírmalo con el Florida Department of Revenue y el Hillsborough County Tax Collector. En estas reservas no hay Airbnb que recaude por ti, así que tú declaras y pagas esos impuestos.

## Probar

```bash
npm run dev
```

En Sandbox usa la tarjeta de prueba de Square `4111 1111 1111 1111`, con cualquier fecha futura, cualquier CVV y el ZIP `94103`. Square tiene más números de prueba (rechazos, verificación 3-D Secure) en su documentación de Sandbox.

**Ojo:** aunque Square esté en Sandbox, las reservas se crean en tu Hospitable real y bloquean fechas reales. Prueba con fechas lejanas y cancela la reserva después en Hospitable.

Lista de pruebas antes de publicar:

- [ ] Reservar 2 noches libres. La reserva aparece en Hospitable, el pago sale *Completed* en el Sandbox de Square y las fechas se bloquean en Airbnb.
- [ ] Conflicto: llena el formulario, bloquea esas fechas en Hospitable y luego paga. Debe salir el aviso de fechas tomadas y el pago debe quedar *Canceled* en Square.
- [ ] Tarjeta rechazada (número de prueba de rechazo). Sale un mensaje claro y no se crea reserva.
- [ ] Mínimo de noches, días cerrados para check-in, límite de huéspedes y de mascotas.
- [ ] En `/admin` apaga el descuento directo: debe desaparecer del panel de reserva y del total.
- [ ] Crear cuenta, cerrar sesión y volver a entrar. La reserva de prueba debe aparecer en `/account`.

## Fotos y textos de la propiedad

Las fotos están en `public/photos/` en WebP, en dos tamaños (`nombre.webp` de 1600 px y `nombre-sm.webp` de 720 px). El orden, las descripciones y la lista de amenidades se editan en `lib/property.ts`; la primera foto es la grande. Revisa que cada amenidad sea cierta antes de publicar.

Para agregar una foto nueva, conviértela con cualquier herramienta a WebP en esos dos tamaños, ponla en `public/photos/` y agrégala a la lista.

## Estado de las conexiones

Arriba del panel `/admin` hay una sección **Connections** que revisa, cada vez que abres el panel:

- **Hospitable:** si el token sirve, si el ID de la propiedad existe (si no existe, te muestra la lista de tus propiedades con su ID correcto) y cuántas noches abiertas hay en los próximos 60 días.
- **Square:** si están las tres variables.
- **Impuesto:** si ya lo configuraste.
- **Reseñas:** si cargaron.

Si el calendario de la web no deja seleccionar fechas, empieza por aquí.

## Reseñas

La sección "What guests say" muestra las reseñas reales de tu propiedad en todas las plataformas conectadas a Hospitable (Airbnb, Vrbo, etc.), sin escribir nada a mano:

- **Promedio y total:** se calculan con **todas** las reseñas.
- **Tarjetas:** muestran las más recientes que tengan texto, sin filtrar por estrellas. Mostrar solo las buenas y presentarlas como si fueran todas va contra la regla de la FTC sobre reseñas de consumidores.
- **Nombres:** se muestra el nombre y la inicial del apellido.
- **Actualización:** se refrescan cada hora.

Si Hospitable no responde o todavía no hay reseñas, la sección no aparece.

## Iconos

Las amenidades usan iconos de [Lucide](https://lucide.dev). Cada amenidad en `lib/property.ts` tiene un `icon`, y la correspondencia con el icono está en `components/Amenities.tsx`. Las líneas "Sleeps 10" y "Pet friendly" salen de la configuración de `/admin`.

## Dominio de prueba

Vercel da gratis un subdominio con HTTPS, por ejemplo `elmaresort.vercel.app` (el nombre se elige en *Settings → Domains*). Square funciona ahí en Sandbox sin configurar nada más. Cuando compres el dominio definitivo, se agrega en esa misma pantalla.

## Publicar (Vercel)

1. Sube el repo a GitHub e impórtalo en Vercel.
2. Copia las variables de `.env.example` en *Settings → Environment Variables*.
3. Cuando todo pase en Sandbox, cambia a las credenciales de **Production** de Square y pon `NEXT_PUBLIC_SQUARE_ENVIRONMENT=production`. Las variables `NEXT_PUBLIC_*` se incluyen al compilar, así que vuelve a desplegar después de cambiarlas.
4. Haz una reserva real pequeña y reembólsala desde Square para confirmar que todo funciona en producción.

## Lo que no hace (todavía)

- **Cancelaciones y reembolsos son manuales:** se reembolsa en el Dashboard de Square y se cancela la reserva en Hospitable.
- **No cobra depósito por daños.**
- **No envía recibo propio.** Activa los recibos por email en tu cuenta de Square si los quieres, y usa las automatizaciones de mensajes de Hospitable para el check-in.
- **Los textos de la web están en inglés.** Se editan en `components/`.

## Archivos clave

| Archivo | Qué hace |
| --- | --- |
| `lib/booking.ts` | Autorizar, reservar en Hospitable y capturar o anular el pago |
| `lib/quote.ts` | Reglas (disponibilidad, mínimo de noches, huéspedes) y cálculo del total |
| `lib/settings.ts` | Valores por defecto y validación de la configuración de `/admin` |
| `lib/auth.ts`, `lib/users.ts` | Cuentas, contraseñas, sesiones y reservas guardadas |
| `components/Admin.tsx` | Panel de configuración |
| `lib/square.ts` | Cliente de Square y mensajes de tarjeta rechazada |
| `components/SquareCard.tsx` | Formulario de tarjeta de Square |
| `components/BookingWidget.tsx` | Calendario, resumen y pago |

El SDK `hospitable` (npm) es de la comunidad, no oficial. Está fijado en la versión 0.7.3. Si Hospitable cambia su API, revisa `lib/hospitable.ts` y `lib/booking.ts` contra developer.hospitable.com.
