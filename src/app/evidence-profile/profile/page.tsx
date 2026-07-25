import { EvidenceSessionProvider } from '@/components/testing/evidence-session-provider';
import { notFound } from 'next/navigation';
import ProfilePage from '../../(main)/profile/page';

export default function ProfileEvidencePage() {
  if (process.env.COMMERCIAL_UI_EVIDENCE !== '1') {
    notFound();
  }

  return (
    <EvidenceSessionProvider>
      <ProfilePage />
    </EvidenceSessionProvider>
  );
}
