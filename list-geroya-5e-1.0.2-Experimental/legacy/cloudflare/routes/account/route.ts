import { authConfig } from "../../../config/auth";
import { getAppUser } from "../../appAuth";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET(request: Request) {
  const appUser = await getAppUser(request);
  if (appUser) return Response.json({ authenticated: true, email: appUser.email, displayName: appUser.email, emailVerified: appUser.emailVerified, authProvider: "email", authConfig });
  const user = await getChatGPTUser();
  return Response.json(user
    ? { authenticated: true, email: user.email, displayName: user.displayName, emailVerified: true, authProvider: "chatgpt", authConfig }
    : { authenticated: false, authConfig });
}
