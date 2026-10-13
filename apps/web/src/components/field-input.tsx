"use client";
import type { Field } from "@signflow/shared";
export function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string | boolean | undefined;
  onChange: (v: string | boolean) => void;
}) {
  if (field.type === "signature") return null;
  if (field.type === "checkbox")
    return (
      <label className="check">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          required={field.required}
        />
        {field.label}
        {field.required ? " *" : ""}
      </label>
    );
  return (
    <label>
      {field.label}
      {field.required ? " *" : ""}
      {field.type === "select" ? (
        <select
          value={String(value ?? field.defaultValue)}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        >
          <option value="">Selecione</option>
          {field.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          required={field.required}
          maxLength={field.validation.maxLength || 4000}
          value={String(value ?? field.defaultValue)}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          required={field.required}
          type={
            field.type === "date"
              ? "date"
              : field.type === "number"
                ? "number"
                : "text"
          }
          step={field.type === "number" ? "any" : undefined}
          inputMode={
            ["cpf", "cnpj", "phone"].includes(field.type) ? "tel" : undefined
          }
          min={field.validation.min}
          max={field.validation.max}
          minLength={field.validation.minLength}
          maxLength={field.validation.maxLength || 4000}
          value={String(value ?? field.defaultValue)}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
