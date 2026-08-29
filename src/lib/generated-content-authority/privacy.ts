/**
 * 矩阵与 QA 回执的隐私校验：只允许哈希、仓库相对路径引用、状态与结论；
 * 提示词、模型响应、作答、反馈正文、凭据、用户标识、本机绝对路径一律拒绝。
 */

const FORBIDDEN_KEY_PATTERNS: readonly RegExp[] = [
  /prompt/iu,
  /modelresponse/iu,
  /responsetext/iu,
  /rawoutput/iu,
  /answer/iu,
  /feedback(body|text|content)?$/iu,
  /credential/iu,
  /secret/iu,
  /password/iu,
  /apikey/iu,
  /(^|[^a-z])token(s)?($|[^a-z])/iu,
  /user(id|email|name|profile)/iu,
  /student(id|name|email)/iu,
  /absolutepath/iu,
  /localpath/iu,
];

/** 本机绝对路径（POSIX 常见家目录、~ 展开与 Windows 盘符）。 */
const ABSOLUTE_PATH_VALUE_PATTERNS: readonly RegExp[] = [
  /\/(?:Users|home|root)\/[\w.-]+/u,
  /[A-Za-z]:\\[\w .-]+(?:\\[\w .-]+)*/u,
  /(?:^|[^\w~])~\/[\w.-]+/u,
];

export interface PrivacyViolation {
  readonly path: string;
  readonly reason: string;
}

/**
 * 回执结构化字段（reference/outputHash/toolVersion/revision）允许的格式：
 * 无空白、无自由文本的引用/哈希/版本串。原始模型响应、学生答案、
 * 用户标识等自由载荷不可能满足该格式，从而在值层面 fail-closed。
 */
const STRUCTURED_VALUE_KEYS = new Set(['reference', 'outputHash', 'toolVersion', 'revision']);
/** 按字段类型的内容格式：引用=内容寻址/仓库相对路径；哈希=hex；版本=语义版本式。 */
const STRUCTURED_VALUE_PATTERNS: Readonly<Record<string, RegExp>> = {
  reference: /^(?:[a-f0-9]{64}|(?:src|prisma|openspec|data|scripts|docs|external|artifacts)\/[\w@\[\].!~/-]+)$/u,
  outputHash: /^[a-f0-9]{64}$/u,
  toolVersion: /^[A-Za-z0-9][A-Za-z0-9.\/-]{0,60}$/u,
  revision: /^[a-f0-9]{7,64}$/u,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkValue(value: string): string | null {
  if (ABSOLUTE_PATH_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    return 'absolute-local-path-value';
  }
  return null;
}

/**
 * 递归扫描任意 JSON 兼容结构，返回隐私违例清单。
 * 键名按禁用子串匹配（prompt/modelresponse/answer/...），
 * 字符串值匹配本机绝对路径模式。空数组/空串不产生违例。
 */
export function scanReceiptPrivacyViolations(
  value: unknown,
  rootPath = '$',
): PrivacyViolation[] {
  const violations: PrivacyViolation[] = [];

  const walk = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((entry, index) => walk(entry, `${path}[${index}]`));
      return;
    }
    if (!isPlainObject(node)) {
      if (typeof node === 'string') {
        const reason = checkValue(node);
        if (reason) violations.push({ path, reason });
      }
      return;
    }
    // QA 回执形状（outputHash+toolVersion 同时在场）：其结构化字段必须满足
    // 无空白引用/哈希/版本格式——自由文本载荷（原始回答、用户标识等）fail-closed。
    // 矩阵描述性 reference 字段不在回执形状内，不受此约束。
    if ('outputHash' in node && 'toolVersion' in node) {
      for (const [receiptKey, receiptValue] of Object.entries(node)) {
        if (!STRUCTURED_VALUE_KEYS.has(receiptKey) || typeof receiptValue !== 'string' || receiptValue.length === 0) continue;
        const pattern = STRUCTURED_VALUE_PATTERNS[receiptKey];
        if (!pattern || !pattern.test(receiptValue)) {
          violations.push({ path: `${path}.${receiptKey}`, reason: 'unstructured-payload-value' });
        }
      }
      for (const [receiptKey, receiptValue] of Object.entries(node)) {
        if (STRUCTURED_VALUE_KEYS.has(receiptKey)) continue;
        walk(receiptValue, `${path}.${receiptKey}`);
      }
      return;
    }
    for (const [key, entry] of Object.entries(node)) {
      const childPath = `${path}.${key}`;
      if (FORBIDDEN_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
        violations.push({ path: childPath, reason: 'forbidden-key' });
        continue;
      }
      walk(entry, childPath);
    }
  };

  walk(value, rootPath);
  return violations;
}
