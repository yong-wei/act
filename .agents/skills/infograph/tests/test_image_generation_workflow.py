import argparse
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch


SKILLS = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(SKILLS / 'infograph/scripts'))


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


register = load('register_infograph_test', SKILLS / 'infograph/scripts/register_infograph.py')
save = load('save_image_test', SKILLS / 'imagen/scripts/save_latest_image.py')
prepare = load('prepare_image_test', SKILLS / 'infograph/scripts/prepare_infograph_source.py')


class ImageWorkflowTests(unittest.TestCase):
    def test_registration_does_not_invent_model_or_accept_review(self):
        for reported, generation_path in [(None, 'codex-native-image-generation'),
                                          ('gpt-image-2.5-sunburst', 'openai-image-api')]:
            with self.subTest(model=reported), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                node_dir = root / 'node'
                node_dir.mkdir()
                (node_dir / 'source.json').write_text('{"node":{"name":"超调量"}}')
                (node_dir / 'prompt.md').write_text('render exact formula')
                image = root / 'this-call.png'
                image.write_bytes(b'image-fixture')
                args = argparse.Namespace(lesson='test', node='alias', image=str(image),
                                          latest_codex_image=False, accept=False, note='',
                                          reported_model=reported, generation_path=generation_path)
                with patch.object(register, 'parse_args', return_value=args), \
                     patch.object(register, 'canonical_node_id', return_value='canonical'), \
                     patch.object(register, 'selected_infograph_ref', return_value=None), \
                     patch.object(register, 'node_infograph_dir', return_value=node_dir), \
                     patch.object(register, 'node_infograph_path', return_value=node_dir / 'infograph.png'), \
                     patch.object(register, 'repo_path', side_effect=lambda p: p.name):
                    register.main()
                metadata = json.loads((node_dir / 'generation.json').read_text())
                self.assertEqual(metadata['model'], reported)
                self.assertEqual(metadata['requested_model'], 'gpt-image-2.5')
                self.assertEqual(metadata['generation_path'], generation_path)
                self.assertEqual(metadata['node_id'], 'canonical')
                self.assertEqual(metadata['formal_parameters_available']['model'], generation_path == 'openai-image-api')
                self.assertEqual(json.loads((node_dir / 'review.json').read_text())['status'], 'needs_review')

    def test_exact_output_wins_over_newest_other_task_image(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = root / 'intended.png'
            target.write_bytes(b'intended-output')
            other = root / 'other.png'
            other.write_bytes(b'other-task-output')
            args = argparse.Namespace(image=str(target), generated_root=str(root),
                                      output_dir=str(root / 'saved'), summary='test', language='en',
                                      prompt_file=None, prompt_text='exact prompt')
            with patch.object(save, 'parse_args', return_value=args), \
                 patch.object(save, 'newest_image', side_effect=AssertionError('must not select globally')):
                save.main()
            self.assertEqual((root / 'saved/test.png').read_bytes(), b'intended-output')
            self.assertEqual((root / 'saved/test.prompt.md').read_text(), 'exact prompt\n')
            self.assertEqual(other.read_bytes(), b'other-task-output')

    def test_prompt_preserves_formula_and_uses_node_specific_evidence(self):
        source = {'node': {'name': '超调量', 'definition': '峰值相对稳态值的偏离',
                           'formulas': [r'M_p=(y_{max}-y_\infty)/y_\infty'], 'keywords': []},
                  'lesson': {'lesson_id': '3-1', 'groups': []}, 'relations': []}
        prompt = prepare.build_prompt(source)
        self.assertIn(source['node']['formulas'][0], prompt)
        self.assertIn('y_\\infty', prompt)
        self.assertNotIn('GPT Image 2 /', prompt)
        self.assertNotIn('左半平面零点改变主导极点路径', prompt)


if __name__ == '__main__':
    unittest.main()
