import { Client, Storage } from "node-appwrite";

const base = () => new Client().setEndpoint(process.env.APPWRITE_ENDPOINT).setProject(process.env.APPWRITE_PROJECT_ID);

export const adminClient = () => base().setKey(process.env.APPWRITE_API_KEY);
export const sessionClient = (secret) => base().setSession(secret);
export const DB = process.env.APPWRITE_DATABASE_ID ?? "agentsolver";
export const BUCKET_ID = process.env.APPWRITE_STORAGE_BUCKET_ID ?? "documents";
export const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
export const adminStorage = () => new Storage(adminClient());
