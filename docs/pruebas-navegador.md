# Pruebas en el navegador (antes de desplegar)

Guía para comprobar a mano, con el **navegador integrado de Claude**, lo que los tests unitarios no pueden ver: que la página no se rompe, que los archivos se suben y se ven de verdad, y que el borrado limpia todo. No se automatiza con Playwright: la hace Claude (o una persona) siguiendo estos pasos.

## Antes de empezar

- Appwrite local arriba y migraciones aplicadas (`bun run appwrite:up`, `bun run db:migrate`).
- `bun run dev` en marcha y sesión iniciada en `http://localhost:3000`.
- **No ejecutes `bun run verify` en mitad de una prueba si compila sobre `.next`**: ahora compila en `.next-verify`, así que ya no pisa al servidor de desarrollo, pero conviene seguir esperando a que termine.
- Archivos de prueba reales (no inventes bytes): una foto PNG, un vídeo MP4 **de más de 4 MB** (para que use varias partes) y un archivo aleatorio de 9 MB.

  ```bash
  ffmpeg -f lavfi -i testsrc2=size=640x360:rate=1 -frames:v 1 prueba.png
  ffmpeg -f lavfi -i testsrc2=size=1280x720:rate=30 -f lavfi -i sine=frequency=440:duration=8 -t 8 \
    -c:v libx264 -b:v 6M -pix_fmt yuv420p -c:a aac -movflags +faststart partido.mp4
  node -e "require('fs').writeFileSync('grabacion.zip', require('crypto').randomBytes(9*1024*1024))"
  ```

  Para meterlos en la página desde el navegador integrado se sirven en local con CORS (`Bun.serve` en otro puerto) y un script los carga como `File` en el `<input type="file" multiple>` del escritorio de la carpeta.
- Al terminar, **borra lo que creaste** (carpetas, archivos, jugador de prueba) y comprueba en Appwrite que no quedan partes huérfanas.

## Qué se comprueba

Cada punto se mira en la pantalla **y** en el servidor/Storage.

### Acceso por invitación
1. Una cuenta sin invitación que inicia sesión llega a `/acceso` («Todavía no tienes acceso») y no ve datos; `/api/workspace/files` responde 401. Se puede probar creando un usuario de prueba en el Appwrite local (borra después el usuario y las filas que cree el alta).
2. `bun run club:invite -- email "Club"`: con el email SIN verificar sigue en `/acceso`; al verificarlo (o entrando con Google) aparece el workspace del club. Repetir el comando responde `exists`.

### Carpetas
1. «Nueva carpeta» crea la carpeta y la deja seleccionada.
2. Clic derecho sobre una carpeta: *Abrir, Cambiar nombre, Acceso…, Eliminar…*.
3. «Eliminar…» pide confirmación («Se borran también sus subcarpetas y todos los archivos…»). Tras confirmar desaparece la carpeta, sus archivos y **todas sus partes en Storage**.

### Subida de archivos
1. Foto + vídeo a la vez: aparece «2 archivos guardados» y las dos tarjetas, sin pantalla «Algo ha fallado».
2. Archivo de 9 MB: el botón muestra `Subiendo… N %` creciendo y termina en «1 archivo guardado».
3. **Integridad**: la descarga tiene el mismo SHA-256 que el original; en Storage hay exactamente 3 partes (4 MiB + 4 MiB + 1 MiB) que suman el tamaño.
4. Una petición `Range` que cruza el límite entre dos partes devuelve `206` con el `Content-Range` correcto.
5. Ningún dato interno de Storage (`partIds`, `storageFileId`) llega al navegador.
6. Un archivo cuyo contenido es JSON (aunque se llame `.png`) se guarda y se descarga tal cual: Appwrite lo sirve como `application/json` y antes eso rompía la descarga con un 500.

### Vista previa y descarga
1. Doble clic en una foto: se ve (`naturalWidth > 0`). En un vídeo: carga duración y dimensiones, se **adelanta** y avanza sin errores.
2. **Visor** (`components/FileViewer.jsx`): abre en el archivo elegido y muestra «N de M»; las flechas, el teclado (← →) y la tira de miniaturas cambian de archivo; el zoom (botones, rueda y doble clic) acerca y restablece; el vídeo y el audio se **pausan al salir** de su diapositiva; solo la diapositiva activa es accesible (`inert` en las vecinas). La foto y el vídeo ocupan todo el alto disponible, sin recuadro ni bordes.
3. **Archivo que no se puede mostrar** (un `.png` que en realidad es JSON): el visor enseña «No se puede mostrar la imagen…» con *Descargar archivo*, nunca el icono de imagen rota. En la carpeta, su miniatura cae al icono de documento.
4. Miniaturas reales en la carpeta y en «Todos los archivos»: foto, fotograma del vídeo con insignia de *play* y tile de audio.
4b. **Cambiar nombre** (clic derecho → *Cambiar nombre*, editor+): el campo aparece enfocado con la extensión sin seleccionar; Enter guarda («Nota de voz.wav»), Escape cancela y el nombre nuevo se ve en el visor y tras recargar. Un viewer no ve la opción.
4c. **Audio**: el visor muestra el reproductor `voice-note` (onda, tiempo restante, velocidad); reproduce, y al pasar a otro archivo se pausa.
5. El menú de una foto/vídeo/audio ofrece *Ver*; el de un `.zip` solo *Descargar* y *Eliminar*.
6. `?inline=1` solo se sirve inline para foto/vídeo/audio, con `X-Content-Type-Options: nosniff` y `Content-Security-Policy: sandbox`. SVG, HTML y el resto, como adjunto.
7. «Todos los archivos»: tamaño legible (`262 B`, `25,9 KB`, `6,3 MB`) y botones *Ver* / *Descargar* con nombre accesible.

### Jugadores
1. «Añadir jugador» crea el jugador; aparece en la lista.
2. «Editar jugador»: un teléfono inválido (`llámame`) muestra el aviso «El teléfono no es válido» y **no guarda nada**; con datos válidos aparecen en «Contacto y representación» con enlaces `tel:` y `mailto:` (el email se guarda en minúsculas).
3. «Borrar» (papelera animada, en el listado y en la ficha): un clic la abre con ✓ y ✕, ✓ borra y vuelve a la lista, ✕ o Escape cancelan; no quedan valoraciones ni noticias del jugador. Si el borrado falla, avisa y no muestra el ✓.

### Valoraciones y comentarios del staff
1. En Negociaciones, «Mi valoración» guarda estado y nota («Guardado para el workspace») y la tarjeta se actualiza al instante (`Equipo: 1 a favor`).
2. La ficha del jugador muestra «Comentarios del staff» con autor, estado, fecha y nota.

## Cómo se mira cada cosa

- Errores de la página: pantalla «Algo ha fallado», consola del navegador (ignora el WebSocket de recarga en caliente) y el terminal de `bun run dev` (respuestas 5xx).
- Integridad de una descarga: `crypto.subtle.digest("SHA-256", …)` en la página, comparando con el original.
- Storage y filas: un script con `node-appwrite` y la API key local (`bun --env-file=.env.local script.mjs`): listar `documents`, comprobar `partIds` con `storage.getFile` y que no sobran archivos `p…` sin documento.
- Móvil: repite lo esencial con `resize_window` en 375×812 (el botón *Ver* y los menús deben ser alcanzables).
