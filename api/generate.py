"""
Vercel Python serverless function: POST /api/generate

Takes a text prompt, generates an image via GMI Cloud (through the Genblaze
Pipeline SDK), and stores the resulting image + a SHA-256-verified provenance
manifest directly to Backblaze B2. This is the core "prompt -> pipeline ->
durable storage" flow the hackathon brief asks for.

Required environment variables (set in Vercel's Environment Variables
settings, and in a local .env for `vercel dev`):
    GMI_API_KEY   - your GMI Cloud API key
    B2_KEY_ID     - your Backblaze B2 Application Key ID
    B2_APP_KEY    - your Backblaze B2 Application Key
    B2_BUCKET     - your B2 bucket name
    B2_REGION     - your B2 bucket's region (e.g. us-west-004)

We additionally write a small app-controlled metadata sidecar (separate from
Genblaze's own provenance manifest) so our own gallery UI has a simple,
predictable schema to read from.
"""

import json
import os
from http.server import BaseHTTPRequestHandler

from genblaze_core import Modality, ObjectStorageSink, KeyStrategy, Pipeline
from genblaze_gmicloud import GMICloudImageProvider
from genblaze_s3 import S3StorageBackend


def generate_and_store(prompt: str, model: str = "seedream-5.0-lite"):
    bucket_name = os.environ["B2_BUCKET"]

    storage = ObjectStorageSink(
        S3StorageBackend.for_backblaze(bucket_name),
        key_strategy=KeyStrategy.HIERARCHICAL,
    )

    result = (
        Pipeline("ai-social-library-generate")
        .step(
            GMICloudImageProvider(),
            model=model,
            prompt=prompt,
            modality=Modality.IMAGE,
        )
        .run(sink=storage, timeout=120)
    )

    asset = result.run.steps[0].assets[0]

    # Write our own lightweight metadata sidecar for the gallery UI, in
    # addition to Genblaze's own provenance manifest (which already lives in
    # the bucket at result.manifest.manifest_uri).
    app_metadata = {
        "asset_url": asset.url,
        "sha256": asset.sha256,
        "prompt": prompt,
        "model": model,
        "manifest_uri": result.manifest.manifest_uri,
        "canonical_hash": result.manifest.canonical_hash,
    }

    import boto3

    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://s3.{os.environ['B2_REGION']}.backblazeb2.com",
        aws_access_key_id=os.environ["B2_KEY_ID"],
        aws_secret_access_key=os.environ["B2_APP_KEY"],
    )
    metadata_key = f"app-metadata/{result.run.run_id}.json"
    s3.put_object(
        Bucket=bucket_name,
        Key=metadata_key,
        Body=json.dumps(app_metadata).encode("utf-8"),
        ContentType="application/json",
    )

    return app_metadata


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            payload = json.loads(body or b"{}")
            prompt = payload.get("prompt", "").strip()

            if not prompt:
                self._send_json(400, {"error": "Missing 'prompt' in request body"})
                return

            result = generate_and_store(prompt)
            self._send_json(200, result)

        except Exception as exc:  # surface a clean error to the frontend
            self._send_json(500, {"error": str(exc)})

    def _send_json(self, status: int, data: dict):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))
