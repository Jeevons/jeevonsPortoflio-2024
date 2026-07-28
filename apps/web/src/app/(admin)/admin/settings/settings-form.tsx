"use client";

import { useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  settingsSchema,
  type SettingsFormValues,
  type SettingsInput,
} from "@/lib/schemas/settings";
import { cn } from "@/lib/utils";

import { saveSettingsAction, type SettingsFormState } from "./actions";

// Story 5.16 — Formulaire des réglages du site (AC1, AC3).
//
// Même mécanique que 5.8 / 5.14 / 5.15 : double validation sur un schéma UNIQUE
// (`settingsSchema`), côté client via `zodResolver` pour le confort, côté
// serveur via la Server Action pour la garantie (AC3 exige explicitement la
// validation serveur). Le client ne protège rien seul.
//
// ⚠️ `<form action={formAction}>` (et non `handleSubmit`) : la soumission passe
// par la Server Action native de React 19, donc le formulaire fonctionne MÊME
// sans JavaScript. `react-hook-form` se greffe en `onBlur` sans intercepter.
//
// ⚠️ UN SEUL formulaire pour les neuf clés, et un seul bouton : l'enregistrement
// est transactionnel côté serveur. Découper en neuf formulaires indépendants
// multiplierait les états intermédiaires sans rien apporter — on corrige en
// général plusieurs textes d'affilée.

const initialState: SettingsFormState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};

type SettingsFormProps = {
  /** Valeurs actuelles, déjà repliées sur les défauts si une clé manque. */
  values: SettingsFormValues;
};

export function SettingsForm({ values }: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    saveSettingsAction,
    initialState,
  );

  const {
    register,
    formState: { errors },
    trigger,
    // ⚠️ TROIS paramètres de type, depuis la story 6.7. `settingsSchema`
    // TRANSFORME désormais (les rôles se saisissent en texte, se stockent en
    // tableau) : la forme des CHAMPS (`SettingsFormValues` = `z.input`) et celle
    // que produit le résolveur (`SettingsInput` = `z.infer`) ont divergé. Sans
    // le troisième paramètre, `zodResolver` et `useForm` se retrouvent avec deux
    // types incompatibles sur `heroRoles`.
  } = useForm<SettingsFormValues, unknown, SettingsInput>({
    resolver: zodResolver(settingsSchema),
    // `onBlur` : on ne harcèle pas pendant la frappe, mais un lien mal formé est
    // signalé avant d'atteindre le bouton d'envoi.
    mode: "onBlur",
    defaultValues: values,
  });

  // Les erreurs SERVEUR sont réinjectées côté client pour s'afficher au même
  // endroit que les erreurs client. Sans cela, un refus serveur apparaîtrait
  // dans un bandeau isolé, sans désigner le champ à corriger (AC3 : « avec une
  // explication »).
  const serverFieldErrors = state.fieldErrors;
  useEffect(() => {
    if (state.status === "error") {
      void trigger();
    }
  }, [state, trigger]);

  /** Message d'erreur d'un champ : la version serveur prime (elle est finale). */
  const errorFor = (field: keyof SettingsFormValues): string | undefined =>
    serverFieldErrors[field] ?? errors[field]?.message;

  const fieldClass = (field: keyof SettingsFormValues) =>
    cn(
      "rounded-md border bg-transparent px-3 py-2 text-sm",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      errorFor(field) ? "border-destructive" : "border-border",
    );

  return (
    <form
      action={formAction}
      className="flex max-w-3xl flex-col gap-10"
      noValidate
    >
      {/* Message GLOBAL (session expirée, panne, champs invalides).
          `role="alert"` : annoncé dès son apparition. */}
      {state.message ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground"
        >
          {state.message}
        </p>
      ) : null}

      {/* --- Accroche (section Hero du site public) --- */}
      <Section
        id="hero"
        title="Accroche"
        description="Le grand texte d'ouverture de votre page d'accueil, le badge de disponibilité qui l'accompagne, et les rôles qui défilent en dessous."
      >
        <Field
          label="Titre"
          name="heroTitle"
          required
          error={errorFor("heroTitle")}
        >
          <textarea
            id="heroTitle"
            rows={2}
            className={fieldClass("heroTitle")}
            aria-invalid={errorFor("heroTitle") ? true : undefined}
            {...register("heroTitle")}
          />
        </Field>

        <Field
          label="Sous-titre"
          name="heroSubtitle"
          required
          error={errorFor("heroSubtitle")}
          hint="Quelques phrases sur qui vous êtes et ce que vous cherchez."
        >
          <textarea
            id="heroSubtitle"
            rows={6}
            className={fieldClass("heroSubtitle")}
            aria-describedby="heroSubtitle-hint"
            aria-invalid={errorFor("heroSubtitle") ? true : undefined}
            {...register("heroSubtitle")}
          />
        </Field>

        <Field
          label="Badge de statut"
          name="heroStatusBadge"
          required
          error={errorFor("heroStatusBadge")}
          hint="Ex. : En recherche d'une alternance pour 2026-2027."
        >
          <input
            id="heroStatusBadge"
            type="text"
            className={fieldClass("heroStatusBadge")}
            aria-describedby="heroStatusBadge-hint"
            aria-invalid={errorFor("heroStatusBadge") ? true : undefined}
            {...register("heroStatusBadge")}
          />
        </Field>

        {/* Story 6.7 — Les intitulés qui défilent sous le badge, en effet de
            frappe. ⚠️ UNE LIGNE = UN RÔLE, et non des valeurs séparées par des
            virgules : un intitulé peut lui-même en contenir. L'indice le dit
            explicitement, sinon la règle n'existerait que dans le schéma. */}
        <Field
          label="Rôles"
          name="heroRoles"
          required
          error={errorFor("heroRoles")}
          hint="Un rôle par ligne. Ils défilent l'un après l'autre sous le badge de statut."
        >
          <textarea
            id="heroRoles"
            rows={4}
            className={fieldClass("heroRoles")}
            aria-describedby="heroRoles-hint"
            aria-invalid={errorFor("heroRoles") ? true : undefined}
            {...register("heroRoles")}
          />
        </Field>
      </Section>

      {/* --- Chiffres clés (section « En quelques chiffres ») ---
          Retour Jeevons, 28/07 : « il faut changer le "6 ans d'expérience"
          aussi, ou au moins que je puisse le modifier ». */}
      <Section
        id="stats"
        title="Chiffres clés"
        description="La section « En quelques chiffres » de la page d'accueil. Le nombre de projets et de technologies est toujours compté automatiquement ; seules les années d'expérience peuvent être forcées."
      >
        {/* 🛑 SEUL CHAMP FACULTATIF DE CET ÉCRAN, et son indice doit l'expliquer :
            vide ne veut pas dire « rien afficher », mais « laisse le calcul
            faire ». Sans cette phrase, un champ vide passerait pour un oubli et
            Jeevons y saisirait une valeur figée sans nécessité. */}
        <Field
          label="Années d'expérience"
          name="statsExperienceYears"
          error={errorFor("statsExperienceYears")}
          hint="Laissez vide pour le calcul automatique (année en cours moins la première année de votre parcours). Saisissez un nombre pour forcer la valeur affichée."
        >
          <input
            id="statsExperienceYears"
            type="text"
            /* `inputMode="numeric"` fait apparaître le pavé numérique en mobile.
               ⚠️ PAS `type="number"` : son champ vide renvoie `""` comme un
               texte, mais il accepte aussi `e`, `+` et `-` (notation
               scientifique) et masque la saisie invalide au lieu de la faire
               valider par le schéma — l'erreur serait alors muette. */
            inputMode="numeric"
            placeholder="Automatique"
            className={fieldClass("statsExperienceYears")}
            aria-describedby="statsExperienceYears-hint"
            aria-invalid={errorFor("statsExperienceYears") ? true : undefined}
            {...register("statsExperienceYears")}
          />
        </Field>

        {/* ⚠️ Libellés saisis AU PLURIEL : le singulier est dérivé
            automatiquement quand le compteur vaut 1 (« 1 projet livré »). Faire
            saisir les deux formes aurait doublé le nombre de champs pour un cas
            marginal. L'indice le dit, sinon la règle resterait invisible. */}
        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            label="Libellé des années"
            name="statsExperienceLabel"
            required
            error={errorFor("statsExperienceLabel")}
            hint="Au pluriel. Ex. : ans d'expérience."
          >
            <input
              id="statsExperienceLabel"
              type="text"
              className={fieldClass("statsExperienceLabel")}
              aria-describedby="statsExperienceLabel-hint"
              aria-invalid={errorFor("statsExperienceLabel") ? true : undefined}
              {...register("statsExperienceLabel")}
            />
          </Field>

          <Field
            label="Libellé des projets"
            name="statsProjectsLabel"
            required
            error={errorFor("statsProjectsLabel")}
            hint="Au pluriel. Ex. : projets livrés."
          >
            <input
              id="statsProjectsLabel"
              type="text"
              className={fieldClass("statsProjectsLabel")}
              aria-describedby="statsProjectsLabel-hint"
              aria-invalid={errorFor("statsProjectsLabel") ? true : undefined}
              {...register("statsProjectsLabel")}
            />
          </Field>

          <Field
            label="Libellé des technologies"
            name="statsStacksLabel"
            required
            error={errorFor("statsStacksLabel")}
            hint="Au pluriel. Ex. : technologies utilisées."
          >
            <input
              id="statsStacksLabel"
              type="text"
              className={fieldClass("statsStacksLabel")}
              aria-describedby="statsStacksLabel-hint"
              aria-invalid={errorFor("statsStacksLabel") ? true : undefined}
              {...register("statsStacksLabel")}
            />
          </Field>
        </div>
      </Section>

      {/* --- Liens sociaux (pied de page) --- */}
      <Section
        id="social"
        title="Liens sociaux"
        description="Affichés dans le pied de page. Chaque lien doit être une adresse complète commençant par https://."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            label="X (Twitter)"
            name="socialTwitter"
            required
            error={errorFor("socialTwitter")}
          >
            <input
              id="socialTwitter"
              type="url"
              inputMode="url"
              className={fieldClass("socialTwitter")}
              aria-invalid={errorFor("socialTwitter") ? true : undefined}
              {...register("socialTwitter")}
            />
          </Field>

          <Field
            label="Instagram"
            name="socialInstagram"
            required
            error={errorFor("socialInstagram")}
          >
            <input
              id="socialInstagram"
              type="url"
              inputMode="url"
              className={fieldClass("socialInstagram")}
              aria-invalid={errorFor("socialInstagram") ? true : undefined}
              {...register("socialInstagram")}
            />
          </Field>

          <Field
            label="LinkedIn"
            name="socialLinkedin"
            required
            error={errorFor("socialLinkedin")}
          >
            <input
              id="socialLinkedin"
              type="url"
              inputMode="url"
              className={fieldClass("socialLinkedin")}
              aria-invalid={errorFor("socialLinkedin") ? true : undefined}
              {...register("socialLinkedin")}
            />
          </Field>

          <Field
            label="GitHub"
            name="socialGithub"
            required
            error={errorFor("socialGithub")}
          >
            <input
              id="socialGithub"
              type="url"
              inputMode="url"
              className={fieldClass("socialGithub")}
              aria-invalid={errorFor("socialGithub") ? true : undefined}
              {...register("socialGithub")}
            />
          </Field>
        </div>
      </Section>

      {/* --- Coordonnées (section Contact) --- */}
      <Section
        id="contact"
        title="Coordonnées"
        description="Utilisées par la section « Me contacter » du site."
      >
        <Field
          label="Lien LinkedIn"
          name="contactLinkedin"
          required
          error={errorFor("contactLinkedin")}
          hint="Peut différer du lien du pied de page — c'est celui du bouton de contact."
        >
          <input
            id="contactLinkedin"
            type="url"
            inputMode="url"
            className={fieldClass("contactLinkedin")}
            aria-describedby="contactLinkedin-hint"
            aria-invalid={errorFor("contactLinkedin") ? true : undefined}
            {...register("contactLinkedin")}
          />
        </Field>

        {/* ⚠️ Saisie ENTIÈRE, stockage FRAGMENTÉ. L'adresse est découpée par le
            serveur avant écriture, pour que la chaîne complète n'apparaisse
            jamais dans le HTML servi au public (protection anti-moisson héritée
            de l'Epic 1). L'indice le dit, sinon la mention « fragmentée » dans le
            code serait invisible de l'utilisateur. */}
        <Field
          label="Adresse e-mail"
          name="contactEmail"
          required
          error={errorFor("contactEmail")}
          hint="Stockée en morceaux pour limiter la collecte automatisée par les robots. Saisissez-la normalement."
        >
          <input
            id="contactEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            className={fieldClass("contactEmail")}
            aria-describedby="contactEmail-hint"
            aria-invalid={errorFor("contactEmail") ? true : undefined}
            {...register("contactEmail")}
          />
        </Field>
      </Section>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer les réglages"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Les modifications apparaissent sur le site public dès
          l&apos;enregistrement.
        </p>
      </div>
    </form>
  );
}

/**
 * Regroupement thématique de champs.
 *
 * `<fieldset>`/`<legend>` plutôt qu'un simple titre : les lecteurs d'écran
 * annoncent alors le groupe en même temps que chaque champ, ce qui distingue
 * « LinkedIn (liens sociaux) » de « LinkedIn (coordonnées) » — deux champs de
 * même libellé sur cet écran.
 */
function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="flex flex-col gap-1">
        <span className="text-lg font-semibold">{title}</span>
        <span
          id={`${id}-description`}
          className="text-sm text-muted-foreground"
        >
          {description}
        </span>
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * Enveloppe d'un champ : libellé lié, indice optionnel, message d'erreur.
 *
 * Même structure que les formulaires 5.8 / 5.14 / 5.15 (`<label for>`,
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
