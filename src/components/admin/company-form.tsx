"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface CompanyFormValues {
  legalName: string;
  tradeName: string;
  fiscalNumber: string;
  businessRegistrationNumber: string;
  email: string;
  phone: string;
  website: string;
  addressLine: string;
  city: string;
  postalCode: string;
}

export const EMPTY_COMPANY_FORM: CompanyFormValues = {
  legalName: "",
  tradeName: "",
  fiscalNumber: "",
  businessRegistrationNumber: "",
  email: "",
  phone: "",
  website: "",
  addressLine: "",
  city: "",
  postalCode: "",
};

interface CompanyFormProps {
  initialValues?: CompanyFormValues;
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  error: string | null;
  fieldErrors: Record<string, string[]>;
  onSubmit: (values: CompanyFormValues) => void;
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs font-medium text-destructive">{errors[0]}</p>;
}

/** Business (customer) data form — used in both the create dialog and the detail edit card. */
export function CompanyForm({
  initialValues = EMPTY_COMPANY_FORM,
  submitLabel,
  pendingLabel,
  isPending,
  error,
  fieldErrors,
  onSubmit,
}: CompanyFormProps) {
  const [values, setValues] = useState<CompanyFormValues>(initialValues);

  const set = (key: keyof CompanyFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="space-y-4"
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="legalName">
          Emri i Biznesit <span className="text-destructive">*</span>
        </Label>
        <Input id="legalName" value={values.legalName} onChange={set("legalName")} required autoFocus />
        <FieldError errors={fieldErrors.legalName} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tradeName">Emri tregtar</Label>
        <Input id="tradeName" value={values.tradeName} onChange={set("tradeName")} />
        <FieldError errors={fieldErrors.tradeName} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fiscalNumber">NUI (numri unik)</Label>
          <Input id="fiscalNumber" value={values.fiscalNumber} onChange={set("fiscalNumber")} />
          <FieldError errors={fieldErrors.fiscalNumber} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="businessRegistrationNumber">NRB (numri i biznesit)</Label>
          <Input
            id="businessRegistrationNumber"
            value={values.businessRegistrationNumber}
            onChange={set("businessRegistrationNumber")}
          />
          <FieldError errors={fieldErrors.businessRegistrationNumber} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="companyEmail">Email</Label>
          <Input id="companyEmail" type="email" value={values.email} onChange={set("email")} />
          <FieldError errors={fieldErrors.email} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefoni</Label>
          <Input id="phone" value={values.phone} onChange={set("phone")} />
          <FieldError errors={fieldErrors.phone} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="website">Uebfaqja</Label>
        <Input id="website" value={values.website} onChange={set("website")} placeholder="https://" />
        <FieldError errors={fieldErrors.website} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="addressLine">Adresa</Label>
        <Input id="addressLine" value={values.addressLine} onChange={set("addressLine")} />
        <FieldError errors={fieldErrors.addressLine} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">Qyteti</Label>
          <Input id="city" value={values.city} onChange={set("city")} />
          <FieldError errors={fieldErrors.city} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postalCode">Kodi postar</Label>
          <Input id="postalCode" value={values.postalCode} onChange={set("postalCode")} />
          <FieldError errors={fieldErrors.postalCode} />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
