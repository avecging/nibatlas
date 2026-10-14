#!/usr/bin/env python3
"""Read-only source export; only encrypted archives and receipts go to Drive.

No app deployment, SQL writes, source-object writes or plaintext CI artifacts.
The restore runbook deliberately treats managed Supabase schemas separately.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tarfile
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

PROJECT = "xgyzsdrugtwqlpnkutfw"
WORKER = "nibatlas-staging"  # Currently serves app.nibatlas.com: protect as live.
BUCKET = "nibatlas-staging-images"
KIND = "nibatlas-full-data-v1"
INTERVAL = timedelta(days=3)
KEEP = 10
MAX_BYTES = 2 * 1024**3
POSTGRES_IMAGE = "postgres:17.6@sha256:00bc86618629af00d2937fdc5a5d63db3ff8450acf52f0636ec813c7f4902929"
TRANSIENT_TABLES = (
    "stamp_private.verification_nonces", "auth.refresh_tokens", "auth.sessions",
    "auth.flow_state", "auth.one_time_tokens", "auth.mfa_challenges",
    "auth.mfa_amr_claims", "auth.saml_relay_states",
)


class BackupError(Exception):
    """Safe message only: never surface provider bodies, SQL or credentials."""


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


def required(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise BackupError(f"Missing configuration: {name}")
    return value


def json_bytes(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2).encode()


def request(url, *, token=None, data=None, method="GET", headers=None, raw=False):
    host = urllib.parse.urlsplit(url).hostname
    if host not in {"api.supabase.com", "api.cloudflare.com", "oauth2.googleapis.com", "www.googleapis.com"}:
        raise BackupError("Refused unexpected provider host")
    h = dict(headers or {})
    if token:
        h["Authorization"] = "Bearer " + token
    if isinstance(data, dict):
        data = json_bytes(data)
        h["Content-Type"] = "application/json"
    try:
        response = urllib.request.build_opener(NoRedirect()).open(
            urllib.request.Request(url, data=data, method=method, headers=h), timeout=120
        )
        if raw:
            return response
        with response:
            return json.load(response)
    except (urllib.error.URLError, ValueError, OSError):
        raise BackupError(f"Provider request failed: {host}") from None


def checked(command, *, env=None, output=None, timeout=1800):
    try:
        result = subprocess.run(command, env=env, stdout=output or subprocess.PIPE,
                                stderr=subprocess.PIPE, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise BackupError("Backup command could not complete") from None
    if result.returncode:
        raise BackupError("Backup command failed; provider details withheld")
    # Warnings can signal incomplete exports. Keep them private and fail closed.
    if result.stderr and command[-1:] != ["--version"]:
        raise BackupError("Backup command reported warnings; review privately before retrying")
    return result.stdout


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def complete_files(files):
    good = []
    for item in files:
        p = item.get("appProperties", {})
        if p.get("kind") != KIND or p.get("project") != PROJECT or p.get("state") != "complete":
            continue
        try:
            timestamp = datetime.fromisoformat(p["completed_at"])
            if timestamp.tzinfo is None:
                raise ValueError()
        except (KeyError, ValueError, TypeError):
            raise BackupError("A completed backup has an invalid timestamp") from None
        if not re.fullmatch(r"[a-f0-9]{64}", p.get("sha256", "")) or int(item.get("size", "0")) <= 0:
            raise BackupError("A completed backup has an invalid receipt")
        good.append((timestamp, item))
    return sorted(good, key=lambda pair: (pair[0], pair[1]["id"]), reverse=True)


def backup_due(files, now):
    good = complete_files(files)
    if good and good[0][0] > now + timedelta(minutes=5):
        raise BackupError("Backup receipt timestamp is in the future")
    return not good or now - good[0][0] >= INTERVAL


class Drive:
    def __init__(self):
        fields = {
            "client_id": required("BACKUP_GOOGLE_CLIENT_ID"),
            "client_secret": required("BACKUP_GOOGLE_CLIENT_SECRET"),
            "refresh_token": required("BACKUP_GOOGLE_REFRESH_TOKEN"),
            "grant_type": "refresh_token",
        }
        response = request("https://oauth2.googleapis.com/token", method="POST",
                           data=urllib.parse.urlencode(fields).encode(),
                           headers={"Content-Type": "application/x-www-form-urlencoded"})
        self.token = response["access_token"]
        # Values are never otherwise logged; GitHub redacts an accidentally echoed token.
        print("::add-mask::" + self.token)

    def call(self, path="", **kwargs):
        return request("https://www.googleapis.com/drive/v3/files" + path, token=self.token, **kwargs)

    def list(self, query):
        items, page = [], None
        while True:
            params = {"q": query, "pageSize": 100,
                      "fields": "nextPageToken,files(id,name,size,shared,ownedByMe,appProperties,parents)"}
            if page:
                params["pageToken"] = page
            response = self.call("?" + urllib.parse.urlencode(params))
            items.extend(response.get("files", []))
            page = response.get("nextPageToken")
            if not page:
                return items

    def folder(self):
        # drive.file can access this OAuth app's files, not the ChatGPT-created folder.
        query = ("trashed=false and mimeType='application/vnd.google-apps.folder' "
                 f"and appProperties has {{ key='nibatlas_backup_folder' and value='{PROJECT}' }}")
        folders = self.list(query)
        if len(folders) > 1:
            raise BackupError("Ambiguous backup folder; resolve duplicate folders first")
        if not folders:
            result = self.call("?fields=id", method="POST", data={
                "name": "Nib Atlas Automated Backups", "mimeType": "application/vnd.google-apps.folder",
                "appProperties": {"nibatlas_backup_folder": PROJECT},
            })
            folder_id = result["id"]
        else:
            folder_id = folders[0]["id"]
        metadata = self.call("/" + folder_id + "?fields=id,shared,ownedByMe,trashed,permissions(type,role)")
        if (metadata.get("shared") is not False or metadata.get("ownedByMe") is not True
                or metadata.get("trashed") or any(p.get("role") != "owner" for p in metadata.get("permissions", []))):
            raise BackupError("Backup folder is not exclusively private and owner-controlled")
        return folder_id

    def backups(self, folder):
        if not re.fullmatch(r"[A-Za-z0-9_-]+", folder):
            raise BackupError("Invalid Drive folder identifier")
        return self.list(f"'{folder}' in parents and trashed=false")

    def upload(self, folder, path):
        digest, size = sha256(path), path.stat().st_size
        metadata = {"name": path.name, "parents": [folder], "appProperties": {
            "kind": KIND, "project": PROJECT, "state": "pending", "sha256": digest,
        }}
        response = request("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,size",
                           token=self.token, method="POST", data=metadata, raw=True,
                           headers={"X-Upload-Content-Type": "application/octet-stream",
                                    "X-Upload-Content-Length": str(size)})
        with response:
            location = response.headers.get("Location", "")
        if not location.startswith("https://www.googleapis.com/upload/drive/"):
            raise BackupError("Unexpected upload destination")
        with path.open("rb") as body:
            result = request(location, token=self.token, method="PUT", data=body,
                             headers={"Content-Length": str(size), "Content-Type": "application/octet-stream"})
        file_id = result["id"]
        metadata = self.call("/" + file_id + "?fields=id,size,shared,parents")
        if (int(metadata.get("size", "0")) != size or metadata.get("shared") is not False
                or metadata.get("parents") != [folder]):
            raise BackupError("Uploaded archive metadata did not match")
        downloaded, total = hashlib.sha256(), 0
        with self.call("/" + file_id + "?alt=media", raw=True) as body:
            for chunk in iter(lambda: body.read(1024 * 1024), b""):
                total += len(chunk)
                if total > size:
                    raise BackupError("Uploaded archive exceeded expected size")
                downloaded.update(chunk)
        if total != size or downloaded.hexdigest() != digest:
            raise BackupError("Uploaded archive checksum did not match")
        # Only a verified ciphertext gets a completed receipt and permits retention.
        self.call("/" + file_id, method="PATCH", data={"appProperties": {
            **metadata.get("appProperties", {}), **result.get("appProperties", {}),
            "kind": KIND, "project": PROJECT, "state": "complete", "sha256": digest,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }})
        return file_id

    def retain(self, folder):
        good = complete_files(self.backups(folder))
        for _, item in good[KEEP:]:
            # Recoverable trash only; never DELETE or empty trash.
            self.call("/" + item["id"], method="PATCH", data={"trashed": True})


def source_config(root):
    token = required("SUPABASE_ACCESS_TOKEN")
    project = request(f"https://api.supabase.com/v1/projects/{PROJECT}", token=token)
    if project.get("id", project.get("ref")) != PROJECT or project.get("name") != "nibatlas-staging":
        raise BackupError("Supabase source identity did not match the fixed live project")
    if required("NEXT_PUBLIC_SUPABASE_URL").rstrip("/") != f"https://{PROJECT}.supabase.co":
        raise BackupError("Supabase deployment URL did not match the fixed source")
    pools = request(f"https://api.supabase.com/v1/projects/{PROJECT}/config/database/pooler", token=token)
    pool = next((x for x in pools if x.get("database_type") == "PRIMARY"), None)
    connection = pool and (pool.get("connection_string") or pool.get("connectionString"))
    if not connection or "[YOUR-PASSWORD]" not in connection:
        raise BackupError("No recognized Supabase pooler connection")
    parsed = urllib.parse.urlsplit(connection.replace("[YOUR-PASSWORD]", "placeholder"))
    if (parsed.scheme not in {"postgres", "postgresql"} or parsed.username != "postgres." + PROJECT
            or not parsed.hostname or not parsed.hostname.endswith(".pooler.supabase.com")
            or parsed.port not in {5432, 6543}):
        raise BackupError("Pooler connection identity did not match")
    if parsed.port != 5432:
        raise BackupError("Backup requires session pooler port 5432, not transaction pooling")
    auth = request(f"https://api.supabase.com/v1/projects/{PROJECT}/config/auth", token=token)
    account = required("CLOUDFLARE_ACCOUNT_ID")
    if not re.fullmatch(r"[a-f0-9]{32}", account):
        raise BackupError("Invalid Cloudflare account identifier")
    worker = request(f"https://api.cloudflare.com/client/v4/accounts/{account}/workers/scripts/{WORKER}/settings",
                     token=required("CLOUDFLARE_API_TOKEN"))
    if not worker.get("success"):
        raise BackupError("Could not read live Worker configuration")
    binding = next((x for x in worker["result"].get("bindings", []) if x.get("name") == "MEDIA_BUCKET"), {})
    if binding.get("bucket_name") != BUCKET:
        raise BackupError("Worker's media bucket did not match fixed backup source")
    (root / "provider-config.json").write_bytes(json_bytes({"project": project, "auth": auth, "worker": worker}))
    rootcert = "system"
    certificate = os.environ.get("BACKUP_POSTGRES_CA_CERT", "").strip()
    if certificate:
        if "-----BEGIN CERTIFICATE-----" not in certificate or "PRIVATE KEY" in certificate:
            raise BackupError("Expected a public PostgreSQL CA certificate, not a private key")
        cert_file = root / "postgres-ca.crt"
        cert_file.write_text(certificate + "\n", encoding="utf-8")
        rootcert = str(cert_file)
    return {**os.environ, "PGHOST": parsed.hostname, "PGPORT": "5432", "PGUSER": parsed.username,
            "PGDATABASE": parsed.path.lstrip("/"), "PGPASSWORD": required("SUPABASE_DB_PASSWORD"),
            "PGSSLMODE": "verify-full", "PGSSLROOTCERT": rootcert,
            "PGOPTIONS": "-c default_transaction_read_only=on -c statement_timeout=900000"}


def database(root, env):
    def pg(command, output=None):
        mount = str(root.parent)
        docker = ["docker", "run", "--rm", "--user", f"{os.getuid()}:{os.getgid()}",
                  "--volume", f"{mount}:{mount}"]
        for key in ("PGHOST", "PGPORT", "PGUSER", "PGDATABASE", "PGPASSWORD", "PGSSLMODE", "PGSSLROOTCERT", "PGOPTIONS"):
            docker += ["--env", key]
        return checked(docker + [POSTGRES_IMAGE] + command, env=env, output=output)
    dump = root / "database.dump"
    args = ["pg_dump", "--format=custom", "--lock-wait-timeout=10s", "--file", str(dump)]
    args.extend("--exclude-table-data=" + table for table in TRANSIENT_TABLES)
    pg(args)
    toc = pg(["pg_restore", "--list", str(dump)])
    for schema, table in [("auth", "users"), ("auth", "identities"), ("public", "shops"),
                          ("public", "stamp_collections"), ("public", "geographic_seals"),
                          ("public", "shop_working_copies"), ("supabase_migrations", "schema_migrations")]:
        if not re.search(r"TABLE DATA " + schema + " " + table + r"\b", toc.decode()):
            raise BackupError("Database archive is missing required durable data")
    (root / "database-toc.txt").write_bytes(toc)
    with (root / "roles.sql").open("wb") as output:
        pg(["pg_dumpall", "--roles-only", "--no-role-passwords"], output=output)
    # Inspect the dumped records, not a later live query: deleted referenced
    # objects must not silently go missing between the DB snapshot and listing.
    tables = ("media_uploads", "shop_images", "stamp_artwork_versions", "about_images", "geographic_seal_assets")
    args = ["pg_restore", "--data-only", "--file=-"]
    args.extend("--table=" + t for t in tables)
    copy_sql = pg(args + [str(dump)]).decode()
    expected = snapshot_media_keys(copy_sql)
    (root / "expected-media-keys.json").write_bytes(json_bytes(sorted(expected)))
    return expected


def snapshot_media_keys(sql):
    """Parse pg_restore's COPY text without executing recovered SQL."""
    keys, table, columns = set(), None, []
    for line in sql.splitlines():
        header = re.fullmatch(r"COPY public\.([a-z_]+) \(([^)]+)\) FROM stdin;", line)
        if header:
            table, columns = header[1], header[2].split(", ")
            continue
        if line == r"\.":
            table = None
            continue
        if table is None:
            continue
        values = line.split("\t")
        if len(values) != len(columns):
            raise BackupError("Could not validate snapshot media references")
        row = dict(zip(columns, (None if x == r"\N" else x for x in values)))
        for name in ("storage_key", "clean_svg_key", "outlined_svg_key", "transparent_png_key", "editable_source_key"):
            value = row.get(name)
            if value and re.match(r"^(staging|production)/(media|seals|about)/", value):
                if "\\" in value:
                    raise BackupError("Unexpected media key serialization")
                if table != "media_uploads" or row.get("status") == "validated":
                    keys.add(value)
        if table in {"about_images", "geographic_seal_assets"} and row.get("ready") == "t":
            scope = "about" if table == "about_images" else "seals"
            ext = "svg" if row.get("content_type") == "image/svg+xml" else "png"
            keys.add(f"{row['environment']}/{scope}/{row['id']}/{row['sha256']}.{ext}")
    return keys


def verify_media_references(expected, inventory):
    if expected - {x["key"] for x in inventory}:
        raise BackupError("Media referenced by the database snapshot is missing from the recovery set")


def media(root, expected):
    import boto3
    from botocore.config import Config
    account = required("CLOUDFLARE_ACCOUNT_ID")
    s3 = boto3.client("s3", endpoint_url=f"https://{account}.r2.cloudflarestorage.com", region_name="auto",
                      aws_access_key_id=required("BACKUP_R2_ACCESS_KEY_ID"),
                      aws_secret_access_key=required("BACKUP_R2_SECRET_ACCESS_KEY"),
                      config=Config(retries={"max_attempts": 3, "mode": "standard"}))
    folder = root / "media"
    folder.mkdir()
    inventory, total = [], 0
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=BUCKET):
        for item in page.get("Contents", []):
            if len(inventory) >= 10000 or total + item["Size"] > MAX_BYTES:
                raise BackupError("Media exceeds initial backup safety limit")
            key = item["Key"]
            name = hashlib.sha256(key.encode()).hexdigest() + ".bin"
            obj = s3.get_object(Bucket=BUCKET, Key=key, IfMatch=item["ETag"])
            count = 0
            path = folder / name
            with obj["Body"] as body, path.open("wb") as output:
                for chunk in iter(lambda: body.read(1024 * 1024), b""):
                    count += len(chunk)
                    if count > item["Size"]:
                        raise BackupError("Media object changed during backup")
                    output.write(chunk)
            if count != item["Size"]:
                raise BackupError("Media object size did not match inventory")
            total += count
            inventory.append({"key": key, "file": "media/" + name, "bytes": count,
                              "sha256": sha256(path), "etag": item["ETag"],
                              "content_type": obj.get("ContentType"), "cache_control": obj.get("CacheControl"),
                              "metadata": obj.get("Metadata", {})})
    if not inventory:
        raise BackupError("The fixed live media bucket unexpectedly returned no objects")
    verify_media_references(expected, inventory)
    (root / "media-inventory.json").write_bytes(json_bytes({"bucket": BUCKET, "objects": inventory}))
    return len(inventory), total


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--check-due", action="store_true")
    args = parser.parse_args()
    drive = Drive()
    folder = drive.folder()
    due = args.force or backup_due(drive.backups(folder), datetime.now(timezone.utc))
    if args.check_due:
        output = required("GITHUB_OUTPUT")
        with open(output, "a", encoding="utf-8") as f:
            f.write("due=" + str(due).lower() + "\n")
        return
    if not due:
        print("Last verified backup is less than three days old; no source export needed.")
        return
    recipient = required("BACKUP_AGE_RECIPIENT")
    if not re.fullmatch(r"age1[023456789acdefghjklmnpqrstuvwxyz]{58}", recipient):
        raise BackupError("Expected one public age X25519 recipient; no private recovery key")
    checked(["age", "--version"])
    os.umask(0o077)
    with tempfile.TemporaryDirectory(prefix="nibatlas-backup-") as scratch:
        base = Path(scratch)
        root = base / "recovery"
        root.mkdir()
        env = source_config(root)
        expected = database(root, env)
        objects, byte_count = media(root, expected)
        # A full repository checkout is required. Never archive working env files.
        checked(["git", "bundle", "create", str(root / "repository.bundle"), "--all"])
        manifest = {"kind": KIND, "project": PROJECT, "worker": WORKER, "bucket": BUCKET,
                    "exported_at": datetime.now(timezone.utc).isoformat(),
                    "transient_table_data_excluded": TRANSIENT_TABLES,
                    "limitations": ["Worker secret values are not exportable via Cloudflare; retain originals in password manager",
                                    "Role passwords omitted; reset privately during recovery",
                                    "A verified ciphertext is not a completed restore drill"],
                    "files": {str(p.relative_to(root)): {"bytes": p.stat().st_size, "sha256": sha256(p)}
                              for p in root.rglob("*") if p.is_file()}}
        (root / "manifest.json").write_bytes(json_bytes(manifest))
        total = sum(p.stat().st_size for p in root.rglob("*") if p.is_file())
        if total > MAX_BYTES:
            raise BackupError("Recovery set exceeds initial backup safety limit")
        archive = base / "recovery.tar.gz"
        with tarfile.open(archive, "w:gz") as out:
            out.add(root, arcname="recovery")
        cipher = base / ("nibatlas-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + ".tar.gz.age")
        checked(["age", "--encrypt", "--recipient", recipient, "--output", str(cipher), str(archive)])
        drive.upload(folder, cipher)
        drive.retain(folder)
        print(f"Encrypted backup uploaded and downloaded checksum verified. Media objects: {objects}; media bytes: {byte_count}.")


if __name__ == "__main__":
    try:
        main()
    except BackupError as error:
        print("::error::" + str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("::error::Backup failed; sensitive provider details withheld. Existing backups retained.", file=sys.stderr)
        sys.exit(1)
