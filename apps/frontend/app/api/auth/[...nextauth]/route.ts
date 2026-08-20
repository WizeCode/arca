import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { jwtDecode } from 'jwt-decode';

import { apiService } from '@/lib/api';

interface BackendTokenClaims {
    sub: string;
    name: string;
    email: string;
    access: number;
}

const handler = NextAuth({
    providers: [
        Credentials({
            name: 'Credentials',
            credentials: {
                email: { label: "E-mail", type: "email" },
                password: { label: "Senha", type: "password" }
            },

            async authorize(credentials, req) {
                const user = await apiService.login({
                    email: credentials?.email || '',
                    password: credentials?.password || ''
                });

                if (user) {
                    const claims = jwtDecode<BackendTokenClaims>(user.token);

                    return {
                        token: user.token,
                        id: claims.sub,
                        roleId: String(claims.access),
                        name: claims.name,
                        email: claims.email
                    };
                }

                return null;
            }
        })
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
        }
    },

    pages: {
        signIn: '/login'
    },
    session: {
        strategy: 'jwt'
    }
});

export { handler as GET, handler as POST };