export class IlabServiceError extends Error {
  constructor(message: string, readonly status: number, readonly retryReport = false) {
    super(message);
    this.name = 'IlabServiceError';
  }
}
