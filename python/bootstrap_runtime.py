#!/usr/bin/env python3

from __future__ import annotations

import subprocess
import sys
import venv
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
RUNTIME_DIR = ROOT / "python-runtime"
REQUIREMENTS = ROOT / "python" / "requirements.txt"
PYVENV_CFG = RUNTIME_DIR / "pyvenv.cfg"


def runtime_python() -> Path:
    unix = RUNTIME_DIR / "bin" / "python3"
    windows = RUNTIME_DIR / "Scripts" / "python.exe"
    if unix.exists():
        return unix
    return windows


def runtime_is_stale() -> bool:
    if not PYVENV_CFG.exists():
        return False

    try:
        config = PYVENV_CFG.read_text(encoding="utf-8")
    except OSError:
        return True

    return str(RUNTIME_DIR) not in config


def ensure_runtime() -> Path:
    python = runtime_python()
    if python.exists() and not runtime_is_stale():
        return python

    builder = venv.EnvBuilder(with_pip=True, symlinks=False, clear=True)
    builder.create(RUNTIME_DIR)
    python = runtime_python()
    if not python.exists():
        raise RuntimeError("failed to create embedded python runtime")
    return python


def install_requirements(python: Path) -> None:
    subprocess.run([str(python), "-m", "pip", "install", "--upgrade", "pip"], check=True)
    subprocess.run([str(python), "-m", "pip", "install", "-r", str(REQUIREMENTS)], check=True)


def main() -> int:
    python = ensure_runtime()
    install_requirements(python)
    print(f"embedded python ready: {python}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
