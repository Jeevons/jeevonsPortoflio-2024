import { type ProjectCardData } from "@/components/ProjectCard";
import { ProjectCardInteractive } from "@/components/ProjectCardInteractive";
import { Reveal } from "@/components/Reveal";
import { SectionHeader } from "@/components/SectionHeader";

// Contrat de donnée d'un projet, partagé par les deux sections.
// Sert de contrat stable pour l'Epic 4 (branchement DB) : le composant ne
// connaît que cette forme, pas la façon dont les projets ont été obtenus (AC3).
//
// Story 5.9 : la forme est désormais définie par `ProjectCard`, seul rendu de la
// carte. Le ré-export préserve les imports existants (`Projects.tsx`,
// `SelfProject.tsx`) — aucun appelant n'a eu à changer.
export type Project = ProjectCardData;

type ProjectListProps = {
  id: string; // "projects" | "side-projects" — ancres posées en Epic 1 (AC2)
  eyebrow: string;
  title: string;
  description: string;
  projects: Project[]; // données injectées, source-agnostique (AC3)
};

// Composant de présentation unique consommé par ProjectsSection et
// SelfProjectsSection. Aucune donnée ni image importée ici : tout arrive en
// props (AC3).
//
// Story 5.9 : le rendu d'UNE carte a migré dans `ProjectCard`, pour que
// l'aperçu de l'éditeur admin affiche exactement la même carte que le visiteur
// (AC3 de 5.9). Cette liste ne garde que ce qui lui est propre : l'entête de
// section et l'empilement `sticky`.
export const ProjectList = ({
  id,
  eyebrow,
  title,
  description,
  projects,
}: ProjectListProps) => {
  return (
    <section className="pb-16 lg:py-24" id={id}>
      <div className="container">
        {/* Story 6.4 — l'entête se révèle normalement : elle n'est pas
            `sticky`, le déplacement vertical y est sans risque. */}
        <Reveal>
          <SectionHeader
            eyebrow={eyebrow}
            title={title}
            description={description}
          />
        </Reveal>

        {/* 🛑 `fadeOnly` OBLIGATOIRE ICI : ce conteneur est l'ANCÊTRE des cartes
            `sticky`. Un `transform`, même `translateY(0)`, ferait de lui leur
            containing block et casserait l'empilement (piège n°2). Le fondu
            seul n'introduit aucun `transform` — vérifié à la sonde SSR. */}
        <Reveal fadeOnly className="mt-10 md:mt-20 flex flex-col  gap-20">
          {projects.map((project, projectIndex) => (
            /* Story 6.4 (piège n°2) — LES CARTES NE SONT PAS ENVELOPPÉES, et
               c'est le choix prudent assumé.

               L'empilement `sticky` est la signature visuelle de la section.
               Deux façons de le casser, toutes deux écartées ici :
               (a) un wrapper animé rend le `sticky` enfant d'un élément porteur
                   de `transform`, ce qui change son containing block ;
               (b) même en déplaçant `sticky` sur le wrapper, on insère un
                   niveau d'empilement supplémentaire entre le conteneur et le
                   `relative z-0` de `Card` — l'ordre de superposition des
                   cartes qui se chevauchent peut alors changer.

               La story prévoit explicitement ce repli : « si conflit : révéler
               le CONTENEUR DE SECTION plutôt que chaque carte ». C'est ce que
               fait la `Reveal` posée sur l'entête et sur le conteneur de la
               liste ci-dessus : la section se révèle à l'entrée, sans qu'aucune
               carte ne soit touchée. La cascade, elle, reste portée par les
               listes qui n'ont pas cette contrainte (hobbies, toolbox). */
            /* Story 6.8 — L'INCLINAISON S'APPLIQUE AU NŒUD `sticky` LUI-MÊME.

               🛑 `sticky` reste EXACTEMENT là où il était : dans la classe
               passée à la carte. `ProjectCardInteractive` n'ajoute AUCUN nœud
               enveloppant — il transmet ses `transform` à cette même racine.
               C'est la seule structure qui préserve à la fois l'empilement
               (un `transform` sur un ANCÊTRE le casserait) et la mise en garde
               (b) de la story 6.4 rappelée ci-dessus (un niveau d'empilement
               supplémentaire changerait l'ordre de superposition).

               ⚠️ L'aperçu admin (`project-preview.tsx`) importe `ProjectCard`
               NU, sans cette enveloppe : il reste donc sans tilt ni halo. */
            /* Story 6.10 (AC6) — LE LIEN VERS LA FICHE EST ACTIVÉ ICI, ET
               SEULEMENT ICI. `project-preview.tsx` (aperçu admin) importe
               `ProjectCard` nu, sans cette prop : son aperçu ne pointe donc
               jamais vers `/projects/[slug]`, qui renverrait un 404 sur un
               projet encore en brouillon. */
            <ProjectCardInteractive
              key={project.title}
              project={project}
              detailLink
              className="project-card-highlight px-8 pt-8 pb-8 md:pt-12 md:pb-12 m:px-10 lg:pt-16 lg:pb-16 lg:px-20 sticky"
              // Décalage croissant : les cartes s'empilent en défilant.
              style={{
                top: `calc(64px + ${projectIndex * 40}px)`,
              }}
            />
          ))}
        </Reveal>
      </div>
    </section>
  );
};
