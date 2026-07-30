 #!/usr/bin/env python3
 """公式推导引擎 -- 使用 SymPy 执行拉普拉斯变换与符号化简的逐步推导。

 输入：stdin JSON，包含 {
   "type": "laplace" | "simplify" | "inverse_laplace",
   "expression": str,       # 待推导的数学表达式（SymPy 可解析格式）
   "variable": str,          # 自变量，默认 "t"（时域）或 "s"（复域）
   "params": dict            # 额外参数（如初值条件）
 }

 输出：stdout JSON，包含 {
   "status": "ok" | "error",
   "steps": [{
     "step": int,
     "description": str,
     "operation": str,
     "input": str,          # LaTeX 格式的输入表达式
     "output": str          # LaTeX 格式的输出表达式
   }],
   "result": str,           # 最终结果的 LaTeX
   "error": str | null
 }

 退出码：0 成功，1 输入错误，2 推导失败
 """

 import json
 import sys

 from sympy import (
     latex, parse_expr, simplify, apart, together, cancel, factor, expand,
     symbols, sympify, Symbol, oo, rcParams
 )
 from sympy.integrals.transforms import laplace_transform, inverse_laplace_transform

 # SymPy LaTeX 输出配置：不将 π 渲染为 \pi 符号，保持变量名不自动希腊化
 rcParams["mathematical_latex"] = True


 # ── 常用拉普拉斯变换表（用于展示推导过程） ──────────────────────────────
 # 格式：(时域表达式, 复域表达式, 变换对名称)
 LAPLACE_PAIRS: list[tuple[str, str, str]] = [
     ("1", "1/s", "阶跃函数"),
     ("t", "1/s**2", "单位斜坡"),
     ("t**n", "gamma(n + 1)/s**(n + 1)", "幂函数"),
     ("exp(-a*t)", "1/(s + a)", "指数衰减"),
     ("t*exp(-a*t)", "1/(s + a)**2", "指数调制斜坡"),
     ("sin(omega*t)", "omega/(s**2 + omega**2)", "正弦函数"),
     ("cos(omega*t)", "s/(s**2 + omega**2)", "余弦函数"),
     ("exp(-a*t)*sin(omega*t)", "omega/((s + a)**2 + omega**2)", "衰减正弦"),
     ("exp(-a*t)*cos(omega*t)", "(s + a)/((s + a)**2 + omega**2)", "衰减余弦"),
     ("DiracDelta(t)", "1", "单位冲激"),
 ]


 def _make_step(seq: int, desc: str, op: str, inp: str, out: str) -> dict:
     return {
         "step": seq,
         "description": desc,
         "operation": op,
         "input": inp,
         "output": out,
     }


 def derive_laplace(expr_str: str, var_str: str = "t") -> dict:
     """执行拉普拉斯变换的逐步推导。"""
     t = symbols(var_str)
     s = symbols("s")

     expr = sympify(expr_str)
     steps = []
     seq = 0

     # 步骤 1：展示原始函数
     seq += 1
     steps.append(_make_step(
         seq, "定义时域函数", "identify",
         f"f({var_str}) = {latex(expr)}",
         f"f({var_str}) = {latex(expr)}"
     ))

     # 步骤 2：写出拉普拉斯变换定义
     seq += 1
     steps.append(_make_step(
         seq, "写出拉普拉斯变换定义式", "definition",
         f"F(s) = \mathcal{{L}}\{{f({var_str})\}} = \int_{{0}}^{{\infty}} f({var_str}) e^{{-s{var_str}}} d{var_str}",
         f"F(s) = \int_{{0}}^{{\infty}} {latex(expr)} e^{{-s{var_str}}} d{var_str}"
     ))

     # 步骤 3：检查是否匹配常用变换对
     for t_expr, s_expr, name in LAPLACE_PAIRS:
         t_sym = sympify(t_expr)
         try:
             if expr.equals(t_sym) or expr.simplify().equals(t_sym):
                 seq += 1
                 steps.append(_make_step(
                     seq, f"匹配常用变换对：{name}", "match_pair",
                     f"\mathcal{{L}}\{{{latex(t_sym)}\}}",
                     f"{latex(sympify(s_expr))}"
                 ))
                 break
         except Exception:
             continue

     # 步骤 4：执行 SymPy 拉普拉斯变换
     seq += 1
     try:
         result, a, cond = laplace_transform(expr, t, s)
     except Exception as e:
         return {"status": "error", "steps": steps, "result": "", "error": str(e)}

     if a and a != -oo:
         convergence = f"\sigma > {latex(a)}" if a != oo else ""
     else:
         convergence = ""

     steps.append(_make_step(
         seq, "执行积分运算", "compute_transform",
         f"F(s) = \int_{{0}}^{{\infty}} {latex(expr)} e^{{-s{var_str}}} d{var_str}",
         f"F(s) = {latex(result)}" + (f",\quad {convergence}" if convergence else "")
     ))

     # 步骤 5：化简结果
     seq += 1
     simplified = simplify(result)
     steps.append(_make_step(
         seq, "化简结果表达式", "simplify",
         latex(result),
         latex(simplified)
     ))

     return {
         "status": "ok",
         "steps": steps,
         "result": latex(simplified),
         "error": None,
     }


 def derive_simplify(expr_str: str) -> dict:
     """执行符号表达式的逐步化简。"""
     expr = sympify(expr_str)
     t = symbols("t")
     s = symbols("s")
     steps = []
     seq = 0

     seq += 1
     steps.append(_make_step(seq, "原始表达式", "identify", latex(expr), latex(expr)))

     # 展开
     try:
         seq += 1
         expanded = expand(expr)
         if not expanded.equals(expr):
             steps.append(_make_step(seq, "展开多项式", "expand", latex(expr), latex(expanded)))
             expr = expanded
     except Exception:
         pass

     # 合并通分
     try:
         seq += 1
         combined = together(expr)
         if not combined.equals(expr):
             steps.append(_make_step(seq, "通分合并", "together", latex(expr), latex(combined)))
             expr = combined
     except Exception:
         pass

     # 部分分式展开（如果是 s 的有理函数）
     try:
         if "s" in expr_str or "S" in expr_str:
             seq += 1
             aparted = apart(expr, s)
             if not aparted.equals(expr):
                 steps.append(_make_step(seq, "部分分式展开", "apart", latex(expr), latex(aparted)))
                 expr = aparted
     except Exception:
         pass

     # 最终化简
     seq += 1
     simplified = simplify(expr)
     steps.append(_make_step(seq, "最终化简", "simplify", latex(expr), latex(simplified)))

     return {
         "status": "ok",
         "steps": steps,
         "result": latex(simplified),
         "error": None,
     }


 def derive_inverse_laplace(expr_str: str, var_str: str = "s") -> dict:
     """执行逆拉普拉斯变换的逐步推导。"""
     s = symbols(var_str)
     t = symbols("t")
     steps = []
     seq = 0

     expr = sympify(expr_str)

     seq += 1
     steps.append(_make_step(
         seq, "定义复域函数", "identify",
         f"F({var_str}) = {latex(expr)}",
         f"F({var_str}) = {latex(expr)}"
     ))

     seq += 1
     steps.append(_make_step(
         seq, "写出逆变换定义式", "definition",
         f"f(t) = \mathcal{{L}}^{{-1}}\{{F({var_str})\}} = \frac{{1}}{{2\pi j}} \int_{{\sigma - j\infty}}^{{\sigma + j\infty}} F({var_str}) e^{{{var_str}t}} d{var_str}",
         f"f(t) = \frac{{1}}{{2\pi j}} \int_{{\sigma - j\infty}}^{{\sigma + j\infty}} {latex(expr)} e^{{{var_str}t}} d{var_str}"
     ))

     # 部分分式展开（如果是有理函数）
     try:
         seq += 1
         aparted = apart(expr, s)
         if not aparted.equals(expr):
             steps.append(_make_step(seq, "部分分式展开", "apart", latex(expr), latex(aparted)))
             expr = aparted
     except Exception:
         pass

     # 执行逆变换
     seq += 1
     try:
         result = inverse_laplace_transform(expr, s, t)
         steps.append(_make_step(seq, "执行逆变换", "compute_inverse", latex(expr), latex(result)))
     except Exception as e:
         return {"status": "error", "steps": steps, "result": "", "error": str(e)}

     return {
         "status": "ok",
         "steps": steps,
         "result": latex(result),
         "error": None,
     }


 DERIVE_MAP = {
     "laplace": derive_laplace,
     "simplify": derive_simplify,
     "inverse_laplace": derive_inverse_laplace,
 }


 def main() -> None:
     try:
         raw = sys.stdin.read()
         data = json.loads(raw)
     except (json.JSONDecodeError, Exception) as e:
         print(json.dumps({"status": "error", "steps": [], "result": "", "error": f"Invalid input: {e}"}))
         sys.exit(1)

     derive_type = data.get("type", "")
     expression = data.get("expression", "")
     variable = data.get("variable", "t")

     if not expression or derive_type not in DERIVE_MAP:
         print(json.dumps({"status": "error", "steps": [], "result": "", "error": f"Unknown type '{derive_type}' or empty expression"}))
         sys.exit(1)

     try:
         result = DERIVE_MAP[derive_type](expression, variable)
         is_ok = result.get("status") == "ok"
         print(json.dumps(result, ensure_ascii=False))
         sys.exit(0 if is_ok else 1)
     except Exception as e:
         print(json.dumps({"status": "error", "steps": [], "result": "", "error": str(e)}))
         sys.exit(2)


 if __name__ == "__main__":
     main()
