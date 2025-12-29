import { type DefaultSession } from 'next-auth';
import { type UserRole } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      // 学生档案数据
      profile?: {
        studentNumber?: string | null;
        classId?: string | null;
        techScore: number;
        ethicsScore: number;
        major?: string | null;
        className?: string | null;
      };
    } & DefaultSession['user'];
  }

  interface User {
    role?: UserRole;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
  }
}
