#!/usr/bin/env python3
# -*- coding: ascii -*-
"""Offline reproducibility tests for build-madina-hafs-pages.py."""

import datetime
import importlib.util
import json
import pathlib
import re
import sys
import tempfile
import unittest


sys.dont_write_bytecode = True
ROOT = pathlib.Path(__file__).resolve().parents[1]
BUILDER_PATH = ROOT / 'tools' / 'build-madina-hafs-pages.py'
SPEC = importlib.util.spec_from_file_location('madina_hafs_builder_under_test', BUILDER_PATH)
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


class BuildMadinaHafsPagesTest(unittest.TestCase):
    def test_side_marker_default_matches_shipped_truth_and_guard(self):
        manifest = json.loads((ROOT / 'data' / 'madina-hafs-pages.json').read_text(encoding='ascii'))
        guard = (ROOT / 'tools' / 'madina-hafs-guard.cjs').read_text(encoding='utf-8')
        match = re.search(r'const SIDE_MARKER_PAGES = (\d+);', guard)
        self.assertIsNotNone(match)
        self.assertEqual(
            [BUILDER.EXPECTED_SIDE_MARKER_PAGES,
             manifest['totals']['sideMarkerPages'], int(match.group(1))],
            [252, 252, 252],
        )

    def test_generated_on_uses_injected_utc_clock_in_temp_outputs(self):
        shipped_path = ROOT / 'data' / 'madina-hafs-pages.json'
        shipped_before = shipped_path.read_bytes()
        records = {1: {
            'printedPage': 1,
            'bytes': 7,
            'sideMarkerPresent': False,
            'sideMarkerPixelsRemoved': 0,
            'protectedPixelsDiscarded': 0,
            'differingSamples': 0,
            'lossless': True,
            'cropGroup': 'fixture',
            'width': 747,
            'height': 1200,
        }}
        clocks = [
            (lambda: datetime.datetime(2027, 1, 1, 2, 30,
                                       tzinfo=datetime.timezone(datetime.timedelta(hours=3))),
             '2026-12-31'),
            (lambda: datetime.datetime(2026, 8, 12, 23, 30,
                                       tzinfo=datetime.timezone(datetime.timedelta(hours=-5))),
             '2026-08-13'),
        ]
        observed = []
        with tempfile.TemporaryDirectory(prefix='madina-hafs-manifest-test-') as temp_dir:
            for index, (clock, expected) in enumerate(clocks):
                output = pathlib.Path(temp_dir) / ('manifest-%d.json' % index)
                doc = BUILDER.write_manifest(records, clock=clock, manifest_path=str(output))
                disk = json.loads(output.read_text(encoding='ascii'))
                self.assertEqual(doc['generatedOn'], expected)
                self.assertEqual(disk['generatedOn'], expected)
                self.assertRegex(disk['generatedOn'], r'^\d{4}-\d{2}-\d{2}$')
                observed.append(disk['generatedOn'])
        self.assertEqual(observed, ['2026-12-31', '2026-08-13'])
        self.assertEqual(shipped_path.read_bytes(), shipped_before)


if __name__ == '__main__':
    unittest.main()
