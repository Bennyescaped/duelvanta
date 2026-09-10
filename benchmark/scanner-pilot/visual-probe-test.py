"""Algorithm contracts only; synthetic keypoints are not recognition fixtures."""
import importlib.util
from pathlib import Path
import unittest
import numpy as np

spec = importlib.util.spec_from_file_location('probe', Path(__file__).with_name('visual-probe.py'))
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

class RetrievalContracts(unittest.TestCase):
    def setUp(self):
        points = [(float(x), float(y)) for y in range(30, 271, 60) for x in range(20, 181, 40)]
        self.descriptors = np.random.default_rng(160012).integers(0, 256, (len(points), 32), dtype=np.uint8)
        self.reference = (np.zeros((300, 200), dtype=np.uint8),
                          [probe.cv.KeyPoint(x, y, 8) for x, y in points], self.descriptors)
        self.query = (np.zeros((600, 400), dtype=np.uint8),
                      [probe.cv.KeyPoint(1.7*x+30, 1.7*y+40, 8) for x, y in points], self.descriptors.copy())
        self.refs = [({'id':'synthetic', 'code':'fixture', 'language':'EN', 'tcg':'one_piece'}, self.reference)]

    def test_geometric_candidate_never_approves_import(self):
        result = probe.retrieve(self.query, 'one_piece', self.refs)
        self.assertEqual(len(result), 1)
        self.assertTrue(result[0]['geometricCandidate'])
        self.assertFalse(result[0]['ready'])

    def test_tcg_filter_and_no_features(self):
        self.assertEqual(probe.retrieve(self.query, 'pokemon', self.refs), [])
        self.assertEqual(probe.retrieve((self.query[0], [], None), 'one_piece', self.refs), [])

    def test_degenerate_matches_cannot_be_geometric_candidate(self):
        line = [probe.cv.KeyPoint(float(i), 100., 8) for i in range(len(self.descriptors))]
        result = probe.retrieve((self.query[0], line, self.descriptors), 'one_piece', self.refs)
        self.assertFalse(any(r['geometricCandidate'] for r in result))

if __name__ == '__main__':
    unittest.main()
