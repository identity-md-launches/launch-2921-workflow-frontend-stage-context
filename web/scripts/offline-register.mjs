import { register } from "node:module";
import { verifyOffline } from "./offline-verify.mjs";
await verifyOffline();
register("./offline-loader.mjs", import.meta.url);
