import 'dotenv/config';
import { encode } from 'next-auth/jwt';

const evidenceUser = {
  id: 'commercial-ui-evidence-pid',
  email: 'commercial-ui-evidence-pid@example.com',
  name: 'Commercial UI PID Evidence',
  role: 'STUDENT',
};

export async function createPidRecommendationEvidenceStorageState({
  baseUrl,
  secret = process.env.NEXTAUTH_SECRET ?? 'replace-with-strong-secret',
}) {
  const origin = new URL(baseUrl);
  const sessionToken = await encode({
    secret,
    token: evidenceUser,
  });

  return {
    cookies: [{
      name: origin.protocol === 'https:' ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      value: sessionToken,
      domain: origin.hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: origin.protocol === 'https:',
      expires: Math.floor(Date.now() / 1000) + 60 * 60,
    }],
    origins: [],
  };
}

export const PID_RECOMMENDATION_EVIDENCE_USER_ID = evidenceUser.id;
