// Creates the demo agent used by the "Entrar como demo" button (idempotent).
import { Client, Users, ID } from "node-appwrite";

const users = new Users(new Client().setEndpoint(process.env.APPWRITE_ENDPOINT).setProject(process.env.APPWRITE_PROJECT_ID).setKey(process.env.APPWRITE_API_KEY));
const email = process.env.DEMO_EMAIL ?? "agente@agentsolver.demo";
const password = process.env.DEMO_PASSWORD ?? "AgentSolver#Demo2026";

const { users: found } = await users.list({ search: email });
if (found.some((u) => u.email === email)) console.log("demo user exists");
else {
  await users.create({ userId: ID.unique(), email, password, name: "Agente Demo" });
  console.log(`demo user created: ${email}`);
}
