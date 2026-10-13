import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { PdfService } from "../src/modules/pdf/pdf.service";

const service = new PdfService();

describe("Inspeção de conteúdo ativo de PDFs", () => {
  it.each([false, true])(
    "aceita destino inicial de página/zoom (referência indireta: %s)",
    async (indirect) => {
      const pdf = await PDFDocument.create();
      const page = pdf.addPage();
      const destination = pdf.context.obj([page.ref, "Fit"]);
      pdf.catalog.set(
        PDFName.of("OpenAction"),
        indirect ? pdf.context.register(destination) : destination,
      );
      await expect(service.inspect(await pdf.save())).resolves.toEqual({
        pages: 1,
      });
    },
  );

  it("aceita destino inicial nomeado", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    pdf.catalog.set(
      PDFName.of("Dests"),
      pdf.context.obj({ inicio: [page.ref, "Fit"] }),
    );
    pdf.catalog.set(PDFName.of("OpenAction"), PDFName.of("inicio"));
    await expect(service.inspect(await pdf.save())).resolves.toEqual({
      pages: 1,
    });
  });

  it("aceita palavras reservadas em texto e metadados", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage().drawText("Exemplo: /JavaScript /JS /Launch /EmbeddedFile");
    pdf.setSubject("Documentação /JavaScript /RichMedia");
    await expect(
      service.inspect(await pdf.save({ useObjectStreams: false })),
    ).resolves.toEqual({ pages: 1 });
  });

  it.each(["JavaScript", "Launch", "URI"])(
    "rejeita ação automática %s",
    async (action) => {
      const pdf = await PDFDocument.create();
      pdf.addPage();
      pdf.catalog.set(
        PDFName.of("OpenAction"),
        pdf.context.register(
          pdf.context.obj({ S: action, JS: PDFString.of("app.alert('x')") }),
        ),
      );
      await expect(service.inspect(await pdf.save())).rejects.toThrow(
        "PDF com conteúdo ativo não permitido",
      );
    },
  );

  it.each(["JavaScript", "JS", "Launch", "RichMedia", "AA", "XFA"])(
    "rejeita entrada estrutural %s em objetos comprimidos",
    async (key) => {
      const pdf = await PDFDocument.create();
      const page = pdf.addPage();
      page.node.set(PDFName.of(key), PDFString.of("conteúdo"));
      await expect(service.inspect(await pdf.save())).rejects.toThrow(
        "PDF com conteúdo ativo não permitido",
      );
    },
  );

  it("rejeita arquivo embutido no dicionário de um stream", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    pdf.context.register(
      pdf.context.flateStream("anexo", { Type: "EmbeddedFile" }),
    );
    await expect(service.inspect(await pdf.save())).rejects.toThrow(
      "PDF com conteúdo ativo não permitido",
    );
  });

  it("rejeita tipo de ação apontado por referência indireta", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    pdf.context.register(
      pdf.context.obj({
        S: pdf.context.register(PDFName.of("JavaScript")),
      }),
    );
    await expect(service.inspect(await pdf.save())).rejects.toThrow(
      "PDF com conteúdo ativo não permitido",
    );
  });
});
