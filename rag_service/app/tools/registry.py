"""Tool Registry and Router for EduSense AI.

Provides safe computational capabilities:
1. calculator: math, algebra, probability, statistics
2. graph_generator: matplotlib pedagogical charts
3. python_executor: sandboxed educational algorithm execution
"""
from __future__ import annotations

import logging
from typing import Any, Callable, Dict, List, Optional

from app.tools.calculator import calculate
from app.tools.graph_generator import generate_chart
from app.tools.python_executor import execute_sandboxed_python

log = logging.getLogger("rag.tools.registry")


class Tool:
    def __init__(self, name: str, description: str, func: Callable[..., Any], parameters: Dict[str, Any]):
        self.name = name
        self.description = description
        self.func = func
        self.parameters = parameters

    def run(self, **kwargs: Any) -> Any:
        try:
            return self.func(**kwargs)
        except Exception as e:
            log.error("Tool '%s' error: %s", self.name, e)
            return {"error": f"Tool '{self.name}' failed: {str(e)}"}


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: Dict[str, Tool] = {}
        self._init_defaults()

    def _init_defaults(self) -> None:
        self.register(
            Tool(
                name="calculator",
                description="Safely computes mathematical, statistical, probability, and trigonometric expressions. e.g. 'sqrt(144) + 12', 'mean([10, 20, 30])', 'comb(10, 3)'",
                func=lambda expression: calculate(expression),
                parameters={
                    "type": "object",
                    "properties": {"expression": {"type": "string", "description": "Expression to evaluate"}},
                    "required": ["expression"],
                },
            )
        )
        self.register(
            Tool(
                name="generate_chart",
                description="Generates an educational graph (line, bar, histogram, scatter, function) and returns an embedded image link.",
                func=lambda **kw: generate_chart(**kw),
                parameters={
                    "type": "object",
                    "properties": {
                        "chart_type": {"type": "string", "enum": ["line", "bar", "histogram", "scatter", "function"]},
                        "title": {"type": "string"},
                        "x_data": {"type": "array"},
                        "y_data": {"type": "array"},
                        "x_label": {"type": "string"},
                        "y_label": {"type": "string"},
                    },
                    "required": ["chart_type", "title", "x_data"],
                },
            )
        )
        self.register(
            Tool(
                name="python_executor",
                description="Runs sandboxed Python code for numerical algorithms, sorting, matrix computations, and data structures. Strictly isolated without OS or network access.",
                func=lambda code: execute_sandboxed_python(code),
                parameters={
                    "type": "object",
                    "properties": {"code": {"type": "string", "description": "Python code snippet"}},
                    "required": ["code"],
                },
            )
        )

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> Optional[Tool]:
        return self._tools.get(name)

    def execute(self, name: str, **kwargs: Any) -> Any:
        t = self.get(name)
        if not t:
            return {"error": f"Tool '{name}' not found"}
        return t.run(**kwargs)

    def list_tools(self) -> List[Dict[str, Any]]:
        return [{"name": t.name, "description": t.description, "parameters": t.parameters} for t in self._tools.values()]


_registry: Optional[ToolRegistry] = None


def get_tool_registry() -> ToolRegistry:
    global _registry
    if _registry is None:
        _registry = ToolRegistry()
    return _registry
