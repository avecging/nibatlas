import importlib.util
import io
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('drive_backup.py'))
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)


def receipt(when, **properties):
    return {'id': when.isoformat(), 'size': '20', 'appProperties': {
        'kind': b.KIND, 'project': b.PROJECT, 'state': 'complete',
        'sha256': 'a' * 64, 'completed_at': when.isoformat(), **properties,
    }}


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 1, 1, 17, tzinfo=timezone.utc)

    def test_three_days_across_month_boundary(self):
        self.assertFalse(b.backup_due([receipt(self.now - timedelta(hours=71))], self.now))
        self.assertTrue(b.backup_due([receipt(self.now - timedelta(hours=72))], self.now))

    def test_upload_duration_does_not_delay_the_next_backup_a_whole_day(self):
        finished = self.now + timedelta(minutes=6)
        # At the same hour three days later it is not due yet. The next hourly
        # poll catches it, rather than waiting until the following day.
        self.assertFalse(b.backup_due([receipt(finished)], self.now + timedelta(days=3)))
        self.assertTrue(b.backup_due([receipt(finished)], self.now + timedelta(days=3, hours=1)))

    def test_only_completed_matching_source_receipts_count(self):
        self.assertTrue(b.backup_due([receipt(self.now, state='pending')], self.now))
        self.assertTrue(b.backup_due([receipt(self.now, project='another-project')], self.now))
        self.assertTrue(b.backup_due([], self.now))

    def test_invalid_completed_receipt_fails_instead_of_silently_skipping_backup(self):
        with self.assertRaises(b.BackupError):
            b.backup_due([receipt(self.now, completed_at='invalid')], self.now)
        with self.assertRaises(b.BackupError):
            b.backup_due([receipt(self.now + timedelta(days=9))], self.now)

    def test_retention_trashes_only_old_completed_backups(self):
        drive = object.__new__(b.Drive)
        files = [receipt(self.now - timedelta(days=i)) for i in range(12)]
        files += [receipt(self.now, state='pending'), {'id': 'unrelated-file'}]
        changes = []
        drive.backups = lambda folder: files
        drive.call = lambda path, **kw: changes.append((path, kw))
        drive.retain('folder')
        self.assertEqual(len(changes), 2)
        self.assertTrue(all(x[1]['method'] == 'PATCH' and x[1]['data'] == {'trashed': True} for x in changes))
        self.assertNotIn('/unrelated-file', [x[0] for x in changes])

    def test_shared_backup_folder_is_rejected(self):
        drive = object.__new__(b.Drive)
        drive.list = lambda query: [{'id': 'folder'}]
        drive.call = lambda *a, **kw: {'shared': True, 'ownedByMe': True}
        with self.assertRaises(b.BackupError):
            drive.folder()

    def test_download_mismatch_never_marks_backup_complete(self):
        drive = object.__new__(b.Drive)
        drive.token = 'fake'
        changes = []
        def call(path, **kw):
            changes.append((path, kw))
            return (io.BytesIO(b'bad') if kw.get('raw') else
                    {'size': '3', 'shared': False, 'parents': ['folder']})
        drive.call = call
        responses = [FakeResponse(b'', {'Location': 'https://www.googleapis.com/upload/drive/v3/files?upload_id=test'}), {'id': 'archive'}]
        with tempfile.TemporaryDirectory() as folder, patch.object(b, 'request', side_effect=responses):
            p = Path(folder) / 'archive.age'
            p.write_bytes(b'abc')
            with self.assertRaises(b.BackupError):
                drive.upload('folder', p)
        self.assertFalse(any(x[1].get('method') == 'PATCH' for x in changes))

    def test_provider_errors_do_not_include_sensitive_body(self):
        with patch.object(b.urllib.request, 'build_opener') as opener:
            opener.return_value.open.side_effect = b.urllib.error.URLError('secret-password')
            with self.assertRaises(b.BackupError) as result:
                b.request('https://api.supabase.com/v1/projects/test')
            self.assertNotIn('secret-password', str(result.exception))

    def test_http_error_reports_status_and_operation_without_credentials_or_body(self):
        error = b.urllib.error.HTTPError('https://api.supabase.com/private?token=secret-query',
                                         403, 'secret-message', {}, io.BytesIO(b'secret-body'))
        with patch.object(b.urllib.request, 'build_opener') as opener:
            opener.return_value.open.side_effect = error
            with self.assertRaises(b.BackupError) as result:
                b.request('https://api.supabase.com/v1/projects/test/config/auth',
                          token='secret-token', operation='Read Supabase Auth configuration')
        self.assertEqual(str(result.exception), 'Read Supabase Auth configuration failed: api.supabase.com (HTTP 403)')
        self.assertNotIn('secret-', str(result.exception))

    def test_command_failure_reports_only_known_tool_not_args_or_stderr(self):
        response = b.subprocess.CompletedProcess([], 1, b'secret-output', b'secret-password')
        with patch.object(b.subprocess, 'run', return_value=response):
            with self.assertRaises(b.BackupError) as result:
                b.checked(['docker', 'run', 'pg_dump', '--file', 'secret-path'])
        self.assertEqual(str(result.exception), 'pg_dump failed; sensitive command details withheld')

    def test_authenticated_requests_cannot_redirect(self):
        self.assertIsNone(b.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://attacker.test'))
        with self.assertRaises(b.BackupError):
            b.request('https://attacker.test', token='fake')

    def test_provider_transaction_url_selects_the_verified_session_endpoint(self):
        for port in (5432, 6543):
            with self.subTest(port=port):
                env, responses = source_fixture(port=port)
                with tempfile.TemporaryDirectory() as folder, patch.dict(b.os.environ, env, clear=True), patch.object(b, 'request', side_effect=responses):
                    result = b.source_config(Path(folder))
                self.assertEqual(result['PGPORT'], '5432')
                self.assertEqual(result['PGHOST'], 'aws-0-ap-southeast-1.pooler.supabase.com')
                self.assertEqual(result['PGUSER'], 'postgres.' + b.PROJECT)
                self.assertEqual(result['PGSSLMODE'], 'verify-full')
                self.assertIn('default_transaction_read_only=on', result['PGOPTIONS'])

    def test_pooler_host_identity_and_allowed_ports_remain_enforced(self):
        for host, port in [('attacker.test', 6543), ('aws-0-ap-southeast-1.pooler.supabase.com', 9999)]:
            with self.subTest(host=host, port=port):
                env, responses = source_fixture(host=host, port=port)
                with tempfile.TemporaryDirectory() as folder, patch.dict(b.os.environ, env, clear=True), patch.object(b, 'request', side_effect=responses) as call:
                    with self.assertRaises(b.BackupError):
                        b.source_config(Path(folder))
                self.assertEqual(call.call_count, 2)

    def test_deleted_object_referenced_by_dump_blocks_completion(self):
        key = 'staging/media/test/v1/image.png'
        sql = ('COPY public.media_uploads (id, storage_key, status) FROM stdin;\n'
               f'test\t{key}\tvalidated\n\\.\n')
        expected = b.snapshot_media_keys(sql)
        self.assertEqual(expected, {key})
        with self.assertRaises(b.BackupError):
            b.verify_media_references(expected, [{'key': 'unrelated'}])
        b.verify_media_references(expected, [{'key': key}])

    def test_pending_uploads_are_not_required_but_ready_about_and_seals_are(self):
        sql = ('COPY public.media_uploads (storage_key, status) FROM stdin;\n'
               'staging/media/pending/v1/file.png\tpending\n\\.\n'
               'COPY public.about_images (id, environment, sha256, ready) FROM stdin;\n'
               'about-id\tstaging\tabc\tt\n\\.\n'
               'COPY public.geographic_seal_assets (id, environment, sha256, ready, content_type) FROM stdin;\n'
               'seal-id\tstaging\tdef\tt\timage/svg+xml\n\\.\n')
        self.assertEqual(b.snapshot_media_keys(sql), {'staging/about/about-id/abc.png', 'staging/seals/seal-id/def.svg'})


def source_fixture(host='aws-0-ap-southeast-1.pooler.supabase.com', port=6543):
    env = {'SUPABASE_ACCESS_TOKEN': 'synthetic-token',
           'NEXT_PUBLIC_SUPABASE_URL': f'https://{b.PROJECT}.supabase.co',
           'SUPABASE_DB_PASSWORD': 'synthetic-password',
           'CLOUDFLARE_ACCOUNT_ID': 'a' * 32, 'CLOUDFLARE_API_TOKEN': 'synthetic-token'}
    responses = [{'id': b.PROJECT, 'name': 'nibatlas-staging'},
                 [{'database_type': 'PRIMARY', 'connection_string':
                   f'postgresql://postgres.{b.PROJECT}:[YOUR-PASSWORD]@{host}:{port}/postgres'}],
                 {}, {'success': True, 'result': {'bindings': [{'name': 'MEDIA_BUCKET', 'bucket_name': b.BUCKET}]}}]
    return env, responses


class FakeResponse(io.BytesIO):
    def __init__(self, body, headers):
        super().__init__(body)
        self.headers = headers


if __name__ == '__main__':
    unittest.main()
