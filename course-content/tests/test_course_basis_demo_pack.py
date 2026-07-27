import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEMO = ROOT / "course-content" / "demo" / "course-basis-root-locus"


def test_restricted_textbook_is_external_to_demo_pack():
    descriptor = json.loads((DEMO / "import-descriptor.json").read_text())
    provenance = json.loads((DEMO / "provenance.json").read_text())
    restricted = next(item for item in descriptor["documents"] if item.get("requiredAccess"))
    restricted_source = next(item for item in provenance["sources"] if not item.get("redistribute", True))

    assert restricted["path"].startswith("teacher-local://")
    assert restricted["pathEnvironmentVariable"] == "COURSE_BASIS_RESTRICTED_TEXTBOOK_PATH"
    assert restricted["bundleContent"] is False
    assert restricted_source["path"].startswith("teacher-local://")
    assert not any("胡寿松" in path.read_text(errors="ignore") for path in DEMO.glob("*.md"))


def test_demo_uses_the_ordinary_course_basis_api():
    script = (ROOT / "course-content" / "scripts" / "import_course_basis_demo.ts").read_text()
    for endpoint in (
        "/api/teacher/course-bases",
        "/documents",
        "/versions",
    ):
        assert endpoint in script
    assert "action: 'confirm'" in script
