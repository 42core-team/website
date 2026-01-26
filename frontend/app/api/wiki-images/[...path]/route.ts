import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const contentDirectory = path.join(process.cwd(), "content", "wiki");

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const resolvedParams = await params;
    const imagePath = resolvedParams.path.join("/");
    const fullPath = path.join(contentDirectory, imagePath);

    // Security check: ensure the path doesn't escape the content directory
    const resolvedPath = path.resolve(fullPath);
    const resolvedContentDir = path.resolve(contentDirectory);

    if (!resolvedPath.startsWith(resolvedContentDir)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Check if file exists
    try {
      await fs.access(fullPath);
    }
    catch {
      return new NextResponse("Image not found", { status: 404 });
    }

    // Read the file
    const fileBuffer = await fs.readFile(fullPath);

    // Determine content type based on file extension
    const ext = path.extname(fullPath).toLowerCase();
    let contentType = "application/octet-stream";

    switch (ext) {
      case ".png":
        contentType = "image/png";
        break;
      case ".jpg":
      case ".jpeg":
        contentType = "image/jpeg";
        break;
      case ".gif":
        contentType = "image/gif";
        break;
      case ".svg":
        contentType = "image/svg+xml";
        break;
      case ".webp":
        contentType = "image/webp";
        break;
    }

    return new Response(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }
  catch (error) {
    console.error("Error serving wiki image:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
