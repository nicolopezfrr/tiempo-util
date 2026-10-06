# Tiempo útil

App privada para tres hermanos (Nico, Alex y Jacobo) que registra el tiempo dedicado cada día a actividades productivas, con un mínimo diario, rachas y multas simbólicas. Sustituye a un grupo de WhatsApp donde lo hacíamos a mano.

Principio que manda sobre todo lo demás: **simple y sin fricción**. Registrar tiene que costar segundos. Ante la duda, no añadir.

## Cómo está montado

- La app es un solo archivo: `index.html` (HTML + CSS + JS en módulo). Sin build, sin npm, sin frameworks.
- Archivos de apoyo, que existen porque una función los exige:
  - `manifest.json` + `icon-180.png`, `icon-192.png`, `icon-512.png`: app instalable (PWA). Nombre e icono provisionales.
  - `firebase-messaging-sw.js`: service worker de las notificaciones (muestra los avisos con la app cerrada).
  - `.github/workflows/buenos-dias.yml` + `.github/scripts/buenos-dias.mjs`: tarea programada de GitHub Actions que envía el mensaje de las 6:00 con Firebase Cloud Messaging. Aquí sí se usa npm (`firebase-admin`), pero solo dentro de la tarea, no en la app.
- Notificaciones (Firebase Cloud Messaging, gratis en Spark):
  - `VAPID_KEY` en `index.html`: clave pública de Firebase → Configuración del proyecto → Cloud Messaging → Certificados push web. No es secreta. Mientras esté vacía, Ajustes muestra "Todavía no están configuradas".
  - Secreto de GitHub `FIREBASE_SERVICE_ACCOUNT`: el JSON de una cuenta de servicio de Firebase, para que la tarea programada lea Firestore y envíe. Este sí es secreto: nunca en el repo.
  - La tarea se lanza a las 04:03 y 05:03 UTC y solo envía la primera vez que en España son entre las 6:00 y las 8:59 (cubre horario de verano e invierno). Apunta el día enviado en `config/push`. Se puede lanzar a mano desde Actions → "Buenos días" → Run workflow (modo prueba: envía ya).
- Hosting: GitHub Pages desde la rama `main`, carpeta raíz. URL: https://nicolopezfrr.github.io/tiempo-util/
- Datos y login: Firebase (proyecto `tiempo-util`), plan gratuito Spark.
  - Firestore como base de datos.
  - Authentication con Google.
  - SDK cargado desde `https://www.gstatic.com/firebasejs/10.12.2/...`
- La `firebaseConfig` del `index.html` es pública a propósito (las claves web de Firebase no son secretas). GitHub la marca como "secret detected": es un falso positivo.
- La seguridad está en las reglas de Firestore, que se editan en la consola de Firebase (no están en este repo). Solo permiten leer y escribir a tres emails de Google concretos con `email_verified`. No pongas los emails en el repositorio, que es público.
- Plan Spark: no hay Cloud Functions ni Cloud Storage. No propongas nada que requiera el plan Blaze (de pago) sin avisar antes.
- Uso mayoritario desde el móvil. Diseñar primero para móvil (ancho ~380 px).

## Reglas del juego (no cambiar sin que lo pida el usuario)

- **Día:** de 00:00 a 23:59 en hora de España (`Europe/Madrid`), para los tres. Nico vive en Monterrey pero se adapta a la hora española. **A partir del 22 de diciembre de 2026 Nico vuelve a España:** desde esa fecha hay que olvidarse de Monterrey y se puede borrar cualquier mención a ello (aquí y en la app).
- **Registro:** solo se puede añadir actividad al día en curso. Por intervalo ("de 17:00 a 18:30"), por minutos o con el cronómetro.
- **Corregir:** cada uno puede editar o borrar sus propias actividades de cualquier día desde el historial, pero solo a la baja (acortar el intervalo o bajar los minutos; categoría y nota sí se pueden cambiar). Si un día cerrado deja de llegar al mínimo, aparece su multa, se rompe la racha y pueden subir las multas de los días siguientes que también fallaron (cuentan como fallos seguidos). Antes de guardar se avisa con la multa nueva y cuánto suben las siguientes. Una corrección nunca puede quitar ni bajar una multa.
- **Cronómetro y medianoche:** si el cronómetro sigue en marcha al cambiar de día, al terminar solo se registra el tramo desde las 00:00 del día en curso; lo anterior se pierde (el día ya está cerrado).
- **Categorías:** Estudio, Deberes y trabajos, Lectura, Escritura, Deporte (el gimnasio NO cuenta, los tres van), Otro (nota obligatoria). Todas cuentan igual.
- **Mínimo diario:** individual, con un valor de lunes a viernes y otro de sábado y domingo. Cada uno lo cambia cuando quiere, pero el cambio se aplica **desde el día siguiente** (para que nadie se lo baje a última hora). Los días pasados se evalúan con el mínimo vigente ese día.
  - Iniciales: Nico 1 h todos los días; Alex y Jacobo 1 h 30 entre semana y 1 h el fin de semana.
- **Multa:** 1 € el primer fallo, +0,50 € por cada fallo consecutivo, tope 3 €. Al tope se sigue pagando 3 € por día fallado. En cuanto se cumple un día, vuelve a empezar en 1 €.
- **Reparto:** cada multa se reparte a medias entre los otros dos hermanos (no hay bote común).
- **Racha:** días seguidos cumpliendo el mínimo. Se rompe con un solo fallo. Sin comodines ni días libres. Hoy suma en cuanto se alcanza el mínimo.
- **Inicio de la cuenta:** `config/main.startDate`. Antes de esa fecha no hay multas ni rachas.
- **Cierre del día:** no hay servidor. Las multas se calculan en el cliente al abrir la app, recorriendo los días cerrados. Si alguien no abre la app un día, se le multa igual.

## Modelo de datos (Firestore)

- `config/main` → `{ startDate: "YYYY-MM-DD" }`
- `days/{persona}_{fecha}` → `{ person, date, entries: [{ id, category, minutes, start, end, note, createdAt, editedAt? }], total }`. `editedAt` solo existe si la actividad se ha corregido.
- `minimums/{id}` → `{ person, weekday, weekend, effectiveFrom, createdAt }` (minutos). Histórico: nunca se sobrescribe, se añade uno nuevo.
- `settlements/{id}` → `{ from, to, amount, date, createdAt, by }`. Pagos reales marcados con "Marcar pagado".
- `tokens/{token}` → `{ person, token, createdAt, device }`. Un documento por dispositivo con notificaciones activadas. Lo crea y renueva la app; la tarea programada borra los que caducan. Las reglas de Firestore deben permitir esta colección a los tres.
- `config/push` → `{ lastMorning: "YYYY-MM-DD" }`. Lo escribe solo la tarea programada para no enviar dos veces el mismo día.

Las multas no se guardan: se derivan siempre de `days` + `minimums`. Los saldos son multas menos pagos.

En el dispositivo, `localStorage["tiempoutil.me"]` guarda qué hermano es (se elige una vez) y `localStorage["tiempoutil.push"]` guarda el token de notificaciones del dispositivo, y `localStorage["tiempoutil.timer"]` guarda el cronómetro en marcha como `{ person, start, cat }` (`start` en milisegundos, `cat` es la categoría elegida al empezar). No va a Firestore: solo se ve en el dispositivo donde se empezó, y sigue contando aunque se cierre la app porque el tiempo se calcula desde `start`.

## Pantallas actuales

Barra inferior con cuatro pestañas:
1. **Hoy:** progreso frente al mínimo, botones "Empiezo ahora" (cronómetro: se elige la categoría con un toque y arranca; al tocar "Termino" abre "Añadir actividad" con las horas y la categoría puestas) y "Añadir actividad", bloques de hoy (editar ✎ y borrar ×), enlace al historial, estado de los otros dos.
2. **Multas:** saldo de cada uno, quién debe a quién con "Marcar pagado", totales históricos, movimientos.
3. **Estadísticas:** semana (gráfica), ranking (semana/mes/total), rachas, categorías.
4. **Ajustes:** mi mínimo, mínimos de todos, historial de cambios, mis actividades (subpantalla "Historial": todas mis actividades por día, con editar a la baja y borrar), notificaciones (activar o desactivar en este dispositivo; en iPhone explica que hay que añadirla a la pantalla de inicio), exportar/importar (JSON y CSV), cambiar persona, cerrar sesión.

## Cómo trabajar en este repo

- Mantener todo en `index.html` salvo que una función lo exija (por ejemplo, el service worker o el manifest de la PWA).
- Probar mentalmente con fechas límite: cambio de día en España, fin de semana, mínimo cambiado hoy, varios fallos seguidos.
- No cambiar el modelo de datos sin una migración que respete los datos existentes.
- Textos de la interfaz en español de España, tono natural y directo.
- Tras cambiar `index.html`, hacer commit en `main`: GitHub Pages publica solo en 1–2 minutos.

## Ideas para el futuro (backlog, no implementar sin que se pida)

Orden recomendado:

1. **Nombre e icono definitivos.** El modo app (PWA) ya está, con el nombre provisional "Tiempo útil" y un icono provisional (anillo con los tres colores). Nombre por decidir (ideas: Racha, Sin Excusas, El Bote, Constancia, Tres).
2. **Menos fricción al registrar:**
   - Atajos "+30 min" y "+1 h" con la categoría habitual.
   - Cuenta atrás hasta el cierre del día en hora de España.
3. **Avatares:** emoji y color elegidos por cada uno (el color se usa en gráficas y barras). Sin fotos subidas, porque Storage requiere plan de pago.
4. **Calendario de constancia:** cuadrícula tipo GitHub, un cuadrado por día (verde cumplido, rojo fallado). Tocar un día muestra qué hizo cada uno, solo lectura.
5. **Notificaciones push** (el envío de las 6:00 ya está hecho; ver "Cómo está montado"):
   - **Siguiente, decidido:** recordatorio a las 21:00 de España solo si aún no se ha llegado al mínimo ("Te faltan 40 min. Multa en juego: 1,50 €"). Reutiliza los tokens y la tarea programada; habrá que replicar en el script el cálculo de mínimos y multas de `index.html`.
   - Hecho: mensaje general a las 6:00 de España, igual para los tres, una frase por día rotando. Las 12 frases están en `.github/scripts/buenos-dias.mjs` (para cambiarlas, editar ahí).
   - Más adelante, si se echan de menos: aviso cuando un hermano cumple, aviso de multa a la mañana siguiente.
   - Las tareas programadas de GitHub pueden retrasarse unos minutos y se desactivan en repos públicos tras 60 días sin commits (reactivar en Actions).
   - iPhone: solo funciona con la app añadida a la pantalla de inicio (iOS 16.4+).
6. **Motivación ligera:** logros discretos (rachas de 7, 30 y 100 días; 100 h totales) y resumen semanal automático cada lunes (horas, quién ganó la semana, dinero movido).
7. **Más adelante, si se pide:** reacción rápida (👏) al día de un hermano.

Mejora técnica pendiente: vincular cada email de Google a una persona para que no se pueda registrar como otro hermano (ahora se elige en el dispositivo y se confía).

## Descartado a propósito

- Chat o comentarios (ya está WhatsApp).
- Puntos, niveles o monedas virtuales.
- Pedir pruebas (fotos, capturas).
- Días justificados o comodines.
- Añadir actividad a días pasados (corregir a la baja sí se puede).
