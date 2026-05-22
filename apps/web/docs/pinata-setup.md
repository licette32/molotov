# Pinata (IPFS) — setup de credencial

Molotov sube las imágenes y la metadata de cada obra a IPFS vía
[Pinata](https://pinata.cloud) (el pinning provider estándar de facto en NFTs —
lo usan OpenSea, Foundation, etc.). Free tier de 1 GB, suficiente para el MVP.

El upload corre **server-side** (`apps/web/app/api/ipfs/upload/route.ts`); la
credencial nunca llega al browser. Pinata usa un **JWT** simple (no UCAN).

| Variable | Qué es |
|---|---|
| `PINATA_JWT` | JWT de la API key de Pinata. Empieza con `eyJ...`. |

> Doc oficial usada de referencia: <https://docs.pinata.cloud/quickstart>
> (SDK `pinata`, API v3 — `pinata.upload.public.file`).

## Pasos

1. **Crear cuenta** en <https://pinata.cloud>.

2. En el dashboard, ir a **API Keys → New Key**.

3. Marcar **"Customize Permissions"** (no uses Admin).

4. Habilitar estos permisos:
   - `pinFileToIPFS`
   - `pinJSONToIPFS`
   - `addPinObject`
   - `getPinObject`
   - `listPinObjects`
   - `pinList`
   - `userPinnedDataTotal`

5. Nombrar la key (ej: `molotov-api`) y crearla.

6. **Copiar el JWT** que Pinata muestra **una sola vez** (no el API Key ni el
   API Secret — el **JWT**, que empieza con `eyJ...`).

7. **Guardarlo en `apps/web/.env.local`** (gitignored):
   ```bash
   PINATA_JWT=eyJ...
   ```

8. **Reiniciar el dev server** para que tome la variable:
   ```bash
   pnpm --filter @molotov/web dev
   ```

## Probar

- Conectá Freighter en testnet, andá a `/crear`, subí una imagen y minteá.
- Si el upload falla, mirá la consola del server: el route handler loguea el
  error real (`[ipfs/upload]`); en pantalla el usuario ve un mensaje editorial.

## Notas

- `PINATA_JWT` es un secreto: no lo commitees. Sólo el `.env.example` (con el
  placeholder vacío) va al repo.
- La gateway URL que devuelve el route handler es
  `https://gateway.pinata.cloud/ipfs/<cid>` (gateway público compartido).
  Si más adelante activás un *dedicated gateway* en Pinata, podés setear
  `PINATA_GATEWAY` y ajustar el formato de URL.
