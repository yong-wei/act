import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

function parseArgs(argv) {
  const args = {
    contract: '',
    implementation: '',
    pageContractConst: 'UNIT_2_1_PAGE_CONTRACTS',
    stepConst: 'UNIT_2_1_LESSON_STEPS',
    steps: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const value = argv[index + 1];
    if (key in args && value && !value.startsWith('--')) {
      args[key] = value;
      index += 1;
    }
  }

  if (!args.contract || !args.implementation) {
    throw new Error(
      'Usage: node scripts/tests/test-interactive-contract-implementation-alignment.mjs --contract <path> --implementation <path> [--pageContractConst NAME] [--stepConst NAME] [--steps step-01,step-02]',
    );
  }

  return args;
}

function unwrap(node) {
  let current = node;
  while (
    ts.isAsExpression(current) ||
    (typeof ts.isSatisfiesExpression === 'function' && ts.isSatisfiesExpression(current)) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function evaluateNode(node) {
  const current = unwrap(node);
  if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) return current.text;
  if (ts.isNumericLiteral(current)) return Number(current.text);
  if (current.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (current.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(current)) return current.elements.map(evaluateNode);
  if (ts.isObjectLiteralExpression(current)) {
    const result = {};
    for (const property of current.properties) {
      if (ts.isPropertyAssignment(property)) {
        const name = property.name;
        const key = ts.isIdentifier(name) ? name.text : ts.isStringLiteral(name) ? name.text : name.getText();
        result[key] = evaluateNode(property.initializer);
      } else if (ts.isShorthandPropertyAssignment(property)) {
        result[property.name.text] = `__SHORTHAND__:${property.name.text}`;
      } else if (ts.isSpreadAssignment(property)) {
        result[`__SPREAD__${Object.keys(result).length}`] = property.expression.getText();
      }
    }
    return result;
  }
  if (ts.isPrefixUnaryExpression(current)) {
    const value = evaluateNode(current.operand);
    return current.operator === ts.SyntaxKind.MinusToken ? -value : value;
  }
  return `__EXPR__:${current.getText()}`;
}

function findConst(sourceText, constName) {
  const sourceFile = ts.createSourceFile('alignment.ts', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let result = null;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(sourceFile) === constName && node.initializer) {
      result = evaluateNode(node.initializer);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return result;
}

function compareField(mismatches, stepId, field, expected, actual) {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    mismatches.push({ stepId, field, expected, actual });
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const contractPath = path.join(root, args.contract);
  const implementationPath = path.join(root, args.implementation);

  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const source = fs.readFileSync(implementationPath, 'utf8');
  const pageContracts = findConst(source, args.pageContractConst);
  const lessonSteps = findConst(source, args.stepConst);

  if (!pageContracts || typeof pageContracts !== 'object') {
    throw new Error(`Unable to read ${args.pageContractConst} from ${args.implementation}`);
  }
  if (!Array.isArray(lessonSteps)) {
    throw new Error(`Unable to read ${args.stepConst} from ${args.implementation}`);
  }

  const selectedSteps = args.steps
    ? args.steps.split(',').map((item) => item.trim()).filter(Boolean)
    : Object.keys(contract.steps ?? {});

  const stepMap = new Map(lessonSteps.map((step) => [step.id, step]));
  const mismatches = [];

  for (const stepId of selectedSteps) {
    const authoringStep = contract.steps?.[stepId];
    if (!authoringStep) {
      mismatches.push({ stepId, field: 'authoring-step', expected: 'present', actual: 'missing' });
      continue;
    }

    const localStep = stepMap.get(stepId);
    const localPageContract = pageContracts[stepId];

    if (!localStep) {
      mismatches.push({ stepId, field: 'step-definition', expected: 'present', actual: 'missing' });
      continue;
    }
    if (!localPageContract) {
      mismatches.push({ stepId, field: 'page-contract', expected: 'present', actual: 'missing' });
      continue;
    }

    compareField(mismatches, stepId, 'title', authoringStep.title, localStep.title);

    const interactionKind = authoringStep.interaction_spec?.interaction_kind ?? 'none';
    const validPageTypes = interactionKind === 'none' ? ['display', 'summary'] : [interactionKind];
    if (!validPageTypes.includes(localStep.pageType)) {
      mismatches.push({
        stepId,
        field: 'pageType',
        expected: interactionKind === 'none' ? 'display|summary' : interactionKind,
        actual: localStep.pageType,
      });
    }

    compareField(mismatches, stepId, 'layout.template', authoringStep.layout?.template, localPageContract.layout?.template);
    compareField(mismatches, stepId, 'layout.regions', authoringStep.layout?.regions ?? [], localPageContract.layout?.regions ?? []);
    compareField(mismatches, stepId, 'interactionKind', interactionKind, localPageContract.interactionKind);
    compareField(
      mismatches,
      stepId,
      'teacherInsightWidgets',
      authoringStep.teacher_insight_spec?.widgets ?? [],
      localPageContract.teacherInsightWidgets ?? [],
    );
    compareField(
      mismatches,
      stepId,
      'telemetrySummaryFields',
      authoringStep.telemetry_spec?.summary_fields ?? [],
      localPageContract.telemetrySummaryFields ?? [],
    );
    compareField(
      mismatches,
      stepId,
      'misconceptionTags',
      authoringStep.telemetry_spec?.misconception_tags ?? [],
      localPageContract.misconceptionTags ?? [],
    );
    compareField(
      mismatches,
      stepId,
      'previewDemoPath',
      authoringStep.preview_contract?.demo_path,
      localPageContract.previewDemoPath,
    );
  }

  if (mismatches.length) {
    console.error(
      JSON.stringify(
        {
          message: 'interactive contract implementation alignment failed',
          contract: args.contract,
          implementation: args.implementation,
          mismatches,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        message: 'interactive contract implementation alignment passed',
        contract: args.contract,
        implementation: args.implementation,
        checkedSteps: selectedSteps,
      },
      null,
      2,
    ),
  );
}

main();
