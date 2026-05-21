import GoogleProvider from "next-auth/providers/google";
import { isAllowedEmail } from "@/helpers/auth/access";


export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: "jwt",
  },

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    async signIn({ user }) {
      return user?.email && await isAllowedEmail(user.email)
    },

    async session({ session }) {
      return session;
    },
  },
};
