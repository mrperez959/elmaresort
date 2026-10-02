# Reservas directas: Next.js + Hospitable + Square

Web de reservas directas para una propiedad. El calendario, los precios y
las reservas viven en Hospitable, así que todo queda sincronizado con
Airbnb y Vrbo. El cobro lo hace Square, con el formulario de tarjeta
incrustado en la página (Web Payments SDK).

## Cómo funciona

Todo pasa en una sola petición a `/api/book`:

1. El servidor recalcula el precio con datos frescos de Hospitable. Si el total cambió desde que el huésped lo vio, no cobra nada y le muestra el nuevo total.
2. Square **autoriza** la tarjeta sin cobrarla (`autocomplete: false`).
3. Se crea la reserva manual en Hospitable.
4. Si Hospitable la acepta, se **captura** el pago y las fechas se bloquean en Airbnb y Vrbo.

Si algo falla después del paso 2 (fechas tomadas por otro canal, error de Hospitable), la autorización se anula y el huésped no paga nada. Si el servidor se cae a la mitad, Square anula la autorización por su cuenta a los 30 minutos (`delayAction: CANCEL`).

A diferencia de la versión con Stripe, no hace falta webhook.

## Requisitos

- Plan pago de Hospitable (Host, Professional o Mogul). El plan Essentials no tiene acceso a la API.
- Cuenta de vendedor de Square **aprobada** para pagos en línea y una app en developer.squareup.com.
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

**Precios:** se usan los precios por noche del calendario de Hospitable. Si allí tienes markups por plataforma, la web muestra el precio base, más barato que en Airbnb.

**Impuestos (`TAX_RATE_PERCENT`):** pon el porcentaje total que corresponde a tu propiedad (sales tax de Florida, surtax del condado y Tourist Development Tax). Confírmalo con el Florida Department of Revenue y el Hillsborough County Tax Collector. En estas reservas no hay Airbnb que recaude por ti, así que tú declaras y pagas esos impuestos.

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
- [ ] Mínimo de noches, días cerrados para check-in y límite de huéspedes.

## Fotos y textos de la propiedad

Las fotos están en `public/photos/` en WebP, en dos tamaños (`nombre.webp` de 1600 px y `nombre-sm.webp` de 720 px). El orden, las descripciones y la lista de amenidades se editan en `lib/property.ts`; la primera foto es la grande. Revisa que cada amenidad sea cierta antes de publicar.

Para agregar una foto nueva, conviértela con cualquier herramienta a WebP en esos dos tamaños, ponla en `public/photos/` y agrégala a la lista.

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
| `lib/square.ts` | Cliente de Square y mensajes de tarjeta rechazada |
| `components/SquareCard.tsx` | Formulario de tarjeta de Square |
| `components/BookingWidget.tsx` | Calendario, resumen y pago |

El SDK `hospitable` (npm) es de la comunidad, no oficial. Está fijado en la versión 0.7.3. Si Hospitable cambia su API, revisa `lib/hospitable.ts` y `lib/booking.ts` contra developer.hospitable.com.
