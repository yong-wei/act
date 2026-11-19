export async function lookupStudentClassroom(joinCode: string): Promise<Response> {
  const url = `/api/session/join?code=${encodeURIComponent(joinCode)}`;
  for (let attempt = 0; ; attempt += 1) {
    let retryAfterSeconds = 0;
    try {
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(7000) });
      if (attempt === 2 || (response.status !== 429 && response.status < 500)) return response;
      retryAfterSeconds = Number(response.headers.get('Retry-After')) || 0;
    } catch (error) {
      if (attempt === 2) throw error;
    }
    const delay = Math.max(400 * (attempt + 1), Math.min(5000, retryAfterSeconds * 1000));
    await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 550));
  }
}
