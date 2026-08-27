export class V022QualificationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'V022QualificationError';
    this.code = code;
  }
}
