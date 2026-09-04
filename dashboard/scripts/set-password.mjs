#!/usr/bin/env node
/**
 * Define a senha master fora do navegador — usado pelo instalador e para
 * recuperação, quando ninguém consegue mais entrar no painel.
 *
 *   node scripts/set-password.mjs "usuario" "senha"
 *
 * Grava o hash em config/secrets.json (permissão 600). A senha nunca fica em
 * texto puro, nem no .env, nem em disco.
 */
import { randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const [, , userArg, passwordArg] = process.argv;
const user = (userArg || "admin").trim() || "admin";
const password = passwordArg || "";

if (password.length < 10) {
  console.error("A senha master precisa ter pelo menos 10 caracteres.");
  process.exit(1);
}

const file =
  process.env.SECRETS_PATH ||
  path.join(
    process.env.CLIENTS_CONFIG_PATH ? path.dirname(process.env.CLIENTS_CONFIG_PATH) : path.join(process.cwd(), "config"),
    "secrets.json",
  );

let current = {};
try {
  current = JSON.parse(fs.readFileSync(file, "utf8"));
} catch {
  // Primeiro uso: cofre ainda não existe.
}

const salt = randomBytes(16);
current.ADMIN_USER = user;
current.ADMIN_PASSWORD_HASH = `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 64).toString("hex")}`;
if (!current.SESSION_SECRET) current.SESSION_SECRET = randomBytes(32).toString("hex");

fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, `${JSON.stringify(current, null, 2)}\n`, { mode: 0o600 });
fs.chmodSync(file, 0o600);

console.log(`Credenciais master gravadas em ${file} (usuário: ${user}).`);
