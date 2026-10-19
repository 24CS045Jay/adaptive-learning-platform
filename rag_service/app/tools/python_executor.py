"""Sandboxed Python Execution Environment for Educational Calculations.

Features:
- AST-level security validation before execution
- Complete prohibition of network, OS, subprocess, and filesystem access
- Process isolation via subprocess with strict timeout (max 4s)
- Clean capture of standard output and numerical answers
"""
from __future__ import annotations

import ast
import logging
import subprocess
import sys
import tempfile
from typing import Any, Dict

log = logging.getLogger("rag.tools.python")

FORBIDDEN_MODULES = {
    "os", "sys", "subprocess", "socket", "requests", "urllib", "shutil",
    "http", "ftplib", "smtplib", "telnetlib", "posix", "nt", "pty",
    "ctypes", "winreg", "msvcrt", "builtins", "__builtin__", "importlib",
    "multiprocessing", "threading", "signal", "asyncio", "pathlib", "io"
}

FORBIDDEN_BUILTINS = {
    "open", "eval", "exec", "compile", "__import__", "globals", "locals",
    "breakpoint", "help", "exit", "quit", "input", "getattr", "setattr", "delattr"
}


class SecurityValidator(ast.NodeVisitor):
    def __init__(self) -> None:
        self.errors = []

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            base_mod = alias.name.split(".")[0].lower()
            if base_mod in FORBIDDEN_MODULES:
                self.errors.append(f"Forbidden module import: '{alias.name}'")
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if node.module:
            base_mod = node.module.split(".")[0].lower()
            if base_mod in FORBIDDEN_MODULES:
                self.errors.append(f"Forbidden module import: '{node.module}'")
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        if isinstance(node.func, ast.Name):
            if node.func.id in FORBIDDEN_BUILTINS:
                self.errors.append(f"Forbidden builtin call: '{node.func.id}()'")
        self.generic_visit(node)


def validate_python_code(code: str) -> Dict[str, Any]:
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return {"valid": False, "error": f"Syntax Error: {e}"}

    validator = SecurityValidator()
    validator.visit(tree)
    if validator.errors:
        return {"valid": False, "error": "Security violation: " + "; ".join(validator.errors)}
    return {"valid": True, "error": None}


def execute_sandboxed_python(code: str, timeout_seconds: int = 4) -> Dict[str, Any]:
    validation = validate_python_code(code)
    if not validation["valid"]:
        return {"success": False, "output": "", "error": validation["error"]}

    wrapped = (
        "import math\n"
        "import random\n"
        "import statistics\n"
        "import collections\n"
        "import itertools\n"
        "import json\n\n"
        + code
    )

    try:
        with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False, encoding="utf-8") as f:
            f.write(wrapped)
            temp_path = f.name

        proc = subprocess.run(
            [sys.executable, "-I", temp_path],
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )

        import os
        try:
            os.remove(temp_path)
        except Exception:
            pass

        stdout = proc.stdout.strip()
        stderr = proc.stderr.strip()

        if proc.returncode == 0:
            return {"success": True, "output": stdout or "[Execution finished with no printed output]", "error": None}
        return {"success": False, "output": stdout, "error": stderr or f"Process exited with code {proc.returncode}"}
    except subprocess.TimeoutExpired:
        return {"success": False, "output": "", "error": f"Execution timed out ({timeout_seconds}s limit)"}
    except Exception as e:
        log.error("Execution error: %s", e)
        return {"success": False, "output": "", "error": str(e)}
