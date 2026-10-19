"""Safe Educational Graph Generator for EduSense AI.

Renders high-quality pedagogical charts using Matplotlib in headless mode.
Saves generated chart to public/uploads/generated_charts/ with unique hash
and returns a clean URL and markdown image link.
"""
from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

log = logging.getLogger("rag.tools.graph")

CHARTS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "public" / "uploads" / "generated_charts"


def generate_chart(
    chart_type: str,
    title: str,
    x_data: Union[List[Any], str],
    y_data: Optional[Union[List[Any], str]] = None,
    x_label: str = "X",
    y_label: str = "Y",
    series_name: str = "Data",
) -> Dict[str, Any]:
    """Generates a clean educational chart and saves it locally."""
    import matplotlib
    matplotlib.use("Agg")  # Non-interactive headless backend
    import matplotlib.pyplot as plt
    import numpy as np

    CHARTS_DIR.mkdir(parents=True, exist_ok=True)

    fig, ax = plt.subplots(figsize=(7, 4.5), dpi=150)
    # Apply clean modern styling
    ax.set_facecolor("#fcfcfd")
    fig.patch.set_facecolor("#ffffff")
    ax.grid(True, linestyle="--", alpha=0.5, color="#cbd5e1")
    for spine in ax.spines.values():
        spine.set_color("#94a3b8")

    try:
        if chart_type in {"function", "math"}:
            # x_data is range or expression
            x = np.linspace(-10, 10, 300)
            expr = str(y_data or x_data)
            # Safe numpy eval for standard math functions
            safe_dict = {
                "x": x,
                "np": np,
                "sin": np.sin,
                "cos": np.cos,
                "tan": np.tan,
                "exp": np.exp,
                "log": np.log,
                "sqrt": np.sqrt,
                "abs": np.abs,
                "pi": np.pi,
            }
            clean_math = expr.replace("^", "**")
            y = eval(clean_math, {"__builtins__": None}, safe_dict)  # safe restricted namespace
            ax.plot(x, y, label=f"y = {expr}", color="#3b82f6", linewidth=2.2)
        elif chart_type == "bar":
            categories = list(x_data) if isinstance(x_data, list) else [x_data]
            values = list(y_data) if isinstance(y_data, list) else [float(y_data or 0)]
            bars = ax.bar(categories, values, color="#6366f1", width=0.5, edgecolor="#4f46e5")
            for bar in bars:
                height = bar.get_height()
                ax.annotate(f"{height:.2g}",
                            xy=(bar.get_x() + bar.get_width() / 2, height),
                            xytext=(0, 3),  # 3 points vertical offset
                            textcoords="offset points",
                            ha='center', va='bottom', fontsize=9)
        elif chart_type == "histogram":
            vals = [float(v) for v in (x_data if isinstance(x_data, list) else [x_data])]
            ax.hist(vals, bins=10, color="#10b981", edgecolor="#059669", alpha=0.85)
        elif chart_type == "scatter":
            x_vals = [float(v) for v in (x_data if isinstance(x_data, list) else [x_data])]
            y_vals = [float(v) for v in (y_data if isinstance(y_data, list) else [y_data or 0])]
            ax.scatter(x_vals, y_vals, color="#ec4899", s=40, edgecolors="#db2777", alpha=0.9)
        else:  # default line chart
            x_vals = list(x_data) if isinstance(x_data, list) else [x_data]
            y_vals = [float(v) for v in (y_data if isinstance(y_data, list) else [y_data or 0])]
            ax.plot(x_vals, y_vals, marker="o", color="#2563eb", linewidth=2.2, label=series_name)

        ax.set_title(title, fontsize=12, fontweight="bold", color="#1e293b", pad=12)
        ax.set_xlabel(x_label, fontsize=10, color="#475569")
        ax.set_ylabel(y_label, fontsize=10, color="#475569")
        if chart_type in {"function", "math", "line"}:
            ax.legend(frameon=True, facecolor="#ffffff", edgecolor="#e2e8f0", fontsize=9)

        fig.tight_layout()

        # Compute stable file name
        content_key = f"{chart_type}_{title}_{x_data}_{y_data}"
        file_hash = hashlib.md5(content_key.encode()).hexdigest()[:12]
        filename = f"chart_{file_hash}.png"
        filepath = CHARTS_DIR / filename
        fig.savefig(filepath, format="png", dpi=150)
        plt.close(fig)

        web_url = f"/uploads/generated_charts/{filename}"
        markdown_embed = f"![{title}]({web_url})"

        return {
            "success": True,
            "filename": filename,
            "url": web_url,
            "markdown": markdown_embed,
            "title": title,
        }
    except Exception as e:
        plt.close(fig)
        log.error("Failed to generate chart: %s", e)
        return {"success": False, "error": str(e), "url": None, "markdown": ""}
