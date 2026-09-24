"use client";

import { useT } from "@/lib/i18n/client";
import { type ShippingAddress, type ShippingField } from "@/lib/shipping";
import type { MessageKey } from "@/lib/i18n";

/**
 * Where to send it, asked only when something is actually being sent.
 *
 * The inputs carry `name=` attributes as well as controlled values, because the
 * free-claim path submits this as a plain `<form action={serverAction}>` and
 * reads them back out of FormData, while the paid path reads the same state
 * into a JSON body. One set of inputs, two transports — rather than two forms
 * that drift.
 *
 * Errors come from `shippingProblems` on the server and are marked per field,
 * so "alamat belum lengkap" never means "somewhere on this form".
 */

const LABEL: Record<ShippingField, MessageKey> = {
  name: "shipping.name",
  phone: "shipping.phone",
  address: "shipping.address",
  city: "shipping.city",
  province: "shipping.province",
  postalCode: "shipping.postalCode",
  note: "shipping.note",
};

/** The form field name, which is the DB column name minus the prefix. */
const INPUT_NAME: Record<ShippingField, string> = {
  name: "shipping_name",
  phone: "shipping_phone",
  address: "shipping_address",
  city: "shipping_city",
  province: "shipping_province",
  postalCode: "shipping_postal_code",
  note: "shipping_note",
};

const FIELD =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40";

/**
 * Module scope, not a closure inside the parent.
 *
 * A component declared during render is a NEW component type on every render,
 * so React unmounts and remounts it — which in a text input means the cursor
 * jumps out after every keystroke. The bug looks like a broken keyboard.
 */
function Field({
  field,
  value,
  onChange,
  invalid,
  disabled,
  required,
  inputMode,
  label,
}: {
  field: ShippingField;
  value: string;
  onChange: (field: ShippingField, next: string) => void;
  invalid: boolean;
  disabled?: boolean;
  required?: boolean;
  inputMode?: "text" | "tel" | "numeric";
  label: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={`shipping-${field}`} className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={`shipping-${field}`}
        name={INPUT_NAME[field]}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        disabled={disabled}
        inputMode={inputMode}
        aria-invalid={invalid || undefined}
        className={`${FIELD} ${invalid ? "border-red-500" : ""}`}
      />
    </div>
  );
}

export function ShippingFields({
  value,
  onChange,
  problems,
  disabled,
}: {
  value: ShippingAddress;
  onChange: (next: ShippingAddress) => void;
  problems: ShippingField[];
  disabled?: boolean;
}) {
  const t = useT();
  const set = (field: ShippingField, next: string) => onChange({ ...value, [field]: next });
  const common = (field: ShippingField) => ({
    field,
    value: (value[field] as string | null) ?? "",
    onChange: set,
    invalid: problems.includes(field),
    disabled,
    label: t(LABEL[field]),
  });

  return (
    <fieldset className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <legend className="px-1 text-sm font-semibold text-foreground">
        {t("shipping.heading")}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field {...common("name")} required inputMode="text" />
        <Field {...common("phone")} required inputMode="tel" />
      </div>
      <Field {...common("address")} required />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field {...common("city")} required />
        <Field {...common("province")} />
        <Field {...common("postalCode")} required inputMode="numeric" />
      </div>
      <Field {...common("note")} />
      {problems.length > 0 && (
        <p className="text-sm text-red-500 dark:text-red-400">
          {t("shipping.incomplete", { fields: problems.map((f) => t(LABEL[f])).join(", ") })}
        </p>
      )}
    </fieldset>
  );
}

export const EMPTY_SHIPPING: ShippingAddress = {
  name: "",
  phone: "",
  address: "",
  city: "",
  province: null,
  postalCode: "",
  note: null,
};
