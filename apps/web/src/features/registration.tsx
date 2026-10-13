"use client";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema } from "@signflow/shared";
import type { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { FileSignature, ArrowRight, CheckCircle } from "lucide-react";
import { post } from "../lib/api";
import { Button } from "../components/ui/button";
import { ErrorBox } from "../components/common";
export function Registration() {
  const form = useForm<
    z.input<typeof registerSchema>,
    unknown,
    z.output<typeof registerSchema>
  >({
    resolver: zodResolver(registerSchema),
    mode: "onBlur",
    defaultValues: { name: "", login: "", password: "" },
  });
  const mutation = useMutation({
    mutationFn: (body: z.output<typeof registerSchema>) =>
      post("auth/register", body),
    onSuccess: () => form.reset(),
  });
  return (
    <main className="login">
      <section className="panel">
        <div className="brand">
          <FileSignature />
          SignFlow
        </div>
        {mutation.isSuccess ? (
          <>
            <CheckCircle size={32} style={{ color: "var(--success)" }} />
            <h1 style={{ marginTop: 16 }}>Cadastro concluído</h1>
            <p>Sua conta foi criada. Entre usando seu login e sua senha.</p>
            <Button asChild>
              <Link href="/login">
                Ir para o login
                <ArrowRight size={16} />
              </Link>
            </Button>
          </>
        ) : (
          <>
            <h1>Crie sua conta</h1>
            <p>Preencha seus dados para acessar o SignFlow.</p>
            <ErrorBox error={mutation.error} />
            <form onSubmit={form.handleSubmit((body) => mutation.mutate(body))}>
              <label htmlFor="register-name">
                Nome
                <input
                  id="register-name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={255}
                  {...form.register("name")}
                  aria-invalid={!!form.formState.errors.name}
                  aria-describedby={
                    form.formState.errors.name
                      ? "register-name-error"
                      : undefined
                  }
                />
                {form.formState.errors.name && (
                  <span id="register-name-error" className="inline-error">
                    {form.formState.errors.name.message}
                  </span>
                )}
              </label>
              <label htmlFor="register-login">
                Login
                <input
                  id="register-login"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  minLength={3}
                  maxLength={64}
                  {...form.register("login")}
                  aria-invalid={!!form.formState.errors.login}
                  aria-describedby={
                    form.formState.errors.login
                      ? "register-login-error"
                      : undefined
                  }
                />
                {form.formState.errors.login && (
                  <span id="register-login-error" className="inline-error">
                    {form.formState.errors.login.message}
                  </span>
                )}
              </label>
              <div>
                <label htmlFor="register-password">
                  Senha
                  <input
                    id="register-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={9}
                    maxLength={128}
                    {...form.register("password")}
                    aria-invalid={!!form.formState.errors.password}
                    aria-describedby="register-password-help"
                  />
                </label>
                <small
                  id="register-password-help"
                  className={
                    form.formState.errors.password ? "inline-error" : "muted"
                  }
                >
                  {form.formState.errors.password?.message ||
                    "Use pelo menos 9 caracteres."}
                </small>
              </div>
              <Button disabled={mutation.isPending}>
                {mutation.isPending ? "Criando conta…" : "Criar cadastro"}
                <ArrowRight size={16} />
              </Button>
            </form>
            <p style={{ fontSize: 13, marginTop: 24 }}>
              Já tem uma conta?{" "}
              <Link href="/login" className="auth-link">
                Entrar
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
