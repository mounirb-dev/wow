# Appwrite en producción

## Causa del fallo

El despliegue `dpl_EyRVfyKXASRvT82BC3ARo5TDhUUN` registró:

```text
Invalid query: Attribute not found in schema: workspaceId
```

El código ya consultaba `workspaceId` para aislar los datos por workspace, pero la base de datos de producción seguía usando el esquema anterior. Por eso la página devolvía `200` mientras el render del servidor registraba errores de Appwrite.

La causa es una migración de esquema no aplicada en el proyecto/base de datos que usa Vercel, no un problema de compatibilidad del SDK. La variable `APPWRITE_DATABASE_ID` debe apuntar al mismo TablesDB donde se ejecutan las migraciones.

## Prevención

Vercel ejecuta ahora `bun run db:migrate:deploy` antes de cada build. El runner aplica las migraciones pendientes usando las variables de entorno del despliegue. La migración de índices es idempotente y no intenta recrear índices existentes.

Variables requeridas en Vercel:

```text
APPWRITE_ENDPOINT
APPWRITE_PROJECT_ID
APPWRITE_API_KEY
APPWRITE_DATABASE_ID
APPWRITE_STORAGE_BUCKET_ID
APP_URL
```

`APPWRITE_API_KEY` solo se usa en servidor y nunca debe exponerse con el prefijo `NEXT_PUBLIC_`.

## Comprobación manual

```bash
bun run db:migrate:deploy
bun run build
```

Si el error persiste, comprobar en Appwrite que `APPWRITE_DATABASE_ID` apunta a la base de datos que contiene las tablas `players`, `workspace_members` y `migrations`, y que la API key tiene permisos de TablesDB para crear columnas, índices y filas.
