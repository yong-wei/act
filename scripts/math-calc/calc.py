#!/usr/bin/env python3
"""受限 SymPy 符号计算后端，供 KAQ calculate 工具使用。"""

import json
import re
import sys

try:
    import resource
except ImportError:
    resource = None

from sympy import (
    E,
    I,
    Float,
    Integer,
    Rational,
    Symbol,
    apart,
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
)
from sympy.integrals.transforms import inverse_laplace_transform, laplace_transform
from sympy.parsing.latex import parse_latex
from sympy.parsing.sympy_parser import (
    auto_symbol,
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

MAX_EXPRESSION_LENGTH = 300
CPU_LIMIT_SECONDS = 5
EXPRESSION_PATTERN = re.compile(r"^[a-zA-Z0-9+\-*/^().,\s\\{}[\]]+$")

TRANSFORMATIONS = standard_transformations + (
    convert_xor,
    implicit_multiplication_application,
    auto_symbol,
)

LOCAL_NAMESPACE = {
    "E": E,
    "I": I,
    "Float": Float,
    "Integer": Integer,
    "pi": pi,
    "oo": oo,
    "Rational": Rational,
    "Symbol": Symbol,
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

GLOBAL_NAMESPACE = {"__builtins__": {}}


def _step(seq: int, description: str, input_expression: str, output_expression: str) -> dict:
    return {
        "step": seq,
        "description": description,
        "input": input_expression,
        "output": output_expression,
    }


def _apply_cpu_limit() -> None:
    if resource is None:
        return
    try:
        resource.setrlimit(resource.RLIMIT_CPU, (CPU_LIMIT_SECONDS, CPU_LIMIT_SECONDS))
    except (ValueError, OSError):
        pass


def _parse_sympy_expression(expression: str):
    return parse_expr(
        expression,
        local_dict=LOCAL_NAMESPACE,
        global_dict=GLOBAL_NAMESPACE,
        transformations=TRANSFORMATIONS,
        evaluate=True,
    )


def _parse_expression(expression: str):
    if len(expression) > MAX_EXPRESSION_LENGTH:
        raise ValueError("表达式过长")
    if not EXPRESSION_PATTERN.fullmatch(expression):
        raise ValueError("表达式包含不允许的字符")

    if "\\" in expression or "{" in expression or "}" in expression:
        try:
            return parse_latex(expression)
        except Exception:
            pass
    return _parse_sympy_expression(expression)


def _pick_variable(expr, preferred: str | None) -> Symbol:
    if preferred:
        candidate = symbols(preferred)
        if candidate in expr.free_symbols:
            return candidate
    for candidate in (symbols("s"), symbols("t"), symbols("x"), symbols("y")):
        if candidate in expr.free_symbols:
            return candidate
    return symbols("x")


def _derive(expression: str, operation: str, variable: str | None) -> dict:
    expr = _parse_expression(expression)
    steps = [_step(1, "原始表达式", latex(expr), latex(expr))]
    variable_symbol = _pick_variable(expr, variable)

    if operation == "simplify":
        result = simplify(expr)
        steps.append(_step(2, "符号化简", latex(expr), latex(result)))
    elif operation == "expand":
        result = expand(expr)
        steps.append(_step(2, "多项式展开", latex(expr), latex(result)))
    elif operation == "factor":
        result = factor(expr)
        steps.append(_step(2, "因式分解", latex(expr), latex(result)))
    elif operation == "apart":
        result = apart(expr, variable_symbol)
        steps.append(_step(2, "部分分式展开", latex(expr), latex(result)))
    elif operation == "diff":
        result = expr.diff(variable_symbol)
        steps.append(
            _step(2, f"对变量 {variable_symbol} 求导", latex(expr), latex(result))
        )
    elif operation == "integrate":
        result = integrate(expr, variable_symbol)
        steps.append(
            _step(2, f"对变量 {variable_symbol} 积分", latex(expr), latex(result))
        )
    elif operation == "laplace":
        time_variable = symbols("t")
        frequency_variable = symbols("s")
        steps.append(
            _step(
                2,
                "写出拉普拉斯变换定义式",
                r"F(s) = \mathcal{L}\{f(t)\} = \int_{0}^{\infty} f(t)e^{-st}dt",
                rf"F(s) = \int_{{0}}^{{\infty}} {latex(expr)} e^{{-s t}} dt",
            )
        )
        result, _, _ = laplace_transform(expr, time_variable, frequency_variable)
        steps.append(_step(3, "执行积分变换", latex(expr), latex(result)))
    elif operation == "inverse_laplace":
        time_variable = symbols("t")
        frequency_variable = symbols("s")
        result = inverse_laplace_transform(expr, frequency_variable, time_variable)
        steps.append(
            _step(2, "执行逆变换", latex(expr), latex(result))
        )
    else:
        raise ValueError(f"不支持的操作: {operation}")

    if operation not in ("laplace", "inverse_laplace"):
        simplified = simplify(result)
        if not simplified.equals(result):
            steps.append(
                _step(len(steps) + 1, "化简结果", latex(result), latex(simplified))
            )
            result = simplified

    return {
        "status": "ok",
        "result": latex(result),
        "steps": steps,
        "error": None,
    }


def _error(message: str) -> str:
    return json.dumps(
        {"status": "error", "result": "", "steps": [], "error": message},
        ensure_ascii=False,
    )


def main() -> None:
    _apply_cpu_limit()
    try:
        data = json.loads(sys.stdin.read())
    except Exception as exc:
        print(_error(f"无效输入: {exc}"))
        sys.exit(1)

    expression = data.get("expression", "")
    operation = data.get("operation", "simplify")
    variable = data.get("variable")
    if not isinstance(expression, str) or not expression.strip():
        print(_error("缺少表达式"))
        sys.exit(1)

    try:
        result = _derive(expression, operation, variable)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:
        print(_error(str(exc)))
        sys.exit(2)


if __name__ == "__main__":
    main()
