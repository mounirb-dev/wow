# Appwrite en producción

## Causa del fallo de Vercel

El despliegue falló antes de compilar porque `vercel.json` ejecutaba una migración en cada build:

```text
bun run db:migrate:deploy && bun run build
```

El runner empezó por `001_schema`, aunque producción ya tenía la columna `name`. Appwrite respondió:

```text
409 column_already_exists
Column with the requested key 'name' already exists.
```

El ledger de migraciones y el esquema remoto no están sincronizados. No es un problema de Bun ni del SDK. Ejecutar migraciones durante un build de Vercel tampoco es seguro: cada build debe ser reproducible y no debe mutar la base de datos.

## Comportamiento actual

Vercel usa el build normal de Next.js (`bun run build`). Las migraciones no se ejecutan automáticamente durante el despliegue.

La migración de producción debe ejecutarse una sola vez, de forma controlada, contra el proyecto y la base de datos correctos. Hay que comprobar que `APPWRITE_DATABASE_ID` es el TablesDB que contiene `players`, `workspace_members` y `migrations`, y que la API key tiene permisos para cambiar el esquema.

## Variables requeridas en Vercel

```text
APPWRITE_ENDPOINT
APPWRITE_PROJECT_ID
APPWRITE_API_KEY
APPWRITE_DATABASE_ID
APPWRITE_STORAGE_BUCKET_ID
APP_URL
```

`APPWRITE_API_KEY` solo se usa en servidor y nunca debe exponerse con el prefijo `NEXT_PUBLIC_`.

## Migración manual

```bash
bun scripts/migrate.mjs
bun run build
```

El primer comando debe ejecutarse desde un entorno seguro con las variables de producción cargadas. Si una migración falla porque el recurso ya existe, no se debe repetir a ciegas: hay que comparar el esquema remoto con el archivo de migración y registrar o corregir el estado explícitamente.

## Migraciones 014, 015 y 016 (pendientes)

Hay tres migraciones nuevas que **no se han aplicado a ningún Appwrite todavía**:

| Migración | Qué cambia |
| --- | --- |
| `014_folder_access` | `folders.restricted` (booleano) y `folders.allowedUserIds` (lista) |
| `015_player_contact` | `players.phone`, `email`, `location`, `agentName`, `agentPhone` |
| `016_document_parts` | `documents.size`, `documents.partIds` y el bucket pasa a aceptar cualquier extensión |

> **Aviso:** en producción el ledger remoto (`migrations`) usa nombres distintos a los archivos del repo. `bun run db:migrate` (que ejecuta `scripts/migrate.mjs`) compara por nombre de archivo, así que intentaría reaplicar desde `001_schema` y fallaría con `409 column_already_exists`. No lo lances a ciegas contra producción.

Orden recomendado (no hay un comando específico: se usa el mismo runner, tras reconciliar el ledger):

1. Haz copia o anota el esquema actual y comprueba que `APPWRITE_DATABASE_ID` y `APPWRITE_STORAGE_BUCKET_ID` apuntan a producción.
2. Reconcilia el ledger: en la tabla `migrations` deja una fila por cada migración `001`-`013` ya reflejada en el esquema, con el **nombre exacto del archivo** (sin `.mjs`). Compara antes el esquema remoto con cada archivo.
3. Ejecuta `bun --env-file=<entorno de producción> scripts/migrate.mjs`: solo debe mostrar `apply` para `014`, `015` y `016` (si ve más, para y revisa el ledger).
4. Las tres migraciones comprueban si la columna existe antes de crearla, así que repetir una tras un fallo parcial es seguro; no lo es repetir las anteriores.
5. Despliega el código **después** de la 016: la subida por partes necesita `size` y `partIds`, y el bucket sin lista de extensiones. La 015 (`players`) debe estar antes de que alguien edite datos de contacto.

La 016 deja el límite de 25 MB por archivo del bucket: vale, porque cada parte pesa 4 MB.

## Variables opcionales

`MAX_UPLOAD_MB` (tope por archivo, 1024 por defecto), `UPLOAD_SECRET` (firma de las subidas; si falta se deriva de `MCP_OAUTH_SECRET` o `APPWRITE_API_KEY`) y `MCP_OAUTH_SECRET`. Rotar el secreto de subida solo invalida las subidas en curso.
