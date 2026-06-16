import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { apiService } from "./api";

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const user = await apiService.login({
          email: credentials?.email || "",
          password: credentials?.password || "",
        });

        if (user) {
          return {
            token: user.token,
            id: user.id,
            roleId: user.roleId,
            name: user.name,
            email: user.email,
          };
        }

        return null;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.token = user.token;
        token.id = user.id;
        token.roleId = user.roleId;
      }
      return token;
    },

    async session({ session, token }) {
      session.token = token.token;
      session.user.id = token.id;
      session.user.roleId = token.roleId;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
