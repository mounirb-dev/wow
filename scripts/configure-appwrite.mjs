// Configures the local Appwrite project through the node-appwrite SDK:
// web platform for the Next app + Google OAuth2 when its credentials are in the env.
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
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

const providers = [
  { name: "google", id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET, update: (a) => project.updateOAuth2Google(a) },
];
for (const p of providers) {
  if (!p.id || !p.secret) { console.log(`oauth skipped   ${p.name} (no credentials in env)`); continue; }
  await p.update({ clientId: p.id, clientSecret: p.secret, enabled: true });
  console.log(`oauth enabled   ${p.name}`);
}

const { providers: all } = await project.listOAuth2Providers();
console.log("enabled providers:", all.filter((x) => x.enabled).map((x) => x.$id).join(", ") || "none");
console.log(`Callback URL to register at the provider: ${APPWRITE_ENDPOINT.replace("127.0.0.1", "localhost")}/account/sessions/oauth2/callback/<provider>/${APPWRITE_PROJECT_ID}`);
