"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { MediaSelector } from "@/components/admin/media-selector";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  slugify,
  timelineEntrySchema,
  type TimelineEntryFormValues,
} from "@/lib/schemas/timeline";
import { cn } from "@/lib/utils";

import {
  createTimelineEntryAction,
  updateTimelineEntryAction,
  type TimelineFormState,
} from "./actions";

// Story 5.14 — Formulaire d'une entrée de parcours, création ET modification
// (AC1, AC3).
//
// Applique la MÊME mécanique que le formulaire de projet (5.8), dont il reprend
// la double validation sur un schéma unique :
//  - CLIENT : `react-hook-form` + `zodResolver(timelineEntrySchema)` → l'erreur
//    s'affiche sous le champ dès qu'il perd le focus, sans aller-retour ;
//  - SERVEUR : la Server Action revalide avec LE MÊME schéma et renvoie ses
//    erreurs dans `state.fieldErrors` — affichées au même endroit.
// Le client est donc un CONFORT, jamais une garantie.
//
// ⚠️ `<form action={formAction}>` (et non `handleSubmit`) : la soumission passe
// par la Server Action native de React 19, donc le formulaire fonctionne MÊME
// sans JavaScript. `react-hook-form` se greffe en mode `onBlur` pour l'affichage
// instantané, sans intercepter l'envoi.
//
// ⚠️ Pas d'aperçu live ici, contrairement au formulaire de projet : l'AC3 de
// 5.9 l'exigeait pour la carte projet, rien d'équivalent n'est demandé pour le
// parcours. En ajouter un serait du périmètre en trop (AGENTS.md §9).

const initialState: TimelineFormState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};

type TimelineFormProps = {
  /**
   * Entrée à modifier, ou `undefined` en création. Décide de l'action appelée,
   * du libellé du bouton et de la présence du champ caché `id`.
   */
  entry?: {
    id: string;
    slug: string;
    title: string;
    place: string;
    body: string;
    startYear: number;
    /** `null` = entrée toujours en cours (AC1). */
    endYear: number | null;
    avatarId: string | null;
    published: boolean;
  };
};

export function TimelineForm({ entry }: TimelineFormProps) {
  const isEdit = entry !== undefined;

  const [state, formAction, pending] = useActionState(
    isEdit ? updateTimelineEntryAction : createTimelineEntryAction,
    initialState,
  );

  const {
    register,
    formState: { errors },
    setValue,
    trigger,
  } = useForm<TimelineEntryFormValues>({
    resolver: zodResolver(timelineEntrySchema),
    // `onBlur` : on ne harcèle pas pendant la frappe, mais un champ invalide est
    // signalé avant d'atteindre le bouton d'envoi.
    mode: "onBlur",
    defaultValues: {
      slug: entry?.slug ?? "",
      title: entry?.title ?? "",
      place: entry?.place ?? "",
      body: entry?.body ?? "",
      // Les `<input>` contrôlés exigent une chaîne : un `number` ou un `null`
      // ferait basculer React en non-contrôlé et déclencherait un avertissement.
      startYear: entry?.startYear.toString() ?? "",
      // AC1 — `null` (entrée en cours) devient un champ VIDE, et le schéma
      // refera le chemin inverse à la soumission. C'est ce qui permet de
      // rouvrir une entrée en cours sans qu'une année n'apparaisse de nulle part.
      endYear: entry?.endYear?.toString() ?? "",
      // ⚠️ `published` par défaut à `false` EN CRÉATION, alors que la colonne
      // vaut `@default(true)` en base (héritage 4.2, pour le seed). Décision
      // Jeevons : même geste que pour un projet, on ne publie jamais par
      // inadvertance (AC3). En modification, on reprend la valeur réelle.
      published: entry?.published ?? false,
      // L'illustration n'est PAS pilotée par react-hook-form : le sélecteur gère
      // aussi le téléversement et a son propre état local (ci-dessous). La
      // valeur par défaut reste présente pour satisfaire le type du schéma.
      avatarId: null,
    },
  });

  // Illustration sélectionnée. `null` = entrée sans image, état valide (AC1).
  const [avatarId, setAvatarId] = useState<string | null>(
    () => entry?.avatarId ?? null,
  );

  // Suggestion d'identifiant à partir de l'intitulé, EN CRÉATION UNIQUEMENT.
  //
  // ⚠️ Jamais en modification : le `slug` est la CLÉ NATURELLE du seed
  // (`@unique`, décision 4.2). Le changer en douce parce qu'on a corrigé un
  // intitulé casserait l'idempotence de l'upsert, qui recréerait alors une
  // entrée en double au lieu de mettre à jour l'existante.
  //
  // La suggestion s'arrête dès que l'utilisateur touche le champ lui-même :
  // à partir de là, son choix prime sur le nôtre.
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const slugRef = useRef<HTMLInputElement | null>(null);

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (slugTouched) return;
    setValue("slug", slugify(event.target.value), { shouldValidate: false });
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
  const errorFor = (field: keyof TimelineEntryFormValues): string | undefined =>
    serverFieldErrors[field] ?? errors[field]?.message;

  const fieldClass = (field: keyof TimelineEntryFormValues) =>
    cn(
      "rounded-md border bg-transparent px-3 py-2 text-sm",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      errorFor(field) ? "border-destructive" : "border-border",
    );

  const slugRegister = register("slug");

  return (
    <form
      action={formAction}
      className="flex max-w-3xl flex-col gap-6"
      noValidate
    >
      {/* En modification, l'identifiant de l'entrée accompagne la soumission. */}
      {isEdit ? <input type="hidden" name="id" value={entry.id} /> : null}

      {/* Message GLOBAL (conflit d'identifiant, session expirée, panne).
          `role="alert"` : annoncé dès son apparition. */}
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
          label="Intitulé"
          name="title"
          required
          error={errorFor("title")}
          hint="Ex. : BUT Métiers du multimédia et de l'Internet"
        >
          <input
            id="title"
            type="text"
            className={fieldClass("title")}
            aria-describedby="title-hint"
            aria-invalid={errorFor("title") ? true : undefined}
            {...register("title")}
            // ⚠️ `onChange` explicite APRÈS le spread : `register` en pose un,
            // que l'on doit appeler nous-mêmes pour ne pas le court-circuiter.
            // L'oublier ferait perdre la validation du champ.
            onChange={(event) => {
              void register("title").onChange(event);
              handleTitleChange(event);
            }}
          />
        </Field>

        <Field
          label="Lieu"
          name="place"
          required
          error={errorFor("place")}
          hint="Ex. : IUT de Tours"
        >
          <input
            id="place"
            type="text"
            className={fieldClass("place")}
            aria-describedby="place-hint"
            aria-invalid={errorFor("place") ? true : undefined}
            {...register("place")}
          />
        </Field>

        <Field
          label="Identifiant"
          name="slug"
          required
          error={errorFor("slug")}
          hint={
            isEdit
              ? "Clé stable de l'entrée. Ne la modifiez qu'en connaissance de cause."
              : "Proposé à partir de l'intitulé. Minuscules, chiffres et tirets."
          }
          className="sm:col-span-2"
        >
          <input
            id="slug"
            type="text"
            className={fieldClass("slug")}
            aria-describedby="slug-hint"
            aria-invalid={errorFor("slug") ? true : undefined}
            {...slugRegister}
            ref={(element) => {
              slugRegister.ref(element);
              slugRef.current = element;
            }}
            // Dès que l'utilisateur saisit lui-même l'identifiant, la suggestion
            // automatique cesse : son choix prime.
            onChange={(event) => {
              setSlugTouched(true);
              void slugRegister.onChange(event);
            }}
          />
        </Field>

        <Field
          label="Année de début"
          name="startYear"
          required
          error={errorFor("startYear")}
        >
          <input
            id="startYear"
            type="number"
            inputMode="numeric"
            className={fieldClass("startYear")}
            aria-invalid={errorFor("startYear") ? true : undefined}
            {...register("startYear")}
          />
        </Field>

        {/* AC1 — « une entrée toujours en cours peut être enregistrée sans année
            de fin ». Le champ est donc FACULTATIF, et l'indice le dit
            explicitement : laisser vide n'est pas un oubli, c'est une
            information. */}
        <Field
          label="Année de fin"
          name="endYear"
          error={errorFor("endYear")}
          hint="Laissez vide si c'est toujours en cours."
        >
          <input
            id="endYear"
            type="number"
            inputMode="numeric"
            className={fieldClass("endYear")}
            aria-describedby="endYear-hint"
            aria-invalid={errorFor("endYear") ? true : undefined}
            {...register("endYear")}
          />
        </Field>
      </div>

      <Field
        label="Texte"
        name="body"
        required
        error={errorFor("body")}
        hint="Ce que vous y avez fait, en quelques phrases."
      >
        <textarea
          id="body"
          rows={6}
          className={fieldClass("body")}
          aria-describedby="body-hint"
          aria-invalid={errorFor("body") ? true : undefined}
          {...register("body")}
        />
      </Field>

      {/* AC1 — Illustration : téléversement ou reprise d'une image de la
          bibliothèque, sans quitter le formulaire. Composant PARTAGÉ avec le
          formulaire de projet (5.12), généralisé par la story 5.14. */}
      <MediaSelector
        name="avatarId"
        legend="Illustration"
        removeLabel="Retirer l'illustration"
        pickerLabel="Choisir une illustration"
        emptyLabel="Aucune image dans la bibliothèque. Téléversez-en une pour illustrer cette entrée."
        value={avatarId}
        onChange={setAvatarId}
        error={errorFor("avatarId")}
      />

      {/* AC3 — Une entrée non publiée n'apparaît pas sur le site public. */}
      <label className="flex w-fit items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="size-4 rounded border-border"
          {...register("published")}
        />
        <span>
          Publiée sur le site
          <span className="block text-xs text-muted-foreground">
            Décochée, l&apos;entrée reste un brouillon visible de vous seul.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Enregistrement…"
            : isEdit
              ? "Enregistrer les modifications"
              : "Créer l'entrée"}
        </Button>
        <Link
          href="/admin/timeline"
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
 * Même structure que celle du formulaire de projet (5.8) : `<label for>`,
 * `aria-describedby`, `role="alert"` — pour que tous les champs de
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
