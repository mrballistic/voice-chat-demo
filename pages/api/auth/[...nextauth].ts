import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { NextApiRequest, NextApiResponse } from "next";
import { NextAuthOptions, Session as NextAuthSession, User, Account, Profile } from "next-auth";
import { JWT } from "next-auth/jwt";

// Extend the Session type to include accessToken
declare module "next-auth" {
  interface Session {
    accessToken?: string;
  }
}

interface ExtendedToken extends JWT {
  accessToken?: string;
}

interface ExtendedSession extends NextAuthSession {
  accessToken?: string;
}

interface JwtCallbackParams {
  token: JWT;
  account?: Account | null;
  user?: User;
  profile?: Profile;
  isNewUser?: boolean;
}

interface SessionCallbackParams {
  session: NextAuthSession;
  token: JWT;
  user?: User;
}

export default function auth(req: NextApiRequest, res: NextApiResponse) {
  return NextAuth(req, res, {
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        authorization: {
          params: {
            scope: "openid email profile https://www.googleapis.com/auth/calendar",
          },
        },
      }),
    ],
    callbacks: {
      async jwt({ token, account }: JwtCallbackParams): Promise<ExtendedToken> {
        if (account) {
          token.accessToken = account.access_token;
        }
        return token as ExtendedToken;
      },
      async session({ session, token }: SessionCallbackParams): Promise<ExtendedSession> {
        (session as ExtendedSession).accessToken = typeof token.accessToken === "string" ? token.accessToken : undefined;
        return session as ExtendedSession;
      },
    },
  } as NextAuthOptions);
}
