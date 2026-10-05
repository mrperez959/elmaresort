# Elma Resort: web de reservas directas

Next.js + Postgres + Square. La disponibilidad sale de los calendarios de
Airbnb y Vrbo (enlaces iCal), así que funciona con cualquier plan de
Hospitable, sin API. Los precios, tarifas, descuentos y reseñas se manejan
desde el panel `/admin`. Los huéspedes crean una cuenta para reservar y ven
sus viajes en `/account`.

## Cómo funciona el calendario

**Entrada (Airbnb y Vrbo → web):** en `/admin`, en *Calendars*, pegas los enlaces de exportación (.ics) de Airbnb y de Vrbo. Las noches ocupadas en cualquiera de ellos aparecen como reservadas en la web. Se leen de nuevo cada 5 minutos, y siempre justo antes de cobrar.

- **Airbnb:** Anuncio → Disponibilidad → Conectar calendarios → Conectar con otro sitio web → copiar el enlace.
- **Vrbo:** Calendario → Importar/Exportar → Exportar → copiar el enlace.

**Salida (web → Airbnb y Vrbo):** arriba de `/admin` está el enlace del calendario de la web. Pégalo **una vez** en Airbnb (*Importar calendario*) y en Vrbo (*Importar*). Cada reserva hecha en la web bloquea esas fechas allá.

**Límite importante:** Airbnb y Vrbo vuelven a leer ese enlace cada pocas horas, no al instante. Cuando entre una reserva directa (aparece en `/admin`), bloquea las fechas en Hospitable de inmediato para evitar una doble reserva en ese intervalo. En la otra dirección no hay problema: la web revisa Airbnb y Vrbo justo antes de cobrar.

**Doble reserva dentro de la web:** la base de datos rechaza dos reservas confirmadas que se crucen, aunque dos personas paguen en el mismo segundo.

## Precio en dos pasos

1. **Calendario:** al elegir fechas, el huésped ve en grande el **total antes de impuestos**: noches, descuentos, limpieza y mascota, con cada línea debajo. Un aviso indica que los impuestos de Florida se agregan en el siguiente paso.
2. **Checkout (`/checkout`):** muestra la factura completa. Primero el total antes de impuestos, luego cada impuesto en su línea (por ejemplo sales tax de Florida, surtax del condado y Tourist Development Tax) y al final el **total a pagar**. Aquí se inicia sesión y se paga.

La limpieza va incluida desde el primer paso a propósito. La regla de la FTC sobre cargos ocultos (vigente desde mayo de 2025) obliga a mostrar desde el principio el total con los cargos obligatorios, y menciona la limpieza de alquileres vacacionales como ejemplo. Solo los impuestos del gobierno pueden agregarse después, siempre antes de pedir el pago.

Después de pagar, el huésped ve su recibo, que también queda guardado en `/account`.

## Cómo funciona el pago

Todo pasa en una sola petición a `/api/book`:

1. El huésped tiene que haber iniciado sesión.
2. Se revisan de nuevo los calendarios y se recalcula el precio. Si el total cambió, no se cobra nada.
3. Square **autoriza** la tarjeta sin cobrarla.
4. Se guarda la reserva. Si las fechas ya no están libres, se anula la autorización.
5. Se **captura** el pago.

Si algo falla después del paso 3, la autorización se anula y el huésped no paga nada. Si el servidor se cae a la mitad, Square la anula solo a los 30 minutos.

## Políticas de cancelación

Son las mismas cuatro de Airbnb y se eligen en `/admin`. Elige la misma que usas en Airbnb:

| Política | Reembolso completo | Después |
| --- | --- | --- |
| Flexible | hasta 24 h antes del check-in | no se devuelve la primera noche |
| Moderate | hasta 5 días antes | no se devuelve la primera noche y del resto se devuelve el 50% |
| Limited | hasta 14 días antes | 50% de las noches hasta 7 días antes; luego nada |
| Firm | hasta 30 días antes | 50% de las noches hasta 7 días antes; luego nada |

Reglas comunes a todas:

- **Período de gracia, como en Airbnb:** reembolso completo si se cancela dentro de las 24 h siguientes a reservar, siempre que falten al menos 7 días para el check-in.
- **Tarifas:** la limpieza y la mascota siempre se devuelven si se cancela antes del check-in, con sus impuestos.
- **Plazos:** cuentan desde la hora de check-in configurada.
- **Reservas existentes:** cada reserva guarda la política vigente al momento de reservar, así que cambiar la política no afecta a las reservas que ya existen.

## Panel del huésped (`/account`)

El huésped ve sus viajes próximos, pasados y cancelados. En cada viaje (`/account/trips/<código>`) puede:

- **Ver el recibo y la política**, con fechas concretas ("reembolso completo si cancelas antes del…").
- **Cambiar fechas o número de huéspedes y mascotas:** ve el precio nuevo antes de confirmar.
  - Si sube, paga la diferencia con tarjeta.
  - Si baja, se le devuelve lo que permite la política sobre la parte que quitó (las tarifas que se eliminan siempre se devuelven).
- **Cancelar:** ve exactamente cuánto recibirá antes de confirmar, y el reembolso va automático a su tarjeta por Square.

Los cambios y cancelaciones solo se pueden hacer antes de la hora de check-in. Después de eso, el huésped tiene que escribirte.

En `/admin`, cada reserva tiene dos opciones: **Cancel (policy)**, que reembolsa según la política, y **Cancel (full refund)**, que lo devuelve todo.

Si Square falla al reembolsar, la reserva queda cancelada y el huésped ve un mensaje de que le enviarás el reembolso. En ese caso, haz el reembolso desde el Dashboard de Square.

## Botón de chat

Es un botón flotante en todas las páginas, excepto `/admin`. A los pocos segundos de entrar muestra el mensaje "Ready for a little waterfront getaway? 🌴". Al abrirlo, el huésped escribe su mensaje y lo envía por **WhatsApp**, **SMS** o **email**, con el texto ya escrito.

Los números y el email se configuran en `/admin` → *Chat button*. Si están vacíos, el botón no aparece.

## Métricas (`/admin/analytics`)

La analítica es propia: los datos se guardan en tu misma base de datos, sin Google Analytics, sin cookies de terceros y sin guardar direcciones IP. El panel muestra:

- **Resumen:** visitantes, visitas, páginas vistas, tiempo promedio en el sitio, reservas, ingresos y **tasa de conversión** (visitas que terminaron en reserva).
- **Visitantes por día:** los días con reserva salen en coral.
- **Embudo:** visitó → abrió las fotos → eligió fechas → fue al checkout → creó cuenta → reservó, con el porcentaje de cada paso.
- **Fotos:** cuántos abren el visor, cuánto tiempo se quedan y el tiempo en cada foto.
- **País y estado** (EE. UU.), según la conexión del visitante (dato aproximado de Vercel).
- **De dónde vienen:** Google, Instagram, directo… y **campañas** con su conversión e ingresos.
- **Dispositivos:** móvil, escritorio o tablet.

**Campañas:** en el enlace de cada anuncio agrega `?utm_source=facebook&utm_medium=paid&utm_campaign=nombre`. Cada campaña aparece en su propia fila.

**Detalles:**
- No se cuentan los bots ni tus propias visitas mientras tengas abierta la sesión de admin.
- Los datos de más de unos 13 meses se borran solos.

## Panel de admin (`/admin`)

Se entra con `ADMIN_PASSWORD`. Contiene:

- **Connections:** estado de cada calendario, de Square, del impuesto y de las reseñas. Si el calendario de la web no muestra fechas, empieza por aquí.
- **Enlace del calendario de la web**, para importarlo en Airbnb y Vrbo.
- **Calendars:** enlaces de Airbnb y Vrbo y el mínimo de noches.
- **Precio por noche:** el de entre semana, el aumento de fin de semana y qué noches cuentan como fin de semana.
- **Tarifas:** limpieza y mascota (por estadía).
- **Descuentos:** semanal y mensual (no se suman entre sí; aplica el más largo) y el de reserva directa, con interruptor. Los descuentos aplican solo a las noches.
- **Límites:** huéspedes, mascotas y noches máximas.
- **Impuestos de Florida:** una línea por impuesto, con nombre y porcentaje. Se cobran sobre noches, limpieza y mascota. Mientras no los guardes, **la reserva en línea está cerrada**. Si de verdad no cobras impuestos, borra todas las líneas y guarda.
- **Reseñas:** calificación general y reseñas individuales (ver abajo).
- **Reservas directas:** la lista de las hechas en la web.

## Reseñas

Sin la API de Hospitable no se pueden leer automáticamente, así que se manejan en `/admin`:

- **Resumen:** copia de tu anuncio la calificación general y el número de reseñas.
- **Reseñas individuales:** agrégalas pegando el texto tal como lo escribió el huésped.

Agrega las recientes a medida que llegan, no solo las mejores. Presentar solo las buenas como si fueran todas va contra la regla de la FTC sobre reseñas.

## Cuentas de huéspedes y seguridad

**Cuentas:**
- **Registro:** nombre, celular (se guarda en formato internacional, por ejemplo +18135550100), email y contraseña de 10 caracteres o más, guardada cifrada con scrypt.
- **Email verificado:** al registrarse llega un **código de 6 dígitos** por email. Sin confirmarlo no se puede pagar, ni cambiar o cancelar viajes. El código vence en 15 minutos, admite 5 intentos y se guarda cifrado.
- **¿Olvidaste tu contraseña?:** se recupera con un código por email. Al cambiarla se cierran las sesiones en todos los demás dispositivos.

**Panel de admin:** contraseña y, si pones `ADMIN_2FA=on`, también un código enviado a `ADMIN_EMAIL`. Actívalo solo cuando el correo funcione (Connections → Email en verde), para no quedarte fuera. A `ADMIN_EMAIL` llega además un aviso por cada reserva directa, para que bloquees las fechas en Hospitable enseguida.

**Protecciones:**
- **Inyección SQL:** todas las consultas usan parámetros (`$1, $2…`) y ningún dato del usuario se pega dentro del SQL.
- **Ataques desde otros sitios (CSRF):** la API solo acepta JSON desde el mismo dominio, y las cookies son `HttpOnly`, `Secure` y `SameSite=Lax`.
- **XSS:** React escapa todo el texto y no se inserta HTML de usuarios.
- **Límites de intentos en la base de datos** (sirven aunque haya varios servidores):
  - inicio de sesión: 8 cada 15 min por email;
  - registros: 5 por hora por IP;
  - códigos: 1 por minuto y 5 por hora;
  - **pagos: 6 por hora por cuenta y 15 por IP**, contra el "card testing" (probar tarjetas robadas);
  - cálculos de precio y disponibilidad.
- **Bots:** un campo oculto en el registro los atrapa.
- **Encabezados de seguridad:** HSTS, prohibición de mostrar la web dentro de otra (clickjacking), `nosniff` y Referrer-Policy. Las páginas privadas no se guardan en caché.
- **Pagos:** los datos de la tarjeta nunca pasan por nuestro servidor (los maneja Square). Square aplica 3-D Secure, CVV y verificación del código postal.

## Dirección y mapa

- **Mapa público:** la portada muestra solo la **zona aproximada** (`/admin` → *Area shown on the public map*).
- **Dirección exacta e instrucciones de llegada:** se guardan en la base de datos, nunca en el código ni en GitHub, y solo aparecen en la página del viaje del huésped **desde el día del check-in hasta el de salida**. El email de confirmación tampoco las incluye.

## Configuración

```bash
npm install
cp .env.example .env.local   # y completa los valores
npm run dev
```

**Base de datos:** en Vercel ve a *Storage → Create Database → Neon* y conéctala al proyecto; `DATABASE_URL` se agrega sola. Las tablas se crean y actualizan automáticamente. En local sirve cualquier Postgres 13 o superior.

**Email:** con Gmail, activa la verificación en 2 pasos de tu cuenta de Google, crea una "contraseña de aplicación" en myaccount.google.com/apppasswords y ponla en `SMTP_PASS`. El resto de valores está en `.env.example`. Más adelante, con un dominio propio, conviene un servicio como Resend o Postmark, que también funcionan por SMTP.

**Seguridad:** genera `SESSION_SECRET` con `openssl rand -base64 48` y elige una `ADMIN_PASSWORD` larga. Si cambias `SESSION_SECRET`, se cierran las sesiones **y cambia el enlace del calendario de la web**, así que tendrías que volver a importarlo en Airbnb y Vrbo.

**Square:** en developer.squareup.com crea una aplicación y copia el Access token, el Application ID y el Location ID. Empieza con Sandbox (tarjeta de prueba `4111 1111 1111 1111`, ZIP `94103`).

**Impuestos:** en `/admin` vienen sugeridas tres líneas sin porcentaje (sales tax de Florida, surtax del condado y Tourist Development Tax); llénalas con las tasas de tu condado. Confírmalo con el Florida Department of Revenue y el Hillsborough County Tax Collector. En estas reservas tú declaras y pagas esos impuestos.

## Lista de pruebas antes de pasar a producción

- [ ] Connections en verde para calendarios, Square, Email e impuestos.
- [ ] Crear una cuenta: llega el código, se confirma y luego se puede pagar.
- [ ] "Forgot your password?" funciona.
- [ ] Con `ADMIN_2FA=on`, entrar a `/admin` pide el código enviado a `ADMIN_EMAIL`.
- [ ] Una noche reservada en Airbnb aparece tachada en la web en menos de 5 minutos.
- [ ] Una reserva de prueba en la web aparece en `/admin`, en `/account` del huésped y, horas después, bloqueada en Airbnb y Vrbo.
- [ ] Tarjeta rechazada: mensaje claro y ninguna reserva creada.
- [ ] Apagar el descuento directo en `/admin`: desaparece del total.

## Diseño

- **Logo:** está en `public/logo-*.webp|png`. El favicon (`app/icon.png`) usa las palmas y el sol.
- **Colores** (variables al inicio de `app/globals.css`): azul marino `#01325B`, azul océano `#035B89`, coral `#FE6B51` y naranja atardecer `#FE8D50`.
- **Tipografía:** títulos en Cormorant Garamond, a juego con el logo, y texto en Atkinson Hyperlegible.
- **Fotos y amenidades:** se editan en `lib/property.ts` y `public/photos/`.

## Archivos clave

| Archivo | Qué hace |
| --- | --- |
| `lib/ical.ts` | Lee los calendarios de Airbnb y Vrbo |
| `lib/availability.ts` | Junta esos calendarios con las reservas directas |
| `lib/calendar-export.ts` | Calendario de la web para Airbnb y Vrbo |
| `lib/booking.ts` | Autorizar, guardar la reserva y capturar o anular el pago |
| `lib/quote.ts`, `lib/pricing.ts` | Reglas y cálculo del total |
| `lib/settings.ts` | Configuración de `/admin` |
| `lib/auth.ts`, `lib/users.ts` | Cuentas, sesiones y reservas guardadas |
| `components/Admin.tsx` | Panel de admin |
