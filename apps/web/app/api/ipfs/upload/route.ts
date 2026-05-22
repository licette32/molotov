import lighthouse from "@lighthouse-web3/sdk";

// IPFS uploads run server-side so LIGHTHOUSE_API_KEY never reaches the client.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const apiKey = process.env.LIGHTHOUSE_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "IPFS no está configurado en el servidor." },
      { status: 500 },
    );
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const entry = form.get("file");
    if (entry instanceof File) file = entry;
  } catch {
    /* falls through to the 400 below */
  }
  if (!file) {
    return Response.json({ error: "Falta el archivo." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const res = await lighthouse.uploadBuffer(buffer, apiKey);
    const cid = res?.data?.Hash;
    if (!cid) throw new Error("Lighthouse no devolvió un CID");
    return Response.json({
      cid,
      gatewayUrl: `https://gateway.lighthouse.storage/ipfs/${cid}`,
    });
  } catch (err) {
    console.error("[ipfs/upload]", err);
    return Response.json(
      { error: "No se pudo subir el archivo a IPFS." },
      { status: 502 },
    );
  }
}
