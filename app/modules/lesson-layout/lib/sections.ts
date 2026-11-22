export type LessonSection =
  | "video"
  | "content"
  | "empty"
  | "quiz"
  | "progress"
  | "note"
  | "discussion";

export type LessonSectionsInput = {
  hasVideo: boolean;
  hasContent: boolean;
  hasQuiz: boolean;
  signedIn: boolean;
  enrolled: boolean;
};

export function sectionsFor(input: LessonSectionsInput): LessonSection[] {
  const { hasVideo, hasContent, hasQuiz, signedIn, enrolled } = input;
  const learning = signedIn && enrolled;

  const shown: Record<LessonSection, boolean> = {
    video: hasVideo,
    content: hasContent,
    empty: !hasVideo && !hasContent,
    quiz: hasQuiz && learning,
    progress: learning,
    // Beside the discussion, after the lesson itself: a Student reported the
    // note in the middle of the page as interrupting the lesson (issue #58).
    note: signedIn,
    discussion: true,
  };

  return ORDER.filter((section) => shown[section]);
}

const ORDER: LessonSection[] = [
  "video",
  "content",
  "empty",
  "quiz",
  "progress",
  "note",
  "discussion",
];
