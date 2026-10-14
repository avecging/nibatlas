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

    def test_authenticated_requests_cannot_redirect(self):
        self.assertIsNone(b.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://attacker.test'))
        with self.assertRaises(b.BackupError):
            b.request('https://attacker.test', token='fake')

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


class FakeResponse(io.BytesIO):
    def __init__(self, body, headers):
        super().__init__(body)
        self.headers = headers


if __name__ == '__main__':
    unittest.main()
