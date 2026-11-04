import { createContext, useContext } from "react";
import type { Abi, Address } from "viem";
import type { Runtime } from "./config";
import type { Wallet } from "./wallet";
import type { Data } from "./state";
export type Transaction = {
  title: string;
  description: string;
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  irreversible?: boolean;
  prepareOnly?: boolean;
  account?: Address;
  validUntil?: number;
  validate?: () => Promise<void>;
};
export type AppContext = {
  r: Runtime;
  wallet: Wallet;
  data?: Data;
  verified: boolean;
  stale: boolean;
  refresh: () => Promise<void>;
  busy: boolean;
  request: (tx: Transaction) => void;
  view: (name: string) => void;
};
export const Context = createContext<AppContext | null>(null);
export function useApp() {
  const ctx = useContext(Context);
  if (!ctx) throw Error("Missing app context");
  return ctx;
}
