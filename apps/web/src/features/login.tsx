"use client";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@signflow/shared";
import type { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { FileSignature, ArrowRight } from "lucide-react";
import { post } from "../lib/api";
import { Button } from "../components/ui/button";
import { ErrorBox } from "../components/common";
export function Login() {
  const client = useQueryClient(),
    router = useRouter();
  const form = useForm<
    z.input<typeof loginSchema>,
    unknown,
    z.output<typeof loginSchema>
  >({ resolver: zodResolver(loginSchema) });
  const mutation = useMutation({
    mutationFn: (b: z.output<typeof loginSchema>) => post("auth/login", b),
    onSuccess: async () => {
      await client.invalidateQueries();
      router.push("/dashboard");
    },
  });
  return (
    <main className="login">
      <div className="panel">
        <div className="brand">
          <FileSignature />
          SignFlow
        </div>
        <h1>Acesse sua área de trabalho</h1>
        <p>Gerencie autorizações e acompanhe cada assinatura.</p>
        <ErrorBox error={mutation.error} />
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
          <label>
            Login
            <input
              autoComplete="username"
              {...form.register("login")}
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              autoComplete="current-password"
              minLength={9}
              maxLength={128}
              {...form.register("password")}
              required
            />
          </label>
          <Button disabled={mutation.isPending}>
            {mutation.isPending ? "Entrando…" : "Entrar"}
            <ArrowRight size={16} />
          </Button>
        </form>
        <p style={{ fontSize: 12, marginTop: 24 }}>
          Ainda não tem uma conta?{" "}
          <Link href="/cadastro" className="auth-link">
            Criar cadastro
          </Link>
        </p>
      </div>
    </main>
  );
}
