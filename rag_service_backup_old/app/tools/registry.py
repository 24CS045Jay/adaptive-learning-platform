"""
Tool Registry and Router for Agentic RAG.
Provides registered tools with unified interface and schemas for LangGraph agent nodes.
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Dict, List, Optional

from app.tools.calculator import calculate
from app.tools.python_executor import execute_sandboxed_python

logger = logging.getLogger("rag_service.tools.registry")


class Tool:
    def __init__(
        self,
        name: str,
        description: str,
        func: Callable[..., Any],
        parameters_schema: Dict[str, Any],
    ):
        self.name = name
        self.description = description
        self.func = func
        self.parameters_schema = parameters_schema

    def run(self, **kwargs) -> Any:
        try:
            return self.func(**kwargs)
        except Exception as e:
            logger.error(f"Error executing tool '{self.name}': {e}", exc_info=True)
            return f"Tool Execution Error: {str(e)}"


class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, Tool] = {}
        self._register_default_tools()

    def _register_default_tools(self):
        # 1. Calculator
        self.register(
            Tool(
                name="calculator",
                description="Evaluates arithmetic expressions and basic mathematical formulas safely. Input: expression string.",
                func=lambda expression: calculate(expression),
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "expression": {"type": "string", "description": "Mathematical expression, e.g., '(15 * 4) + 2^3'"}
                    },
                    "required": ["expression"],
                },
            )
        )

        # 2. Sandboxed Python
        self.register(
            Tool(
                name="python_executor",
                description="Runs sandboxed Python code for numerical algorithms, data structures, and code problem demonstrations.",
                func=lambda code: execute_sandboxed_python(code),
                parameters_schema={
                    "type": "object",
                    "properties": {
                        "code": {"type": "string", "description": "Python code snippet to execute"}
                    },
                    "required": ["code"],
                },
            )
        )

    def register(self, tool: Tool):
        self._tools[tool.name] = tool

    def get(self, name: str) -> Optional[Tool]:
        return self._tools.get(name)

    def list_tools(self) -> List[Tool]:
        return list(self._tools.values())

    def execute(self, tool_name: str, **kwargs) -> Any:
        tool = self.get(tool_name)
        if not tool:
            return f"Error: Tool '{tool_name}' not found."
        return tool.run(**kwargs)


_global_tool_registry: Optional[ToolRegistry] = None


def get_tool_registry() -> ToolRegistry:
    global _global_tool_registry
    if _global_tool_registry is None:
        _global_tool_registry = ToolRegistry()
    return _global_tool_registry
