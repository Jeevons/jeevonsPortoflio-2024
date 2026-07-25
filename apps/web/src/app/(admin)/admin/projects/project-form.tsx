"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button, buttonVariants } from "@/components/ui/button";
import { ProjectCategory } from "@/generated/prisma/enums";
import type { AdminStackOption } from "@/lib/admin/projects";
import {
  projectSchema,
  slugify,
  type ProjectFormValues,
} from "@/lib/schemas/project";
import { cn } from "@/lib/utils";

import {
  createProjectAction,
  updateProjectAction,
  type ProjectFormState,
} from "./actions";
import {
  HighlightsEditor,
  toDrafts,
  type HighlightDraft,
} from "./highlights-editor";
import { ProjectPreview } from "./project-preview";
import { StacksSelector } from "./stacks-selector";

// Story 5.8 — Formulaire de projet, création ET modification (AC2, AC3, AC4).
//
// DOUBLE VALIDATION, UN SEUL SCHÉMA (AC2) :
//  - CLIENT : `react-hook-form` + `zodResolver(projectSchema)` → l'erreur
//    s'affiche sous le champ dès qu'il perd le focus, sans aller-retour ;
//  - SERVEUR : la Server Action revalide avec LE MÊME `projectSchema` et renvoie
//    ses erreurs dans `state.fieldErrors` — affichées au même endroit.
// Le client est donc un CONFORT, jamais une garantie : désactiver JavaScript ou
// poster directement sur l'action aboutit au même refus, avec le même message.
//
// ⚠️ `<form action={formAction}>` (et non `handleSubmit`) : la soumission passe
// par la Server Action native de React 19, donc le formulaire fonctionne MÊME
// sans JavaScript (progressive enhancement). `react-hook-form` se greffe en
// mode `onBlur` pour l'affichage instantané, sans intercepter l'envoi.

const initialState: ProjectFormState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};

/** Libellés français des catégories — l'enum Prisma est en anglais. */
const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  FLAGSHIP: "Projet phare",
  PERSONAL: "Projet personnel",
  LAB: "Laboratoire",
};

type ProjectFormProps = {
  /**
   * Projet à modifier, ou `undefined` en création. Décide de l'action appelée,
   * du libellé du bouton et de la présence du champ caché `id`.
   */
  project?: {
    id: string;
    slug: string;
    title: string;
    company: string;
    category: ProjectCategory;
    description: string | null;
    period: string;
    link: string | null;
    repoUrl: string | null;
    outcome: string | null;
    published: boolean;
    /** Story 5.9 — points forts déjà ordonnés (AC1). */
    highlights: { id: string; label: string }[];
    /** Story 5.9 — technologies déjà associées (AC2). */
    stacks: { id: string; name: string }[];
  };
  /** Story 5.9 — technologies proposées au sélecteur (AC2). */
  stackOptions: AdminStackOption[];
};

export function ProjectForm({ project, stackOptions }: ProjectFormProps) {
  const isEdit = project !== undefined;

  const [state, formAction, pending] = useActionState(
    isEdit ? updateProjectAction : createProjectAction,
    initialState,
  );

  const {
    register,
    control,
    formState: { errors },
    setValue,
    trigger,
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    // `onBlur` : on ne harcèle pas l'utilisateur pendant la frappe, mais il sait
    // qu'un champ est invalide avant d'atteindre le bouton d'envoi.
    mode: "onBlur",
    defaultValues: {
      slug: project?.slug ?? "",
      title: project?.title ?? "",
      company: project?.company ?? "",
      category: project?.category ?? ProjectCategory.PERSONAL,
      // Les colonnes nullables arrivent en `null` ; un `<input>` contrôlé exige
      // une chaîne, sinon React bascule en non-contrôlé et avertit en console.
      description: project?.description ?? "",
      period: project?.period ?? "",
      link: project?.link ?? "",
      repoUrl: project?.repoUrl ?? "",
      outcome: project?.outcome ?? "",
      published: project?.published ?? false,
      // Les relations ne sont PAS pilotées par react-hook-form : leurs contrôles
      // (liste répétable, cases à cocher) ont leur propre état local, plus simple
      // à réordonner. Les valeurs par défaut restent présentes pour que le type
      // du schéma soit satisfait.
      highlights: [],
      stackIds: [],
    },
  });

  // Story 5.9 — ÉTAT DES RELATIONS, tenu ici (et non dans react-hook-form) parce
  // qu'il alimente DEUX consommateurs : les contrôles d'édition et l'aperçu live
  // (AC3). Le remonter au parent commun est ce qui permet à l'aperçu de refléter
  // les points forts et les technologies en direct, sans aller-retour serveur.
  const [highlights, setHighlights] = useState<HighlightDraft[]>(() =>
    toDrafts(project?.highlights ?? []),
  );
  const [stackIds, setStackIds] = useState<string[]>(
    () => project?.stacks.map((stack) => stack.id) ?? [],
  );

  // AC3 — Abonnement aux champs qui alimentent l'aperçu : chaque frappe provoque
  // un rendu, donc une carte à jour (« se met à jour à mesure que je tape »).
  //
  // ⚠️ `useWatch` et NON `watch()` : ce dernier renvoie une fonction que le
  // React Compiler ne sait pas mémoïser, ce qui lui fait abandonner l'optimisation
  // de tout le composant (il le signale en avertissement de lint, et AGENTS.md §8
  // exige zéro warning). `useWatch` est le hook prévu pour cet usage : il s'abonne
  // au `control` et ne re-rend que sur changement réel des champs surveillés.
  //
  // On nomme explicitement les champs plutôt que de tout surveiller : `description`
  // et `repoUrl` n'apparaissent pas sur la carte, les observer déclencherait des
  // rendus pour rien.
  const live = useWatch({
    control,
    name: ["company", "period", "title", "outcome", "link"],
  });
  const [liveCompany, livePeriod, liveTitle, liveOutcome, liveLink] = live;

  // Noms des technologies cochées : l'aperçu affiche des NOMS, alors que l'état
  // ne porte que des identifiants.
  const selectedStackNames = stackOptions
    .filter((option) => stackIds.includes(option.id))
    .map((option) => option.name);

  // AC3 — Suggestion d'identifiant à partir du titre, EN CRÉATION UNIQUEMENT.
  //
  // ⚠️ Jamais en modification : un projet publié a une URL que des liens
  // externes pointent déjà. Renommer son titre ne doit pas changer son slug en
  // douce et casser ces liens — Jeevons doit le faire explicitement.
  //
  // La suggestion s'arrête dès que l'utilisateur touche le champ lui-même
  // (`slugTouched`) : à partir de là, son choix prime sur le nôtre.
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const slugRef = useRef<HTMLInputElement | null>(null);

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (slugTouched) return;
    const suggestion = slugify(event.target.value);
    setValue("slug", suggestion, { shouldValidate: false });
  };

  // Les erreurs SERVEUR sont réinjectées dans `react-hook-form` pour s'afficher
  // exactement comme les erreurs client (même emplacement, même style). Sans
  // cela, un refus serveur apparaîtrait dans un bandeau isolé et l'utilisateur
  // devrait deviner quel champ corriger.
  const serverFieldErrors = state.fieldErrors;
  useEffect(() => {
    // `trigger()` revalide côté client après un retour serveur en erreur : les
    // deux jeux de messages convergent alors sur le schéma partagé.
    if (state.status === "error") {
      void trigger();
    }
  }, [state, trigger]);

  /** Message d'erreur d'un champ : la version serveur prime (elle est finale). */
  const errorFor = (field: keyof ProjectFormValues): string | undefined =>
    serverFieldErrors[field] ?? errors[field]?.message;

  const fieldClass = (field: keyof ProjectFormValues) =>
    cn(
      "rounded-md border bg-transparent px-3 py-2 text-sm",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      errorFor(field) ? "border-destructive" : "border-border",
    );

  return (
    // AC3 — Deux colonnes : formulaire à gauche, aperçu à droite (« un aperçu de
    // la carte du projet s'affiche À CÔTÉ »). Sous `xl`, l'aperçu passe SOUS le
    // formulaire plutôt que de comprimer les deux : côte à côte sur un écran
    // étroit, ni l'un ni l'autre ne serait utilisable.
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <form action={formAction} className="flex flex-col gap-6" noValidate>
        {/* En modification, l'identifiant du projet accompagne la soumission. */}
        {isEdit ? <input type="hidden" name="id" value={project.id} /> : null}

        {/* Message GLOBAL (conflit de slug, session expirée, panne). `role="alert"`
            : annoncé par les lecteurs d'écran dès son apparition. */}
        {state.message ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground"
          >
            {state.message}
          </p>
        ) : null}

        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            label="Titre"
            name="title"
            required
            error={errorFor("title")}
            className="sm:col-span-2"
          >
            <input
              id="title"
              type="text"
              className={fieldClass("title")}
              aria-invalid={errorFor("title") ? true : undefined}
              aria-describedby={errorFor("title") ? "title-error" : undefined}
              {...register("title")}
              // `register` pose déjà un `onChange` : on le compose plutôt que de
              // l'écraser, sinon react-hook-form ne verrait plus la saisie.
              onChange={(event) => {
                void register("title").onChange(event);
                handleTitleChange(event);
              }}
            />
          </Field>

          <Field
            label="Identifiant d'URL"
            name="slug"
            required
            error={errorFor("slug")}
            hint={
              isEdit
                ? "Attention : le modifier change l'adresse publique du projet."
                : "Proposé automatiquement à partir du titre. Minuscules, chiffres et tirets."
            }
          >
            <input
              id="slug"
              type="text"
              className={fieldClass("slug")}
              aria-invalid={errorFor("slug") ? true : undefined}
              aria-describedby={cn(
                "slug-hint",
                errorFor("slug") ? "slug-error" : "",
              ).trim()}
              {...register("slug")}
              ref={(element) => {
                register("slug").ref(element);
                slugRef.current = element;
              }}
              onChange={(event) => {
                void register("slug").onChange(event);
                // Dès la première frappe dans le champ, la suggestion se retire.
                setSlugTouched(true);
              }}
            />
          </Field>

          <Field
            label="Catégorie"
            name="category"
            required
            error={errorFor("category")}
          >
            <select
              id="category"
              className={fieldClass("category")}
              aria-invalid={errorFor("category") ? true : undefined}
              aria-describedby={
                errorFor("category") ? "category-error" : undefined
              }
              {...register("category")}
            >
              {Object.values(ProjectCategory).map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Entreprise"
            name="company"
            required
            error={errorFor("company")}
          >
            <input
              id="company"
              type="text"
              className={fieldClass("company")}
              aria-invalid={errorFor("company") ? true : undefined}
              aria-describedby={
                errorFor("company") ? "company-error" : undefined
              }
              {...register("company")}
            />
          </Field>

          <Field
            label="Période"
            name="period"
            required
            error={errorFor("period")}
            hint="Ex. « Janvier - 2024 »."
          >
            <input
              id="period"
              type="text"
              className={fieldClass("period")}
              aria-invalid={errorFor("period") ? true : undefined}
              aria-describedby={cn(
                "period-hint",
                errorFor("period") ? "period-error" : "",
              ).trim()}
              {...register("period")}
            />
          </Field>

          <Field
            label="Résultat chiffré"
            name="outcome"
            error={errorFor("outcome")}
            hint="Ex. « +38 % de conversion ». Laissez vide si ce projet n'en a pas : la section sera simplement masquée sur le site."
            className="sm:col-span-2"
          >
            <input
              id="outcome"
              type="text"
              className={fieldClass("outcome")}
              aria-invalid={errorFor("outcome") ? true : undefined}
              aria-describedby={cn(
                "outcome-hint",
                errorFor("outcome") ? "outcome-error" : "",
              ).trim()}
              {...register("outcome")}
            />
          </Field>

          <Field
            label="Description"
            name="description"
            error={errorFor("description")}
            className="sm:col-span-2"
          >
            <textarea
              id="description"
              rows={5}
              className={fieldClass("description")}
              aria-invalid={errorFor("description") ? true : undefined}
              aria-describedby={
                errorFor("description") ? "description-error" : undefined
              }
              {...register("description")}
            />
          </Field>

          <Field
            label="Lien du projet"
            name="link"
            error={errorFor("link")}
            hint="URL complète, ou vide."
          >
            <input
              id="link"
              type="url"
              inputMode="url"
              placeholder="https://…"
              className={fieldClass("link")}
              aria-invalid={errorFor("link") ? true : undefined}
              aria-describedby={cn(
                "link-hint",
                errorFor("link") ? "link-error" : "",
              ).trim()}
              {...register("link")}
            />
          </Field>

          <Field
            label="Dépôt de code"
            name="repoUrl"
            error={errorFor("repoUrl")}
            hint="URL complète, ou vide."
          >
            <input
              id="repoUrl"
              type="url"
              inputMode="url"
              placeholder="https://…"
              className={fieldClass("repoUrl")}
              aria-invalid={errorFor("repoUrl") ? true : undefined}
              aria-describedby={cn(
                "repoUrl-hint",
                errorFor("repoUrl") ? "repoUrl-error" : "",
              ).trim()}
              {...register("repoUrl")}
            />
          </Field>
        </div>

        {/* AC1 — points forts : ajout / modification / suppression sans limite,
          et réordonnancement dont l'ordre est persisté. */}
        <HighlightsEditor initial={highlights} onChange={setHighlights} />

        {/* AC2 — association de technologies EXISTANTES (la création est 5.15). */}
        <StacksSelector
          options={stackOptions}
          selected={stackIds}
          onChange={setStackIds}
        />

        {/* `published` exposé SIMPLEMENT (piège n°6) : la mécanique brouillon /
          aperçu `?preview=1` est la story 5.11. */}
        <label className="flex w-fit items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded border-border"
            {...register("published")}
          />
          <span>
            Publié sur le site
            <span className="block text-xs text-muted-foreground">
              Décoché, le projet reste un brouillon visible de vous seul.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending
              ? "Enregistrement…"
              : isEdit
                ? "Enregistrer les modifications"
                : "Créer le projet"}
          </Button>
          <Link
            href="/admin/projects"
            className={cn(buttonVariants({ variant: "ghost" }))}
          >
            Annuler
          </Link>
        </div>
      </form>

      {/* AC3 — L'aperçu est HORS du `<form>` : il ne poste rien et n'a pas à
          participer à la soumission. Il ne consomme que l'état client, ce qui
          lui permet de refléter des données pas encore enregistrées. */}
      <ProjectPreview
        company={liveCompany ?? ""}
        period={livePeriod ?? ""}
        title={liveTitle ?? ""}
        outcome={liveOutcome ?? ""}
        link={liveLink ?? ""}
        highlights={highlights.map((draft) => draft.label)}
        stackNames={selectedStackNames}
      />
    </div>
  );
}

/**
 * Enveloppe d'un champ : libellé lié, indice optionnel, message d'erreur.
 *
 * Factorisé pour que TOUS les champs portent la même structure d'accessibilité
 * (`<label for>`, `aria-describedby`, `role="alert"`) — une seule
 * implémentation, aucune divergence possible d'un champ à l'autre.
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
