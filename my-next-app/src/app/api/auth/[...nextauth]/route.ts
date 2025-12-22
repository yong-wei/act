import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
    }),
    // Add other providers as needed
  ],
  // Add other NextAuth.js options as needed
  // For example, callbacks, session, pages, etc.
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
