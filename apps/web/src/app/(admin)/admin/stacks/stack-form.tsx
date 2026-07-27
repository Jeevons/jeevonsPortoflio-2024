"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button, buttonVariants } from "@/components/ui/button";
import { SkillLevel } from "@/generated/prisma/enums";
import {
  isKnownStackDomain,
  SKILL_LEVEL_LABELS,
  STACK_DOMAIN_LABELS,
  STACK_DOMAINS,
  stackSchema,
  type StackFormValues,
} from "@/lib/schemas/stack";
import {
  isKnownStackIconKey,
  STACK_ICON_KEYS,
  STACK_ICON_LABELS,
} from "@/lib/stack-icons";
import { cn } from "@/lib/utils";

import {
  createStackAction,
  updateStackAction,
  type StackFormState,
} from "./actions";

// Story 5.15 — Formulaire d'une technologie, création ET modification (AC1).
//
// Même mécanique que 5.8 / 5.14 : double validation sur un schéma UNIQUE
// (`stackSchema`), côté client via `zodResolver` pour le confort, côté serveur
// via la Server Action pour la garantie. Le client ne protège rien seul.
//
// ⚠️ `<form action={formAction}>` (et non `handleSubmit`) : la soumission passe
// par la Server Action native de React 19, donc le formulaire fonctionne MÊME
// sans JavaScript. `react-hook-form` se greffe en `onBlur` sans intercepter.
//
// ⚠️ L'UNICITÉ DU NOM (AC1) n'est PAS vérifiable ici : seule la base peut la
// trancher. Le refus arrive donc du serveur, dans `state.fieldErrors.name`, et
// s'affiche exactement comme une erreur client (même emplacement).

const initialState: StackFormState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};

// ⚠️ Une clé d'icône HORS registre est ACCEPTÉE (décision Jeevons) : une
// technologie saisie avant l'existence du registre garde sa clé, et l'ouvrir
// dans l'éditeur ne doit surtout pas l'écraser en silence. Le `<select>`
// l'affiche donc comme une option à part, sélectionnée, avec un avertissement.

type StackFormProps = {
  /**
   * Technologie à modifier, ou `undefined` en création. Décide de l'action
   * appelée, du libellé du bouton et de la présence du champ caché `id`.
   */
  stack?: {
    id: string;
    name: string;
    iconKey: string | null;
    level: SkillLevel | null;
    /** Story 6.13 — domaine de regroupement public, nullable par construction. */
    domain: string | null;
  };
};

export function StackForm({ stack }: StackFormProps) {
  const isEdit = stack !== undefined;

  const [state, formAction, pending] = useActionState(
    isEdit ? updateStackAction : createStackAction,
    initialState,
  );

  // Une clé enregistrée mais absente du registre : on la conserve telle quelle
  // et on avertit, plutôt que de la perdre.
  const initialIconKey = stack?.iconKey ?? "";
  const hasUnknownIconKey =
    initialIconKey !== "" && !isKnownStackIconKey(initialIconKey);

  const [iconKey, setIconKey] = useState<string>(initialIconKey);

  // Story 6.13 — Un domaine hors liste (valeur retirée de `STACK_DOMAINS`) est
  // ramené à « Non précisé » : contrairement à `iconKey`, le schéma le REFUSE,
  // donc le conserver bloquerait toute modification de la technologie.
  const storedDomain = stack?.domain ?? "";
  const hasUnknownDomain =
    storedDomain !== "" && !isKnownStackDomain(storedDomain);
  const initialDomain = hasUnknownDomain ? "" : storedDomain;

  const {
    register,
    formState: { errors },
    trigger,
  } = useForm<StackFormValues>({
    resolver: zodResolver(stackSchema),
    // `onBlur` : on ne harcèle pas pendant la frappe, mais un champ invalide est
    // signalé avant d'atteindre le bouton d'envoi.
    mode: "onBlur",
    defaultValues: {
      name: stack?.name ?? "",
      iconKey: initialIconKey,
      // Les `<select>` contrôlés exigent une chaîne : `null` ferait basculer
      // React en non-contrôlé et déclencherait un avertissement.
      level: stack?.level ?? "",
      // Story 6.13 — même contrainte que `level` : un `<select>` contrôlé exige
      // une chaîne. ⚠️ Un domaine en base RETIRÉ de `STACK_DOMAINS` ne peut pas
      // être proposé : on retombe sur « Non précisé » plutôt que d'envoyer une
      // valeur que le schéma refuserait — la technologie reste enregistrable et
      // s'affiche dans le groupe de repli.
      domain: initialDomain,
    },
  });

  // Les erreurs SERVEUR sont réinjectées côté client pour s'afficher au même
  // endroit que les erreurs client. Sans cela, un refus serveur (nom déjà pris)
  // apparaîtrait dans un bandeau isolé, sans désigner le champ à corriger.
  const serverFieldErrors = state.fieldErrors;
  useEffect(() => {
    if (state.status === "error") {
      void trigger();
    }
  }, [state, trigger]);

  /** Message d'erreur d'un champ : la version serveur prime (elle est finale). */
  const errorFor = (field: keyof StackFormValues): string | undefined =>
    serverFieldErrors[field] ?? errors[field]?.message;

  const fieldClass = (field: keyof StackFormValues) =>
    cn(
      "rounded-md border bg-transparent px-3 py-2 text-sm",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      errorFor(field) ? "border-destructive" : "border-border",
    );

  const iconRegister = register("iconKey");

  return (
    <form
      action={formAction}
      className="flex max-w-2xl flex-col gap-6"
      noValidate
    >
      {/* En modification, l'identifiant accompagne la soumission. */}
      {isEdit ? <input type="hidden" name="id" value={stack.id} /> : null}

      {/* Message GLOBAL (nom déjà pris, session expirée, panne).
          `role="alert"` : annoncé dès son apparition. */}
      {state.message ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground"
        >
          {state.message}
        </p>
      ) : null}

      <Field
        label="Nom"
        name="name"
        required
        error={errorFor("name")}
        hint="Tel qu'il s'affichera sur le site. Ex. : React, Chrome Dev Tools."
      >
        <input
          id="name"
          type="text"
          className={fieldClass("name")}
          aria-describedby="name-hint"
          aria-invalid={errorFor("name") ? true : undefined}
          {...register("name")}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Field
          label="Icône"
          name="iconKey"
          error={errorFor("iconKey")}
          hint="Sans icône, une icône neutre est affichée sur le site."
        >
          <select
            id="iconKey"
            className={fieldClass("iconKey")}
            aria-describedby="iconKey-hint"
            aria-invalid={errorFor("iconKey") ? true : undefined}
            {...iconRegister}
            onChange={(event) => {
              void iconRegister.onChange(event);
              setIconKey(event.target.value);
            }}
          >
            <option value="">Aucune icône</option>
            {STACK_ICON_KEYS.map((key) => (
              <option key={key} value={key}>
                {STACK_ICON_LABELS[key]}
              </option>
            ))}
            {/* Une clé hors registre reste sélectionnable pour ne pas être
                écrasée par simple ouverture du formulaire. */}
            {hasUnknownIconKey ? (
              <option value={initialIconKey}>
                {initialIconKey} (clé inconnue)
              </option>
            ) : null}
          </select>
        </Field>

        <Field
          label="Niveau de maîtrise"
          name="level"
          error={errorFor("level")}
          hint="Détermine la place de la technologie sur le site : les plus solides d'abord."
        >
          <select
            id="level"
            className={fieldClass("level")}
            aria-describedby="level-hint"
            aria-invalid={errorFor("level") ? true : undefined}
            {...register("level")}
          >
            <option value="">Non précisé</option>
            {/* Ordre d'affichage = ordre de tri public : le plus solide d'abord,
                pour que la liste se lise comme le résultat. */}
            {(
              [
                SkillLevel.STRONG,
                SkillLevel.COMFORTABLE,
                SkillLevel.LEARNING,
              ] as const
            ).map((value) => (
              <option key={value} value={value}>
                {SKILL_LEVEL_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>

        {/* Story 6.13 — Domaine de regroupement de la section publique
            « Stack & outils ». Facultatif : sans domaine, la technologie reste
            affichée, dans un groupe de repli. */}
        <Field
          label="Domaine"
          name="domain"
          error={errorFor("domain")}
          hint="Regroupe la technologie sur le site. Sans domaine, elle apparaît dans « Autres technologies »."
        >
          <select
            id="domain"
            className={fieldClass("domain")}
            aria-describedby="domain-hint"
            aria-invalid={errorFor("domain") ? true : undefined}
            {...register("domain")}
          >
            <option value="">Non précisé</option>
            {/* Ordre de la liste = ordre des groupes sur le site. */}
            {STACK_DOMAINS.map((value) => (
              <option key={value} value={value}>
                {STACK_DOMAIN_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Le domaine enregistré ne fait plus partie de la liste : on le dit, car
          enregistrer le formulaire le remplacera par « Non précisé ». */}
      {hasUnknownDomain ? (
        <p
          role="status"
          className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
        >
          Le domaine enregistré («&nbsp;{storedDomain}&nbsp;») ne fait plus
          partie des domaines proposés. Choisissez-en un&nbsp;: sans quoi
          l&apos;enregistrement le remplacera par «&nbsp;Non précisé&nbsp;» et
          la technologie apparaîtra dans «&nbsp;Autres technologies&nbsp;».
        </p>
      ) : null}

      {/* AVERTISSEMENT, pas refus : la technologie reste enregistrable, le site
          affichera simplement une icône neutre. Refuser la ferait disparaître,
          ce qui est pire. */}
      {iconKey !== "" && !isKnownStackIconKey(iconKey) ? (
        <p
          role="status"
          className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
        >
          Clé d&apos;icône inconnue («&nbsp;{iconKey}&nbsp;»). La technologie
          reste enregistrable&nbsp;: le site affichera une icône neutre à la
          place.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Enregistrement…"
            : isEdit
              ? "Enregistrer les modifications"
              : "Créer la technologie"}
        </Button>
        <Link
          href="/admin/stacks"
          className={cn(buttonVariants({ variant: "ghost" }))}
        >
          Annuler
        </Link>
      </div>
    </form>
  );
}

/**
 * Enveloppe d'un champ : libellé lié, indice optionnel, message d'erreur.
 *
 * Même structure que les formulaires 5.8 et 5.14 (`<label for>`,
 * `aria-describedby`, `role="alert"`), pour que tous les champs de
 * l'administration portent la même accessibilité.
 */
function Field({
  label,
  name,
  required,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  name: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={name} className="text-sm font-medium">
        {label}
        {required ? (
          <span aria-hidden className="ml-1 text-destructive">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (obligatoire)</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={`${name}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${name}-error`}
          role="alert"
          className="text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
