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
