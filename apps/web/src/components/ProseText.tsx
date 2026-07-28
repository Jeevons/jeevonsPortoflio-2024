// Rendu d'un texte libre saisi en administration (`description` d'un projet,
// story 6.10) sous forme de PARAGRAPHES.
//
// 🛑 POURQUOI CE COMPOSANT : le champ est un `<textarea>` — Jeevons y saisit
// naturellement des paragraphes séparés par une ligne vide. Rendu tel quel dans
// un unique `<p>`, le HTML écrase ces sauts de ligne : une description longue
// devient un pavé compact et illisible.
//
// ❌ PAS DE MARKDOWN, PAS DE `dangerouslySetInnerHTML` : le texte reste du texte
// brut, inséré par React (donc échappé). On ne fait qu'interpréter les
// séparations de lignes, sans ouvrir la porte à l'injection de HTML.
//
// ⚠️ AUCUN `"use client"` : vue pure, sans état (AGENTS.md §6). Utilisable
// depuis la page serveur comme depuis l'aperçu admin.

type ProseTextProps = {
  /** Texte brut saisi en administration. */
  children: string;
  className?: string;
};

/**
 * Découpe le texte en paragraphes sur les lignes vides.
 *
 * ⚠️ Tolère `\r\n` (saisie depuis Windows) et les lignes vides multiples ou
 * remplies d'espaces : sans quoi une frappe un peu libre produirait des
 * paragraphes fantômes.
 */
const toParagraphs = (text: string) =>
  text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

export const ProseText = ({ children, className }: ProseTextProps) => {
  const paragraphs = toParagraphs(children);

  if (paragraphs.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {paragraphs.map((paragraph, index) => (
        /* `mt-*` plutôt que `space-y-*` sur le parent : le premier paragraphe
           ne doit pas décoller du titre qui le précède. */
        <p key={index} className={index > 0 ? "mt-4" : undefined}>
          {/* Un saut de ligne SIMPLE à l'intérieur d'un paragraphe reste un
              saut de ligne (liste d'éléments, adresse…), sans créer un nouveau
              paragraphe. */}
          {paragraph.split("\n").map((line, lineIndex) => (
            <span key={lineIndex}>
              {lineIndex > 0 ? <br /> : null}
              {line.trim()}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
};
