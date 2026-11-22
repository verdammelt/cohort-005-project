import { sectionsFor } from "./lib/sections";
import type { LessonSection, LessonSectionsInput } from "./lib/sections";

export type { LessonSection, LessonSectionsInput };

/**
 * The sections of the lesson page a viewer sees, top to bottom.
 * The prev/next navigation is not a section: it always closes the page.
 */
export function lessonSections(input: LessonSectionsInput): LessonSection[] {
  return sectionsFor(input);
}
