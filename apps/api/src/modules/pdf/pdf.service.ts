import { Injectable, BadRequestException } from "@nestjs/common";
import {
  PDFDocument,
  PDFDict,
  PDFName,
  PDFArray,
  PDFObject,
  PDFStream,
  PDFString,
  PDFHexString,
  PDFPage,
  degrees,
  StandardFonts,
  rgb,
} from "pdf-lib";
import { PNG } from "pngjs";
import { Field } from "@signflow/shared";
import { configEnv } from "../../config/env";
export function fieldRect(f: Field, width: number, height: number) {
  return {
    x: f.x * width,
    y: (1 - f.y - f.height) * height,
    width: f.width * width,
    height: f.height * height,
  };
}
export function fieldPlacement(f: Field, page: PDFPage) {
  const box = page.getCropBox(),
    W = box.width,
    H = box.height,
    rotation = ((page.getRotation().angle % 360) + 360) % 360;
  let r;
  if (rotation === 90)
    r = {
      x: (f.y + f.height) * W,
      y: f.x * H,
      width: f.width * H,
      height: f.height * W,
    };
  else if (rotation === 180)
    r = {
      x: (1 - f.x) * W,
      y: (f.y + f.height) * H,
      width: f.width * W,
      height: f.height * H,
    };
  else if (rotation === 270)
    r = {
      x: (1 - f.y - f.height) * W,
      y: (1 - f.x) * H,
      width: f.width * H,
      height: f.height * W,
    };
  else r = fieldRect(f, W, H);
  const rad = (rotation * Math.PI) / 180;
  return {
    ...r,
    x: r.x + box.x,
    y: r.y + box.y,
    rotation,
    point: (dx: number, dy: number) => ({
      x: r.x + box.x + dx * Math.cos(rad) - dy * Math.sin(rad),
      y: r.y + box.y + dx * Math.sin(rad) + dy * Math.cos(rad),
    }),
  };
}
@Injectable()
export class PdfService {
  async inspect(
    bytes: Uint8Array,
    maxBytes = configEnv.maxBytes,
    maxPages = configEnv.maxPages,
  ) {
    if (
      bytes.length > maxBytes ||
      bytes.length < 20 ||
      !Buffer.from(bytes.subarray(0, 5)).equals(Buffer.from("%PDF-"))
    )
      throw new BadRequestException("PDF inválido ou acima do limite");
    try {
      const pdf = await PDFDocument.load(bytes, {
        ignoreEncryption: false,
        updateMetadata: false,
      });
      const pages = pdf.getPageCount();
      if (pages < 1 || pages > maxPages) throw new Error();
      const forbidden = new Set([
        "JavaScript",
        "JS",
        "Launch",
        "EmbeddedFile",
        "RichMedia",
        "AA",
        "XFA",
      ]);
      const seen = new Set<PDFObject>();
      const inspectObject = (o: PDFObject) => {
        if (seen.has(o)) return;
        seen.add(o);
        if (o instanceof PDFStream) {
          inspectObject(o.dict);
        } else if (o instanceof PDFDict) {
          for (const [k, v] of o.entries()) {
            // OpenAction may be a passive destination (page/zoom), not an action.
            const value = pdf.context.lookup(v);
            const unsafeOpenAction =
              k.decodeText() === "OpenAction" &&
              !(value instanceof PDFArray) &&
              !(value instanceof PDFName) &&
              !(value instanceof PDFString) &&
              !(value instanceof PDFHexString);
            if (
              unsafeOpenAction ||
              forbidden.has(k.decodeText()) ||
              (value instanceof PDFName && forbidden.has(value.decodeText()))
            )
              throw new BadRequestException(
                "PDF com conteúdo ativo não permitido",
              );
            if (value) inspectObject(value);
          }
        } else if (o instanceof PDFArray) {
          for (const v of o.asArray()) {
            const value = pdf.context.lookup(v);
            if (value) inspectObject(value);
          }
        }
      };
      for (const [, object] of pdf.context.enumerateIndirectObjects())
        inspectObject(object);
      return { pages };
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(
        "PDF corrompido, protegido ou acima do limite de páginas",
      );
    }
  }
  async fill(
    bytes: Uint8Array,
    fields: Field[],
    values: Record<string, string | boolean>,
    signature?: string,
    receipt?: Record<string, unknown>,
  ) {
    const pdf = await PDFDocument.load(bytes);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    let image;
    if (signature) {
      const b = Buffer.from(signature.split(",")[1], "base64");
      if (b.length > 250000)
        throw new BadRequestException("Assinatura excede o limite");
      try {
        image = await pdf.embedPng(b);
        if (
          image.width < 10 ||
          image.height < 10 ||
          image.width > 2000 ||
          image.height > 1000
        )
          throw new Error();
      } catch {
        throw new BadRequestException("Imagem de assinatura inválida");
      }
    }
    for (const f of fields) {
      const page = pdf.getPage(f.page);
      if (!page)
        throw new BadRequestException(
          "Campo aponta para uma página inexistente",
        );
      const r = fieldPlacement(f, page);
      if (f.type === "signature") {
        if (image) {
          const scale = Math.min(
            r.width / image.width,
            r.height / image.height,
          );
          page.drawImage(image, {
            x: r.x,
            y: r.y,
            width: image.width * scale,
            height: image.height * scale,
            rotate: degrees(r.rotation),
          });
        }
        continue;
      }
      const value = values[f.id] ?? f.defaultValue;
      if (value === undefined || value === "") continue;
      const raw = f.type === "checkbox" ? (value ? "X" : "") : String(value);
      const safe = raw.normalize("NFC");
      try {
        font.encodeText(safe.replaceAll("\n", ""));
      } catch {
        throw new BadRequestException(
          `${f.label}: caracteres não suportados pela fonte do PDF`,
        );
      }
      const size = Math.max(5, Math.min(11, r.height * 0.65));
      const lines: string[] = [];
      for (const paragraph of safe.split("\n")) {
        let line = "";
        for (const word of paragraph.split(" ")) {
          let next = line ? `${line} ${word}` : word;
          if (font.widthOfTextAtSize(next, size) > r.width && line) {
            lines.push(line);
            line = "";
            next = word;
          }
          while (
            font.widthOfTextAtSize(next, size) > r.width &&
            next.length > 1
          ) {
            let k = next.length - 1;
            while (
              k > 1 &&
              font.widthOfTextAtSize(next.slice(0, k), size) > r.width
            )
              k--;
            lines.push(next.slice(0, k));
            next = next.slice(k);
          }
          line = next;
        }
        lines.push(line);
      }
      const capacity = Math.max(1, Math.floor(r.height / (size * 1.15)));
      if (lines.length > capacity)
        throw new BadRequestException(
          `Texto não cabe no campo ${f.label}; amplie o campo ou reduza o texto`,
        );
      for (let i = 0; i < lines.length; i++)
        page.drawText(lines[i], {
          ...r.point(1, r.height - size - i * size * 1.15),
          rotate: degrees(r.rotation),
          size,
          font,
          color: rgb(0.08, 0.08, 0.08),
        });
    }
    if (receipt) {
      let page: PDFPage;
      let y = 0;
      const nextPage = () => {
        page = pdf.addPage([595, 842]);
        page.drawText("SignFlow — Comprovante de assinatura", {
          x: 40,
          y: 795,
          size: 17,
          font,
        });
        page.drawText(
          "Assinatura declarada; conferência cadastral não comprova identidade civil.",
          { x: 40, y: 60, size: 8, font },
        );
        y = 760;
      };
      nextPage();
      for (const [k, v] of Object.entries(receipt)) {
        const text = `${k}: ${String(v)}`;
        try {
          font.encodeText(text.replaceAll("\n", ""));
        } catch {
          throw new BadRequestException(
            "Caracteres não suportados no comprovante",
          );
        }
        for (const paragraph of text.split("\n")) {
          let remaining = paragraph;
          do {
            let n = Math.min(remaining.length, 110);
            while (
              n > 1 &&
              font.widthOfTextAtSize(remaining.slice(0, n), 9) > 515
            )
              n--;
            if (y < 95) nextPage();
            page!.drawText(remaining.slice(0, n), { x: 40, y, size: 9, font });
            remaining = remaining.slice(n);
            y -= 14;
          } while (remaining.length);
        }
      }
    }
    return pdf.save();
  }
  async validateText(text: string) {
    const pdf = await PDFDocument.create(),
      font = await pdf.embedFont(StandardFonts.Helvetica);
    try {
      font.encodeText(text.replaceAll("\n", ""));
    } catch {
      throw new BadRequestException(
        "Identificação ou declaração contém caracteres não suportados pela fonte do PDF",
      );
    }
  }
  async validateSignature(data: string) {
    try {
      const b = Buffer.from(data.split(",")[1], "base64");
      if (
        b.length < 24 ||
        b.length > 250000 ||
        b.readUInt32BE(16) > 2000 ||
        b.readUInt32BE(20) > 1000
      )
        throw new Error();
      const png = PNG.sync.read(b, { checkCRC: true });
      if (
        png.width > 2000 ||
        png.height > 1000 ||
        png.width < 10 ||
        png.height < 10
      )
        throw new Error();
      let dark = 0;
      for (let i = 0; i < png.data.length; i += 4) {
        if (
          png.data[i + 3] > 40 &&
          png.data[i] + png.data[i + 1] + png.data[i + 2] < 650
        )
          dark++;
      }
      if (dark < 30) throw new Error();
    } catch {
      throw new BadRequestException("Desenhe uma assinatura não vazia");
    }
    const pdf = await PDFDocument.create();
    try {
      const image = await pdf.embedPng(
        Buffer.from(data.split(",")[1], "base64"),
      );
      if (
        image.width < 10 ||
        image.height < 10 ||
        image.width > 2000 ||
        image.height > 1000
      )
        throw new Error();
    } catch {
      throw new BadRequestException("Assinatura inválida");
    }
  }
}
