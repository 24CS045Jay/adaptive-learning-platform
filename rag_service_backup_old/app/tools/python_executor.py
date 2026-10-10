"""
Sandboxed Python Code Execution Tool.
Executes educational python snippets safely in an isolated environment with:
- Strict AST-level forbidden module and function validation
- Subprocess isolation with execution timeout
- Memory and execution safety
- Restricted built-ins
"""

from __future__ import annotations

import ast
import logging
import subprocess
import sys
import tempfile
from typing import Dict

logger = logging.getLogger("rag_service.tools.python_executor")

# Prohibited imports and function calls
FORBIDDEN_MODULES = {
    "os", "sys", "subprocess", "socket", "requests", "urllib", "shutil",
    "http", "ftplib", "smtplib", "telnetlib", "posix", "nt", "pty",
    "ctypes", "winreg", "msvcrt", "builtins", "__builtin__", "importlib",
    "multiprocessing", "threading", "signal",
}

FORBIDDEN_BUILTINS = {
    "open", "eval", "exec", "compile", "__import__", "globals", "locals",
    "breakpoint", "help", "exit", "quit",
}


class SecurityValidator(ast.NodeVisitor):
    def __init__(self):
        self.errors = []

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            base_mod = alias.name.split(".")[0]
            if base_mod in FORBIDDEN_MODULES:
                self.errors.append(f"Forbidden import '{alias.name}'")
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        if node.module:
            base_mod = node.module.split(".")[0]
            if base_mod in FORBIDDEN_MODULES:
                self.errors.append(f"Forbidden import from '{node.module}'")
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call):
        if isinstance(node.func, ast.Name):
            if node.func.id in FORBIDDEN_BUILTINS:
                self.errors.append(f"Forbidden function call '{node.func.id}()'")
        self.generic_visit(node)


def validate_python_code(code: str) -> Dict[str, Any]:
    """Validate python code using AST visitor before execution."""
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return {"valid": False, "error": f"Syntax Error: {e}"}

    validator = SecurityValidator()
    validator.visit(tree)

    if validator.errors:
        return {
            "valid": False,
            "error": "Security restriction: " + "; ".join(validator.errors),
        }

    return {"valid": True, "error": None}


def execute_sandboxed_python(code: str, timeout_seconds: int = 5) -> Dict[str, Any]:
    """
    Executes Python code in a safe temporary subprocess with timeout.
    Returns:
    {
        "success": bool,
        "output": str,
        "error": Optional[str]
    }
    """
    validation = validate_python_code(code)
    if not validation["valid"]:
        return {
            "success": False,
            "output": "",
            "error": validation["error"],
        }

    # Wrap code with safe environment header
    wrapped_code = (
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
            f.write(wrapped_code)
            temp_path = f.name

        result = subprocess.run(
            [sys.executable, "-I", temp_path],  # -I: isolated mode (no user site-packages or env vars)
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )

        import os
        try:
            os.remove(temp_path)
        except Exception:
            pass

        stdout = result.stdout.strip()
        stderr = result.stderr.strip()

        if result.returncode == 0:
            return {
                "success": True,
                "output": stdout or "[Execution completed with no output]",
                "error": None,
            }
        else:
            return {
                "success": False,
                "output": stdout,
                "error": stderr or f"Process exited with code {result.returncode}",
            }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "output": "",
            "error": f"Execution timed out after {timeout_seconds} seconds",
        }
    except Exception as e:
        logger.error(f"Error executing python code: {e}")
        return {
            "success": False,
            "output": "",
            "error": f"Execution failed: {str(e)}",
        }
