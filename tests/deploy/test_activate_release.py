import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("activate", Path(__file__).parents[2] / "scripts/activate-release.py")
activate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(activate)


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.deploy_root = self.root / "sites"

    def build(self, name, entry="index.html"):
        source = self.root / name
        (source / "assets").mkdir(parents=True)
        (source / entry).write_text(name)
        (source / "assets" / f"{name}.js").write_text(name)
        return source

    def test_home_release_preserves_other_sites_and_old_lazy_chunks(self):
        history = self.build("history", "history.html")
        activate.activate_release(self.deploy_root, "history", "h1", history)
        first = self.build("first")
        activate.activate_release(self.deploy_root, "home", "v1", first)
        second = self.build("second")
        activate.activate_release(self.deploy_root, "home", "v2", second)
        self.assertEqual((self.deploy_root / "home/current/index.html").read_text(), "second")
        self.assertEqual((self.deploy_root / "home/current/assets/first.js").read_text(), "first")
        self.assertEqual((self.deploy_root / "home/current/assets/second.js").read_text(), "second")
        self.assertEqual((self.deploy_root / "history/current/history.html").read_text(), "history")
        self.assertEqual((self.deploy_root / "home/releases/v1/index.html").read_text(), "first")

    def test_invalid_build_keeps_the_current_release(self):
        source = self.build("first")
        activate.activate_release(self.deploy_root, "home", "v1", source)
        before = (self.deploy_root / "home/current").readlink()
        for app, release in [("home", "../escape"), ("other", "v2"), ("history", "v2")]:
            with self.assertRaises(ValueError):
                activate.activate_release(self.deploy_root, app, release, source)
        self.assertEqual((self.deploy_root / "home/current").readlink(), before)
        with self.assertRaises(ValueError):
            activate.activate_release(self.deploy_root, "home", "v1", source)

    def test_symlink_in_build_is_rejected_before_activation(self):
        source = self.build("first")
        (source / "outside").symlink_to(self.root)
        with self.assertRaises(ValueError):
            activate.activate_release(self.deploy_root, "home", "v1", source)
        self.assertFalse((self.deploy_root / "home/current").exists())

    def test_source_inside_deployment_root_is_rejected(self):
        source = self.build("first")
        activate.activate_release(self.deploy_root, "home", "v1", source)
        with self.assertRaises(ValueError):
            activate.activate_release(self.deploy_root, "home", "v2", self.deploy_root / "home/current")


if __name__ == "__main__":
    unittest.main()
