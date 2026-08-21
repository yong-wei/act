#!/usr/bin/env wolframscript

ClearAll[
  writeResponse, fail, tex, makeStep, appendExpressionStep, appendTextStep,
  verificationLabel, appendVerificationStep, normalizePlainExpression,
  parseExpression, pickVariable, differentiationRule,
  containsUnevaluatedComputationQ, partialFractionTeachingData,
  appendPartialFractionTeachingSteps, appendDifferentiationTeachingSteps,
  integrationSubstitutionData, appendIntegrationSubstitutionSteps, calculate
];

allowedHeads = {
  HoldComplete, Plus, Times, Power, Rational, Complex,
  Sin, Cos, Tan, Exp, Log, Abs
};

allowedSystemSymbols = {
  E, Pi, I, Infinity,
  Plus, Times, Power, Rational, Complex,
  Sin, Cos, Tan, Exp, Log, Abs
};

writeResponse[payload_Association] := Print[
  ExportString[payload, "RawJSON", "Compact" -> True]
];

fail[message_String, code_Integer : 2] := (
  writeResponse[<|
    "status" -> "error",
    "result" -> "",
    "steps" -> {},
    "error" -> message
  |>];
  Exit[code]
);

tex[expression_] := ToString[TeXForm[expression]];

makeStep[number_Integer, description_String, operation_String, input_String, output_String] := <|
  "step" -> number,
  "description" -> description,
  "operation" -> operation,
  "input" -> input,
  "output" -> output
|>;

appendExpressionStep[
  steps_List,
  description_String,
  operation_String,
  input_,
  output_,
  force_ : False
] := Module[{inputTex, outputTex},
  inputTex = tex[input];
  outputTex = tex[output];
  If[!TrueQ[force] && inputTex === outputTex,
    steps,
    Append[steps, makeStep[Length[steps] + 1, description, operation, inputTex, outputTex]]
  ]
];

appendTextStep[
  steps_List,
  description_String,
  operation_String,
  input_String,
  output_String
] := Append[steps, makeStep[Length[steps] + 1, description, operation, input, output]];

verificationLabel[verification_] := Which[
  verification === $Failed, "unresolved",
  TrueQ[verification], "verified",
  verification === False, "failed",
  True, "conditional or unresolved: " <> tex[verification]
];

appendVerificationStep[
  steps_List,
  description_String,
  operation_String,
  input_,
  verification_
] := appendTextStep[
  steps,
  description,
  operation,
  tex[input],
  verificationLabel[verification]
];

normalizePlainExpression[expression_String] := FixedPoint[
  StringReplace[#, {
    "**" -> "^",
    RegularExpression["(?i)\\bsin\\(([^()]*)\\)"] -> "Sin[$1]",
    RegularExpression["(?i)\\bcos\\(([^()]*)\\)"] -> "Cos[$1]",
    RegularExpression["(?i)\\btan\\(([^()]*)\\)"] -> "Tan[$1]",
    RegularExpression["(?i)\\bexp\\(([^()]*)\\)"] -> "Exp[$1]",
    RegularExpression["(?i)\\blog\\(([^()]*)\\)"] -> "Log[$1]",
    RegularExpression["(?i)\\babs\\(([^()]*)\\)"] -> "Abs[$1]"
  }] &,
  expression
];

validHeldExpressionQ[held_HoldComplete] := Module[{heads, symbols},
  heads = DeleteDuplicates@Cases[
    held,
    HoldPattern[(head_Symbol)[___]] :> Unevaluated[head],
    Infinity,
    Heads -> True
  ];
  symbols = DeleteDuplicates@Cases[held, symbol_Symbol :> Unevaluated[symbol], Infinity, Heads -> False];
  AllTrue[heads, MemberQ[allowedHeads, #] &] && AllTrue[
    symbols,
    MemberQ[allowedSystemSymbols, #] ||
      (# === HoldComplete) ||
      (Context[Unevaluated[#]] === "Global`" &&
        StringMatchQ[SymbolName[Unevaluated[#]], RegularExpression["[A-Za-z][A-Za-z0-9]{0,9}"]]) &
  ]
];

parseExpression[expression_String] := Module[{held, plain},
  held = If[
    StringContainsQ[expression, "\\"] || StringContainsQ[expression, "{"] || StringContainsQ[expression, "}"],
    Quiet@Check[ToExpression[expression, TeXForm, HoldComplete], $Failed],
    plain = normalizePlainExpression[expression];
    Quiet@Check[ToExpression[plain, InputForm, HoldComplete], $Failed]
  ];
  If[held === $Failed || !MatchQ[held, HoldComplete[_]], fail["无法解析表达式"]];
  If[!validHeldExpressionQ[held], fail["表达式包含不允许的数学结构"]];
  ReleaseHold[held]
];

pickVariable[expression_, preferred_] := Module[{symbols, preferredSymbol},
  symbols = Variables[Level[expression, {-1}]];
  If[StringQ[preferred] && StringMatchQ[preferred, RegularExpression["[A-Za-z][A-Za-z0-9]{0,9}"]],
    preferredSymbol = Symbol["Global`" <> preferred];
    If[MemberQ[symbols, preferredSymbol], Return[preferredSymbol]]
  ];
  SelectFirst[{s, t, x, y}, MemberQ[symbols, #] &, x]
];

differentiationRule[expression_] := Which[
  Head[expression] === Plus, {"Apply the sum rule", "D[u+v]=D[u]+D[v]"},
  Head[expression] === Times, {"Apply the product rule", "D[uv]=uD[v]+vD[u]"},
  Head[expression] === Power, {"Apply the power or chain rule", "D[u^n]=n u^(n-1) D[u]"},
  True, {"Apply the matching elementary derivative rule", "Differentiate the outer form and then its argument"}
];

containsUnevaluatedComputationQ[expression_] := !FreeQ[
  expression,
  _Integrate | _LaplaceTransform | _InverseLaplaceTransform
];

partialFractionTeachingData[rational_, variable_] := Module[
  {
    numerator, denominator, factorData, coefficientCount, coefficients,
    displayCoefficients, displayRules, partialTerms, coefficientIndex,
    factor, multiplicity, degree, power, numeratorPolynomial, quotient,
    remainder, ansatz, clearedLeft, clearedRight, coefficientPolynomial,
    coefficientValues, equations, solution, displayAnsatz, displayEquations, displaySolution,
    solvedAnsatz, displaySolvedAnsatz, result
  },
  numerator = Numerator[rational];
  denominator = Denominator[rational];
  If[!PolynomialQ[numerator, variable] || !PolynomialQ[denominator, variable], Return[$Failed]];

  factorData = Rest[FactorList[denominator]];
  coefficientCount = Total[(Exponent[#[[1]], variable] #[[2]]) & /@ factorData];
  If[coefficientCount < 1 || coefficientCount > 12, Return[$Failed]];

  coefficients = Table[Unique["pfCoefficient"], {coefficientCount}];
  displayCoefficients = Table[Subscript[a, index], {index, coefficientCount}];
  displayRules = Thread[coefficients -> displayCoefficients];
  partialTerms = {};
  coefficientIndex = 1;

  Do[
    factor = factorPair[[1]];
    multiplicity = factorPair[[2]];
    degree = Exponent[factor, variable];
    Do[
      numeratorPolynomial = Sum[
        coefficients[[coefficientIndex + offset]] variable^offset,
        {offset, 0, degree - 1}
      ];
      coefficientIndex += degree;
      partialTerms = Append[partialTerms, numeratorPolynomial/factor^power],
      {power, 1, multiplicity}
    ],
    {factorPair, factorData}
  ];

  {quotient, remainder} = PolynomialQuotientRemainder[numerator, denominator, variable];
  ansatz = quotient + Total[partialTerms];
  clearedLeft = Expand[numerator];
  clearedRight = Expand[Cancel[ansatz denominator]];
  coefficientPolynomial = Expand[clearedLeft - clearedRight];
  coefficientValues = CoefficientList[coefficientPolynomial, variable];
  equations = DeleteCases[
    Thread[coefficientValues == ConstantArray[0, Length[coefficientValues]]],
    True
  ];
  If[equations === {} || !ListQ[equations], Return[$Failed]];

  solution = Quiet@Check[Solve[equations, coefficients], $Failed];
  If[solution === $Failed || solution === {}, Return[$Failed]];
  solution = First[solution];
  solvedAnsatz = ansatz /. solution;
  result = Apart[rational, variable];
  If[!TrueQ[FullSimplify[Together[solvedAnsatz - result] == 0]], Return[$Failed]];

  displayAnsatz = ansatz /. displayRules;
  displayEquations = equations /. displayRules;
  displaySolution = solution /. displayRules;
  displaySolvedAnsatz = solvedAnsatz;

  <|
    "Result" -> result,
    "AnsatzEquation" -> (tex[rational] <> "=" <> tex[displayAnsatz]),
    "ClearedEquation" -> (tex[clearedLeft] <> "=" <> tex[clearedRight /. displayRules]),
    "CoefficientEquations" -> StringRiffle[tex /@ displayEquations, ",\\quad "],
    "CoefficientSolution" -> tex[displaySolution],
    "SolvedEquation" -> (tex[rational] <> "=" <> tex[displaySolvedAnsatz])
  |>
];

appendPartialFractionTeachingSteps[steps_List, rational_, data_Association] := Module[{nextSteps},
  nextSteps = appendTextStep[
    steps,
    "Write the governed partial-fraction ansatz with undetermined coefficients",
    "partial_fraction_ansatz",
    tex[rational],
    data["AnsatzEquation"]
  ];
  nextSteps = appendTextStep[
    nextSteps,
    "Multiply by the common denominator",
    "clear_denominators",
    data["AnsatzEquation"],
    data["ClearedEquation"]
  ];
  nextSteps = appendTextStep[
    nextSteps,
    "Compare coefficients of equal powers",
    "coefficient_equations",
    data["ClearedEquation"],
    data["CoefficientEquations"]
  ];
  nextSteps = appendTextStep[
    nextSteps,
    "Solve the undetermined-coefficient system",
    "solve_coefficients",
    data["CoefficientEquations"],
    data["CoefficientSolution"]
  ];
  appendTextStep[
    nextSteps,
    "Substitute the solved coefficients into the ansatz",
    "substitute_coefficients",
    data["AnsatzEquation"],
    data["SolvedEquation"]
  ]
];

appendDifferentiationTeachingSteps[steps_List, expression_, variable_] := Module[
  {nextSteps, factors, factorDerivatives, derivativeStatements, productTerms, terms, termDerivatives},
  nextSteps = steps;
  Which[
    Head[expression] === Times,
      factors = List @@ expression;
      factorDerivatives = D[#, variable] & /@ factors;
      derivativeStatements = MapThread[
        "\\frac{d}{d" <> SymbolName[variable] <> "}(" <> tex[#1] <> ")=" <> tex[#2] &,
        {factors, factorDerivatives}
      ];
      productTerms = Table[
        Times @@ ReplacePart[factors, index -> factorDerivatives[[index]]],
        {index, Length[factors]}
      ];
      nextSteps = appendTextStep[
        nextSteps,
        "Differentiate each factor required by the product rule",
        "differentiate_factors",
        tex[expression],
        StringRiffle[derivativeStatements, ",\\quad "]
      ];
      appendTextStep[
        nextSteps,
        "Substitute the factor derivatives into the product rule",
        "apply_product_rule",
        tex[expression],
        StringRiffle[tex /@ productTerms, "+"]
      ],
    Head[expression] === Plus,
      terms = List @@ expression;
      termDerivatives = D[#, variable] & /@ terms;
      appendTextStep[
        nextSteps,
        "Differentiate each term and apply linearity",
        "differentiate_terms",
        tex[expression],
        StringRiffle[tex /@ termDerivatives, "+"]
      ],
    True,
      steps
  ]
];

integrationSubstitutionData[expression_, variable_] := Module[
  {
    factors, exponentialFactors, exponentialFactor, inner, outerFactor,
    innerDerivative, ratio, substitutionSymbol
  },
  factors = If[Head[expression] === Times, List @@ expression, {expression}];
  exponentialFactors = Cases[factors, Power[E, _]];
  If[exponentialFactors === {}, Return[$Failed]];

  exponentialFactor = First[exponentialFactors];
  inner = exponentialFactor[[2]];
  innerDerivative = D[inner, variable];
  If[TrueQ[innerDerivative == 0], Return[$Failed]];
  outerFactor = Cancel[expression/exponentialFactor];
  ratio = Quiet@Check[FullSimplify[outerFactor/innerDerivative], $Failed];
  If[ratio === $Failed || !FreeQ[ratio, variable], Return[$Failed]];
  substitutionSymbol = Symbol["Global`u"];

  <|
    "Inner" -> inner,
    "InnerDerivative" -> innerDerivative,
    "TransformedIntegrand" -> ratio Exp[substitutionSymbol],
    "AntiderivativeInU" -> ratio Exp[substitutionSymbol],
    "BackSubstitution" -> ratio Exp[inner]
  |>
];

appendIntegrationSubstitutionSteps[
  steps_List,
  expression_,
  variable_,
  data_Association
] := Module[{nextSteps, uName, variableName, originalIntegral, transformedIntegral, antiderivativeInU},
  nextSteps = steps;
  uName = "u";
  variableName = SymbolName[variable];
  originalIntegral = "\\int " <> tex[expression] <> "\\,d" <> variableName;
  transformedIntegral = "\\int " <> tex[data["TransformedIntegrand"]] <> "\\,d" <> uName;
  antiderivativeInU = tex[data["AntiderivativeInU"]];
  nextSteps = appendTextStep[
    nextSteps,
    "Choose the inner expression as the substitution variable",
    "substitution_choice",
    originalIntegral,
    uName <> "=" <> tex[data["Inner"]]
  ];
  nextSteps = appendTextStep[
    nextSteps,
    "Differentiate the substitution variable",
    "substitution_differential",
    uName <> "=" <> tex[data["Inner"]],
    "d" <> uName <> "=" <> tex[data["InnerDerivative"]] <> "\\,d" <> variableName
  ];
  nextSteps = appendTextStep[
    nextSteps,
    "Rewrite the integral in the substitution variable",
    "rewrite_integral",
    originalIntegral,
    originalIntegral <> "=" <> transformedIntegral
  ];
  nextSteps = appendTextStep[
    nextSteps,
    "Apply the standard exponential antiderivative",
    "standard_antiderivative",
    transformedIntegral,
    antiderivativeInU
  ];
  appendTextStep[
    nextSteps,
    "Substitute the original inner expression back",
    "back_substitution",
    antiderivativeInU,
    tex[data["BackSubstitution"]]
  ]
];

calculate[expression_String, operation_String, variable_] := Module[
  {
    parsed, selectedVariable, result, steps, inputTex, rationalForm,
    cancelled, expanded, collected, factorTerms, factored, denominator,
    decomposed, recombined, derivative, simplified, antiderivative,
    transformed, reconstructed, verification, rule, standardForm, resultTex,
    partialFractionData, substitutionData, expandedDecomposition,
    decomposedTerms, termTransforms, standardPairDescriptions
  },
  parsed = parseExpression[expression];
  selectedVariable = pickVariable[parsed, variable];
  inputTex = tex[parsed];
  resultTex = Null;
  steps = {makeStep[1, "Identify the original expression", "identify", inputTex, inputTex]};

  Switch[operation,
    "simplify",
      rationalForm = Together[parsed];
      denominator = Times @@ DeleteDuplicates@Cases[
        parsed,
        Power[base_, exponent_ /; TrueQ[exponent < 0]] :> base,
        Infinity
      ];
      If[denominator =!= 1,
        steps = appendTextStep[
          steps,
          "Preserve the domain restriction from the original denominator",
          "domain_restriction",
          tex[denominator],
          tex[denominator] <> "\\neq 0"
        ]
      ];
      steps = appendExpressionStep[steps, "Combine rational terms over a common denominator", "common_denominator", parsed, rationalForm];
      cancelled = Cancel[rationalForm];
      steps = appendExpressionStep[steps, "Cancel common polynomial factors", "cancel_common_factors", rationalForm, cancelled];
      result = FullSimplify[cancelled];
      steps = appendExpressionStep[steps, "Apply governed symbolic simplification", "simplify", cancelled, result];
      steps = appendExpressionStep[steps, "State the simplified result", "final_result", parsed, result, True];
      verification = Quiet@Check[FullSimplify[Together[parsed - result] == 0], $Failed];
      steps = appendVerificationStep[steps, "Verify equivalence with the original expression", "verify_equivalence", parsed == result, verification],
    "expand",
      steps = appendTextStep[steps, "Apply the distributive and power-expansion rules", "expansion_rule", "a(b+c), (a+b)^n", "Expand each product and power term-by-term"];
      expanded = Expand[parsed];
      steps = appendExpressionStep[steps, "Expand products and powers", "expand_products", parsed, expanded];
      collected = Collect[expanded, selectedVariable];
      steps = appendExpressionStep[steps, "Collect like powers of the selected variable", "collect_like_terms", expanded, collected];
      result = expanded;
      steps = appendExpressionStep[steps, "State the expanded result", "final_result", parsed, result, True];
      verification = Quiet@Check[FullSimplify[Together[parsed - result] == 0], $Failed];
      steps = appendVerificationStep[steps, "Verify the expansion reproduces the original expression", "verify_equivalence", parsed == result, verification],
    "factor",
      factorTerms = FactorTerms[parsed, selectedVariable];
      steps = appendExpressionStep[steps, "Extract coefficients and common factors", "factor_terms", parsed, factorTerms];
      factored = Factor[factorTerms];
      steps = appendExpressionStep[steps, "Factor the remaining polynomial over exact coefficients", "factor_polynomial", factorTerms, factored];
      result = factored;
      steps = appendExpressionStep[steps, "State the factored result", "final_result", parsed, result, True];
      expanded = Expand[result];
      steps = appendExpressionStep[steps, "Expand the factors for comparison", "expand_check", result, expanded, True];
      verification = Quiet@Check[FullSimplify[Together[parsed - expanded] == 0], $Failed];
      steps = appendVerificationStep[steps, "Verify the factors reconstruct the original expression", "verify_equivalence", parsed == expanded, verification],
    "apart",
      rationalForm = Together[parsed];
      steps = appendExpressionStep[steps, "Write the expression as one rational function", "rational_form", parsed, rationalForm];
      denominator = Factor[Denominator[rationalForm]];
      steps = appendExpressionStep[steps, "Factor the denominator to identify pole factors", "factor_denominator", Denominator[rationalForm], denominator, True];
      partialFractionData = Quiet@Check[partialFractionTeachingData[rationalForm, selectedVariable], $Failed];
      If[AssociationQ[partialFractionData],
        steps = appendPartialFractionTeachingSteps[steps, rationalForm, partialFractionData];
        result = partialFractionData["Result"],
        result = Apart[rationalForm, selectedVariable]
      ];
      steps = appendExpressionStep[steps, "Compute the partial-fraction decomposition", "partial_fraction", rationalForm, result, True];
      steps = appendExpressionStep[steps, "State the partial-fraction form", "final_result", parsed, result, True];
      recombined = Together[result];
      steps = appendExpressionStep[steps, "Recombine the partial fractions", "recombine_fractions", result, recombined, True];
      verification = Quiet@Check[FullSimplify[Together[parsed - recombined] == 0], $Failed];
      steps = appendVerificationStep[steps, "Verify the decomposition reconstructs the original expression", "verify_equivalence", parsed == recombined, verification],
    "diff",
      rule = differentiationRule[parsed];
      steps = appendTextStep[steps, rule[[1]], "differentiation_rule", tex[parsed], rule[[2]]];
      steps = appendDifferentiationTeachingSteps[steps, parsed, selectedVariable];
      expanded = Expand[parsed];
      steps = appendExpressionStep[steps, "Expand the expression when this exposes simpler derivative terms", "prepare_derivative", parsed, expanded];
      derivative = D[parsed, selectedVariable];
      steps = appendExpressionStep[steps, "Differentiate with respect to " <> SymbolName[selectedVariable], "differentiate", parsed, derivative, True];
      simplified = FullSimplify[derivative];
      steps = appendExpressionStep[steps, "Simplify the derivative", "simplify_derivative", derivative, simplified];
      result = simplified;
      steps = appendExpressionStep[steps, "State the derivative", "final_result", parsed, result, True];
      verification = Quiet@Check[FullSimplify[result == D[parsed, selectedVariable]], $Failed];
      steps = appendVerificationStep[steps, "Recompute the derivative to verify the result", "verify_derivative", result, verification],
    "integrate",
      rationalForm = Together[parsed];
      steps = appendExpressionStep[steps, "Normalize rational terms before integration", "prepare_integral", parsed, rationalForm];
      decomposed = Quiet@Check[Apart[rationalForm, selectedVariable], rationalForm];
      steps = appendExpressionStep[steps, "Decompose into integrable standard terms", "decompose_integrand", rationalForm, decomposed];
      substitutionData = Quiet@Check[integrationSubstitutionData[parsed, selectedVariable], $Failed];
      If[AssociationQ[substitutionData],
        steps = appendIntegrationSubstitutionSteps[steps, parsed, selectedVariable, substitutionData],
        steps = appendTextStep[steps, "Match standard antiderivative forms and linearity", "integration_rule", tex[decomposed], "Integrate each recognized term with respect to " <> SymbolName[selectedVariable]]
      ];
      antiderivative = Integrate[decomposed, selectedVariable];
      steps = appendExpressionStep[steps, "Compute the antiderivative", "integrate", decomposed, antiderivative, True];
      result = FullSimplify[antiderivative];
      steps = appendExpressionStep[steps, "Simplify and state the antiderivative", "final_result", antiderivative, result, True];
      resultTex = tex[result] <> "+C";
      steps = appendTextStep[steps, "Add the arbitrary constant for the family of antiderivatives", "integration_constant", tex[result], resultTex];
      derivative = Quiet@Check[D[result, selectedVariable], $Failed];
      verification = If[
        containsUnevaluatedComputationQ[result],
        $Failed,
        Quiet@Check[FullSimplify[Together[derivative - parsed] == 0], $Failed]
      ];
      steps = appendVerificationStep[steps, "Differentiate the antiderivative and compare with the integrand", "verify_antiderivative", derivative, verification],
    "laplace",
      steps = appendTextStep[
        steps,
        "Write the unilateral Laplace-transform definition",
        "definition",
        "F(s)=\\mathcal{L}\\{f(t)\\}",
        "F(s)=\\int_{0}^{\\infty}f(t)e^{-st}dt"
      ];
      decomposed = Expand[parsed];
      steps = appendExpressionStep[steps, "Use linearity to expose transformable terms", "linearity_decomposition", parsed, decomposed];
      steps = appendTextStep[steps, "Match each term to a standard Laplace transform pair", "standard_transform_pair", tex[decomposed], "Apply linearity and the standard transform table"];
      transformed = LaplaceTransform[decomposed, t, s];
      steps = appendExpressionStep[steps, "Evaluate the Laplace transform", "laplace_transform", decomposed, transformed, True];
      result = FullSimplify[transformed];
      steps = appendExpressionStep[steps, "Simplify and state the transform", "final_result", transformed, result, True];
      reconstructed = Quiet@Check[InverseLaplaceTransform[result, s, t], $Failed];
      verification = If[
        containsUnevaluatedComputationQ[result] || containsUnevaluatedComputationQ[reconstructed],
        $Failed,
        Quiet@Check[FullSimplify[Together[reconstructed - parsed] == 0], $Failed]
      ];
      steps = appendVerificationStep[steps, "Apply the inverse transform and compare with the original function", "verify_inverse_laplace_round_trip", reconstructed, verification],
    "inverse_laplace",
      rationalForm = Together[parsed];
      steps = appendExpressionStep[steps, "Write the transform as one rational function", "rational_form", parsed, rationalForm];
      denominator = Factor[Denominator[rationalForm]];
      steps = appendExpressionStep[steps, "Factor the denominator and identify pole factors", "factor_denominator", Denominator[rationalForm], denominator, True];
      partialFractionData = Quiet@Check[partialFractionTeachingData[rationalForm, s], $Failed];
      If[AssociationQ[partialFractionData],
        steps = appendPartialFractionTeachingSteps[steps, rationalForm, partialFractionData];
        decomposed = partialFractionData["Result"],
        decomposed = Apart[rationalForm, s]
      ];
      steps = appendExpressionStep[steps, "Compute the partial-fraction decomposition", "partial_fraction", rationalForm, decomposed, True];
      standardForm = Map[
        Function[term,
          With[{termRational = Together[term]},
            Numerator[termRational] / FactorTerms[Expand[Denominator[termRational]], u]
          ]
        ],
        decomposed /. s -> u - 1
      ];
      steps = appendExpressionStep[steps, "Set u=s+1 to expose completed-square transform forms", "standard_form", decomposed, standardForm, True];
      expandedDecomposition = Expand[decomposed];
      decomposedTerms = If[Head[expandedDecomposition] === Plus, List @@ expandedDecomposition, {expandedDecomposition}];
      termTransforms = Quiet@Check[InverseLaplaceTransform[#, s, t] & /@ decomposedTerms, $Failed];
      If[ListQ[termTransforms],
        termTransforms = FullSimplify[
          ComplexExpand[#],
          Assumptions -> Element[t, Reals] && t >= 0
        ] & /@ termTransforms
      ];
      If[
        ListQ[termTransforms] && !AnyTrue[termTransforms, containsUnevaluatedComputationQ],
        standardPairDescriptions = MapThread[
          Function[{term, inverse},
            "\\mathcal{L}^{-1}\\left\\{" <> tex[term] <> "\\right\\}=" <> tex[inverse]
          ],
          {decomposedTerms, termTransforms}
        ];
        steps = appendTextStep[
          steps,
          "Match each decomposed term to its computed inverse-Laplace pair",
          "standard_transform_pair",
          tex[standardForm],
          StringRiffle[standardPairDescriptions, ",\\quad "]
        ];
        transformed = Total[termTransforms],
        steps = appendTextStep[
          steps,
          "Match each term to a standard inverse-Laplace pair",
          "standard_transform_pair",
          tex[standardForm],
          "No governed term-by-term pair was resolved"
        ];
        transformed = InverseLaplaceTransform[decomposed, s, t]
      ];
      steps = appendExpressionStep[steps, "Apply the inverse Laplace transform term by term", "inverse_laplace_transform", decomposed, transformed, True];
      result = FullSimplify[transformed];
      steps = appendExpressionStep[steps, "Combine and state the time-domain result", "final_result", transformed, result, True];
      reconstructed = Quiet@Check[LaplaceTransform[result, t, s], $Failed];
      verification = If[
        containsUnevaluatedComputationQ[result] || containsUnevaluatedComputationQ[reconstructed],
        $Failed,
        Quiet@Check[FullSimplify[Together[reconstructed - parsed] == 0], $Failed]
      ];
      steps = appendVerificationStep[steps, "Apply the forward Laplace transform and compare with the original expression", "verify_laplace_round_trip", reconstructed, verification],
    _, fail["不支持的操作: " <> operation]
  ];

  <|
    "status" -> "ok",
    "result" -> If[StringQ[resultTex], resultTex, tex[result]],
    "steps" -> steps,
    "error" -> Null
  |>
];

rawInput = Last[$ScriptCommandLine];
request = Quiet@Check[ImportString[rawInput, "RawJSON"], $Failed];
If[request === $Failed || !AssociationQ[request], fail["无效输入", 1]];

expression = Lookup[request, "expression", ""];
operation = Lookup[request, "operation", "simplify"];
variable = Lookup[request, "variable", Null];

If[!StringQ[expression] || StringLength[StringTrim[expression]] === 0, fail["缺少表达式", 1]];
If[StringLength[expression] > 300, fail["表达式过长"]];
If[!StringMatchQ[expression, RegularExpression["[A-Za-z0-9+\\-*/^().,\\s\\\\{}\\[\\]]+"]], fail["表达式包含不允许的字符"]];
If[!StringQ[operation], fail["操作必须是字符串"]];
If[variable =!= Null && (!StringQ[variable] || !StringMatchQ[variable, RegularExpression["[A-Za-z][A-Za-z0-9]{0,9}"]]), fail["变量包含不允许的字符"]];

response = Quiet@Check[calculate[expression, operation, variable], $Failed];
If[response === $Failed, fail["公式计算失败"]];
writeResponse[response];
Exit[0];
