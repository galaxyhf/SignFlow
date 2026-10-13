"use client";
import { Button } from "../components/ui/button";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="content">
      <h1>Não foi possível abrir esta tela</h1>
      <p>
        Tente novamente. Seus documentos permanecem preservados no servidor.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </main>
  );
}
