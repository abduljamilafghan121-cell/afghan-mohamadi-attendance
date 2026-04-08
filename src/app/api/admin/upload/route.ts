import { NextResponse } from "next/server";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../lib/auth";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await verifyAccessToken(token);
    assertRole(user, ["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form" }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  const mime = file.type || "";
  if (!mime.startsWith("image/")) return NextResponse.json({ error: "Only image files allowed" }, { status: 400 });

  const extFromName = (() => {
    const n = file.name || "";
    const idx = n.lastIndexOf(".");
    return idx >= 0 ? n.slice(idx + 1).toLowerCase() : "";
  })();
  const extFromMime = (() => {
    if (mime === "image/png") return "png";
    if (mime === "image/jpeg") return "jpg";
    if (mime === "image/webp") return "webp";
    if (mime === "image/gif") return "gif";
    return "";
  })();
  const ext = extFromMime || extFromName || "png";

  const id = crypto.randomBytes(16).toString("hex");
  const filename = `${id}.${ext}`;
  const bytes = await file.arrayBuffer();
  const buf = Buffer.from(bytes);

  const folder = form.get("folder")?.toString() || "uploads";

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;

  if (supabaseUrl && supabaseKey && bucket) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const objectPath = `${folder}/${filename}`;
      const { error } = await supabase.storage.from(bucket).upload(objectPath, buf, {
        contentType: mime,
        upsert: true,
      });

      if (error) return NextResponse.json({ error: `Supabase upload failed: ${error.message}` }, { status: 500 });

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
      return NextResponse.json({ url: urlData.publicUrl, message: "Upload successful" });
    } catch (err) {
      return NextResponse.json({ error: `Supabase upload error: ${err}` }, { status: 500 });
    }
  }

  try {
    const uploadsDir = path.join(process.cwd(), "public", folder);
    await mkdir(uploadsDir, { recursive: true });
    const fullPath = path.join(uploadsDir, filename);
    await writeFile(fullPath, buf);
    return NextResponse.json({ url: `/${folder}/${filename}`, message: "Upload successful (local fallback)" });
  } catch (err) {
    return NextResponse.json({ error: `Local upload failed: ${err}` }, { status: 500 });
  }
}
