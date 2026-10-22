// Configures the local Appwrite project through the node-appwrite SDK:
// web platform for the Next app + Google OAuth2 when credentials are in the env.
// Run: bun --env-file=.env.local scripts/configure-appwrite.mjs
import { Client, Project } from "node-appwrite";

const { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY } = process.env;
const project = new Project(new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID).setKey(APPWRITE_API_KEY));

const appHost = new URL(process.env.APP_URL ?? "http://localhost:3000").hostname;
const { platforms } = await project.listPlatforms();
if (platforms.some((p) => p.hostname === appHost)) console.log(`platform ok     ${appHost}`);
else {
  await project.createWebPlatform({ platformId: "web-local", name: "Local Next", hostname: appHost });
  console.log(`platform added  ${appHost}`);
}

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) console.log("oauth skipped   google (no credentials in env)");
else {
  await project.updateOAuth2Google({ clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, enabled: true });
  console.log("oauth enabled   google");
}

const { providers: all } = await project.listOAuth2Providers();
console.log("enabled providers:", all.filter((x) => x.enabled).map((x) => x.$id).join(", ") || "none");
console.log(`Callback URL to register at the provider: ${APPWRITE_ENDPOINT.replace("127.0.0.1", "localhost")}/account/sessions/oauth2/callback/<provider>/${APPWRITE_PROJECT_ID}`);
