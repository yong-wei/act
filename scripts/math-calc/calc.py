#!/usr/bin/env python3
"""受限 SymPy 符号计算后端，供 KAQ calculate 工具使用。

从 stdin 读取 JSON：{
  "expression": str,   # LaTeX 或 SymPy 风格表达式
  "operation": str,    # simplify | expand | factor | apart | diff | integrate | laplace | inverse_laplace
  "variable": str      # 可选；diff/integrate/laplace 的变量
}

向 stdout 输出 JSON：{
  "status": "ok" | "error",
  "result": str,       # LaTeX 结果
  "steps": [{ "step", "description", "operation", "input", "output" }],
  "error": str | null
}

安全边界：
- 表达式只允许 ASCII 数学字符（不含下划线、引号、分号等）；
- parse_expr 使用无内建函数且仅含白名单符号的命名空间；
- 表达式长度受限，Python 进程内设置 CPU 时间限制。
"""

import json
import re
import sys

try:
    import resource
except ImportError:  # Windows 开发环境
    resource = None

from sympy import (
    Add,
    E,
    Float,
    I,
    Integer,
    Mul,
    Pow,
    Rational,
    Symbol,
    apart,
    cancel,
    cos,
    expand,
    exp,
    factor,
    factorial,
    gamma,
    integrate,
    latex,
    log,
    oo,
    pi,
    simplify,
    sin,
    sqrt,
    symbols,
    tan,
    together,
)
from sympy.integrals.transforms import (
    inverse_laplace_transform,
    laplace_transform,
)
from sympy.parsing.latex import parse_latex
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

MAX_EXPRESSION_LENGTH = 300
CPU_LIMIT_SECONDS = 5

# 不允许下划线、引号、分号、at 符号、反引号等危险字符。
EXPRESSION_PATTERN = re.compile(r"^[a-zA-Z0-9+\-*/^().,\s\\{}[\]]+$")
VARIABLE_PATTERN = re.compile(r"^[a-zA-Z][a-zA-Z0-9]{0,9}$")

TRANSFORMATIONS = standard_transformations + (convert_xor, implicit_multiplication_application)

# 受限命名空间：仅暴露白名单 SymPy 名称与常用变量。
LOCAL_NAMESPACE = {
    "E": E,
    "I": I,
    "pi": pi,
    "oo": oo,
    "Rational": Rational,
    "Symbol": Symbol,
    "symbols": symbols,
    "sqrt": sqrt,
    "exp": exp,
    "log": log,
    "sin": sin,
    "cos": cos,
    "tan": tan,
    "factorial": factorial,
    "gamma": gamma,
    "s": symbols("s"),
    "t": symbols("t"),
    "x": symbols("x"),
    "y": symbols("y"),
}

# 显式清空内建函数，防止属性链逃逸；这些构造器仅用于 parse_expr 的数字和运算符。
GLOBAL_NAMESPACE = {
    "__builtins__": {},
    "Add": Add,
    "Float": Float,
    "Integer": Integer,
    "Mul": Mul,
    "Pow": Pow,
    "Rational": Rational,
    "Symbol": Symbol,
}


def _step(seq: int, description: str, operation: str, inp: str, out: str) -> dict:
    return {
        "step": seq,
        "description": description,
        "operation": operation,
        "input": inp,
        "output": out,
    }


def _apply_cpu_limit() -> None:
    if resource is not None:
        try:
            resource.setrlimit(resource.RLIMIT_CPU, (CPU_LIMIT_SECONDS, CPU_LIMIT_SECONDS))
        except (ValueError, OSError):
            pass


def _parse_expression(expression: str):
    if len(expression) > MAX_EXPRESSION_LENGTH:
        raise ValueError("表达式过长")
    if not EXPRESSION_PATTERN.fullmatch(expression):
        raise ValueError("表达式包含不允许的字符")

    # 明确的 LaTeX 标记只允许严格 LaTeX 解析；纯 SymPy 风格表达式只走受限 parse_expr。
    if re.search(r"[\\{}]", expression):
        return parse_latex(expression, strict=True)

    return parse_expr(
        expression,
        local_dict=LOCAL_NAMESPACE,
        global_dict=GLOBAL_NAMESPACE,
        transformations=TRANSFORMATIONS,
        evaluate=True,
    )


def _pick_variable(expr, preferred: str | None) -> Symbol:
    if preferred is not None:
        if not isinstance(preferred, str):
            raise ValueError("变量必须是字符串")
        if not VARIABLE_PATTERN.fullmatch(preferred):
            raise ValueError("变量包含不允许的字符")
        candidate = symbols(preferred)
        if candidate in expr.free_symbols:
            return candidate
    for candidate in (symbols("s"), symbols("t"), symbols("x"), symbols("y")):
        if candidate in expr.free_symbols:
            return candidate
    return symbols("x")


def _derive(expression: str, operation: str, variable: str | None) -> dict:
    expr = _parse_expression(expression)
    steps = []
    seq = 0

    seq += 1
    steps.append(_step(seq, "原始表达式", "identify", latex(expr), latex(expr)))

    var = _pick_variable(expr, variable)

    if operation == "simplify":
        seq += 1
        result = simplify(expr)
        steps.append(_step(seq, "符号化简", "simplify", latex(expr), latex(result)))
    elif operation == "expand":
        seq += 1
        result = expand(expr)
        steps.append(_step(seq, "多项式展开", "expand", latex(expr), latex(result)))
    elif operation == "factor":
        seq += 1
        result = factor(expr)
        steps.append(_step(seq, "因式分解", "factor", latex(expr), latex(result)))
    elif operation == "apart":
        seq += 1
        result = apart(expr, var)
        steps.append(_step(seq, "部分分式展开", "apart", latex(expr), latex(result)))
    elif operation == "diff":
        seq += 1
        result = expr.diff(var)
        steps.append(
            _step(
                seq,
                f"对变量 {var} 求导",
                "diff",
                latex(expr),
                latex(result),
            )
        )
    elif operation == "integrate":
        seq += 1
        result = integrate(expr, var)
        steps.append(
            _step(
                seq,
                f"对变量 {var} 积分",
                "integrate",
                latex(expr),
                latex(result),
            )
        )
    elif operation == "laplace":
        t = symbols("t")
        s = symbols("s")
        seq += 1
        steps.append(
            _step(
                seq,
                "写出拉普拉斯变换定义式",
                "definition",
                rf"F(s) = \mathcal{{L}}\{{f(t)\}} = \int_{{0}}^{{\infty}} f(t) e^{{-s t}} dt",
                rf"F(s) = \int_{{0}}^{{\infty}} {latex(expr)} e^{{-s t}} dt",
            )
        )
        result, _, _ = laplace_transform(expr, t, s)
        seq += 1
        steps.append(_step(seq, "执行积分变换", "laplace_transform", latex(expr), latex(result)))
    elif operation == "inverse_laplace":
        t = symbols("t")
        s = symbols("s")
        seq += 1
        result = inverse_laplace_transform(expr, s, t)
        steps.append(_step(seq, "执行逆变换", "inverse_laplace_transform", latex(expr), latex(result)))
    else:
        raise ValueError(f"不支持的操作: {operation}")

    if operation not in ("laplace", "inverse_laplace"):
        seq += 1
        simplified = simplify(result)
        if not simplified.equals(result):
            steps.append(_step(seq, "化简结果", "simplify", latex(result), latex(simplified)))
            result = simplified

    return {"status": "ok", "result": latex(result), "steps": steps, "error": None}


def main() -> None:
    _apply_cpu_limit()
    try:
        raw = sys.stdin.read()
        data = json.loads(raw)
    except Exception as exc:
        print(json.dumps({"status": "error", "result": "", "steps": [], "error": f"无效输入: {exc}"}))
        sys.exit(1)

    expression = data.get("expression", "")
    operation = data.get("operation", "simplify")
    variable = data.get("variable")

    if not isinstance(expression, str) or not expression.strip():
        print(json.dumps({"status": "error", "result": "", "steps": [], "error": "缺少表达式"}))
        sys.exit(1)

    try:
        result = _derive(expression, operation, variable)
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0 if result["status"] == "ok" else 1)
    except Exception as exc:
        print(json.dumps({"status": "error", "result": "", "steps": [], "error": str(exc)}))
        sys.exit(2)


if __name__ == "__main__":
    main()
