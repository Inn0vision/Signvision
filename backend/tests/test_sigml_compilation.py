import re
import xml.etree.ElementTree as ET
from pathlib import Path
import pytest

DATA_SIGML_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "Initial-sigml-files"


def extract_sign_blocks(xml: str, gloss_override: str = None) -> list[str]:
    """
    Python mirror of extractSignBlocks from Application/src/services/sigmlCompiler.ts.
    Extracts <hns_sign> or <hamgestural_sign> blocks and updates/attaches the gloss attribute.
    """
    if not xml or not isinstance(xml, str):
        return []

    pattern = re.compile(r"<(hns_sign|hamgestural_sign)[\s\S]*?</\1>", re.IGNORECASE)
    matches = pattern.findall(xml)
    full_matches = [m.group(0) for m in pattern.finditer(xml)]

    if not full_matches:
        inner_match = re.search(r"<sigml[^>]*>([\s\S]*?)</sigml>", xml, re.IGNORECASE)
        inner = inner_match.group(1).strip() if inner_match else re.sub(r"</?sigml[^>]*>", "", xml, flags=re.IGNORECASE).strip()
        return [inner] if inner else []

    results = []
    for idx, block in enumerate(full_matches):
        if gloss_override:
            gloss_val = gloss_override if len(full_matches) == 1 else f"{gloss_override}_{idx + 1}"
            if re.search(r'gloss=[\'"][^\'"]*[\'"]', block, re.IGNORECASE):
                block = re.sub(r'gloss=[\'"][^\'"]*[\'"]', f'gloss="{gloss_val}"', block, flags=re.IGNORECASE)
            else:
                block = re.sub(r"<(hns_sign|hamgestural_sign)", rf'<\1 gloss="{gloss_val}"', block, count=1, flags=re.IGNORECASE)
        results.append(block)
    return results


def combine_sigml_texts(items: list[dict[str, str]]) -> str | None:
    """
    Python mirror of combineSiGMLTexts from Application/src/services/sigmlCompiler.ts.
    Combines individual sign XMLs into a continuous <sigml> animation document.
    """
    all_blocks = []
    for item in items:
        blocks = extract_sign_blocks(item["xml"], item.get("word"))
        all_blocks.extend(blocks)

    if not all_blocks:
        return None

    return f'<?xml version="1.0" encoding="utf-8"?>\n<sigml>\n' + "\n".join(all_blocks) + "\n</sigml>"


def test_real_sigml_files_exist():
    assert DATA_SIGML_DIR.exists(), f"Initial-sigml-files directory not found: {DATA_SIGML_DIR}"
    water_file = DATA_SIGML_DIR / "water.sigml"
    school_file = DATA_SIGML_DIR / "school.sigml"
    assert water_file.exists(), "water.sigml does not exist"
    assert school_file.exists(), "school.sigml does not exist"


def test_single_sign_extraction():
    water_xml = (DATA_SIGML_DIR / "water.sigml").read_text(encoding="utf-8")
    blocks = extract_sign_blocks(water_xml, gloss_override="WATER")
    assert len(blocks) == 1
    assert 'gloss="WATER"' in blocks[0]
    assert "<hamflathand/>" in blocks[0]


def test_combine_sigml_xml_validity():
    water_xml = (DATA_SIGML_DIR / "water.sigml").read_text(encoding="utf-8")
    school_xml = (DATA_SIGML_DIR / "school.sigml").read_text(encoding="utf-8")

    combined = combine_sigml_texts([
        {"xml": water_xml, "word": "WATER"},
        {"xml": school_xml, "word": "SCHOOL"},
    ])

    assert combined is not None
    assert combined.startswith('<?xml version="1.0" encoding="utf-8"?>')
    assert "<sigml>" in combined
    assert "</sigml>" in combined

    # Validate XML parser integrity
    root = ET.fromstring(combined.split("\n", 1)[1])  # Strip <?xml ...?> for standard ET.fromstring
    assert root.tag == "sigml"
    assert len(root) == 2

    # Check children
    child1, child2 = list(root)
    assert child1.tag in ("hns_sign", "hamgestural_sign")
    assert child1.attrib.get("gloss") == "WATER"

    assert child2.tag in ("hns_sign", "hamgestural_sign")
    assert child2.attrib.get("gloss") == "SCHOOL"

    # Verify manual gestures are intact
    assert child1.find("hamnosys_manual") is not None
    assert child2.find("hamnosys_manual") is not None


def test_combine_empty_or_invalid():
    assert combine_sigml_texts([]) is None
    assert combine_sigml_texts([{"xml": "", "word": "EMPTY"}]) is None
