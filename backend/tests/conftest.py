import sys
from pathlib import Path

# Ensure project root and backend are in sys.path for test execution from any directory
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = Path(__file__).resolve().parent.parent

for p in (ROOT_DIR, BACKEND_DIR):
    p_str = str(p)
    if p_str not in sys.path:
        sys.path.insert(0, p_str)
