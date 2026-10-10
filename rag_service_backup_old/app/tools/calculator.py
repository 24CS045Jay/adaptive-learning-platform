"""
Safe Calculator Tool.
Evaluates mathematical expressions safely using Python's AST parser without eval() or dangerous builtins.
"""

from __future__ import annotations

import ast
import math
import operator
from typing import Any, Union

# Allowed operators
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

# Allowed math functions
MATH_FUNCTIONS = {
    "abs": abs,
    "round": round,
    "min": min,
    "max": max,
    "sum": sum,
    "sqrt": math.sqrt,
    "log": math.log,
    "log10": math.log10,
    "exp": math.exp,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "pi": math.pi,
    "e": math.e,
}


def _eval_node(node: ast.AST) -> Union[int, float]:
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return node.value
        raise ValueError(f"Unsupported constant type: {type(node.value)}")

    if isinstance(node, ast.BinOp):
        op_type = type(node.op)
        if op_type not in OPERATORS:
            raise ValueError(f"Unsupported operator: {op_type}")
        left = _eval_node(node.left)
        right = _eval_node(node.right)
        return OPERATORS[op_type](left, right)

    if isinstance(node, ast.UnaryOp):
        op_type = type(node.op)
        if op_type not in OPERATORS:
            raise ValueError(f"Unsupported unary operator: {op_type}")
        operand = _eval_node(node.operand)
        return OPERATORS[op_type](operand)

    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name):
            raise ValueError("Only direct function calls are allowed")
        func_name = node.func.id
        if func_name not in MATH_FUNCTIONS:
            raise ValueError(f"Function '{func_name}' is not permitted")
        args = [_eval_node(arg) for arg in node.args]
        func = MATH_FUNCTIONS[func_name]
        return func(*args)

    if isinstance(node, ast.Name):
        if node.id in MATH_FUNCTIONS:
            val = MATH_FUNCTIONS[node.id]
            if isinstance(val, (int, float)):
                return val
        raise ValueError(f"Unknown variable or identifier: {node.id}")

    raise ValueError(f"Unsupported AST node expression: {type(node)}")


def calculate(expression: str) -> str:
    """
    Safely calculates mathematical expression.
    Returns the result formatted as a string.
    """
    clean_expr = expression.strip()
    if not clean_expr:
        return "Error: Empty expression"

    try:
        parsed = ast.parse(clean_expr, mode="eval")
        result = _eval_node(parsed.body)
        if isinstance(result, float) and result.is_integer():
            return str(int(result))
        return str(result)
    except ZeroDivisionError:
        return "Error: Division by zero"
    except Exception as e:
        return f"Error evaluating expression: {str(e)}"
