import { NextResponse } from "next/server";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

// Reads our own app-controlled metadata sidecars (written by api/generate.py
// alongside each Genblaze run) to build a simple, predictable gallery feed.
// We don't need to understand Genblaze's internal manifest schema for this —
// our sidecar already has exactly what the UI needs.

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getClient() {
  return new S3Client({
    endpoint: `https://s3.${getEnv("B2_REGION")}.backblazeb2.com`,
    region: getEnv("B2_REGION"),
    credentials: {
      accessKeyId: getEnv("B2_KEY_ID"),
      secretAccessKey: getEnv("B2_APP_KEY"),
    },
  });
}

export async function GET() {
  try {
    const client = getClient();
    const bucket = getEnv("B2_BUCKET");

    const listResult = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: "app-metadata/" })
    );

    const items = await Promise.all(
      (listResult.Contents ?? []).map(async (obj) => {
        if (!obj.Key) return null;
        const res = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: obj.Key })
        );
        const text = await res.Body?.transformToString();
        if (!text) return null;
        return JSON.parse(text);
      })
    );

    const gallery = items.filter((item) => item !== null);

    return NextResponse.json({ items: gallery });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

