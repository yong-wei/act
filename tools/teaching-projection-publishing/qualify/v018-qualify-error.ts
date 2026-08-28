export class V018QualificationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'V018QualificationError';
    this.code = code;
  }
}
