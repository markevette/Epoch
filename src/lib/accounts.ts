import { averyProfile } from "./personas"
import type { Profile } from "./types"

export type Role = "member" | "admin"

export type Account = {
  email: string
  password: string
  role: Role
  name: string
  profile: Profile | null
}

export type Directory = {
  sessionEmail: string | null
  accounts: Account[]
}

export type PublicAccount = Omit<Account, "password">

export const MIN_PASSWORD_LENGTH = 8

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function seedAccounts(
  today: Date,
  creds: {
    member: { email: string; password: string }
    admin: { email: string; password: string }
  },
): Account[] {
  return [
    {
      email: normalizeEmail(creds.member.email),
      password: creds.member.password,
      role: "member",
      name: "Avery Chen",
      profile: averyProfile(today),
    },
    {
      email: normalizeEmail(creds.admin.email),
      password: creds.admin.password,
      role: "admin",
      name: "Epoch staff",
      profile: null,
    },
  ]
}

export function authenticate(accounts: Account[], email: string, password: string): Account | null {
  const needle = normalizeEmail(email)
  const account = accounts.find((item) => item.email === needle)
  if (!account || account.password !== password) return null
  return account
}

export function addMember(
  accounts: Account[],
  input: { email: string; password: string; name: string }
): { accounts: Account[]; error: string | null } {
  const email = normalizeEmail(input.email)
  const name = input.name.trim()
  if (!email.includes("@") || email.startsWith("@") || email.endsWith("@")) {
    return { accounts, error: "Enter an email address." }
  }
  if (input.password.trim().length < MIN_PASSWORD_LENGTH) {
    return { accounts, error: `Use at least ${MIN_PASSWORD_LENGTH} characters for the password.` }
  }
  if (name.length === 0) {
    return { accounts, error: "Enter the name for the file." }
  }
  if (accounts.some((account) => account.email === email)) {
    return { accounts, error: "That email already has an account. Sign in instead." }
  }
  return {
    error: null,
    accounts: [
      ...accounts,
      { email, password: input.password, role: "member", name, profile: null },
    ],
  }
}

export function withAccountProfile(accounts: Account[], email: string, profile: Profile | null): Account[] {
  return accounts.map((account) => (account.email === email ? { ...account, profile } : account))
}
