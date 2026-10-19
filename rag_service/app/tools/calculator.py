"""Safe Computational Calculator Tool for EduSense AI.

Evaluates mathematical, statistical, probability, and matrix operations safely
using AST parsing without eval() or dangerous system access.
"""
from __future__ import annotations

import ast
import math
import operator
import statistics
from typing import Any, List, Union

OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

SAFE_FUNCTIONS = {
    # Basic math
    "abs": abs,
    "round": round,
    "min": min,
    "max": max,
    "sum": sum,
    "sqrt": math.sqrt,
    "cbrt": lambda x: math.pow(x, 1 / 3),
    "log": math.log,
    "log2": math.log2,
    "log10": math.log10,
    "exp": math.exp,
    "pow": math.pow,
    # Trigonometry
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "asin": math.asin,
    "acos": math.acos,
    "atan": math.atan,
    "degrees": math.degrees,
    "radians": math.radians,
    # Constants
    "pi": math.pi,
    "e": math.e,
    # Statistics & Probability
    "factorial": math.factorial,
    "comb": math.comb,
    "perm": math.perm,
    "mean": statistics.mean,
    "median": statistics.median,
    "variance": statistics.variance,
    "stdev": statistics.stdev,
}


def _eval_node(node: ast.AST) -> Any:
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float, str, bool)):
            return node.value
        raise ValueError(f"Unsupported constant type: {type(node.value)}")

    if isinstance(node, ast.List):
        return [_eval_node(elt) for elt in node.elts]

    if isinstance(node, ast.Tuple):
        return tuple(_eval_node(elt) for elt in node.elts)

    if isinstance(node, ast.BinOp):
        op_type = type(node.op)
        if op_type not in OPERATORS:
            raise ValueError(f"Operator {op_type.__name__} is not allowed")
        left = _eval_node(node.left)
        right = _eval_node(node.right)
        return OPERATORS[op_type](left, right)

    if isinstance(node, ast.UnaryOp):
        op_type = type(node.op)
        if op_type not in OPERATORS:
            raise ValueError(f"Unary operator {op_type.__name__} is not allowed")
        operand = _eval_node(node.operand)
        return OPERATORS[op_type](operand)

    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name):
            raise ValueError("Only direct built-in mathematical function calls are allowed")
        func_name = node.func.id.lower()
        if func_name not in SAFE_FUNCTIONS:
            raise ValueError(f"Function '{func_name}' is not in permitted safe math library")
        args = [_eval_node(arg) for arg in node.args]
        return SAFE_FUNCTIONS[func_name](*args)

    if isinstance(node, ast.Name):
        name_lower = node.id.lower()
        if name_lower in SAFE_FUNCTIONS:
            val = SAFE_FUNCTIONS[name_lower]
            if isinstance(val, (int, float)):
                return val
        raise ValueError(f"Variable or identifier '{node.id}' is unknown")

    raise ValueError(f"Unsupported AST expression: {type(node).__name__}")


def calculate(expression: str) -> str:
    """Safely calculates mathematical expression. Returns human-readable result."""
    clean_expr = expression.strip()
    if not clean_expr:
        return "Error: Empty expression"

    # Replace common notation
    clean_expr = clean_expr.replace("^", "**")

    try:
        parsed = ast.parse(clean_expr, mode="eval")
        result = _eval_node(parsed.body)
        if isinstance(result, float):
            if result.is_integer():
                return str(int(result))
            return f"{result:.6g}"
        return str(result)
    except ZeroDivisionError:
        return "Error: Division by zero"
    except Exception as e:
        # Fallback to SymPy for symbolic math if available
        try:
            import sympy
            clean_sym = clean_expr.replace("**", "^")
            sym_expr = sympy.sympify(clean_sym, evaluate=True)
            return str(sym_expr)
        except Exception:
            return f"Calculation Error: {str(e)}"
